import os
from datetime import timedelta
from dotenv import load_dotenv

# Load .env once, as early as possible
load_dotenv()

# Constants that several blueprints need
MAX_USERS_PER_LIST = 8
MAX_LISTS_PER_USER = 10


class Config:
    """Base Flask configuration – identical to your monolith version."""
    SQLALCHEMY_DATABASE_URI = 'sqlite:///whirlwatch.db'
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Secrets & API keys
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY')
    TMDB_API_KEY = os.getenv('TMDB_API_KEY')
    MAIL_USERNAME = os.getenv('MAIL_USERNAME')
    MAIL_PASSWORD = os.getenv('MAIL_PASSWORD')

    if not JWT_SECRET_KEY:
        raise ValueError("JWT_SECRET_KEY not found in environment variables")
    if not TMDB_API_KEY:
        raise ValueError("TMDB_API_KEY not found in environment variables")
    if not MAIL_USERNAME:
        raise ValueError("MAIL_USERNAME not found in environment variables")
    if not MAIL_PASSWORD:
        raise ValueError("MAIL_PASSWORD not found in environment variables")

    # JWT lifetimes
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(days=30)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=60)

    # Rate-limit constants (used in utils.helpers)
    ENDPOINT_LIMIT_DEFAULT = 300  # seconds
