"""
TMDB proxy endpoints (search + single title details).
"""
import requests
from flask import Blueprint, request, jsonify, current_app
from werkzeug.exceptions import BadRequest
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import or_
from extensions import db, limiter
from models import MediaList, SharedList, Media, MediaInList
from utils.helpers import get_list_user_count  # not used here but kept for parity
from utils.suggestions import get_suggestions  # Import the get_suggestions function

media_bp = Blueprint("media_bp", __name__, url_prefix="/api")


# ---------------------------- Search ------------------------------ #
@media_bp.route("/search")
@jwt_required()
def search_media():
    try:
        current_user_id = get_jwt_identity()
        query = request.args.get("query", "")
        media_type = request.args.get("type", "movie")
        if not query:
            raise BadRequest("No search query provided")
        if media_type not in ["movie", "tv"]:
            raise BadRequest("Invalid media type")

        resp = requests.get(
            f"https://api.themoviedb.org/3/search/{media_type}",
            params={
                "api_key": current_app.config["TMDB_API_KEY"],
                "query": query,
                "language": "en-US",
                "page": request.args.get("page", 1),
            },
            timeout=5,
        )
        resp.raise_for_status()
        data = resp.json()

        # Get all lists the user has access to
        user_lists = MediaList.query.filter(
            or_(MediaList.owner_id == current_user_id,
                MediaList.id.in_(
                    db.session.query(SharedList.list_id).filter(SharedList.user_id == current_user_id)
                )
            )
        ).all()
        
        # Find media items in those lists that match the search results
        media_in_lists = {}
        
        # Get the TMDB IDs from the search results
        tmdb_ids = [result["id"] for result in data["results"]]
        
        # Query for media items in the database with these TMDB IDs
        if tmdb_ids:
            # Find Media records with matching TMDB IDs and media type
            media_records = Media.query.filter(
                Media.tmdb_id.in_(tmdb_ids),
                Media.media_type == media_type
            ).all()
            
            # Create a mapping of TMDB ID to Media ID
            tmdb_to_media_id = {media.tmdb_id: media.id for media in media_records}
            
            # Find which lists contain these media items
            if media_records:
                media_ids = [media.id for media in media_records]
                
                media_list_entries = db.session.query(
                    MediaInList.media_id, MediaInList.list_id
                ).filter(
                    MediaInList.media_id.in_(media_ids),
                    MediaInList.list_id.in_([lst.id for lst in user_lists])
                ).all()
                
                # Create mapping from media ID to list IDs
                media_id_to_lists = {}
                for media_id, list_id in media_list_entries:
                    media_id_to_lists.setdefault(media_id, []).append(list_id)
                
                # Map TMDB IDs to list IDs
                for tmdb_id, media_id in tmdb_to_media_id.items():
                    if media_id in media_id_to_lists:
                        media_in_lists[tmdb_id] = media_id_to_lists[media_id]

        # Add the list information to each search result
        for result in data["results"]:
            result["addedToLists"] = media_in_lists.get(result["id"], [])

        return jsonify(data), 200

    except requests.RequestException as e:
        return jsonify({"error": f"TMDB API error: {str(e)}"}), 503
    except Exception as e:
        current_app.logger.error(f"Search error: {str(e)}", exc_info=True)
        return jsonify({"error": str(e)}), 500


# ------------------------ Single title details -------------------- #
@media_bp.route("/<string:media_type>/<int:media_id>")
@jwt_required()
def get_media_details(media_type, media_id):
    try:
        if media_type not in ["movie", "tv"]:
            raise BadRequest("Invalid media type")

        resp = requests.get(
            f"https://api.themoviedb.org/3/{media_type}/{media_id}",
            params={
                "api_key": current_app.config["TMDB_API_KEY"],
                "language": "en-US",
                "append_to_response": "seasons,episodes" if media_type == "tv" else None,
            },
            timeout=5,
        )
        resp.raise_for_status()
        return jsonify(resp.json()), 200

    except requests.RequestException as e:
        return jsonify({"error": f"TMDB API error: {str(e)}"}), 503
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ------------------------ Media Suggestions -------------------- #
@media_bp.route("/suggestions")
@jwt_required()
@limiter.limit("3 per day")
def get_media_suggestions():
    try:
        current_user_id = get_jwt_identity()
        query = request.args.get("query", "Give me a completely random selection of media")
        # Limit query to 80 characters
        query = query[:80]
        genre_hint = request.args.get("genre", "Any")
        max_items = int(request.args.get("max_items", 10))
        language = request.args.get("language", "English")
        media_type = request.args.get("media_type", "Any")

        # Set to default if the query string is empty
        if query == "":
            query = "Give me a completely random selection of media"
        
        # Call the get_suggestions function from suggestions.py
        response_dict, status_code = get_suggestions(
            query=query,
            genre_hint=genre_hint,
            max_items=max_items,
            language=language,
            media_type=media_type
        )
        
        # Get the user's lists to check if suggested media is already added
        if status_code == 200 and "results" in response_dict:
            user_lists = MediaList.query.filter(
                or_(MediaList.owner_id == current_user_id,
                    MediaList.id.in_(
                        db.session.query(SharedList.list_id).filter(SharedList.user_id == current_user_id)
                    ))
            ).all()
            
            # Get all the unique media types and IDs from the suggestions
            tmdb_info = []
            for result in response_dict["results"]:
                if "media_type" in result and "id" in result:
                    tmdb_info.append((result["media_type"], result["id"]))
            
            # Find media IDs for these TMDB IDs
            media_records = {}
            if tmdb_info:
                unique_types = set(media_type for media_type, _ in tmdb_info)
                for media_type in unique_types:
                    tmdb_ids = [tmdb_id for m_type, tmdb_id in tmdb_info if m_type == media_type]
                    if tmdb_ids:
                        records = Media.query.filter(
                            Media.tmdb_id.in_(tmdb_ids),
                            Media.media_type == media_type
                        ).all()
                        for record in records:
                            media_records[(record.media_type, record.tmdb_id)] = record.id
            
            # Find which lists contain these media items
            media_in_lists = {}
            if media_records:
                media_ids = list(media_records.values())
                list_ids = [lst.id for lst in user_lists]
                
                media_list_entries = db.session.query(
                    MediaInList.media_id, MediaInList.list_id
                ).filter(
                    MediaInList.media_id.in_(media_ids),
                    MediaInList.list_id.in_(list_ids)
                ).all()
                
                # Map media IDs to list IDs
                media_id_to_lists = {}
                for media_id, list_id in media_list_entries:
                    media_id_to_lists.setdefault(media_id, []).append(list_id)
                
                # Map TMDB info to list IDs
                for key, media_id in media_records.items():
                    if media_id in media_id_to_lists:
                        media_in_lists[key] = media_id_to_lists[media_id]
            
            # Add information about which lists each media item is in
            for result in response_dict["results"]:
                media_type = result.get("media_type")
                tmdb_id = result.get("id")
                if media_type and tmdb_id:
                    result["addedToLists"] = media_in_lists.get((media_type, tmdb_id), [])
        
        return jsonify(response_dict), status_code

    except Exception as e:
        current_app.logger.error(f"Suggestions error: {str(e)}", exc_info=True)
        return jsonify({"error": str(e)}), 500
