"""
All list, shared-list, and media-in-list operations.
Updated to support personal user ratings.
"""
import random, string, requests
from datetime import datetime
from flask import Blueprint, request, jsonify, current_app
from werkzeug.exceptions import BadRequest, Forbidden, NotFound
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import func
from extensions import db, limiter
from models import (
    MediaList,
    MediaInList,
    SharedList,
    User,
    Media,
    UserMediaRating,
)
from utils.helpers import (
    get_list_user_count,
    get_user_list_count,
)
from utils.ratings import (
    get_or_create_media,
    get_or_create_user_rating,
    update_user_rating,
    get_average_rating,
    get_user_ratings_for_list,
    get_all_ratings_for_media_in_list,
    clean_orphaned_ratings,
)
from config import MAX_USERS_PER_LIST, MAX_LISTS_PER_USER

lists_bp = Blueprint("lists_bp", __name__, url_prefix="/api")


# --------------------------- Create list -------------------------- #
@lists_bp.route("/lists", methods=["POST"])
@jwt_required()
def create_list():
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json() or {}
        if "name" not in data:
            raise BadRequest("List name is required")

        if get_user_list_count(current_user_id) >= MAX_LISTS_PER_USER:
            raise BadRequest(f"You can only be associated with up to {MAX_LISTS_PER_USER} lists")

        # generate unique share code
        share_code = "".join(random.choices(string.ascii_uppercase + string.digits, k=8))
        while MediaList.query.filter(func.upper(MediaList.share_code) == share_code).first():
            share_code = "".join(random.choices(string.ascii_uppercase + string.digits, k=8))

        new_list = MediaList(
            name=data["name"],
            description=data.get("description", ""),
            owner_id=current_user_id,
            share_code=share_code,
        )
        db.session.add(new_list)
        db.session.commit()
        return jsonify({"message": "List created", "list_id": new_list.id}), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# ----------------------------- Share ------------------------------ #
@lists_bp.route("/lists/<int:list_id>/share", methods=["POST"])
@jwt_required()
def share_list(list_id):
    try:
        current_user_id = get_jwt_identity()
        lst = MediaList.query.get_or_404(list_id)
        if lst.owner_id != current_user_id:
            raise Forbidden("You don't have permission to share this list")
        return jsonify({"share_code": lst.share_code}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# -------------------------- Get all lists ------------------------- #
@lists_bp.route("/lists", methods=["GET"])
@jwt_required()
def get_lists():
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get_or_404(current_user_id)

        owned = user.lists
        shared = (
            MediaList.query.join(SharedList)
            .filter(SharedList.user_id == current_user_id)
            .all()
        )

        all_lists = []

        for lst in owned:
            all_lists.append(_serialize_list(lst, current_user_id, is_owner=True))

        for lst in shared:
            all_lists.append(_serialize_list(lst, current_user_id, is_owner=False))

        return jsonify({"lists": all_lists}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


def _serialize_list(lst: MediaList, current_uid: int, is_owner: bool):
    """Internal helper – build the JSON payload with user-specific ratings."""
    user_count = get_list_user_count(lst.id)
    
    media_items_payload = []
    for item in lst.media_items:
        # Get the user's personal rating for this media item
        user_rating = UserMediaRating.query.filter_by(
            user_id=current_uid, media_id=item.media_id
        ).first()
        
        # Get average rating from all users with access to this list
        avg_rating = get_average_rating(item.media_id, lst.id)
        
        media = Media.query.get(item.media_id)
        
        media_items_payload.append({
            "id": item.id,
            "tmdb_id": media.tmdb_id,
            "media_type": media.media_type,
            "added_by": {"id": item.added_by_id, "username": item.added_by.username},
            "user_rating": {
                "watch_status": user_rating.watch_status if user_rating else "not_watched",
                "rating": user_rating.rating if user_rating else None,
            },
            "avg_rating": avg_rating["average"],
            "rating_count": avg_rating["count"],
        })
    
    return {
        "id": lst.id,
        "name": lst.name,
        "description": lst.description,
        "is_owner": is_owner,
        "owner": {"id": lst.owner.id, "username": lst.owner.username}
        if not is_owner
        else None,
        "share_code": lst.share_code,
        "created_at": lst.created_at.isoformat(),
        "last_updated": lst.last_updated.isoformat(),
        "media_items": media_items_payload,
        "user_count": user_count,
        "max_users": MAX_USERS_PER_LIST,
    }


# ------------------------- Join a list ---------------------------- #
@lists_bp.route("/lists/join", methods=["POST"])
@jwt_required()
def join_list():
    try:
        current_user_id = get_jwt_identity()
        share_code = (request.get_json() or {}).get("share_code", "").upper()
        if not share_code:
            raise BadRequest("Share code is required")

        if get_user_list_count(current_user_id) >= MAX_LISTS_PER_USER:
            raise BadRequest(f"You can only be associated with up to {MAX_LISTS_PER_USER} lists")

        lst = MediaList.query.filter(func.upper(MediaList.share_code) == share_code).first()
        if not lst:
            raise NotFound("Invalid share code")
        if lst.owner_id == current_user_id:
            raise BadRequest("You cannot join your own list")
        if SharedList.query.filter_by(list_id=lst.id, user_id=current_user_id).first():
            raise BadRequest("You already have access to this list")
        if get_list_user_count(lst.id) >= MAX_USERS_PER_LIST:
            raise BadRequest(f"This list has reached its maximum capacity of {MAX_USERS_PER_LIST} users")

        # Create the SharedList entry - add the user to the list
        db.session.add(SharedList(list_id=lst.id, user_id=current_user_id))
        
        # Create UserMediaRating records for all media in the list
        media_in_list = MediaInList.query.filter_by(list_id=lst.id).all()
        for item in media_in_list:
            # Get or create a user rating record for each media item in the list
            get_or_create_user_rating(current_user_id, item.media_id)
        
        db.session.commit()

        return jsonify({
            "message": "Successfully joined list",
            "list_id": lst.id,
            "user_count": get_list_user_count(lst.id),
            "max_users": MAX_USERS_PER_LIST,
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# ------------------ Get users who have access to list ------------- #
@lists_bp.route("/lists/<int:list_id>/users", methods=["GET"])
@jwt_required()
def get_list_users(list_id):
    try:
        current_user_id = get_jwt_identity()
        lst = MediaList.query.get_or_404(list_id)
        if lst.owner_id != current_user_id:
            raise Forbidden("Not authorized to view list users")

        shared_users = (
            User.query.join(SharedList).filter(SharedList.list_id == list_id).all()
        )

        return jsonify({
            "owner": {
                "id": lst.owner.id,
                "username": lst.owner.username,
                "email": lst.owner.email,
            },
            "shared_users": [
                {"id": user.id, "username": user.username, "email": user.email}
                for user in shared_users
            ],
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------------------- Remove user from list --------------------- #
@lists_bp.route("/lists/<int:list_id>/users/<int:user_id>", methods=["DELETE"])
@jwt_required()
def remove_user_from_list(list_id, user_id):
    try:
        current_user_id = get_jwt_identity()
        lst = MediaList.query.get_or_404(list_id)
        if lst.owner_id != current_user_id:
            raise Forbidden("Not authorized to remove users from this list")

        # Get all media in this list for later cleanup
        media_in_list = MediaInList.query.filter_by(list_id=list_id).all()
        media_ids = [item.media_id for item in media_in_list]
        
        # Delete media added by this user from the list
        MediaInList.query.filter_by(list_id=list_id, added_by_id=user_id).delete()
        
        shared_access = SharedList.query.filter_by(list_id=list_id, user_id=user_id).first_or_404()
        db.session.delete(shared_access)
        db.session.commit()
        
        # Now clean up orphaned ratings for the removed user
        cleaned_ratings = []
        for media_id in media_ids:
            if clean_orphaned_ratings(user_id, media_id):
                cleaned_ratings.append(media_id)
        
        if cleaned_ratings:
            db.session.commit()

        return jsonify({
            "message": "User removed successfully. All media items added by this user have been removed from the list.",
            "ratings_cleaned": len(cleaned_ratings)
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# --------------------------- Leave list --------------------------- #
@lists_bp.route("/lists/<int:list_id>/leave", methods=["POST"])
@jwt_required()
def leave_list(list_id):
    try:
        current_user_id = get_jwt_identity()
        lst = MediaList.query.get_or_404(list_id)
        if lst.owner_id == current_user_id:
            raise BadRequest("Cannot leave a list you own")

        # Get all media in this list for later cleanup
        media_in_list = MediaInList.query.filter_by(list_id=list_id).all()
        media_ids = [item.media_id for item in media_in_list]
        
        # Remove media items added by the user
        MediaInList.query.filter_by(list_id=list_id, added_by_id=current_user_id).delete()
        
        # Remove the user from the shared list
        shared_access = SharedList.query.filter_by(list_id=list_id, user_id=current_user_id).first_or_404()
        db.session.delete(shared_access)
        
        # Commit these changes first
        db.session.commit()
        
        # Now clean up orphaned ratings
        cleaned_ratings = []
        for media_id in media_ids:
            if clean_orphaned_ratings(current_user_id, media_id):
                cleaned_ratings.append(media_id)
        
        if cleaned_ratings:
            db.session.commit()

        return jsonify({
            "message": "Successfully left the list. All media items you added have been removed.",
            "ratings_cleaned": len(cleaned_ratings)
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# -------------------------- Get one list -------------------------- #
@lists_bp.route("/lists/<int:list_id>", methods=["GET"])
@jwt_required()
def get_list(list_id):
    try:
        current_user_id = get_jwt_identity()
        lst = MediaList.query.get_or_404(list_id)

        is_shared = SharedList.query.filter_by(list_id=list_id, user_id=current_user_id).first() is not None
        if lst.owner_id != current_user_id and not is_shared:
            raise Forbidden("Not authorized to view this list")

        media_items_payload = []
        for item in lst.media_items:
            # Get the associated media record
            media = Media.query.get(item.media_id)
            
            # Get the user's personal rating
            user_rating = UserMediaRating.query.filter_by(
                user_id=current_user_id, media_id=item.media_id
            ).first()
            
            # Get average rating from all users with access to this list
            avg_rating = get_average_rating(item.media_id, list_id)
            
            try:
                tmdb_resp = requests.get(
                    f"https://api.themoviedb.org/3/{media.media_type}/{media.tmdb_id}",
                    params={"api_key": current_app.config["TMDB_API_KEY"], "language": "en-US"},
                    timeout=5,
                )
                tmdb_data = tmdb_resp.json()
                media_items_payload.append({
                    "id": item.id,
                    "media_id": media.id,
                    "tmdb_id": media.tmdb_id,
                    "media_type": media.media_type,
                    "added_date": item.added_date.isoformat(),
                    "last_updated": item.last_updated.isoformat(),
                    "added_by": {"id": item.added_by_id, "username": item.added_by.username},
                    "user_rating": {
                        "watch_status": user_rating.watch_status if user_rating else "not_watched",
                        "rating": user_rating.rating if user_rating else None,
                    },
                    "avg_rating": avg_rating["average"],
                    "rating_count": avg_rating["count"],
                    "title": tmdb_data.get("title") or tmdb_data.get("name"),
                    "poster_path": tmdb_data.get("poster_path"),
                    "overview": tmdb_data.get("overview"),
                    "release_date": tmdb_data.get("release_date") or tmdb_data.get("first_air_date"),
                    "vote_average": tmdb_data.get("vote_average"),
                })
            except Exception as e:
                current_app.logger.error(f"TMDB fetch error: {e}")
                media_items_payload.append({
                    "id": item.id,
                    "media_id": media.id,
                    "tmdb_id": media.tmdb_id,
                    "media_type": media.media_type,
                    "user_rating": {
                        "watch_status": user_rating.watch_status if user_rating else "not_watched",
                        "rating": user_rating.rating if user_rating else None,
                    },
                    "avg_rating": avg_rating["average"],
                    "rating_count": avg_rating["count"],
                    "added_by": {"id": item.added_by_id, "username": item.added_by.username},
                })

        return jsonify({
            "id": lst.id,
            "name": lst.name,
            "description": lst.description,
            "is_owner": lst.owner_id == current_user_id,
            "shared_with_me": is_shared,
            "owner": {"id": lst.owner.id, "username": lst.owner.username},
            "share_code": lst.share_code,
            "media_items": media_items_payload,
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ------------------------ Update list meta ------------------------ #
@lists_bp.route("/lists/<int:list_id>", methods=["PUT"])
@jwt_required()
def update_list(list_id):
    try:
        current_user_id = get_jwt_identity()
        lst = MediaList.query.get_or_404(list_id)
        if lst.owner_id != current_user_id:
            raise Forbidden("Not authorized to modify this list")

        data = request.get_json() or {}
        if "name" in data:
            lst.name = data["name"]
        if "description" in data:
            lst.description = data["description"]

        lst.last_updated = datetime.utcnow()
        db.session.commit()

        return jsonify({
            "message": "List updated successfully",
            "list": {"id": lst.id, "name": lst.name, "description": lst.description},
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# --------------------------- Delete list -------------------------- #
@lists_bp.route("/lists/<int:list_id>", methods=["DELETE"])
@jwt_required()
def delete_list(list_id):
    try:
        current_user_id = get_jwt_identity()
        lst = MediaList.query.get_or_404(list_id)
        if lst.owner_id != current_user_id:
            raise Forbidden("Not authorized to delete this list")

        # Get all users with access to this list
        owner_id = lst.owner_id
        shared_user_ids = [su.user_id for su in SharedList.query.filter_by(list_id=list_id).all()]
        all_user_ids = [owner_id] + shared_user_ids
        
        # Get all media in this list for later cleanup
        media_in_list = MediaInList.query.filter_by(list_id=list_id).all()
        media_ids = [item.media_id for item in media_in_list]
        
        # Delete all related list entries
        MediaInList.query.filter_by(list_id=list_id).delete()
        SharedList.query.filter_by(list_id=list_id).delete()
        db.session.delete(lst)
        db.session.commit()
        
        # Now clean up orphaned ratings for all users
        cleaned_ratings = 0
        for user_id in all_user_ids:
            for media_id in media_ids:
                if clean_orphaned_ratings(user_id, media_id):
                    cleaned_ratings += 1
        
        if cleaned_ratings > 0:
            db.session.commit()
            
        return jsonify({
            "message": "List deleted successfully",
            "ratings_cleaned": cleaned_ratings
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# ---------------------- Add media to list ------------------------- #
@lists_bp.route("/lists/<int:list_id>/media", methods=["POST"])
@jwt_required()
def add_media_to_list(list_id):
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json() or {}
        if not all(k in data for k in ("tmdb_id", "media_type")):
            raise BadRequest("tmdb_id and media_type are required")
        if data["media_type"] not in ["movie", "tv"]:
            raise BadRequest("Invalid media type")

        lst = MediaList.query.get_or_404(list_id)
        if lst.owner_id != current_user_id and not SharedList.query.filter_by(list_id=list_id, user_id=current_user_id).first():
            raise Forbidden("Not authorized to add to this list")

        # Get or create the media record
        media = get_or_create_media(data["tmdb_id"], data["media_type"])
        
        # Create the media-list association
        list_entry = MediaInList.query.filter_by(list_id=list_id, media_id=media.id).first()
        if not list_entry:
            list_entry = MediaInList(
                list_id=list_id,
                media_id=media.id,
                added_date=datetime.utcnow(),
                added_by_id=current_user_id,
            )
            db.session.add(list_entry)
        
        # Get existing user rating - important to do this first to preserve existing ratings
        user_rating = UserMediaRating.query.filter_by(
            user_id=current_user_id, media_id=media.id
        ).first()
        
        # Only create a new rating or update the existing rating if explicitly provided in request
        if "watch_status" in data or "rating" in data:
            # Explicit rating/status provided in request
            user_rating = update_user_rating(
                current_user_id, 
                media.id,
                watch_status=data.get("watch_status"),
                rating=data.get("rating")
            )
        elif not user_rating:
            # No rating exists yet - create a new one with default values
            user_rating = get_or_create_user_rating(current_user_id, media.id)
        # Else: Rating exists but no new values provided - we preserve the existing rating
        
        # Create default rating records for all other users with access to this list
        # First, get the list owner if not the current user
        if lst.owner_id != current_user_id:
            # Only create if doesn't exist
            if not UserMediaRating.query.filter_by(user_id=lst.owner_id, media_id=media.id).first():
                get_or_create_user_rating(lst.owner_id, media.id)
            
        # Then all shared list users
        shared_users = SharedList.query.filter_by(list_id=list_id).all()
        for shared_user in shared_users:
            if shared_user.user_id != current_user_id:  # Skip the current user
                # Only create if doesn't exist
                if not UserMediaRating.query.filter_by(user_id=shared_user.user_id, media_id=media.id).first():
                    get_or_create_user_rating(shared_user.user_id, media.id)
        
        lst.last_updated = datetime.utcnow()
        db.session.commit()

        return jsonify({
            "message": "Media added successfully",
            "id": list_entry.id,
            "media_id": media.id,
            "added_by": {"id": current_user_id, "username": User.query.get(current_user_id).username},
            "user_rating": {
                "watch_status": user_rating.watch_status if user_rating else "not_watched",
                "rating": user_rating.rating if user_rating else None,
            } if user_rating else None
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# ---------------------- Update media status ----------------------- #
@lists_bp.route("/lists/<int:list_id>/media/<int:media_id>", methods=["PUT"])
@jwt_required()
def update_media_status(list_id, media_id):
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json() or {}

        # Find the media-list entry
        list_media = MediaInList.query.filter_by(id=media_id, list_id=list_id).first_or_404()
        lst = MediaList.query.get_or_404(list_id)

        if lst.owner_id != current_user_id and not SharedList.query.filter_by(list_id=list_id, user_id=current_user_id).first():
            raise Forbidden("Not authorized to update media in this list")

        # Update the user's personal rating for this media
        if "watch_status" in data or "rating" in data:
            update_user_rating(
                current_user_id,
                list_media.media_id,
                watch_status=data.get("watch_status"),
                rating=data.get("rating")
            )
            lst.last_updated = datetime.utcnow()
            list_media.last_updated = datetime.utcnow()

        db.session.commit()
        return jsonify({"message": "Status updated successfully"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# ----------------------- Delete media entry ----------------------- #
@lists_bp.route("/lists/<int:list_id>/media/<int:media_id>", methods=["DELETE"])
@jwt_required()
def delete_media(list_id, media_id):
    return _delete_media_internal(list_id, media_id=media_id)


@lists_bp.route("/lists/<int:list_id>/media/tmdb/<int:tmdb_id>", methods=["DELETE"])
@jwt_required()
def delete_media_by_tmdb(list_id, tmdb_id):
    return _delete_media_internal(list_id, tmdb_id=tmdb_id)


def _delete_media_internal(list_id, media_id=None, tmdb_id=None):
    try:
        current_user_id = get_jwt_identity()
        lst = MediaList.query.get_or_404(list_id)
        if lst.owner_id != current_user_id and not SharedList.query.filter_by(list_id=list_id, user_id=current_user_id).first():
            raise Forbidden("Not authorized to modify this list")

        # Store media ID for later cleanup
        actual_media_id = None
        
        if media_id:
            # Find the media list entry by its ID
            media_list_entry = MediaInList.query.filter_by(list_id=list_id, id=media_id).first_or_404()
            actual_media_id = media_list_entry.media_id
            db.session.delete(media_list_entry)
        else:
            # Find the Media record by TMDB ID
            media = Media.query.filter_by(tmdb_id=tmdb_id).first_or_404()
            actual_media_id = media.id
            # Then find the MediaInList entry
            media_list_entry = MediaInList.query.filter_by(list_id=list_id, media_id=media.id).first_or_404()
            db.session.delete(media_list_entry)

        lst.last_updated = datetime.utcnow()
        db.session.commit()
        
        # Get all users who had access to this list
        owner_id = lst.owner_id
        shared_user_ids = [su.user_id for su in SharedList.query.filter_by(list_id=list_id).all()]
        all_user_ids = [owner_id] + shared_user_ids
        
        # Clean up orphaned ratings for all users
        cleaned_count = 0
        for user_id in all_user_ids:
            if clean_orphaned_ratings(user_id, actual_media_id):
                cleaned_count += 1
        
        if cleaned_count > 0:
            db.session.commit()
            
        return jsonify({
            "message": "Media removed successfully", 
            "ratings_cleaned": cleaned_count
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# ----------------- Get all ratings for a media item --------------- #
@lists_bp.route("/lists/<int:list_id>/media/<int:media_id>/ratings", methods=["GET"])
@jwt_required()
def get_media_ratings(list_id, media_id):
    try:
        current_user_id = get_jwt_identity()
        lst = MediaList.query.get_or_404(list_id)
        
        # Check user has access to the list
        is_shared = SharedList.query.filter_by(list_id=list_id, user_id=current_user_id).first() is not None
        if lst.owner_id != current_user_id and not is_shared:
            raise Forbidden("Not authorized to view this list")
            
        # Find the media record from the MediaInList entry
        media_list_entry = MediaInList.query.filter_by(list_id=list_id, id=media_id).first_or_404()
        media_id = media_list_entry.media_id
        
        # Get all ratings for this media from users with access to the list
        ratings = get_all_ratings_for_media_in_list(list_id, media_id)
        
        # Get the Media record for TMDB details
        media = Media.query.get(media_id)
        
        return jsonify({
            "media_id": media_id,
            "tmdb_id": media.tmdb_id,
            "media_type": media.media_type,
            "ratings": ratings
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ----------------- Get user's ratings across lists ---------------- #
@lists_bp.route("/user/ratings", methods=["GET"])
@jwt_required()
def get_user_ratings():
    try:
        current_user_id = get_jwt_identity()
        
        # Get all user's ratings
        ratings = UserMediaRating.query.filter_by(user_id=current_user_id).all()
        
        result = []
        for rating in ratings:
            media = Media.query.get(rating.media_id)
            
            # Get lists containing this media that the user has access to
            owned_lists = (
                MediaList.query.join(MediaInList)
                .filter(
                    MediaList.owner_id == current_user_id,
                    MediaInList.media_id == rating.media_id
                )
                .all()
            )
            
            shared_lists = (
                MediaList.query.join(MediaInList).join(SharedList)
                .filter(
                    SharedList.user_id == current_user_id,
                    MediaInList.media_id == rating.media_id
                )
                .all()
            )
            
            lists = [
                {"id": lst.id, "name": lst.name}
                for lst in owned_lists + shared_lists
            ]
            
            try:
                tmdb_resp = requests.get(
                    f"https://api.themoviedb.org/3/{media.media_type}/{media.tmdb_id}",
                    params={"api_key": current_app.config["TMDB_API_KEY"], "language": "en-US"},
                    timeout=5,
                )
                tmdb_data = tmdb_resp.json()
                
                result.append({
                    "id": rating.id,
                    "media_id": media.id,
                    "tmdb_id": media.tmdb_id,
                    "media_type": media.media_type,
                    "watch_status": rating.watch_status,
                    "rating": rating.rating,
                    "updated_at": rating.updated_at.isoformat(),
                    "title": tmdb_data.get("title") or tmdb_data.get("name"),
                    "poster_path": tmdb_data.get("poster_path"),
                    "release_date": tmdb_data.get("release_date") or tmdb_data.get("first_air_date"),
                    "in_lists": lists
                })
            except Exception as e:
                current_app.logger.error(f"TMDB fetch error: {e}")
                result.append({
                    "id": rating.id,
                    "media_id": media.id,
                    "tmdb_id": media.tmdb_id,
                    "media_type": media.media_type,
                    "watch_status": rating.watch_status,
                    "rating": rating.rating,
                    "updated_at": rating.updated_at.isoformat(),
                    "in_lists": lists
                })
        
        return jsonify({"ratings": result}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ----------------- Get average ratings for list ----------------- #
@lists_bp.route("/lists/<int:list_id>/average_ratings", methods=["GET"])
@jwt_required()
def get_list_average_ratings(list_id):
    try:
        current_user_id = get_jwt_identity()
        lst = MediaList.query.get_or_404(list_id)
        
        # Check user has access to the list
        is_shared = SharedList.query.filter_by(list_id=list_id, user_id=current_user_id).first() is not None
        if lst.owner_id != current_user_id and not is_shared:
            raise Forbidden("Not authorized to view this list")
            
        # Get all media items in this list
        media_items = MediaInList.query.filter_by(list_id=list_id).all()
        
        average_ratings = []
        for list_item in media_items:
            # Get the Media record
            media = Media.query.get(list_item.media_id)
            
            # Get the average rating
            avg_rating = get_average_rating(list_item.media_id, list_id)
            
            # Only include media with at least one rating
            if avg_rating["count"] > 0:
                try:
                    # Get TMDB details
                    tmdb_resp = requests.get(
                        f"https://api.themoviedb.org/3/{media.media_type}/{media.tmdb_id}",
                        params={"api_key": current_app.config["TMDB_API_KEY"], "language": "en-US"},
                        timeout=5,
                    )
                    tmdb_data = tmdb_resp.json()
                    
                    average_ratings.append({
                        "tmdb_id": media.tmdb_id,
                        "media_type": media.media_type,
                        "average_rating": avg_rating["average"],
                        "rating_count": avg_rating["count"],
                        "title": tmdb_data.get("title") or tmdb_data.get("name"),
                        "poster_path": tmdb_data.get("poster_path"),
                        "overview": tmdb_data.get("overview"),
                        "release_date": tmdb_data.get("release_date") or tmdb_data.get("first_air_date"),
                        "vote_average": tmdb_data.get("vote_average"),
                    })
                except Exception as e:
                    current_app.logger.error(f"TMDB fetch error: {e}")
                    # Include basic info even if TMDB fetch fails
                    average_ratings.append({
                        "tmdb_id": media.tmdb_id,
                        "media_type": media.media_type,
                        "average_rating": avg_rating["average"],
                        "rating_count": avg_rating["count"],
                    })
        
        return jsonify({"average_ratings": average_ratings}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
