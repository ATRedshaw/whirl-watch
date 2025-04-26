"""
Blueprint dedicated to verifying / resending email codes.
"""
import secrets
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify
from werkzeug.exceptions import BadRequest
from extensions import db, limiter
from flask_jwt_extended import create_access_token, create_refresh_token
from models import User, VerificationCode
from utils.email_utils import send_verification_email

email_verification_bp = Blueprint(
    "email_verification_bp", __name__, url_prefix="/api"
)


# ------------------------- Verify Email -------------------------- #
@email_verification_bp.route("/verify-email", methods=["POST"])
@limiter.limit("5 per 15 minutes")
def verify_email():
    try:
        data = request.get_json() or {}
        email = data.get("email")
        code = data.get("code")

        if not email or not code:
            raise BadRequest("Email and verification code are required")

        user = User.query.filter_by(email=email).first()
        if not user:
            raise BadRequest("Invalid verification code")

        verification = (
            VerificationCode.query.filter_by(
                user_id=user.id,
                code=code,
                purpose="email_verification",
                used=False,
            )
            .order_by(VerificationCode.created_at.desc())
            .first()
        )

        if not verification:
            raise BadRequest("Invalid verification code")

        if datetime.utcnow() - verification.created_at > timedelta(minutes=15):
            raise BadRequest("Verification code has expired")

        verification.used = True
        user.email_verified = True
        db.session.commit()

        access_token = create_access_token(identity=user.id)
        refresh_token = create_refresh_token(identity=user.id)

        return (
            jsonify(
                {
                    "message": "Email verified successfully",
                    "access_token": access_token,
                    "refresh_token": refresh_token,
                    "user": {"id": user.id, "username": user.username, "email": user.email},
                }
            ),
            200,
        )

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# ---------------------- Resend Verification ---------------------- #
@email_verification_bp.route("/resend-verification", methods=["POST"])
@limiter.limit("2 per 15 minutes")
def resend_verification():
    try:
        data = request.get_json() or {}
        email = data.get("email")
        if not email:
            raise BadRequest("Email is required")

        user = User.query.filter_by(email=email).first()
        if not user:
            return (
                jsonify({"message": "If an account exists with this email, a verification code will be sent"}),
                200,
            )

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

        if not send_verification_email(
            user.email, verification_code, user.username, purpose="email_verification"
        ):
            raise Exception("Failed to send verification email")

        return jsonify({"message": "Verification code sent successfully"}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
