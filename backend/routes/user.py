"""
Update / delete profile endpoints.
"""
from flask import Blueprint, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.exceptions import BadRequest, Unauthorized
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db, limiter
from models import User, MediaInList, SharedList, VerificationCode

user_bp = Blueprint("user_bp", __name__, url_prefix="/api")


# ------------------------- Update profile ------------------------- #
@user_bp.route("/user/profile", methods=["PUT"])
@jwt_required()
@limiter.limit("10 per hour")
def update_profile():
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get_or_404(current_user_id)
        data = request.get_json() or {}

        if "username" in data:
            if User.query.filter(User.id != current_user_id,
                                 User.username == data["username"]).first():
                raise BadRequest("Username already exists")
            user.username = data["username"]

        if "email" in data:
            if User.query.filter(User.id != current_user_id,
                                 User.email == data["email"]).first():
                raise BadRequest("Email already exists")
            user.email = data["email"]

        if "current_password" in data and "new_password" in data:
            if not check_password_hash(user.password_hash, data["current_password"]):
                raise BadRequest("Current password is incorrect")
            user.password_hash = generate_password_hash(data["new_password"])

        db.session.commit()
        return jsonify({
            "message": "Profile updated successfully",
            "user": {"id": user.id, "username": user.username, "email": user.email},
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# ------------------------- Delete account ------------------------- #
@user_bp.route("/user/profile", methods=["DELETE"])
@jwt_required()
@limiter.limit("3 per hour")
def delete_profile():
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json() or {}
        if "password" not in data:
            raise BadRequest("Password is required to delete account")

        user = User.query.get_or_404(current_user_id)
        if not check_password_hash(user.password_hash, data["password"]):
            raise Unauthorized("Invalid password")

        # Cascade deletes (same as monolith)
        MediaInList.query.filter_by(added_by_id=current_user_id).delete()
        SharedList.query.filter_by(user_id=current_user_id).delete()
        VerificationCode.query.filter_by(user_id=current_user_id).delete()
        from models import MediaList  # local import avoids circular issue
        MediaList.query.filter_by(owner_id=current_user_id).delete()

        db.session.delete(user)
        db.session.commit()
        return jsonify({"message": "Account deleted successfully"}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
