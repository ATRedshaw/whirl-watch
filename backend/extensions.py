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

# Get privileged user IDs from environment variable (comma-separated list)
PRIVILEGED_USER_IDS = os.getenv('PRIVILEGED_USER_IDS', '1')
privileged_users = [int(user_id.strip()) for user_id in PRIVILEGED_USER_IDS.split(',') if user_id.strip()]

# Custom key function that exempts certain user IDs from rate limits
def get_rate_limit_key():
    try:
        # Get the current user's ID
        current_user_id = get_jwt_identity()
        
        if current_user_id in privileged_users:
            # Return None for privileged users to bypass rate limits completely
            return None
        
        # For regular users, use IP + user ID to prevent sharing rate limits
        return f"{get_remote_address()}:{current_user_id}"
    except:
        # Fallback to IP address if user isn't authenticated
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
                "origins": "http://localhost:3000",
                "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
                "allow_headers": ["Content-Type", "Authorization"],
            }
        },
    )
    limiter.init_app(app)
