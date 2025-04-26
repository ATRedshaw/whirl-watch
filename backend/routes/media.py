"""
TMDB proxy endpoints (search + single title details).
"""
import requests
from flask import Blueprint, request, jsonify, current_app
from werkzeug.exceptions import BadRequest
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import or_
from extensions import db, limiter
from models import MediaList, SharedList
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

        # which of the user's lists already include each TMDB id?
        user_lists = MediaList.query.filter(
            or_(MediaList.owner_id == current_user_id,
                MediaList.shared_with.any(user_id=current_user_id))).all()

        media_in_lists = {}
        for lst in user_lists:
            for item in lst.media_items:
                if item.media_type == media_type:
                    media_in_lists.setdefault(item.tmdb_id, []).append(lst.id)

        for result in data["results"]:
            result["addedToLists"] = media_in_lists.get(result["id"], [])

        return jsonify(data), 200

    except requests.RequestException as e:
        return jsonify({"error": f"TMDB API error: {str(e)}"}), 503
    except Exception as e:
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
                    MediaList.shared_with.any(user_id=current_user_id))).all()

            media_in_lists = {}
            for lst in user_lists:
                for item in lst.media_items:
                    media_in_lists.setdefault((item.media_type, item.tmdb_id), []).append(lst.id)

            # Add information about which lists each media item is in
            for result in response_dict["results"]:
                media_type = result.get("media_type")
                tmdb_id = result.get("id")
                if media_type and tmdb_id:
                    result["addedToLists"] = media_in_lists.get((media_type, tmdb_id), [])
        
        return jsonify(response_dict), status_code

    except Exception as e:
        return jsonify({"error": str(e)}), 500
