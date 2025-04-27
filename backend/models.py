"""
Pure SQLAlchemy models – copied verbatim from your single-file version.
"""
from datetime import datetime
from sqlalchemy import func
from extensions import db

# ---------- Models ----------
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128))
    email_verified = db.Column(db.Boolean, default=False)
    is_admin = db.Column(db.Boolean, default=False)
    is_privilege = db.Column(db.Boolean, default=False)
    lists = db.relationship('MediaList', backref='owner', lazy=True)
    # Add relationship to user media ratings
    ratings = db.relationship('UserMediaRating', backref='user', lazy=True)


# New model for storing unique media items
class Media(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    tmdb_id = db.Column(db.Integer, nullable=False)
    media_type = db.Column(db.String(10), nullable=False)  # 'movie' or 'tv'
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    list_entries = db.relationship('MediaInList', backref='media', lazy=True)
    user_ratings = db.relationship('UserMediaRating', backref='media', lazy=True)
    
    __table_args__ = (
        db.UniqueConstraint('tmdb_id', 'media_type', name='uq_media_tmdb_type'),
    )


class MediaList(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(80), nullable=False)
    description = db.Column(db.String(100))
    owner_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    share_code = db.Column(db.String(8), unique=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    last_updated = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    media_items = db.relationship('MediaInList', backref='media_list', lazy=True)
    shared_with = db.relationship('SharedList', backref='media_list', lazy=True)


# Modified to remove rating from this model
class MediaInList(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    list_id = db.Column(db.Integer, db.ForeignKey('media_list.id'), nullable=False)
    media_id = db.Column(db.Integer, db.ForeignKey('media.id'), nullable=False)
    added_date = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    last_updated = db.Column(db.DateTime, default=datetime.utcnow,
                             onupdate=datetime.utcnow, nullable=False)
    added_by_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)

    added_by = db.relationship('User', backref='added_media_items')

    __table_args__ = (
        db.UniqueConstraint('list_id', 'media_id', name='uq_list_media'),
    )


# New model for personal user ratings
class UserMediaRating(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    media_id = db.Column(db.Integer, db.ForeignKey('media.id'), nullable=False)
    watch_status = db.Column(db.String(20), default='not_watched', nullable=False)
    rating = db.Column(db.Integer, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, 
                           onupdate=datetime.utcnow, nullable=False)
    
    __table_args__ = (
        db.UniqueConstraint('user_id', 'media_id', name='uq_user_media_rating'),
    )


class SharedList(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    list_id = db.Column(db.Integer, db.ForeignKey('media_list.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)


class VerificationCode(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    code = db.Column(db.String(6), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    purpose = db.Column(db.String(20), nullable=False)  # 'password_reset', 'email_verification'
    used = db.Column(db.Boolean, default=False)
