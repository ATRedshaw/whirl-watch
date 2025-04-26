"""
All list, shared-list, and media-in-list operations.
Large but nothing was functionally changed – only organised into a blueprint.
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
)
from utils.helpers import (
    get_list_user_count,
    get_user_list_count,
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
    """Internal helper – build the JSON payload identical to monolith."""
    user_count = get_list_user_count(lst.id)
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
        "media_items": [
            {
                "id": item.id,
                "tmdb_id": item.tmdb_id,
                "media_type": item.media_type,
                "watch_status": item.watch_status,
                "rating": item.rating,
            }
            for item in lst.media_items
        ],
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

        db.session.add(SharedList(list_id=lst.id, user_id=current_user_id))
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

        MediaInList.query.filter_by(list_id=list_id, added_by_id=user_id).delete()
        shared_access = SharedList.query.filter_by(list_id=list_id, user_id=user_id).first_or_404()

        db.session.delete(shared_access)
        db.session.commit()

        return jsonify({
            "message": "User removed successfully. All media items added by this user have been removed from the list."
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

        MediaInList.query.filter_by(list_id=list_id, added_by_id=current_user_id).delete()
        shared_access = SharedList.query.filter_by(list_id=list_id, user_id=current_user_id).first_or_404()

        db.session.delete(shared_access)
        db.session.commit()

        return jsonify({
            "message": "Successfully left the list. All media items you added have been removed."
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
            try:
                tmdb_resp = requests.get(
                    f"https://api.themoviedb.org/3/{item.media_type}/{item.tmdb_id}",
                    params={"api_key": current_app.config["TMDB_API_KEY"], "language": "en-US"},
                    timeout=5,
                )
                tmdb_data = tmdb_resp.json()
                media_items_payload.append({
                    "id": item.id,
                    "tmdb_id": item.tmdb_id,
                    "media_type": item.media_type,
                    "watch_status": item.watch_status,
                    "rating": item.rating,
                    "added_date": item.added_date.isoformat(),
                    "last_updated": item.last_updated.isoformat(),
                    "added_by": {"id": item.added_by_id, "username": item.added_by.username},
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
                    "tmdb_id": item.tmdb_id,
                    "media_type": item.media_type,
                    "watch_status": item.watch_status,
                    "rating": item.rating,
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

        MediaInList.query.filter_by(list_id=list_id).delete()
        SharedList.query.filter_by(list_id=list_id).delete()
        db.session.delete(lst)
        db.session.commit()
        return jsonify({"message": "List deleted successfully"}), 200
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

        new_media = MediaInList(
            list_id=list_id,
            tmdb_id=data["tmdb_id"],
            media_type=data["media_type"],
            watch_status=data.get("watch_status", "not_watched"),
            rating=data.get("rating"),
            added_date=datetime.utcnow(),
            added_by_id=current_user_id,
        )
        lst.last_updated = datetime.utcnow()
        db.session.add(new_media)
        db.session.commit()

        return jsonify({
            "message": "Media added successfully",
            "id": new_media.id,
            "added_by": {"id": current_user_id, "username": User.query.get(current_user_id).username},
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

        media = MediaInList.query.filter_by(list_id=list_id, id=media_id).first_or_404()
        lst = MediaList.query.get_or_404(list_id)

        if lst.owner_id != current_user_id and not SharedList.query.filter_by(list_id=list_id, user_id=current_user_id).first():
            raise Forbidden("Not authorized to update this media")

        if "watch_status" in data or "rating" in data:
            lst.last_updated = datetime.utcnow()
        if "watch_status" in data:
            media.watch_status = data["watch_status"]
            media.last_updated = datetime.utcnow()
        if "rating" in data:
            media.rating = data["rating"]

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

        if media_id:
            media = MediaInList.query.filter_by(list_id=list_id, id=media_id).first_or_404()
        else:
            media = MediaInList.query.filter_by(list_id=list_id, tmdb_id=tmdb_id).first_or_404()

        lst.last_updated = datetime.utcnow()
        db.session.delete(media)
        db.session.commit()
        return jsonify({"message": "Media removed successfully"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
