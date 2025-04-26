"""
Centralised error / exception handlers.
"""
from datetime import datetime
from flask import jsonify
from werkzeug.exceptions import BadRequest, Unauthorized, Forbidden, NotFound
from sqlalchemy.exc import SQLAlchemyError
from flask_limiter.errors import RateLimitExceeded

from utils.helpers import get_retry_after, format_retry_message


def register_error_handlers(app):
    # ------------- Standard Errors ------------- #
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

    # ------------- Rate-limit Error ------------- #
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
