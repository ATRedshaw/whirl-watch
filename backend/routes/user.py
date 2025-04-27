"""
Update / delete profile endpoints.
"""
from flask import Blueprint, request, jsonify, current_app
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.exceptions import BadRequest, Unauthorized
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db, limiter
from models import User, MediaInList, SharedList, VerificationCode, MediaList, Media, UserMediaRating
from sqlalchemy import or_, desc
import requests

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


# ------------------------- User Media Collection ------------------------- #
@user_bp.route("/user/media", methods=["GET", "OPTIONS"])
@jwt_required()
def get_user_media():
    # Handle OPTIONS request for CORS preflight
    if request.method == "OPTIONS":
        return "", 200

    try:
        current_user_id = get_jwt_identity()
        
        # Get all lists the user has access to (as owner or shared)
        user_lists = MediaList.query.filter(
            or_(MediaList.owner_id == current_user_id,
                MediaList.id.in_(
                    db.session.query(SharedList.list_id).filter(SharedList.user_id == current_user_id)
                )
            )
        ).all()
        
        if not user_lists:
            return jsonify({"media_items": []}), 200
        
        # Get all media items from these lists
        list_ids = [lst.id for lst in user_lists]
        list_id_to_name = {lst.id: lst.name for lst in user_lists}
        
        # Create a dictionary to map list IDs to their names
        query = db.session.query(
            Media, MediaInList, UserMediaRating
        ).join(
            MediaInList, Media.id == MediaInList.media_id
        ).outerjoin(
            UserMediaRating, 
            (Media.id == UserMediaRating.media_id) & (UserMediaRating.user_id == current_user_id)
        ).filter(
            MediaInList.list_id.in_(list_ids)
        ).order_by(
            desc(MediaInList.last_updated)
        ).all()
        
        media_items = []
        for media, media_in_list, user_rating in query:
            # Get media details from TMDB
            try:
                tmdb_api_key = current_app.config["TMDB_API_KEY"]
                
                # Fetch media details from TMDB
                resp = requests.get(
                    f"https://api.themoviedb.org/3/{media.media_type}/{media.tmdb_id}",
                    params={
                        "api_key": tmdb_api_key,
                        "language": "en-US",
                    },
                    timeout=5,
                )
                
                if resp.status_code != 200:
                    current_app.logger.warning(f"Failed to fetch details for {media.media_type}/{media.tmdb_id}: {resp.status_code}")
                    continue
                
                tmdb_data = resp.json()
                
                # Determine the title field based on media type
                title = tmdb_data.get("title" if media.media_type == "movie" else "name", "Unknown Title")
                
                # Build the media item with data from TMDB
                item = {
                    "id": media_in_list.id,
                    "title": title,
                    "media_type": media.media_type,
                    "poster_path": tmdb_data.get("poster_path"),
                    "backdrop_path": tmdb_data.get("backdrop_path"),
                    "tmdb_id": media.tmdb_id,
                    "overview": tmdb_data.get("overview"),
                    "watch_status": user_rating.watch_status if user_rating else "not_watched",
                    "rating": user_rating.rating if user_rating else None,
                    "last_updated": (user_rating.updated_at if user_rating else media_in_list.last_updated).isoformat(),
                    "list_id": media_in_list.list_id,
                    "list_name": list_id_to_name.get(media_in_list.list_id, "Unknown List")
                }
                media_items.append(item)
                
            except Exception as fetch_error:
                current_app.logger.error(f"Error fetching TMDB data: {str(fetch_error)}")
                continue
        
        return jsonify({"media_items": media_items}), 200
    
    except Exception as e:
        current_app.logger.error(f"Error fetching user media: {str(e)}", exc_info=True)
        return jsonify({"error": str(e)}), 500


# ------------------------- User Media Update ------------------------- #
@user_bp.route("/user/media/<int:media_id>", methods=["PUT", "DELETE", "OPTIONS"])
@jwt_required()
def update_user_media(media_id):
    # Handle OPTIONS request for CORS preflight
    if request.method == "OPTIONS":
        return "", 200
        
    try:
        current_user_id = get_jwt_identity()
        
        # Find the media_in_list entry
        media_in_list = MediaInList.query.get_or_404(media_id)
        
        # Verify user has access to this list
        list_access = db.session.query(MediaList).filter(
            or_(
                MediaList.id == media_in_list.list_id,
                MediaList.owner_id == current_user_id,
                MediaList.id.in_(
                    db.session.query(SharedList.list_id).filter(SharedList.user_id == current_user_id)
                )
            )
        ).first()
        
        if not list_access:
            return jsonify({"error": "You don't have access to this media item"}), 403
        
        # DELETE request - remove media from list
        if request.method == "DELETE":
            db.session.delete(media_in_list)
            db.session.commit()
            return jsonify({"message": "Media removed from list"}), 200
        
        # PUT request - update media status/rating
        data = request.get_json() or {}
        
        if "watch_status" in data:
            media_in_list.watch_status = data["watch_status"]
            
        if "rating" in data:
            # Rating can be null or a number between 1-10
            if data["rating"] is not None and (float(data["rating"]) < 1 or float(data["rating"]) > 10):
                return jsonify({"error": "Rating must be between 1 and 10"}), 400
            media_in_list.rating = data["rating"]
            
        if "last_updated" in data:
            media_in_list.last_updated = data["last_updated"]
            
        db.session.commit()
        
        return jsonify({
            "message": "Media updated successfully",
            "media": {
                "id": media_in_list.id,
                "watch_status": media_in_list.watch_status,
                "rating": media_in_list.rating,
                "last_updated": media_in_list.last_updated.isoformat()
            }
        }), 200
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error updating user media: {str(e)}", exc_info=True)
        return jsonify({"error": str(e)}), 500


# ------------------------- User Activity Feed ------------------------- #
@user_bp.route("/user/feed", methods=["GET", "OPTIONS"])
@jwt_required()
def get_user_feed():
    # Handle OPTIONS request for CORS preflight
    if request.method == "OPTIONS":
        return "", 200
        
    try:
        current_user_id = get_jwt_identity()
        
        # Get all lists the user has access to
        user_lists = MediaList.query.filter(
            or_(MediaList.owner_id == current_user_id,
                MediaList.id.in_(
                    db.session.query(SharedList.list_id).filter(SharedList.user_id == current_user_id)
                )
            )
        ).all()
        
        if not user_lists:
            return jsonify({"feed_items": []}), 200
        
        # Get list IDs
        list_ids = [lst.id for lst in user_lists]
        
        # Get recent activity from these lists (excluding current user's activity)
        # Limit to 20 most recent items
        recent_activity = db.session.query(
            MediaInList, Media, User
        ).join(
            Media, Media.id == MediaInList.media_id
        ).join(
            User, User.id == MediaInList.added_by_id
        ).filter(
            MediaInList.list_id.in_(list_ids),
            MediaInList.added_by_id != current_user_id  # Exclude current user's activity
        ).order_by(
            desc(MediaInList.last_updated)
        ).limit(20).all()
        
        feed_items = []
        for media_in_list, media, user in recent_activity:
            # Fetch media details from TMDB
            try:
                tmdb_api_key = current_app.config["TMDB_API_KEY"]
                
                # Get media details from TMDB
                resp = requests.get(
                    f"https://api.themoviedb.org/3/{media.media_type}/{media.tmdb_id}",
                    params={
                        "api_key": tmdb_api_key,
                        "language": "en-US",
                    },
                    timeout=5,
                )
                
                if resp.status_code != 200:
                    current_app.logger.warning(f"Failed to fetch details for {media.media_type}/{media.tmdb_id}: {resp.status_code}")
                    continue
                
                tmdb_data = resp.json()
                
                # Determine the title field based on media type
                title = tmdb_data.get("title" if media.media_type == "movie" else "name", "Unknown Title")
                
                # Determine action based on watch status from UserMediaRating
                action = "added"
                user_rating = UserMediaRating.query.filter_by(
                    user_id=user.id, 
                    media_id=media.id
                ).first()
                
                if user_rating:
                    if user_rating.watch_status == "completed":
                        action = "completed watching"
                    elif user_rating.watch_status == "in_progress":
                        action = "started watching"
                
                # Get list name
                list_name = next((lst.name for lst in user_lists if lst.id == media_in_list.list_id), "Unknown List")
                
                item = {
                    "id": media_in_list.id,
                    "user_id": user.id,
                    "user_name": user.username,
                    "media_id": media.id,
                    "media_title": title,
                    "media_type": media.media_type,
                    "poster_path": tmdb_data.get("poster_path"),
                    "list_id": media_in_list.list_id,
                    "list_name": list_name,
                    "action": action,
                    "watch_status": user_rating.watch_status if user_rating else "not_watched",
                    "rating": user_rating.rating if user_rating else None,
                    "timestamp": media_in_list.last_updated.isoformat()
                }
                feed_items.append(item)
                
            except Exception as fetch_error:
                current_app.logger.error(f"Error fetching TMDB data for feed: {str(fetch_error)}")
                continue
        
        return jsonify({"feed_items": feed_items}), 200
        
    except Exception as e:
        current_app.logger.error(f"Error fetching user feed: {str(e)}", exc_info=True)
        return jsonify({"error": str(e)}), 500
