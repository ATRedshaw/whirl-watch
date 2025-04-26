"""
All auth / login / register / token related endpoints.
Logic copied verbatim, only the imports / blueprint wiring changed.
"""
import secrets
from flask import Blueprint, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.exceptions import BadRequest, Unauthorized, Forbidden
from sqlalchemy.exc import IntegrityError
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    jwt_required,
    get_jwt_identity,
)
from extensions import db, limiter
from models import User, VerificationCode
from utils.email_utils import send_verification_email

auth_bp = Blueprint("auth_bp", __name__, url_prefix="/api")


# ---------------------------- Register ---------------------------- #
@auth_bp.route("/register", methods=["POST"])
@limiter.limit("3 per hour")
def register():
    try:
        data = request.get_json()
        if not data:
            raise BadRequest("No input data provided")

        required_fields = ["username", "email", "password"]
        for field in required_fields:
            if field not in data:
                raise BadRequest(f"Missing required field: {field}")

        # Unique username / email checks
        if User.query.filter_by(username=data["username"]).first():
            raise BadRequest("Username already exists")
        if User.query.filter_by(email=data["email"]).first():
            raise BadRequest("Email already exists")

        # Check if this is the first user (id=1)
        is_first_user = User.query.count() == 0

        user = User(
            username=data["username"],
            email=data["email"],
            password_hash=generate_password_hash(data["password"]),
            email_verified=False,
            is_admin=is_first_user,  # First user is admin
            is_privilege=is_first_user,  # First user is privileged
        )

        try:
            db.session.add(user)
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            raise BadRequest("Username or email already exists")

        # generate & store verification code
        verification_code = "".join(
            secrets.choice("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ") for _ in range(6)
        )
        db.session.add(
            VerificationCode(
                user_id=user.id,
                code=verification_code,
                purpose="email_verification",
            )
        )
        db.session.commit()

        # send email
        if not send_verification_email(
            user.email, verification_code, user.username, purpose="email_verification"
        ):
            raise Exception("Failed to send verification email")

        return (
            jsonify(
                {
                    "message": "User created successfully. Please check your email for verification code.",
                    "user": {
                        "id": user.id,
                        "username": user.username,
                        "email": user.email,
                        "requires_verification": True,
                        "is_admin": user.is_admin,
                        "is_privilege": user.is_privilege,
                    },
                }
            ),
            201,
        )

    except BadRequest as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# ------------------------------ Login ----------------------------- #
@auth_bp.route("/login", methods=["POST"])
@limiter.limit("10 per hour")
def login():
    try:
        data = request.get_json() or {}
        if "username" not in data or "password" not in data:
            raise BadRequest("Missing username or password")

        user = User.query.filter_by(username=data["username"]).first()
        if not user or not check_password_hash(user.password_hash, data["password"]):
            raise Unauthorized("Invalid credentials")

        if not user.email_verified:
            return (
                jsonify(
                    {
                        "error": "Email not verified",
                        "requires_verification": True,
                        "email": user.email,
                    }
                ),
                403,
            )

        access_token = create_access_token(identity=user.id)
        refresh_token = create_refresh_token(identity=user.id)

        return (
            jsonify(
                {
                    "access_token": access_token,
                    "refresh_token": refresh_token,
                    "user": {
                        "id": user.id, 
                        "username": user.username, 
                        "email": user.email,
                        "is_admin": user.is_admin,
                        "is_privilege": user.is_privilege
                    },
                }
            ),
            200,
        )

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# --------------------------- Refresh ------------------------------ #
@auth_bp.route("/refresh", methods=["POST"])
@jwt_required(refresh=True)
def refresh():
    try:
        current_user_id = get_jwt_identity()
        access_token = create_access_token(identity=current_user_id)
        return jsonify({"access_token": access_token}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ------------------------- Verify Token --------------------------- #
@auth_bp.route("/verify-token", methods=["GET"])
@jwt_required()
def verify_token():
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get_or_404(current_user_id)
        return (
            jsonify(
                {"user": {
                    "id": user.id, 
                    "username": user.username, 
                    "email": user.email,
                    "is_admin": user.is_admin,
                    "is_privilege": user.is_privilege
                }}
            ),
            200,
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500
