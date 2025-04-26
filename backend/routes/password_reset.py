"""
Everything related to password-reset flows.
"""
import secrets
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify
from werkzeug.exceptions import BadRequest
from flask_jwt_extended import (
    create_access_token,
    jwt_required,
    get_jwt_identity,
)
from extensions import db, limiter
from models import User, VerificationCode
from utils.email_utils import send_verification_email
from werkzeug.security import generate_password_hash

password_reset_bp = Blueprint("password_reset_bp", __name__, url_prefix="/api")


# ------------------- Request verification code ------------------- #
@password_reset_bp.route("/reset-password/request", methods=["POST"])
@limiter.limit("3 per 60 minutes")
def request_password_reset():
    try:
        data = request.get_json() or {}
        email = data.get("email")
        if not email:
            raise BadRequest("Email is required")

        user = User.query.filter_by(email=email).first()
        if not user:
            # same behaviour: silent 200 even if not found
            return jsonify({
                "message": "If an account exists with this email, a verification code will be sent",
                "status": "no_account",
            }), 200

        verification_code = "".join(
            secrets.choice("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ") for _ in range(6)
        )

        db.session.add(
            VerificationCode(
                user_id=user.id, code=verification_code, purpose="password_reset"
            )
        )
        db.session.commit()

        if not send_verification_email(user.email, verification_code, user.username):
            raise Exception("Failed to send verification email")

        return jsonify({
            "message": "If an account exists with this email, a verification code will be sent",
            "status": "code_sent",
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# --------------------- Verify the 6-digit code -------------------- #
@password_reset_bp.route("/reset-password/verify-code", methods=["POST"])
@limiter.limit("5 per 15 minutes")
def verify_reset_code():
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
                purpose="password_reset",
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
        db.session.commit()

        reset_token = create_access_token(
            identity=user.id, expires_delta=timedelta(minutes=15)
        )

        return jsonify({
            "message": "Code verified successfully",
            "reset_token": reset_token,
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# ------------------------ Complete the reset ---------------------- #
@password_reset_bp.route("/reset-password/complete", methods=["POST"])
@jwt_required()
@limiter.limit("3 per hour")
def complete_password_reset():
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get_or_404(current_user_id)

        new_password = (request.get_json() or {}).get("newPassword")
        if not new_password:
            raise BadRequest("New password is required")

        user.password_hash = generate_password_hash(new_password)
        db.session.commit()
        return jsonify({"message": "Password reset successful"}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
