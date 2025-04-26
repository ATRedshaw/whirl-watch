from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import User
from extensions import db

admin_bp = Blueprint('admin', __name__, url_prefix='/api/admin')

# Helper function to check if user is admin
def is_admin(user_id):
    user = User.query.get(user_id)
    return user and user.is_admin

@admin_bp.route('/users', methods=['GET'])
@jwt_required()
def get_users():
    current_user_id = get_jwt_identity()
    
    # Check if user is admin
    if not is_admin(current_user_id):
        return jsonify({"error": "Unauthorized access"}), 403
    
    users = User.query.all()
    users_data = [
        {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "is_admin": user.is_admin,
            "is_privilege": user.is_privilege,
            "email_verified": user.email_verified
        } for user in users
    ]
    
    return jsonify({"users": users_data}), 200

@admin_bp.route('/users/<int:user_id>/privilege', methods=['PUT'])
@jwt_required()
def update_user_privilege(user_id):
    current_user_id = get_jwt_identity()
    
    # Check if user is admin
    if not is_admin(current_user_id):
        return jsonify({"error": "Unauthorized access"}), 403
    
    # Get request data
    data = request.get_json()
    is_privilege = data.get('is_privilege', False)
    
    # Update user privilege
    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    
    user.is_privilege = is_privilege
    db.session.commit()
    
    return jsonify({
        "message": "User privilege updated successfully",
        "user": {
            "id": user.id,
            "username": user.username,
            "is_privilege": user.is_privilege
        }
    }), 200