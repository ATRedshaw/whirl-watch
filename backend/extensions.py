"""
All 3rd-party extensions live here so we never create circular imports.
"""
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

db = SQLAlchemy()
jwt = JWTManager()
cors = CORS()  # resources will be configured in app.create_app()

# In-memory limiter (identical behaviour to original)
limiter = Limiter(key_func=get_remote_address, storage_uri="memory://")


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
