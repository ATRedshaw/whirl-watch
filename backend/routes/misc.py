"""
backend/routes/misc.py
──────────────────────
This blueprint exposes a single public-facing endpoint – ``/api`` – that
returns machine-readable documentation for every other route in the
service.  The payload is self-contained so your front-end (or an API
explorer) can parse it without having to hard-code anything.

Nothing here requires authentication.
"""
from flask import Blueprint, jsonify
from config import MAX_LISTS_PER_USER, MAX_USERS_PER_LIST

misc_bp = Blueprint("misc_bp", __name__, url_prefix="/api")


@misc_bp.route("", methods=["GET"])
def api_documentation():
    """
    Return a JSON object that enumerates every available endpoint,
    its HTTP method(s), expected parameters / body shape, rate-limits,
    authentication requirements, and example response keys.

    KEEP THIS UP-TO-DATE whenever a new blueprint or route is added.
    """
    return jsonify({
        "version": "1.0",
        "description": "WhirlWatch · collaborative movie / TV tracking API",
        "endpoints": {
            # ───────────────────────── AUTH ───────────────────────── #
            "authentication": {
                "/api/register": {
                    "method": "POST",
                    "description": "Create a new account (triggers email verification).",
                    "body": {
                        "username": "string · required · 3-80 chars",
                        "email":    "string · required · valid email",
                        "password": "string · required · 6-128 chars"
                    },
                    "response": {
                        "message": "User created successfully. Please check your email for verification code.",
                        "user": {
                            "id":   "integer",
                            "username": "string",
                            "email":    "string",
                            "requires_verification": "boolean"
                        }
                    },
                    "rate_limit": "3 / hour"
                },
                "/api/login": {
                    "method": "POST",
                    "description": "Exchange credentials for access / refresh tokens.",
                    "body": {
                        "username": "string · required",
                        "password": "string · required"
                    },
                    "response": {
                        "access_token":  "string",
                        "refresh_token": "string",
                        "user": {
                            "id": "integer",
                            "username": "string",
                            "email": "string"
                        }
                    },
                    "rate_limit": "10 / hour"
                },
                "/api/refresh": {
                    "method": "POST",
                    "description": "Swap a valid refresh token for a new access token.",
                    "authentication": "JWT *refresh* token required",
                    "response": {
                        "access_token": "string"
                    },
                    "rate_limit": "none"
                },
                "/api/verify-token": {
                    "method": "GET",
                    "description": "Quick way for the front-end to verify an access token and fetch the current user object.",
                    "authentication": "JWT bearer token required",
                    "response": {
                        "user": {
                            "id": "integer",
                            "username": "string",
                            "email": "string"
                        }
                    },
                    "rate_limit": "none"
                }
            },

            # ────────────────── EMAIL VERIFICATION ────────────────── #
            "email_verification": {
                "/api/verify-email": {
                    "method": "POST",
                    "description": "Confirm account using the 6-digit code sent via email.",
                    "body": {
                        "email": "string · required",
                        "code":  "string · required · 6 characters"
                    },
                    "response": {
                        "message": "Email verified successfully",
                        "access_token":  "string",
                        "refresh_token": "string",
                        "user": {
                            "id": "integer",
                            "username": "string",
                            "email": "string"
                        }
                    },
                    "rate_limit": "5 / 15 min"
                },
                "/api/resend-verification": {
                    "method": "POST",
                    "description": "Send a fresh 6-digit code (useful if the previous one expired).",
                    "body": { "email": "string · required" },
                    "response": { "message": "Verification code sent successfully" },
                    "rate_limit": "2 / 15 min"
                }
            },

            # ───────────────────── PASSWORD RESET ──────────────────── #
            "password_reset": {
                "/api/reset-password/request": {
                    "method": "POST",
                    "description": "Kick off reset flow – generates & emails a 6-digit code.",
                    "body": { "email": "string · required" },
                    "response": {
                        "message": "If an account exists with this email, a verification code will be sent",
                        "status":  "code_sent | no_account"
                    },
                    "rate_limit": "3 / 60 min"
                },
                "/api/reset-password/verify-code": {
                    "method": "POST",
                    "description": "Validate the 6-digit code, receive a short-lived JWT reset token.",
                    "body": {
                        "email": "string · required",
                        "code":  "string · required"
                    },
                    "response": {
                        "message": "Code verified successfully",
                        "reset_token": "JWT · 15 min expiry"
                    },
                    "rate_limit": "5 / 15 min"
                },
                "/api/reset-password/complete": {
                    "method": "POST",
                    "description": "Set a new password (requires the reset token from previous step).",
                    "authentication": "JWT bearer token (reset token) required",
                    "body": { "newPassword": "string · required · 6-128 chars" },
                    "response": { "message": "Password reset successful" },
                    "rate_limit": "3 / hour"
                }
            },

            # ───────────────────────── USER ────────────────────────── #
            "user": {
                "/api/user/profile": {
                    "methods": ["PUT", "DELETE"],
                    "description": "Modify account details or permanently delete the account.",
                    "authentication": "JWT bearer token required",

                    "PUT_body": {
                        "username":         "string · optional · 3-80 chars",
                        "email":            "string · optional · valid email",
                        "current_password": "string · required if changing password",
                        "new_password":     "string · optional · 6-128 chars"
                    },
                    "DELETE_body": {
                        "password": "string · required"
                    },
                    "rate_limit": {
                        "PUT": "10 / hour",
                        "DELETE": "3 / hour"
                    }
                }
            },

            # ───────────────────────── LISTS ───────────────────────── #
            "lists": {
                "/api/lists": {
                    "methods": ["GET", "POST"],
                    "description": "Fetch *all* lists the user is associated with OR create a new list.",
                    "authentication": "JWT bearer token required",
                    "POST_body": {
                        "name":        "string · required · 1-80 chars",
                        "description": "string · optional · up to 100 chars"
                    },
                    "limits": {
                        "per_user":      MAX_LISTS_PER_USER,
                        "users_per_list": MAX_USERS_PER_LIST
                    }
                },
                "/api/lists/<list_id>": {
                    "methods": ["GET", "PUT", "DELETE"],
                    "description": "Single list detail, metadata update, or delete (owner only).",
                    "authentication": "JWT bearer token required",
                    "PUT_body": {
                        "name":        "string · optional · 1-80 chars",
                        "description": "string · optional · up to 100 chars"
                    }
                },
                "/api/lists/<list_id>/share": {
                    "method": "POST",
                    "description": "Owner retrieves the list’s 8-character share code.",
                    "authentication": "JWT bearer token required"
                },
                "/api/lists/join": {
                    "method": "POST",
                    "description": "Join a list using its share code.",
                    "authentication": "JWT bearer token required",
                    "body": { "share_code": "string · required · 8 characters" },
                    "limits": {
                        "per_user":      MAX_LISTS_PER_USER,
                        "users_per_list": MAX_USERS_PER_LIST
                    }
                },
                "/api/lists/<list_id>/users": {
                    "method": "GET",
                    "description": "Owner-only – list every user who has access.",
                    "authentication": "JWT bearer token required",
                    "response": {
                        "owner":       { "id": "integer", "username": "string", "email": "string" },
                        "shared_users": [ { "id": "integer", "username": "string", "email": "string" } ]
                    }
                },
                "/api/lists/<list_id>/users/<user_id>": {
                    "method": "DELETE",
                    "description": "Owner removes a user and purges all items they added.",
                    "authentication": "JWT bearer token required"
                },
                "/api/lists/<list_id>/leave": {
                    "method": "POST",
                    "description": "Shared user voluntarily leaves a list (their items are deleted).",
                    "authentication": "JWT bearer token required"
                },

                # ──────────────── MEDIA WITHIN LISTS ───────────────── #
                "/api/lists/<list_id>/media": {
                    "methods": ["POST"],
                    "description": "Add a TMDB title to the list.",
                    "authentication": "JWT bearer token required",
                    "body": {
                        "tmdb_id":      "integer · required",
                        "media_type":   "string · required · 'movie' | 'tv'",
                        "watch_status": "string · optional · not_watched | watching | completed",
                        "rating":       "integer · optional · 1-10"
                    }
                },
                "/api/lists/<list_id>/media/<media_id>": {
                    "methods": ["PUT", "DELETE"],
                    "description": "Update watch_status / rating, or delete by internal media_id.",
                    "authentication": "JWT bearer token required",
                    "PUT_body": {
                        "watch_status": "string · optional",
                        "rating":       "integer · optional · 1-10"
                    }
                },
                "/api/lists/<list_id>/media/tmdb/<tmdb_id>": {
                    "method": "DELETE",
                    "description": "Delete by TMDB ID instead of internal media_id (convenience).",
                    "authentication": "JWT bearer token required"
                }
            },

            # ───────────────────────── MEDIA ───────────────────────── #
            "media": {
                "/api/search": {
                    "method": "GET",
                    "description": "Proxy to TMDB search API – returns movies / TV plus list membership info.",
                    "authentication": "JWT bearer token required",
                    "query_params": {
                        "query": "string · required",
                        "type":  "string · optional · movie | tv · default: movie",
                        "page":  "integer · optional · default: 1"
                    }
                },
                "/api/<media_type>/<media_id>": {
                    "method": "GET",
                    "description": "Full TMDB metadata for a single movie or show.",
                    "authentication": "JWT bearer token required",
                    "url_params": {
                        "media_type": "movie | tv",
                        "media_id":   "integer · TMDB ID"
                    }
                }
            }
        },

        # ───────────────────── AUTH SCHEME ───────────────────── #
        "authentication": {
            "type": "JWT Bearer Token",
            "header_example": "Authorization: Bearer <access_token>",
            "access_token_ttl": "30 days",
            "refresh_token_ttl": "60 days"
        },

        # ───────────────────── ERROR CODES ───────────────────── #
        "errors": {
            "400": "Bad Request · your input parameters failed validation",
            "401": "Unauthorized · token missing / expired / bad credentials",
            "403": "Forbidden · you don't have permission for that resource",
            "404": "Not Found · resource doesn't exist",
            "429": "Too Many Requests · rate-limit reached",
            "500": "Internal Server Error · unhandled exception",
            "503": "Service Unavailable · upstream TMDB error"
        }
    }), 200
