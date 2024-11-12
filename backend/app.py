from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity, create_refresh_token
from werkzeug.security import generate_password_hash, check_password_hash
import requests
import os
from datetime import datetime, timedelta
import uuid
from dotenv import load_dotenv
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from werkzeug.exceptions import BadRequest, Unauthorized, NotFound, Forbidden
from sqlalchemy import func
import string
import random
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_limiter import RateLimitExceeded
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import secrets
import math

# Load environment variables from .env file
try:
    load_dotenv()
except Exception as e:
    print(f"Error loading environment variables: {str(e)}")
    raise

app = Flask(__name__)
CORS(app)

# Configuration
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///movietracker.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY')
if not app.config['JWT_SECRET_KEY']:
    raise ValueError("JWT_SECRET_KEY not found in environment variables")

app.config['TMDB_API_KEY'] = os.getenv('TMDB_API_KEY')
if not app.config['TMDB_API_KEY']:
    raise ValueError("TMDB_API_KEY not found in environment variables")

app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(days=30)  # Set token expiration to 30 days
app.config['JWT_REFRESH_TOKEN_EXPIRES'] = timedelta(days=60)  # Refresh token lasts 60 days
app.config['MAIL_USERNAME'] = os.getenv('MAIL_USERNAME')
if not app.config['MAIL_USERNAME']:
    raise ValueError("MAIL_USERNAME not found in environment variables")

app.config['MAIL_PASSWORD'] = os.getenv('MAIL_PASSWORD')
if not app.config['MAIL_PASSWORD']:
    raise ValueError("MAIL_PASSWORD not found in environment variables")

# Add this constant near the top with other configurations
MAX_USERS_PER_LIST = 8

db = SQLAlchemy(app)
jwt = JWTManager(app)

limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    storage_uri="memory://"
)

# Models
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128))
    email_verified = db.Column(db.Boolean, default=False)
    lists = db.relationship('MediaList', backref='owner', lazy=True)

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

class MediaInList(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    list_id = db.Column(db.Integer, db.ForeignKey('media_list.id'), nullable=False)
    tmdb_id = db.Column(db.Integer, nullable=False)
    media_type = db.Column(db.String(10), nullable=False)  # 'movie' or 'tv'
    added_date = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    last_updated = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    watch_status = db.Column(db.String(20), default='not_watched', nullable=False)
    rating = db.Column(db.Integer, nullable=True)
    added_by_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    added_by = db.relationship('User', backref='added_media_items')

    __table_args__ = (
        db.Index('idx_list_media', 'list_id', 'tmdb_id', 'media_type', unique=True),
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
    purpose = db.Column(db.String(20), nullable=False)  # 'password_reset' or other purposes
    used = db.Column(db.Boolean, default=False)

# Error handlers
@app.errorhandler(BadRequest)
def handle_bad_request(e):
    return jsonify({"error": "Bad request", "message": str(e)}), 400

@app.errorhandler(Unauthorized)
def handle_unauthorized(e):
    return jsonify({"error": "Unauthorized", "message": str(e)}), 401

@app.errorhandler(Forbidden)
def handle_forbidden(e):
    return jsonify({"error": "Forbidden", "message": str(e)}), 403

@app.errorhandler(NotFound)
def handle_not_found(e):
    return jsonify({"error": "Not found", "message": str(e)}), 404

@app.errorhandler(SQLAlchemyError)
def handle_db_error(e):
    return jsonify({"error": "Database error", "message": str(e)}), 500

@app.route('/api', methods=['GET'])
def api_documentation():
    """API Documentation endpoint"""
    return jsonify({
        'version': '1.0',
        'description': 'Movie and TV Show Tracking API',
        'endpoints': {
            'authentication': {
                '/api/register': {
                    'method': 'POST',
                    'description': 'Register new user',
                    'parameters': {
                        'username': 'string (required) - 3 to 80 characters',
                        'email': 'string (required) - valid email format', 
                        'password': 'string (required) - 6 to 128 characters'
                    },
                    'rate_limit': 'None'
                },
                '/api/login': {
                    'method': 'POST',
                    'description': 'Login user',
                    'parameters': {
                        'username': 'string (required)',
                        'password': 'string (required)'
                    },
                    'rate_limit': '5 per 15 minutes'
                },
                '/api/refresh': {
                    'method': 'POST', 
                    'description': 'Get new access token using refresh token',
                    'authentication': 'JWT Refresh Token required',
                    'rate_limit': 'None'
                }
            },
            'password_reset': {
                '/api/reset-password/get-username': {
                    'method': 'POST',
                    'description': 'Get username associated with email',
                    'parameters': {
                        'email': 'string (required)'
                    },
                    'rate_limit': '5 per 15 minutes'
                },
                '/api/reset-password/request': {
                    'method': 'POST',
                    'description': 'Request password reset code',
                    'parameters': {
                        'email': 'string (required)'
                    },
                    'rate_limit': '5 per 15 minutes'
                },
                '/api/reset-password/verify-code': {
                    'method': 'POST',
                    'description': 'Verify reset code',
                    'parameters': {
                        'email': 'string (required)',
                        'code': 'string (required)'
                    },
                    'rate_limit': '5 per 15 minutes'
                },
                '/api/reset-password/complete': {
                    'method': 'POST',
                    'description': 'Complete password reset with token',
                    'authentication': 'JWT Bearer Token required',
                    'parameters': {
                        'newPassword': 'string (required) - 6 to 128 characters'
                    },
                    'rate_limit': '5 per 15 minutes'
                }
            },
            'user': {
                '/api/user/profile': {
                    'methods': ['PUT', 'DELETE'],
                    'description': 'Update or delete user profile',
                    'authentication': 'JWT Bearer Token required',
                    'PUT_parameters': {
                        'username': 'string (optional) - 3 to 80 characters',
                        'email': 'string (optional) - valid email format',
                        'current_password': 'string (required for password change)',
                        'new_password': 'string (optional) - 6 to 128 characters'
                    },
                    'DELETE_parameters': {
                        'password': 'string (required)'
                    },
                    'rate_limit': 'None'
                }
            },
            'lists': {
                '/api/lists': {
                    'methods': ['GET', 'POST'],
                    'description': 'Get all lists for authenticated user or create new list',
                    'authentication': 'JWT Bearer Token required',
                    'POST_parameters': {
                        'name': 'string (required) - 1 to 80 characters',
                        'description': 'string (optional) - up to 100 characters'
                    },
                    'rate_limit': 'None'
                },
                '/api/lists/<list_id>': {
                    'methods': ['GET', 'PUT', 'DELETE'],
                    'description': 'Get, update or delete specific list',
                    'authentication': 'JWT Bearer Token required',
                    'PUT_parameters': {
                        'name': 'string (optional) - 1 to 80 characters',
                        'description': 'string (optional) - up to 100 characters'
                    },
                    'rate_limit': 'None'
                },
                '/api/lists/<list_id>/share': {
                    'method': 'POST',
                    'description': 'Generate share code for list',
                    'authentication': 'JWT Bearer Token required',
                    'response': {
                        'share_code': 'string - 8 character unique code'
                    },
                    'rate_limit': 'None'
                },
                '/api/lists/join': {
                    'method': 'POST',
                    'description': 'Join a shared list using share code',
                    'authentication': 'JWT Bearer Token required',
                    'parameters': {
                        'share_code': 'string (required) - 8 character code'
                    },
                    'rate_limit': 'None'
                },
                '/api/lists/<list_id>/users': {
                    'method': 'GET',
                    'description': 'Get users with access to list',
                    'authentication': 'JWT Bearer Token required',
                    'rate_limit': 'None'
                },
                '/api/lists/<list_id>/users/<user_id>': {
                    'method': 'DELETE',
                    'description': 'Remove user from shared list',
                    'authentication': 'JWT Bearer Token required',
                    'rate_limit': 'None'
                },
                '/api/lists/<list_id>/leave': {
                    'method': 'POST',
                    'description': 'Leave a shared list',
                    'authentication': 'JWT Bearer Token required',
                    'rate_limit': 'None'
                }
            },
            'media': {
                '/api/search': {
                    'method': 'GET',
                    'description': 'Search for movies or TV shows',
                    'authentication': 'JWT Bearer Token required',
                    'parameters': {
                        'query': 'string (required)',
                        'type': 'string (optional, default: movie) - movie or tv',
                        'page': 'integer (optional, default: 1)'
                    },
                    'rate_limit': '200 per day, 50 per hour'
                },
                '/api/<media_type>/<media_id>': {
                    'method': 'GET',
                    'description': 'Get detailed information about a movie or TV show',
                    'authentication': 'JWT Bearer Token required',
                    'parameters': {
                        'media_type': 'string (required) - movie or tv',
                        'media_id': 'integer (required) - TMDB ID'
                    },
                    'rate_limit': '200 per day, 50 per hour'
                },
                '/api/lists/<list_id>/media': {
                    'methods': ['GET', 'POST'],
                    'description': 'Get all media in list or add new media',
                    'authentication': 'JWT Bearer Token required',
                    'POST_parameters': {
                        'tmdb_id': 'integer (required)',
                        'media_type': 'string (required) - movie or tv',
                        'watch_status': 'string (optional) - not_watched, watching, completed',
                        'rating': 'integer (optional) - 1 to 10'
                    },
                    'rate_limit': 'None'
                },
                '/api/lists/<list_id>/media/<media_id>': {
                    'methods': ['GET', 'PUT', 'DELETE'],
                    'description': 'Get, update or delete media from list',
                    'authentication': 'JWT Bearer Token required',
                    'PUT_parameters': {
                        'watch_status': 'string (optional) - not_watched, watching, completed',
                        'rating': 'integer (optional) - 1 to 10'
                    },
                    'rate_limit': 'None'
                }
            }
        },
        'authentication': {
            'type': 'JWT Bearer Token',
            'header': 'Authorization: Bearer <token>',
            'access_token_expiry': '30 days',
            'refresh_token_expiry': '60 days'
        },
        'rate_limits': {
            'default': '200 per day, 50 per hour',
            'auth_endpoints': '5 per 15 minutes'
        },
        'errors': {
            '400': 'Bad Request - Invalid input parameters',
            '401': 'Unauthorized - Authentication required or failed',
            '403': 'Forbidden - Insufficient permissions',
            '404': 'Not Found - Resource does not exist',
            '429': 'Too Many Requests - Rate limit exceeded',
            '500': 'Server Error - Internal processing error',
            '503': 'Service Unavailable - TMDB API error'
        }
    }), 200

# Authentication routes
@app.route('/api/register', methods=['POST'])
@limiter.limit("3 per hour")
def register():
    try:
        data = request.get_json()
        if not data:
            raise BadRequest("No input data provided")
        
        required_fields = ['username', 'email', 'password']
        for field in required_fields:
            if field not in data:
                raise BadRequest(f"Missing required field: {field}")
        
        user = User(
            username=data['username'],
            email=data['email'],
            password_hash=generate_password_hash(data['password']),
            email_verified=False
        )
        
        db.session.add(user)
        db.session.commit()

        # Generate verification code
        verification_code = ''.join(secrets.choice('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ') for _ in range(6))
        
        # Save verification code
        new_code = VerificationCode(
            user_id=user.id,
            code=verification_code,
            purpose='email_verification'
        )
        db.session.add(new_code)
        db.session.commit()
        
        # Send verification email
        if not send_verification_email(user.email, verification_code, purpose='email_verification'):
            raise Exception("Failed to send verification email")
        
        return jsonify({
            'message': 'User created successfully. Please check your email for verification code.',
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'requires_verification': True
            }
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/login', methods=['POST'])
@limiter.limit("10 per hour")
def login():
    try:
        data = request.get_json()
        if not data:
            raise BadRequest("No input data provided")
            
        if 'username' not in data or 'password' not in data:
            raise BadRequest("Missing username or password")
            
        user = User.query.filter_by(username=data['username']).first()
        if not user:
            raise Unauthorized("Invalid credentials")
            
        if not check_password_hash(user.password_hash, data['password']):
            raise Unauthorized("Invalid credentials")

        if not user.email_verified:
            return jsonify({
                'error': 'Email not verified',
                'requires_verification': True,
                'email': user.email
            }), 403
            
        access_token = create_access_token(identity=user.id)
        refresh_token = create_refresh_token(identity=user.id)
        
        return jsonify({
            'access_token': access_token,
            'refresh_token': refresh_token,
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    try:
        current_user_id = get_jwt_identity()
        access_token = create_access_token(identity=current_user_id)
        return jsonify({'access_token': access_token}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Movie list routes
@app.route('/api/lists', methods=['POST'])
@jwt_required()
def create_list():
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        
        if not data or 'name' not in data:
            raise BadRequest("List name is required")
        
        # Generate an 8-character share code using uppercase letters and numbers
        share_code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))
        
        # Ensure uniqueness of share code
        while MediaList.query.filter(func.upper(MediaList.share_code) == share_code).first():
            share_code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))
            
        new_list = MediaList(
            name=data['name'],
            description=data.get('description', ''),
            owner_id=current_user_id,
            share_code=share_code
        )
        db.session.add(new_list)
        db.session.commit()
        
        return jsonify({'message': 'List created', 'list_id': new_list.id}), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/lists/<int:list_id>/share', methods=['POST'])
@jwt_required()
def share_list(list_id):
    try:
        current_user_id = get_jwt_identity()
        movie_list = MediaList.query.get_or_404(list_id)
        
        if movie_list.owner_id != current_user_id:
            raise Forbidden("You don't have permission to share this list")
        
        return jsonify({'share_code': movie_list.share_code}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/lists', methods=['GET'])
@jwt_required()
def get_lists():
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get_or_404(current_user_id)
        
        owned_lists = user.lists
        shared_lists = MediaList.query.join(SharedList).filter(
            SharedList.user_id == current_user_id
        ).all()
        
        all_lists = []
        
        # Process owned lists
        for lst in owned_lists:
            user_count = get_list_user_count(lst.id)  # Get user count
            all_lists.append({
                'id': lst.id,
                'name': lst.name,
                'description': lst.description,
                'is_owner': True,
                'share_code': lst.share_code,
                'created_at': lst.created_at.isoformat(),
                'last_updated': lst.last_updated.isoformat(),
                'media_items': [{
                    'id': item.id,
                    'tmdb_id': item.tmdb_id,
                    'media_type': item.media_type,
                    'watch_status': item.watch_status,
                    'rating': item.rating
                } for item in lst.media_items],
                'user_count': user_count,  # Add user count
                'max_users': MAX_USERS_PER_LIST  # Add max users
            })
        
        # Process shared lists
        for lst in shared_lists:
            user_count = get_list_user_count(lst.id)  # Get user count
            all_lists.append({
                'id': lst.id,
                'name': lst.name,
                'description': lst.description,
                'is_owner': False,
                'owner': {
                    'id': lst.owner.id,
                    'username': lst.owner.username
                },
                'created_at': lst.created_at.isoformat(),
                'last_updated': lst.last_updated.isoformat(),
                'share_code': lst.share_code,
                'media_items': [{
                    'id': item.id,
                    'tmdb_id': item.tmdb_id,
                    'media_type': item.media_type,
                    'watch_status': item.watch_status,
                    'rating': item.rating
                } for item in lst.media_items],
                'user_count': user_count,  # Add user count
                'max_users': MAX_USERS_PER_LIST  # Add max users
            })
        
        return jsonify({'lists': all_lists}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# TMDB API routes
@app.route('/api/search')
@jwt_required()
def search_media():
    try:
        current_user_id = get_jwt_identity()
        query = request.args.get('query', '')
        media_type = request.args.get('type', 'movie')  # 'movie' or 'tv'
        
        if not query:
            raise BadRequest('No search query provided')
        
        if media_type not in ['movie', 'tv']:
            raise BadRequest('Invalid media type')
        
        # Get TMDB search results
        response = requests.get(
            f'https://api.themoviedb.org/3/search/{media_type}',
            params={
                'api_key': app.config['TMDB_API_KEY'],
                'query': query,
                'language': 'en-US',
                'page': request.args.get('page', 1)
            },
            timeout=5
        )
        response.raise_for_status()
        data = response.json()
        
        # Get user's lists that contain these media items
        user_lists = MediaList.query.filter(
            (MediaList.owner_id == current_user_id) |
            MediaList.shared_with.any(user_id=current_user_id)
        ).all()
        
        # Create a mapping of tmdb_id to list_ids
        media_in_lists = {}
        for lst in user_lists:
            for item in lst.media_items:
                if item.media_type == media_type:
                    if item.tmdb_id not in media_in_lists:
                        media_in_lists[item.tmdb_id] = []
                    media_in_lists[item.tmdb_id].append(lst.id)
        
        # Add list information to each result
        for item in data['results']:
            item['addedToLists'] = media_in_lists.get(item['id'], [])
        
        return jsonify(data), 200
        
    except requests.RequestException as e:
        return jsonify({'error': f"TMDB API error: {str(e)}"}), 503
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/<string:media_type>/<int:media_id>')
@jwt_required()
def get_media_details(media_type, media_id):
    try:
        if media_type not in ['movie', 'tv']:
            raise BadRequest('Invalid media type')
            
        response = requests.get(
            f'https://api.themoviedb.org/3/{media_type}/{media_id}',
            params={
                'api_key': app.config['TMDB_API_KEY'],
                'language': 'en-US',
                'append_to_response': 'seasons,episodes' if media_type == 'tv' else None
            },
            timeout=5
        )
        response.raise_for_status()
        
        return jsonify(response.json()), 200
        
    except requests.RequestException as e:
        return jsonify({'error': f"TMDB API error: {str(e)}"}), 503
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/verify-token', methods=['GET'])
@jwt_required()
def verify_token():
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get_or_404(current_user_id)
        return jsonify({
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email
            }
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/lists/<int:list_id>/media', methods=['POST'])
@jwt_required()
def add_media_to_list(list_id):
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        
        required_fields = ['tmdb_id', 'media_type']
        if not all(field in data for field in required_fields):
            raise BadRequest("tmdb_id and media_type are required")
            
        if data['media_type'] not in ['movie', 'tv']:
            raise BadRequest("Invalid media type")
            
        media_list = MediaList.query.get_or_404(list_id)
        
        # Check if user has access to the list
        has_access = (media_list.owner_id == current_user_id or 
                     SharedList.query.filter_by(list_id=list_id, user_id=current_user_id).first())
        
        if not has_access:
            raise Forbidden("Not authorized to add to this list")
        
        new_media = MediaInList(
            list_id=list_id,
            tmdb_id=data['tmdb_id'],
            media_type=data['media_type'],
            watch_status=data.get('watch_status', 'not_watched'),
            rating=data.get('rating'),
            added_date=datetime.utcnow(),
            added_by_id=current_user_id
        )
        
        # Update the list's last_updated timestamp
        media_list.last_updated = datetime.utcnow()
        
        db.session.add(new_media)
        db.session.commit()
        
        return jsonify({
            'message': 'Media added successfully', 
            'id': new_media.id,
            'added_by': {
                'id': current_user_id,
                'username': User.query.get(current_user_id).username
            }
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/lists/<int:list_id>/media/<int:media_id>', methods=['PUT'])
@jwt_required()
def update_media_status(list_id, media_id):
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        
        media = MediaInList.query.filter_by(
            list_id=list_id,
            id=media_id
        ).first_or_404()
        
        media_list = MediaList.query.get_or_404(list_id)
        
        # Check if user has access to the list
        has_access = (media_list.owner_id == current_user_id or 
                     SharedList.query.filter_by(list_id=list_id, user_id=current_user_id).first())
        
        if not has_access:
            raise Forbidden("Not authorized to update this media")
        
        # Only update last_updated when watch_status or rating changes
        if 'watch_status' in data or 'rating' in data:
            media_list.last_updated = datetime.utcnow()
            
        if 'watch_status' in data:
            media.watch_status = data['watch_status']
            media.last_updated = datetime.utcnow()
            
        if 'rating' in data:
            media.rating = data['rating']
                
        db.session.commit()
        
        return jsonify({'message': 'Status updated successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/lists/<int:list_id>', methods=['DELETE'])
@jwt_required()
def delete_list(list_id):
    try:
        current_user_id = get_jwt_identity()
        media_list = MediaList.query.get_or_404(list_id)
        
        # Check if user owns the list
        if media_list.owner_id != current_user_id:
            raise Forbidden("Not authorized to delete this list")
            
        # Delete associated media items first (cascade delete)
        MediaInList.query.filter_by(list_id=list_id).delete()
        
        # Delete associated shared list entries
        SharedList.query.filter_by(list_id=list_id).delete()
        
        # Delete the list itself
        db.session.delete(media_list)
        db.session.commit()
        
        return jsonify({'message': 'List deleted successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/lists/<int:list_id>', methods=['GET'])
@jwt_required()
def get_list(list_id):
    try:
        current_user_id = get_jwt_identity()
        media_list = MediaList.query.get_or_404(list_id)
        
        # Check if user has access to the list (owner or shared)
        is_shared = SharedList.query.filter_by(
            list_id=list_id, 
            user_id=current_user_id
        ).first() is not None
        
        has_access = (media_list.owner_id == current_user_id or is_shared)
        
        if not has_access:
            raise Forbidden("Not authorized to view this list")
        
        media_items = []
        for item in media_list.media_items:
            # Fetch TMDB details for each media item
            try:
                tmdb_response = requests.get(
                    f'https://api.themoviedb.org/3/{item.media_type}/{item.tmdb_id}',
                    params={
                        'api_key': app.config['TMDB_API_KEY'],
                        'language': 'en-US'
                    },
                    timeout=5
                )
                tmdb_data = tmdb_response.json()
                
                media_items.append({
                    'id': item.id,
                    'tmdb_id': item.tmdb_id,
                    'media_type': item.media_type,
                    'watch_status': item.watch_status,
                    'rating': item.rating,
                    'added_date': item.added_date.isoformat(),
                    'last_updated': item.last_updated.isoformat(),
                    # Add added_by information
                    'added_by': {
                        'id': item.added_by_id,
                        'username': item.added_by.username
                    },
                    # TMDB data
                    'title': tmdb_data.get('title') or tmdb_data.get('name'),
                    'poster_path': tmdb_data.get('poster_path'),
                    'overview': tmdb_data.get('overview'),
                    'release_date': tmdb_data.get('release_date') or tmdb_data.get('first_air_date'),
                    'vote_average': tmdb_data.get('vote_average')
                })
            except Exception as e:
                print(f"Error fetching TMDB data: {str(e)}")
                # Include basic info even if TMDB fetch fails
                media_items.append({
                    'id': item.id,
                    'tmdb_id': item.tmdb_id,
                    'media_type': item.media_type,
                    'watch_status': item.watch_status,
                    'rating': item.rating,
                    # Add added_by information even in error case
                    'added_by': {
                        'id': item.added_by_id,
                        'username': item.added_by.username
                    }
                })
        
        return jsonify({
            'id': media_list.id,
            'name': media_list.name,
            'description': media_list.description,
            'is_owner': media_list.owner_id == current_user_id,
            'shared_with_me': is_shared,
            'owner': {
                'id': media_list.owner.id,
                'username': media_list.owner.username
            },
            'share_code': media_list.share_code,
            'media_items': media_items
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/lists/<int:list_id>/media/<int:media_id>', methods=['DELETE'])
@jwt_required()
def delete_media(list_id, media_id):
    try:
        current_user_id = get_jwt_identity()
        media_list = MediaList.query.get_or_404(list_id)
        
        # Check if user has access to the list (owner or shared)
        has_access = (media_list.owner_id == current_user_id or 
                     SharedList.query.filter_by(list_id=list_id, user_id=current_user_id).first())
        
        if not has_access:
            raise Forbidden("Not authorized to modify this list")
            
        media = MediaInList.query.filter_by(
            list_id=list_id,
            id=media_id
        ).first_or_404()
        
        # Update the list's last_updated timestamp
        media_list.last_updated = datetime.utcnow()
        
        db.session.delete(media)
        db.session.commit()
        
        return jsonify({'message': 'Media removed successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/lists/<int:list_id>/media/tmdb/<int:tmdb_id>', methods=['DELETE'])
@jwt_required()
def delete_media_by_tmdb(list_id, tmdb_id):
    try:
        current_user_id = get_jwt_identity()
        media_list = MediaList.query.get_or_404(list_id)
        
        # Check if user has access to the list (owner or shared)
        has_access = (media_list.owner_id == current_user_id or 
                     SharedList.query.filter_by(list_id=list_id, user_id=current_user_id).first())
        
        if not has_access:
            raise Forbidden("Not authorized to modify this list")
            
        media = MediaInList.query.filter_by(
            list_id=list_id,
            tmdb_id=tmdb_id
        ).first_or_404()
        
        # Update the list's last_updated timestamp
        media_list.last_updated = datetime.utcnow()
        
        db.session.delete(media)
        db.session.commit()
        
        return jsonify({'message': 'Media removed successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# Add this helper function with other helper functions
def get_list_user_count(list_id):
    """Get total number of users with access to a list (owner + shared users)"""
    try:
        media_list = MediaList.query.get_or_404(list_id)
        shared_count = SharedList.query.filter_by(list_id=list_id).count()
        return shared_count + 1  # +1 for the owner
    except Exception as e:
        print(f"Error counting list users: {str(e)}")
        return 0

@app.route('/api/lists/join', methods=['POST'])
@jwt_required()
def join_list():
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        
        if not data or 'share_code' not in data:
            raise BadRequest("Share code is required")
            
        share_code = data['share_code'].upper()
        
        media_list = MediaList.query.filter(
            func.upper(MediaList.share_code) == share_code
        ).first()
        if not media_list:
            raise NotFound("Invalid share code")
            
        if media_list.owner_id == current_user_id:
            raise BadRequest("You cannot join your own list")
            
        existing_share = SharedList.query.filter_by(
            list_id=media_list.id,
            user_id=current_user_id
        ).first()
        
        if existing_share:
            raise BadRequest("You already have access to this list")
        
        # Check user limit
        current_user_count = get_list_user_count(media_list.id)
        if current_user_count >= MAX_USERS_PER_LIST:
            raise BadRequest(f"This list has reached its maximum capacity of {MAX_USERS_PER_LIST} users")
            
        new_share = SharedList(
            list_id=media_list.id,
            user_id=current_user_id
        )
        
        db.session.add(new_share)
        db.session.commit()
        
        return jsonify({
            'message': 'Successfully joined list',
            'list_id': media_list.id,
            'user_count': current_user_count + 1,
            'max_users': MAX_USERS_PER_LIST
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# Add these new routes after your existing list routes

@app.route('/api/lists/<int:list_id>/users', methods=['GET'])
@jwt_required()
def get_list_users(list_id):
    try:
        current_user_id = get_jwt_identity()
        media_list = MediaList.query.get_or_404(list_id)
        
        # Only list owner can view users
        if media_list.owner_id != current_user_id:
            raise Forbidden("Not authorized to view list users")
            
        # Get all users with access to the list
        shared_users = User.query.join(SharedList).filter(
            SharedList.list_id == list_id
        ).all()
        
        return jsonify({
            'owner': {
                'id': media_list.owner.id,
                'username': media_list.owner.username,
                'email': media_list.owner.email
            },
            'shared_users': [{
                'id': user.id,
                'username': user.username,
                'email': user.email
            } for user in shared_users]
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/lists/<int:list_id>/users/<int:user_id>', methods=['DELETE'])
@jwt_required()
def remove_user_from_list(list_id, user_id):
    try:
        current_user_id = get_jwt_identity()
        media_list = MediaList.query.get_or_404(list_id)
        
        # Only list owner can remove users
        if media_list.owner_id != current_user_id:
            raise Forbidden("Not authorized to remove users from this list")
            
        # Delete all media items added by this user
        MediaInList.query.filter_by(
            list_id=list_id,
            added_by_id=user_id
        ).delete()
        
        # Delete the shared access
        shared_access = SharedList.query.filter_by(
            list_id=list_id,
            user_id=user_id
        ).first_or_404()
        
        db.session.delete(shared_access)
        db.session.commit()
        
        return jsonify({
            'message': 'User removed successfully. All media items added by this user have been removed from the list.'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/lists/<int:list_id>/leave', methods=['POST'])
@jwt_required()
def leave_list(list_id):
    try:
        current_user_id = get_jwt_identity()
        media_list = MediaList.query.get_or_404(list_id)
        
        # Check if user is actually a shared user (not the owner)
        if media_list.owner_id == current_user_id:
            raise BadRequest("Cannot leave a list you own")
            
        # Delete all media items added by this user
        MediaInList.query.filter_by(
            list_id=list_id,
            added_by_id=current_user_id
        ).delete()
        
        # Find and delete the shared access
        shared_access = SharedList.query.filter_by(
            list_id=list_id,
            user_id=current_user_id
        ).first_or_404()
        
        db.session.delete(shared_access)
        db.session.commit()
        
        return jsonify({
            'message': 'Successfully left the list. All media items you added have been removed.'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/lists/<int:list_id>', methods=['PUT'])
@jwt_required()
def update_list(list_id):
    try:
        current_user_id = get_jwt_identity()
        media_list = MediaList.query.get_or_404(list_id)
        
        if media_list.owner_id != current_user_id:
            raise Forbidden("Not authorized to modify this list")
            
        data = request.get_json()
        
        if 'name' in data:
            media_list.name = data['name']
        if 'description' in data:
            media_list.description = data['description']
            
        media_list.last_updated = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'message': 'List updated successfully',
            'list': {
                'id': media_list.id,
                'name': media_list.name,
                'description': media_list.description
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/user/profile', methods=['PUT'])
@jwt_required()
@limiter.limit("10 per hour")
def update_profile():
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get_or_404(current_user_id)
        data = request.get_json()

        if 'username' in data:
            # Check if new username is already taken
            if User.query.filter(User.id != current_user_id, User.username == data['username']).first():
                raise BadRequest('Username already exists')
            user.username = data['username']

        if 'email' in data:
            # Check if new email is already taken
            if User.query.filter(User.id != current_user_id, User.email == data['email']).first():
                raise BadRequest('Email already exists')
            user.email = data['email']

        if 'current_password' in data and 'new_password' in data:
            if not check_password_hash(user.password_hash, data['current_password']):
                raise BadRequest('Current password is incorrect')
            user.password_hash = generate_password_hash(data['new_password'])

        db.session.commit()
        return jsonify({
            'message': 'Profile updated successfully',
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email
            }
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/user/profile', methods=['DELETE'])
@jwt_required()
@limiter.limit("3 per hour")
def delete_profile():
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        
        if not data or 'password' not in data:
            raise BadRequest("Password is required to delete account")
            
        user = User.query.get_or_404(current_user_id)
        
        if not check_password_hash(user.password_hash, data['password']):
            raise Unauthorized("Invalid password")

        # Delete all media items added by the user
        MediaInList.query.filter_by(added_by_id=current_user_id).delete()
        
        # Delete all shared lists for this user
        SharedList.query.filter_by(user_id=current_user_id).delete()
        
        # Delete all verification codes for this user
        VerificationCode.query.filter_by(user_id=current_user_id).delete()
        
        # Delete all lists owned by the user
        MediaList.query.filter_by(owner_id=current_user_id).delete()
        
        # Finally, delete the user
        db.session.delete(user)
        db.session.commit()
        
        return jsonify({'message': 'Account deleted successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

def get_retry_after():
    """Get the retry-after time from rate limiter based on the current endpoint's limit"""
    try:
        # Endpoint-specific defaults (in seconds)
        endpoint_limits = {
            'login': 3600,              # 60 minutes
            'update_profile': 3600,     # 60 minutes
            'register': 3600,           # 60 minutes
            'verify_email': 900,        # 15 minutes
            'resend_verification': 900, # 15 minutes
            'request_password_reset': 3600,  # 60 minutes
            'verify_reset_code': 900,   # 15 minutes
            'complete_password_reset': 3600,  # 60 minutes
            'delete_account': 3600,     # 60 minutes
        }
        
        # Get the retry-after value for the current endpoint
        retry_after = endpoint_limits.get(request.endpoint, 300)  # 5 minutes default
        return retry_after
    except Exception as e:
        print(f"Error in get_retry_after: {str(e)}")
        return 900  # 15 minutes default fallback

def format_retry_message(retry_after):
    """Format the retry message based on time remaining"""
    if retry_after >= 3600:  # If 60 minutes or more
        hours = math.ceil(retry_after / 3600)
        return f"Too many attempts. Please try again in {hours} {'hour' if hours == 1 else 'hours'}"
    else:
        minutes = math.ceil(retry_after / 60)
        return f"Too many attempts. Please try again in {minutes} {'minute' if minutes == 1 else 'minutes'}"

@app.errorhandler(RateLimitExceeded)
def handle_ratelimit_error(e):
    retry_after = get_retry_after()
    reset_time = int(datetime.utcnow().timestamp() + retry_after)
    message = format_retry_message(retry_after)
    
    return jsonify({
        'error': message,
        'retry_after': retry_after,
        'reset_time': reset_time
    }), 429

@app.route('/api/reset-password/complete', methods=['POST'])
@jwt_required()
@limiter.limit("3 per hour")
def complete_password_reset():
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get_or_404(current_user_id)
        data = request.get_json()
        
        new_password = data.get('newPassword')
        if not new_password:
            raise BadRequest('New password is required')
            
        user.password_hash = generate_password_hash(new_password)
        db.session.commit()
        
        return jsonify({'message': 'Password reset successful'}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def send_verification_email(to_email, code, purpose='password_reset'):
    try:
        msg = MIMEMultipart('alternative')
        msg['From'] = app.config['MAIL_USERNAME']
        msg['To'] = to_email

        # Updated CSS styles with better contrast
        styles = """
            body { 
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #e2e8f0;  /* Lighter text color for better contrast */
                max-width: 600px;
                margin: 0 auto;
                background-color: #0f172a;
            }
            .container {
                background: #1e293b;  /* Solid background for better email client compatibility */
                padding: 32px;
                border-radius: 12px;
                border: 1px solid #334155;
            }
            .header {
                text-align: center;
                margin-bottom: 30px;
            }
            .logo {
                font-size: 32px;
                font-weight: bold;
                color: #38bdf8;  /* Fallback color */
                margin-bottom: 16px;
            }
            .subtitle {
                color: #cbd5e1;  /* Lighter color for better visibility */
                font-size: 18px;
            }
            .code {
                background-color: #0f172a;  /* Darker background for contrast */
                padding: 20px;
                border-radius: 8px;
                font-size: 32px;
                font-weight: bold;
                text-align: center;
                letter-spacing: 8px;
                margin: 24px 0;
                color: #38bdf8;  /* Bright blue for emphasis */
                border: 1px solid #334155;
            }
            .footer {
                text-align: center;
                margin-top: 32px;
                padding-top: 24px;
                border-top: 1px solid #334155;
                color: #cbd5e1;  /* Lighter color for better visibility */
                font-size: 14px;
            }
            .warning {
                background-color: #0f172a;  /* Darker background for contrast */
                border: 1px solid #334155;
                border-radius: 8px;
                padding: 16px;
                color: #cbd5e1;  /* Lighter color for better visibility */
                font-style: italic;
                margin-top: 24px;
                font-size: 14px;
            }
            .heading {
                color: #38bdf8;  /* Bright blue for headings */
                font-size: 24px;
                font-weight: bold;
                margin-bottom: 16px;
            }
            .signature {
                color: #38bdf8;  /* Bright blue for signature */
                font-weight: bold;
            }
            p {
                color: #e2e8f0;  /* Ensure paragraph text is visible */
                margin-bottom: 16px;
            }
        """

        if purpose == 'email_verification':
            msg['Subject'] = "Welcome to WhirlWatch - Verify Your Account"
            html = f"""
            <html>
                <head>
                    <style>{styles}</style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <div class="logo">🎬 WhirlWatch</div>
                            <div class="subtitle">Track, Share, and Discover Together</div>
                        </div>
                        
                        <div class="heading">Welcome to WhirlWatch!</div>
                        
                        <p>Thank you for joining WhirlWatch. To start tracking your favorite movies and TV shows, please verify your account using this code:</p>
                        
                        <div class="code">{code}</div>
                        
                        <p>This verification code will expire in 15 minutes for security purposes.</p>
                        
                        <div class="warning">
                            If you didn't create an account with WhirlWatch, you can safely ignore this email.
                        </div>
                        
                        <div class="footer">
                            <p>Best regards,<br>
                            <span class="signature">Alex Redshaw</span><br>
                            WhirlWatch Developer</p>
                            <p>This is an automated message, please do not reply.</p>
                        </div>
                    </div>
                </body>
            </html>
            """
        else:  # password_reset
            msg['Subject'] = "WhirlWatch - Password Reset Request"
            html = f"""
            <html>
                <head>
                    <style>{styles}</style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <div class="logo">🎬 WhirlWatch</div>
                            <div class="subtitle">Account Security</div>
                        </div>
                        
                        <div class="heading">Password Reset Request</div>
                        
                        <p>We received a request to reset your WhirlWatch password. Use this verification code to complete the process:</p>
                        
                        <div class="code">{code}</div>
                        
                        <p>This verification code will expire in 15 minutes for security purposes.</p>
                        
                        <div class="warning">
                            If you didn't request this password reset, please ignore this email and ensure your account is secure.
                        </div>
                        
                        <div class="footer">
                            <p>Best regards,<br>
                            <span class="signature">Alex Redshaw</span><br>
                            WhirlWatch Developer</p>
                            <p>This is an automated message, please do not reply.</p>
                        </div>
                    </div>
                </body>
            </html>
            """

        # Create both plain text and HTML versions
        text_content = f"""
        {'Welcome to WhirlWatch!' if purpose == 'email_verification' else 'WhirlWatch - Password Reset'}
        
        Your verification code is: {code}
        
        This code will expire in 15 minutes.
        
        If you didn't {('create an account with WhirlWatch' if purpose == 'email_verification' else 'request this password reset')}, please ignore this email.
        
        Best regards,
        Alex Redshaw
        WhirlWatch Developer
        """

        # Attach both versions
        part1 = MIMEText(text_content, 'plain')
        part2 = MIMEText(html, 'html')
        msg.attach(part1)
        msg.attach(part2)

        # Gmail SMTP settings
        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls()
        
        try:
            server.login(app.config['MAIL_USERNAME'], app.config['MAIL_PASSWORD'])
        except smtplib.SMTPAuthenticationError as e:
            print(f"SMTP Authentication Error: {str(e)}")
            raise Exception("Email authentication failed - check credentials")
            
        server.send_message(msg)
        server.quit()
        return True
    except Exception as e:
        print(f"Email error: {str(e)}")
        return False

@app.route('/api/reset-password/request', methods=['POST'])
@limiter.limit("3 per 60 minutes")
def request_password_reset():
    try:
        data = request.get_json()
        email = data.get('email')
        
        if not email:
            raise BadRequest('Email is required')
            
        user = User.query.filter_by(email=email).first()
        if not user:
            return jsonify({
                'message': 'If an account exists with this email, a verification code will be sent',
                'status': 'no_account'
            }), 200
            
        # Generate verification code
        verification_code = ''.join(secrets.choice('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ') for _ in range(6))
        
        # Save verification code
        new_code = VerificationCode(
            user_id=user.id,
            code=verification_code,
            purpose='password_reset'
        )
        db.session.add(new_code)
        db.session.commit()
        
        # Send email
        if not send_verification_email(user.email, verification_code):
            raise Exception("Failed to send verification email")
            
        return jsonify({
            'message': 'If an account exists with this email, a verification code will be sent',
            'status': 'code_sent'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/reset-password/verify-code', methods=['POST'])
@limiter.limit("5 per 15 minutes")
def verify_reset_code():
    try:
        data = request.get_json()
        email = data.get('email')
        code = data.get('code')
        
        if not email or not code:
            raise BadRequest('Email and verification code are required')
            
        user = User.query.filter_by(email=email).first()
        if not user:
            raise BadRequest('Invalid verification code')
            
        verification = VerificationCode.query.filter_by(
            user_id=user.id,
            code=code,
            purpose='password_reset',
            used=False
        ).order_by(VerificationCode.created_at.desc()).first()
        
        if not verification:
            raise BadRequest('Invalid verification code')
            
        if datetime.utcnow() - verification.created_at > timedelta(minutes=15):
            raise BadRequest('Verification code has expired')
            
        verification.used = True
        db.session.commit()
        
        reset_token = create_access_token(
            identity=user.id,
            expires_delta=timedelta(minutes=15)
        )
        
        return jsonify({
            'message': 'Code verified successfully',
            'reset_token': reset_token
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/verify-email', methods=['POST'])
@limiter.limit("5 per 15 minutes")
def verify_email():
    try:
        data = request.get_json()
        email = data.get('email')
        code = data.get('code')
        
        if not email or not code:
            raise BadRequest('Email and verification code are required')
            
        user = User.query.filter_by(email=email).first()
        if not user:
            raise BadRequest('Invalid verification code')
            
        verification = VerificationCode.query.filter_by(
            user_id=user.id,
            code=code,
            purpose='email_verification',
            used=False
        ).order_by(VerificationCode.created_at.desc()).first()
        
        if not verification:
            raise BadRequest('Invalid verification code')
            
        if datetime.utcnow() - verification.created_at > timedelta(minutes=15):
            raise BadRequest('Verification code has expired')
            
        verification.used = True
        user.email_verified = True
        db.session.commit()
        
        access_token = create_access_token(identity=user.id)
        refresh_token = create_refresh_token(identity=user.id)
        
        return jsonify({
            'message': 'Email verified successfully',
            'access_token': access_token,
            'refresh_token': refresh_token,
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/resend-verification', methods=['POST'])
@limiter.limit("2 per 15 minutes")
def resend_verification():
    try:
        data = request.get_json()
        email = data.get('email')
        
        if not email:
            raise BadRequest('Email is required')
            
        user = User.query.filter_by(email=email).first()
        if not user:
            return jsonify({
                'message': 'If an account exists with this email, a verification code will be sent'
            }), 200
            
        verification_code = ''.join(secrets.choice('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ') for _ in range(6))
        
        new_code = VerificationCode(
            user_id=user.id,
            code=verification_code,
            purpose='email_verification'
        )
        db.session.add(new_code)
        db.session.commit()
        
        if not send_verification_email(user.email, verification_code, purpose='email_verification'):
            raise Exception("Failed to send verification email")
            
        return jsonify({
            'message': 'Verification code sent successfully'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    try:
        with app.app_context():
            db.create_all()
        app.run(debug=True)
    except Exception as e:
        print(f"Failed to start application: {str(e)}")
