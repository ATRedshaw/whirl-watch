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
            # Validate username length
            if len(data["username"]) > 15:
                raise BadRequest("Username must be 15 characters or less")
                
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
        # Also delete all user ratings
        UserMediaRating.query.filter_by(user_id=current_user_id).delete()
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
                    "list_name": list_id_to_name.get(media_in_list.list_id, "Unknown List"),
                    # Include release date fields from TMDB
                    "release_date": tmdb_data.get("release_date"),
                    "first_air_date": tmdb_data.get("first_air_date"),
                    # Include TMDB rating
                    "vote_average": tmdb_data.get("vote_average")
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


# ------------------------- User Activity Feeds ------------------------- #
# GET /feed/self → "Things I've done"
@user_bp.route("/feed/self", methods=["GET", "OPTIONS"])
@jwt_required()
def get_user_self_feed():
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
        
        # Create a mapping of list IDs to names for later use
        list_id_to_name = {lst.id: lst.name for lst in user_lists}
        
        # Get media items for the self feed
        media_query = (
            db.session.query(MediaInList, Media, UserMediaRating)
            .join(Media, Media.id == MediaInList.media_id)
            .outerjoin(
                UserMediaRating,
                (UserMediaRating.media_id == Media.id) & (UserMediaRating.user_id == current_user_id)
            )
            .filter(
                MediaInList.list_id.in_(list_ids),
                or_(
                    # Added → include only if added_by_id == current_user.id
                    (MediaInList.added_by_id == current_user_id),
                    # In-progress/Completed → include if list_member_id (user_id in UserMediaRating) == current_user.id
                    (UserMediaRating.user_id == current_user_id) & 
                    (UserMediaRating.watch_status.in_(["in_progress", "completed"]))
                )
            )
            .order_by(desc(db.func.coalesce(UserMediaRating.updated_at, MediaInList.last_updated)))
        ).all()
        
        # De-duplication by media_id (single response)
        # Using a dictionary to keep only the most recent update for each media item
        deduplicated_items = {}
        
        feed_items = []
        for media_in_list, media, user_rating in media_query:
            # Skip if we've already processed a more recent update for this media
            if media.id in deduplicated_items:
                continue
                
            # Mark this media as processed
            deduplicated_items[media.id] = True
            
            # Fetch media details from TMDB
            try:
                tmdb_api_key = current_app.config["TMDB_API_KEY"]
                
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
                action = "added to your list"
                status = user_rating.watch_status if user_rating else "not_watched"
                
                if user_rating:
                    if user_rating.watch_status == "completed":
                        action = "completed watching"
                    elif user_rating.watch_status == "in_progress":
                        action = "started watching"
                    
                    # Include rating info if available
                    if user_rating.rating:
                        action += f" and rated {user_rating.rating}/10"
                
                # Create feed item
                item = {
                    "id": media_in_list.id,
                    "user_id": current_user_id,
                    "media_id": media.id,
                    "media_title": title,
                    "media_type": media.media_type,
                    "poster_path": tmdb_data.get("poster_path"),
                    "overview": tmdb_data.get("overview"),
                    "vote_average": tmdb_data.get("vote_average"),
                    "release_date": tmdb_data.get("release_date"),
                    "first_air_date": tmdb_data.get("first_air_date"),
                    "list_id": media_in_list.list_id,
                    "list_name": list_id_to_name.get(media_in_list.list_id, "Unknown List"),
                    "action": action,
                    "watch_status": status,
                    "rating": user_rating.rating if user_rating else None,
                    "timestamp": (user_rating.updated_at if user_rating else media_in_list.last_updated).isoformat(),
                    "tmdb_id": media.tmdb_id,
                    "added_by_id": media_in_list.added_by_id
                }
                feed_items.append(item)
                
            except Exception as fetch_error:
                current_app.logger.error(f"Error fetching TMDB data for feed: {str(fetch_error)}")
                continue
        
        return jsonify({"feed_items": feed_items[:20]}), 200  # Limit to 20 items
        
    except Exception as e:
        current_app.logger.error(f"Error fetching self feed: {str(e)}", exc_info=True)
        return jsonify({"error": str(e)}), 500


# GET /feed/collaborators → "Things my teammates did in our shared lists"
@user_bp.route("/feed/collaborators", methods=["GET", "OPTIONS"])
@jwt_required()
def get_user_collaborators_feed():
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
        
        # Create a mapping of list IDs to names for later use
        list_id_to_name = {lst.id: lst.name for lst in user_lists}
        
        # De-duplication dictionaries
        # 1. For "Added" events - track by (media_id, added_by_id)
        added_items = {}
        
        # 2. For "In-progress"/"Completed" events - track by (media_id, user_id)
        status_items = {}
        
        # Process feed items from collaborators
        feed_items = []
        
        # Process "Added" actions - only include if added_by_id ≠ current_user.id AND added_by_id == event_author.id
        added_media_query = (
            db.session.query(MediaInList, Media, User)
            .join(Media, Media.id == MediaInList.media_id)
            .join(User, User.id == MediaInList.added_by_id)
            .filter(
                MediaInList.list_id.in_(list_ids),
                MediaInList.added_by_id != current_user_id  # Added by someone else, not the current user
            )
            .order_by(desc(MediaInList.added_date))
        ).all()
        
        # First pass - process "Added" events
        for media_in_list, media, added_by_user in added_media_query:
            # Skip if we've already processed this (media, user) combination for "Added" events
            dedup_key = f"{media.id}:{added_by_user.id}:added"
            if dedup_key in added_items:
                continue
                
            # Mark as processed
            added_items[dedup_key] = True
            
            try:
                tmdb_api_key = current_app.config["TMDB_API_KEY"]
                
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
                
                # Create feed item for "Added" event
                item = {
                    "id": media_in_list.id,
                    "user_id": added_by_user.id,
                    "user_name": added_by_user.username,
                    "media_id": media.id,
                    "media_title": title,
                    "media_type": media.media_type,
                    "poster_path": tmdb_data.get("poster_path"),
                    "overview": tmdb_data.get("overview"),
                    "vote_average": tmdb_data.get("vote_average"),
                    "release_date": tmdb_data.get("release_date"),
                    "first_air_date": tmdb_data.get("first_air_date"),
                    "list_id": media_in_list.list_id,
                    "list_name": list_id_to_name.get(media_in_list.list_id, "Unknown List"),
                    "action": "added to their watchlist",
                    "watch_status": "not_watched",
                    "rating": None,
                    "timestamp": media_in_list.added_date.isoformat(),
                    "tmdb_id": media.tmdb_id,
                    "added_by_id": media_in_list.added_by_id
                }
                feed_items.append(item)
                
            except Exception as fetch_error:
                current_app.logger.error(f"Error fetching TMDB data for feed: {str(fetch_error)}")
                continue
        
        # Second pass - process "In-progress" and "Completed" events
        # In-progress & Completed / Rated → include when list_member_id ≠ current_user.id
        status_query = (
            db.session.query(MediaInList, Media, UserMediaRating, User)
            .join(Media, Media.id == MediaInList.media_id)
            .join(
                UserMediaRating,
                (UserMediaRating.media_id == Media.id) & 
                (UserMediaRating.watch_status.in_(["in_progress", "completed"]))
            )
            .join(User, User.id == UserMediaRating.user_id)
            .filter(
                MediaInList.list_id.in_(list_ids),
                UserMediaRating.user_id != current_user_id  # Not the current user's status
            )
            .order_by(desc(UserMediaRating.updated_at))
        ).all()
        
        for media_in_list, media, user_rating, user in status_query:
            # Skip if we've already processed this (media, user) combination for status events
            dedup_key = f"{media.id}:{user.id}:{user_rating.watch_status}"
            if dedup_key in status_items:
                continue
                
            # Mark as processed
            status_items[dedup_key] = True
            
            try:
                tmdb_api_key = current_app.config["TMDB_API_KEY"]
                
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
                
                # Determine action based on watch status
                action = "added to their list"
                if user_rating.watch_status == "completed":
                    action = "completed watching"
                elif user_rating.watch_status == "in_progress":
                    action = "started watching"
                
                # Include rating info if available
                if user_rating.rating is not None:
                    action += f" and rated {user_rating.rating}/10"
                
                # Create feed item for status update
                item = {
                    "id": media_in_list.id,
                    "user_id": user.id,
                    "user_name": user.username,
                    "media_id": media.id,
                    "media_title": title,
                    "media_type": media.media_type,
                    "poster_path": tmdb_data.get("poster_path"),
                    "overview": tmdb_data.get("overview"),
                    "vote_average": tmdb_data.get("vote_average"),
                    "release_date": tmdb_data.get("release_date"),
                    "first_air_date": tmdb_data.get("first_air_date"),
                    "list_id": media_in_list.list_id,
                    "list_name": list_id_to_name.get(media_in_list.list_id, "Unknown List"),
                    "action": action,
                    "watch_status": user_rating.watch_status,
                    "rating": user_rating.rating,
                    "timestamp": user_rating.updated_at.isoformat(),
                    "tmdb_id": media.tmdb_id,
                    "added_by_id": media_in_list.added_by_id
                }
                feed_items.append(item)
                
            except Exception as fetch_error:
                current_app.logger.error(f"Error fetching TMDB data for feed: {str(fetch_error)}")
                continue
        
        # Sort by timestamp, most recent first
        feed_items.sort(key=lambda x: x["timestamp"], reverse=True)
        
        return jsonify({"feed_items": feed_items[:20]}), 200  # Limit to 20 items
        
    except Exception as e:
        current_app.logger.error(f"Error fetching collaborators feed: {str(e)}", exc_info=True)
        return jsonify({"error": str(e)}), 500


# Legacy endpoint - redirects to self feed for backward compatibility
@user_bp.route("/user/feed", methods=["GET", "OPTIONS"])
@jwt_required()
def get_user_feed():
    # Handle OPTIONS request for CORS preflight
    if request.method == "OPTIONS":
        return "", 200
    
    # Redirect to the new self feed endpoint
    return get_user_self_feed()
