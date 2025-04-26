"""
All 3rd-party extensions live here so we never create circular imports.
"""
import os
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager, get_jwt_identity
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

db = SQLAlchemy()
jwt = JWTManager()
cors = CORS()  # resources will be configured in app.create_app()

# Custom key function that exempts privileged users from rate limits
def get_rate_limit_key():
    try:
        # Get the current user's ID
        current_user_id = get_jwt_identity()
        
        if current_user_id:
            # Import here to avoid circular imports
            from models import User
            
            # Check if the user has privilege status in the database
            user = User.query.get(current_user_id)
            if user and user.is_privilege:
                # Return None for privileged users to bypass rate limits completely
                return None
        
        # For regular users, use IP + user ID to prevent sharing rate limits
        return f"{get_remote_address()}:{current_user_id}" if current_user_id else get_remote_address()
    except:
        # Fallback to IP address if user isn't authenticated or there's an error
        return get_remote_address()

# In-memory limiter with custom key function
limiter = Limiter(key_func=get_rate_limit_key, storage_uri="memory://")

def init_extensions(app):
    """Bind each extension to the freshly created app."""
    db.init_app(app)
    jwt.init_app(app)
    cors.init_app(
        app,
        resources={
            r"/api/*": {
                "origins": ["http://localhost:3000", "https://whirlwatch.onrender.com"],
                "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
                "allow_headers": ["Content-Type", "Authorization"],
            }
        },
    )
    limiter.init_app(app)
