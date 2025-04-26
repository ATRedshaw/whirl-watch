"""
Helper utilities that multiple blueprints rely on.
No logic has been changed – only moved.
"""
import math
from datetime import datetime
from flask import request, current_app
from sqlalchemy.exc import SQLAlchemyError
from werkzeug.exceptions import NotFound

from extensions import db
from models import MediaList, SharedList
from flask_limiter.errors import RateLimitExceeded


# ------------------- List / User count helpers ------------------- #
def get_list_user_count(list_id):
    """Return owner + number of shared users for a given list."""
    try:
        shared_count = SharedList.query.filter_by(list_id=list_id).count()
        return shared_count + 1  # +1 for owner
    except SQLAlchemyError as e:
        current_app.logger.error(f"Error counting list users: {e}")
        return 0


def get_user_list_count(user_id):
    """Return how many lists (owned + shared) a user is part of."""
    try:
        owned = MediaList.query.filter_by(owner_id=user_id).count()
        shared = SharedList.query.filter_by(user_id=user_id).count()
        return owned + shared
    except SQLAlchemyError as e:
        current_app.logger.error(f"Error counting user lists: {e}")
        return 0


# ------------------- Rate-limit helper utils ------------------- #
def get_retry_after():
    """
    Map endpoints to custom retry-after seconds.
    Mirrors the dictionary from the original monolith.
    """
    # Debug: Log the actual endpoint being checked
    current_app.logger.info(f"Checking rate limit for endpoint: {request.endpoint}")
    
    endpoint_limits = {
        # Auth blueprint endpoints
        'login': 3600,
        'auth_bp.login': 3600,
        'register': 3600,
        'auth_bp.register': 3600,
        
        # User blueprint endpoints
        'update_profile': 3600,
        'user_bp.update_profile': 3600,
        'delete_account': 3600,
        'user_bp.delete_profile': 3600,
        
        # Email verification endpoints
        'verify_email': 900,
        'email_verification_bp.verify_email': 900,
        'resend_verification': 900,
        'email_verification_bp.resend_verification': 900,
        
        # Password reset endpoints
        'request_password_reset': 3600,
        'password_reset_bp.request_password_reset': 3600,
        'verify_reset_code': 900,
        'password_reset_bp.verify_reset_code': 900,
        'complete_password_reset': 3600,
        'password_reset_bp.complete_password_reset': 3600,
        
        # Media endpoints
        'get_media_suggestions': 86400,  # 24 hours for suggestions endpoint
        'media_bp.get_media_suggestions': 86400,  # Blueprint-prefixed version
    }
    return endpoint_limits.get(request.endpoint, current_app.config.get('ENDPOINT_LIMIT_DEFAULT', 300))


def format_retry_message(retry_after: int) -> str:
    """Pretty human readable message used in RateLimit error-handler."""
    if retry_after >= 3600:
        hours = math.ceil(retry_after / 3600)
        return f"Too many attempts. Please try again in {hours} {'hour' if hours == 1 else 'hours'}"
    minutes = math.ceil(retry_after / 60)
    return f"Too many attempts. Please try again in {minutes} {'minute' if minutes == 1 else 'minutes'}"
