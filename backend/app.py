from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from werkzeug.security import generate_password_hash, check_password_hash
import requests
import os
from datetime import datetime, timedelta
import uuid
from dotenv import load_dotenv
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
from werkzeug.exceptions import BadRequest, Unauthorized, NotFound, Forbidden

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

db = SQLAlchemy(app)
jwt = JWTManager(app)

# Models
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128))
    lists = db.relationship('MediaList', backref='owner', lazy=True)

class MediaList(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.String(500))
    owner_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    share_code = db.Column(db.String(8), unique=True)
    media_items = db.relationship('MediaInList', backref='media_list', lazy=True)
    shared_with = db.relationship('SharedList', backref='media_list', lazy=True)

class MediaInList(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    list_id = db.Column(db.Integer, db.ForeignKey('media_list.id'), nullable=False)
    tmdb_id = db.Column(db.Integer, nullable=False)
    media_type = db.Column(db.String(10), nullable=False)  # 'movie' or 'tv'
    added_date = db.Column(db.DateTime, default=datetime.utcnow)
    watch_status = db.Column(db.String(20), default='not_watched', nullable=False)
    rating = db.Column(db.Integer)
    # For TV shows
    current_season = db.Column(db.Integer)
    current_episode = db.Column(db.Integer)
    total_episodes_watched = db.Column(db.Integer, default=0)

class SharedList(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    list_id = db.Column(db.Integer, db.ForeignKey('media_list.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)

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
                        'username': 'string (required)',
                        'email': 'string (required)',
                        'password': 'string (required)'
                    }
                },
                '/api/login': {
                    'method': 'POST',
                    'description': 'Login user',
                    'parameters': {
                        'username': 'string (required)',
                        'password': 'string (required)'
                    }
                },
                '/api/verify-token': {
                    'method': 'GET',
                    'description': 'Verify JWT token and get user info',
                    'authentication': 'JWT Bearer Token required'
                }
            },
            'lists': {
                '/api/lists': {
                    'methods': ['GET', 'POST'],
                    'description': 'Get all lists for authenticated user or create new list',
                    'authentication': 'JWT Bearer Token required',
                    'POST_parameters': {
                        'name': 'string (required)',
                        'description': 'string (optional)'
                    }
                },
                '/api/lists/<list_id>': {
                    'methods': ['GET', 'PUT', 'DELETE'],
                    'description': 'Get, update or delete specific list',
                    'authentication': 'JWT Bearer Token required',
                    'PUT_parameters': {
                        'name': 'string (optional)',
                        'description': 'string (optional)'
                    }
                },
                '/api/lists/<list_id>/share': {
                    'method': 'POST',
                    'description': 'Generate share code for list',
                    'authentication': 'JWT Bearer Token required'
                },
                '/api/lists/join': {
                    'method': 'POST',
                    'description': 'Join a shared list using share code',
                    'authentication': 'JWT Bearer Token required',
                    'parameters': {
                        'share_code': 'string (required)'
                    }
                }
            },
            'media': {
                '/api/search': {
                    'method': 'GET',
                    'description': 'Search for movies or TV shows',
                    'authentication': 'JWT Bearer Token required',
                    'parameters': {
                        'query': 'string (required)',
                        'type': 'string (optional, default: movie)',
                        'page': 'integer (optional, default: 1)'
                    }
                },
                '/api/<media_type>/<media_id>': {
                    'method': 'GET',
                    'description': 'Get detailed information about a movie or TV show',
                    'authentication': 'JWT Bearer Token required',
                    'parameters': {
                        'media_type': 'string (required, movie or tv)',
                        'media_id': 'integer (required)'
                    }
                },
                '/api/lists/<list_id>/media': {
                    'methods': ['GET', 'POST'],
                    'description': 'Get all media in list or add new media',
                    'authentication': 'JWT Bearer Token required',
                    'POST_parameters': {
                        'tmdb_id': 'integer (required)',
                        'media_type': 'string (required, movie or tv)',
                        'watch_status': 'string (optional)',
                        'rating': 'integer (optional)',
                        'current_season': 'integer (optional, TV only)',
                        'current_episode': 'integer (optional, TV only)',
                        'total_episodes_watched': 'integer (optional, TV only)'
                    }
                },
                '/api/lists/<list_id>/media/<media_id>': {
                    'methods': ['GET', 'PUT', 'DELETE'],
                    'description': 'Get, update or delete media from list',
                    'authentication': 'JWT Bearer Token required',
                    'PUT_parameters': {
                        'watch_status': 'string (optional)',
                        'rating': 'integer (optional)',
                        'current_season': 'integer (optional, TV only)',
                        'current_episode': 'integer (optional, TV only)',
                        'total_episodes_watched': 'integer (optional, TV only)'
                    }
                }
            }
        },
        'authentication': {
            'type': 'JWT Bearer Token',
            'header': 'Authorization: Bearer <token>'
        },
        'errors': {
            '400': 'Bad Request - Invalid input parameters',
            '401': 'Unauthorized - Authentication required or failed',
            '403': 'Forbidden - Insufficient permissions',
            '404': 'Not Found - Resource does not exist',
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
        
        if User.query.filter_by(username=data['username']).first():
            raise BadRequest('Username already exists')
            
        if User.query.filter_by(email=data['email']).first():
            raise BadRequest('Email already exists')
        
        user = User(
            username=data['username'],
            email=data['email'],
            password_hash=generate_password_hash(data['password'])
        )
        db.session.add(user)
        db.session.commit()
        
        return jsonify({'message': 'User created successfully'}), 201
        
    except IntegrityError:
        db.session.rollback()
        return jsonify({'error': 'Database integrity error'}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/login', methods=['POST'])
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
        return jsonify({
            'access_token': access_token,
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email
            }
        }), 200
        
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
            
        new_list = MediaList(
            name=data['name'],
            description=data.get('description', ''),
            owner_id=current_user_id,
            share_code=str(uuid.uuid4())[:8]
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

@app.route('/api/lists/join/<share_code>', methods=['POST'])
@jwt_required()
def join_list(share_code):
    try:
        current_user_id = get_jwt_identity()
        movie_list = MediaList.query.filter_by(share_code=share_code).first()
        
        if not movie_list:
            raise NotFound("Invalid share code")
            
        if movie_list.owner_id == current_user_id:
            raise BadRequest("Cannot join your own list")
            
        existing_share = SharedList.query.filter_by(
            list_id=movie_list.id, 
            user_id=current_user_id
        ).first()
        
        if existing_share:
            raise BadRequest("Already joined this list")
        
        shared_list = SharedList(list_id=movie_list.id, user_id=current_user_id)
        db.session.add(shared_list)
        db.session.commit()
        
        return jsonify({'message': 'Successfully joined list'}), 200
        
    except Exception as e:
        db.session.rollback()
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
            media_items = [{
                'id': item.id,
                'tmdb_id': item.tmdb_id,
                'media_type': item.media_type,
                'watch_status': item.watch_status,
                'rating': item.rating,
                'current_season': item.current_season,
                'current_episode': item.current_episode,
                'total_episodes_watched': item.total_episodes_watched
            } for item in lst.media_items]
            
            all_lists.append({
                'id': lst.id,
                'name': lst.name,
                'description': lst.description,
                'is_owner': True,
                'share_code': lst.share_code,
                'media_items': media_items
            })
        
        # Process shared lists
        for lst in shared_lists:
            media_items = [{
                'id': item.id,
                'tmdb_id': item.tmdb_id,
                'media_type': item.media_type,
                'watch_status': item.watch_status,
                'rating': item.rating,
                'current_season': item.current_season,
                'current_episode': item.current_episode,
                'total_episodes_watched': item.total_episodes_watched
            } for item in lst.media_items]
            
            all_lists.append({
                'id': lst.id,
                'name': lst.name,
                'description': lst.description,
                'is_owner': False,
                'owner': {
                    'id': lst.owner.id,
                    'username': lst.owner.username
                },
                'share_code': lst.share_code,
                'media_items': media_items
            })
        
        return jsonify({'lists': all_lists}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# TMDB API routes
@app.route('/api/search')
@jwt_required()
def search_media():
    try:
        query = request.args.get('query', '')
        media_type = request.args.get('type', 'movie')  # 'movie' or 'tv'
        
        if not query:
            raise BadRequest('No search query provided')
        
        if media_type not in ['movie', 'tv']:
            raise BadRequest('Invalid media type')
        
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
        
        return jsonify(response.json()), 200
        
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
        if media_list.owner_id != current_user_id:
            raise Forbidden("Not authorized to add to this list")
            
        new_media = MediaInList(
            list_id=list_id,
            tmdb_id=data['tmdb_id'],
            media_type=data['media_type'],
            watch_status=data.get('watch_status', 'not_watched'),
            current_season=data.get('current_season'),
            current_episode=data.get('current_episode'),
            total_episodes_watched=data.get('total_episodes_watched', 0)
        )
        
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
        if media_list.owner_id != current_user_id:
            raise Forbidden("Not authorized to update this media")
            
        # Update basic fields
        if 'watch_status' in data:
            media.watch_status = data['watch_status']
        if 'rating' in data:
            media.rating = data['rating']
            
        # Update TV show specific fields
        if media.media_type == 'tv':
            if 'current_season' in data:
                media.current_season = data['current_season']
            if 'current_episode' in data:
                media.current_episode = data['current_episode']
            if 'total_episodes_watched' in data:
                media.total_episodes_watched = data['total_episodes_watched']
                
        db.session.commit()
        
        return jsonify({'message': 'Status updated successfully'}), 200
        
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
