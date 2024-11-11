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
                        'password': 'string (required) - 6 to 128 characters',
                        'security_question': 'string (required) - must be one of the predefined questions',
                        'security_answer': 'string (required)'
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
                '/api/reset-password/get-question': {
                    'method': 'POST',
                    'description': 'Get security question for username',
                    'parameters': {
                        'username': 'string (required)'
                    },
                    'rate_limit': '5 per 15 minutes'
                },
                '/api/reset-password/verify': {
                    'method': 'POST',
                    'description': 'Verify security answer and get reset token',
                    'parameters': {
                        'username': 'string (required)',
                        'security_answer': 'string (required)'
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
                },
                '/api/user/security-question': {
                    'method': 'PUT',
                    'description': 'Update security question and answer',
                    'authentication': 'JWT Bearer Token required',
                    'parameters': {
                        'currentPassword': 'string (required)',
                        'security_question': 'string (required) - must be one of the predefined questions',
                        'security_answer': 'string (required)'
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
def register():
    try:
        data = request.get_json()
        if not data:
            raise BadRequest("No input data provided")
        
        required_fields = ['username', 'email', 'password']
        for field in required_fields:
            if field not in data:
                raise BadRequest(f"Missing required field: {field}")
        
        # Create user without security question fields
        user = User(
            username=data['username'],
            email=data['email'],
            password_hash=generate_password_hash(data['password'])
        )
        
        db.session.add(user)
        db.session.commit()
        
        return jsonify({
            'message': 'User created successfully',
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email
            }
        }), 201

    except IntegrityError:
        db.session.rollback()
        return jsonify({'error': 'Username or email already exists'}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/login', methods=['POST'])
@limiter.limit("5 per 15 minutes")  # Stricter limit for login attempts
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
            
        access_token = create_access_token(identity=user.id)
        refresh_token = create_refresh_token(identity=user.id)
        
        return jsonify({
            'access_token': access_token,
            'refresh_token': refresh_token,
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'security_question': user.security_question
            }
        }), 200
        
    except RateLimitExceeded:
        # Ensure rate limit responses are always JSON
        return jsonify({
            'error': 'Too many login attempts',
            'retry_after': get_retry_after()
        }), 429
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
                } for item in lst.media_items]
            })
        
        # Process shared lists
        for lst in shared_lists:
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
                } for item in lst.media_items]
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
                'email': user.email,
                'security_question': user.security_question
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
            added_date=datetime.utcnow()
        )
        
        # Update the list's last_updated timestamp
        media_list.last_updated = datetime.utcnow()
        
        db.session.add(new_media)
        db.session.commit()
        
        return jsonify({'message': 'Media added successfully', 'id': new_media.id}), 201
        
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
                    'rating': item.rating
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

@app.route('/api/lists/join', methods=['POST'])
@jwt_required()
def join_list():
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        
        if not data or 'share_code' not in data:
            raise BadRequest("Share code is required")
            
        share_code = data['share_code'].upper()  # Convert to uppercase
        
        # Find the list with the given share code
        media_list = MediaList.query.filter(
            func.upper(MediaList.share_code) == share_code
        ).first()
        if not media_list:
            raise NotFound("Invalid share code")
            
        # Check if user already owns the list
        if media_list.owner_id == current_user_id:
            raise BadRequest("You cannot join your own list")
            
        # Check if user already has access to the list
        existing_share = SharedList.query.filter_by(
            list_id=media_list.id,
            user_id=current_user_id
        ).first()
        
        if existing_share:
            raise BadRequest("You already have access to this list")
            
        # Create new shared access
        new_share = SharedList(
            list_id=media_list.id,
            user_id=current_user_id
        )
        
        db.session.add(new_share)
        db.session.commit()
        
        return jsonify({
            'message': 'Successfully joined list',
            'list_id': media_list.id
        }), 200
        
    except (BadRequest, NotFound) as e:
        return jsonify({'error': str(e)}), e.code
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
            
        # Find and delete the shared access
        shared_access = SharedList.query.filter_by(
            list_id=list_id,
            user_id=user_id
        ).first_or_404()
        
        db.session.delete(shared_access)
        db.session.commit()
        
        return jsonify({'message': 'User removed successfully'}), 200
        
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
            
        # Find and delete the shared access
        shared_access = SharedList.query.filter_by(
            list_id=list_id,
            user_id=current_user_id
        ).first_or_404()
        
        db.session.delete(shared_access)
        db.session.commit()
        
        return jsonify({'message': 'Successfully left the list'}), 200
        
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

# Add these new routes after your existing user routes

@app.route('/api/user/profile', methods=['PUT'])
@jwt_required()
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
def delete_account():
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get_or_404(current_user_id)
        data = request.get_json()

        # Verify password before deletion
        if not data or 'password' not in data:
            raise BadRequest('Password is required to delete account')

        if not check_password_hash(user.password_hash, data['password']):
            raise BadRequest('Invalid password')

        # Remove user from shared lists
        SharedList.query.filter_by(user_id=current_user_id).delete()

        # Delete user's lists and their contents
        for lst in user.lists:
            MediaInList.query.filter_by(list_id=lst.id).delete()
            SharedList.query.filter_by(list_id=lst.id).delete()
            db.session.delete(lst)

        # Delete the user
        db.session.delete(user)
        db.session.commit()

        return jsonify({'message': 'Account deleted successfully'}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# Add new routes for password reset
@app.route('/api/reset-password/verify', methods=['POST'])
@limiter.limit("5 per 15 minutes")
def verify_security_answer():
    try:
        data = request.get_json()
        username = data.get('username')
        
        user = User.query.filter_by(username=username).first()
        if not user:
            # Use same error message for security
            raise BadRequest('Invalid username or security answer')
            
        if not user.security_question:
            raise BadRequest('No security question set up for this account')
            
        if not check_password_hash(user.security_answer_hash, data.get('security_answer')):
            # Use same error message for security
            raise BadRequest('Invalid username or security answer')
            
        # Generate a temporary token for password reset
        reset_token = create_access_token(
            identity=user.id,
            expires_delta=timedelta(minutes=15)
        )
        
        return jsonify({
            'message': 'Security answer verified',
            'reset_token': reset_token
        }), 200
        
    except RateLimitExceeded:
        # Ensure rate limit responses are always JSON
        return jsonify({
            'error': 'Too many attempts',
            'retry_after': get_retry_after()
        }), 429
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def get_retry_after():
    """Get the retry-after time from rate limiter"""
    try:
        # Get retry-after from headers, or use default of 15 minutes
        retry_after = request.headers.get('Retry-After')
        return int(retry_after) if retry_after else 900
    except (ValueError, TypeError):
        return 900

@app.route('/api/reset-password/complete', methods=['POST'])
@jwt_required()
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

@app.route('/api/user/security-question', methods=['PUT'])
@jwt_required()
def update_security_question():
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get_or_404(current_user_id)
        data = request.get_json()

        # Validate required fields
        if not data.get('security_question') or not data.get('security_answer'):
            raise BadRequest('Security question and answer are required')

        # Verify current password before making changes
        if not check_password_hash(user.password_hash, data.get('currentPassword', '')):
            raise BadRequest('Current password is incorrect')

        user.security_question = data['security_question']
        user.security_answer_hash = generate_password_hash(data['security_answer'])
        db.session.commit()
        
        return jsonify({
            'message': 'Security question updated',
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'security_question': user.security_question
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/reset-password/get-question', methods=['POST'])
@limiter.limit("5 per 15 minutes")  # Add the same rate limit as verify endpoint
def get_security_question():
    try:
        data = request.get_json()
        username = data.get('username')
        
        if not username:
            raise BadRequest('Username is required')
            
        user = User.query.filter_by(username=username).first()
        if not user:
            raise NotFound('User not found')
            
        if not user.security_question:
            raise BadRequest('No security question set for this user')
            
        question_map = {
            'childhood_hero': 'Who was your childhood hero or role model?',
            'first_concert': 'What was the first concert you attended?',
            'childhood_nickname': 'What was your childhood nickname?',
            'first_job': 'What was your first paid job?',
            'favorite_teacher': 'What was the name of your favorite teacher?',
            'first_car': 'What was the make/model of your first car?',
            'met_spouse': 'In what city did you meet your spouse/significant other?',
            'grandparent_occupation': 'What was your maternal grandfather\'s occupation?',
            'childhood_street': 'What street did you live on in third grade?',
            'childhood_bestfriend': 'What was the name of your childhood best friend?',
            'first_pet': 'What was the name of your first pet?',
            'mothers_maiden': 'What is your mother\'s maiden name?',
            'elementary_school': 'What elementary school did you attend?',
            'birth_city': 'In what city were you born?',
            'first_phone': 'What was your first phone number?',
            'childhood_vacation': 'Where did you go on your first vacation?',
            'favorite_book': 'What was your favorite book as a child?',
            'first_movie': 'What was the first movie you saw in theaters?',
            'sports_team': 'What was the first sports team you supported?',
            'childhood_hobby': 'What was your favorite childhood hobby?',
            'first_computer': 'What was your first computer or gaming console?',
            'favorite_subject': 'What was your favorite subject in high school?',
            'first_language': 'What was the first foreign language you studied?',
            'childhood_dream': 'What did you want to be when you grew up?',
            'first_award': 'What was the first award or achievement you remember winning?'
        }
        
        question_text = question_map.get(user.security_question, user.security_question)
            
        return jsonify({
            'security_question': question_text
        }), 200
        
    except RateLimitExceeded:  # Add rate limit exceeded handler
        return jsonify({
            'error': 'Too many attempts',
            'retry_after': get_retry_after()
        }), 429
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.errorhandler(429)
def ratelimit_handler(e):
    return jsonify({
        'error': 'Too many attempts',
        'retry_after': get_retry_after()
    }), 429

@app.route('/api/reset-password/get-username', methods=['POST'])
@limiter.limit("5 per 15 minutes")
def get_username_by_email():
    try:
        data = request.get_json()
        email = data.get('email')
        
        if not email:
            raise BadRequest('Email is required')
            
        user = User.query.filter_by(email=email).first()
        if not user:
            # Use a vague error message for security
            raise NotFound('No account found with this email address')
            
        return jsonify({
            'username': user.username
        }), 200
        
    except RateLimitExceeded:
        return jsonify({
            'error': 'Too many attempts',
            'retry_after': get_retry_after()
        }), 429
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def send_verification_email(to_email, code):
    try:
        msg = MIMEMultipart()
        msg['From'] = app.config['MAIL_USERNAME']
        msg['To'] = to_email
        msg['Subject'] = "Whirl Watch - Password Reset Verification Code"

        body = f"""
        Your verification code is: {code}
        
        This code will expire in 15 minutes.
        If you didn't request this code, please ignore this email.
        
        Best regards,
        Alex Redshaw - Whirl Watch Developer
        """
        msg.attach(MIMEText(body, 'plain'))

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
@limiter.limit("5 per 15 minutes")
def request_password_reset():
    try:
        data = request.get_json()
        email = data.get('email')
        
        if not email:
            raise BadRequest('Email is required')
            
        user = User.query.filter_by(email=email).first()
        if not user:
            # Still return 200 for security, but with a different status
            return jsonify({
                'message': 'If an account exists with this email, a verification code will be sent',
                'status': 'no_account'  # Add this status field
            }), 200
            
        # Generate 6-digit alphanumeric code
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
            'status': 'code_sent'  # Add this status field
        }), 200
        
    except RateLimitExceeded:
        return jsonify({
            'error': 'Too many attempts',
            'retry_after': get_retry_after()
        }), 429
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
            
        # Find valid verification code
        verification = VerificationCode.query.filter_by(
            user_id=user.id,
            code=code,
            purpose='password_reset',
            used=False
        ).order_by(VerificationCode.created_at.desc()).first()
        
        if not verification:
            raise BadRequest('Invalid verification code')
            
        # Check if code is expired (15 minutes)
        if datetime.utcnow() - verification.created_at > timedelta(minutes=15):
            raise BadRequest('Verification code has expired')
            
        # Mark code as used
        verification.used = True
        db.session.commit()
        
        # Generate reset token
        reset_token = create_access_token(
            identity=user.id,
            expires_delta=timedelta(minutes=15)
        )
        
        return jsonify({
            'message': 'Code verified successfully',
            'reset_token': reset_token
        }), 200
        
    except RateLimitExceeded:
        return jsonify({
            'error': 'Too many attempts',
            'retry_after': get_retry_after()
        }), 429
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
