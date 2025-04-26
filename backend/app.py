"""
Application factory + bootstrap (what used to be at the bottom of your big file)
"""
from flask import Flask
from config import Config
from extensions import init_extensions, db
from utils.error_handlers import register_error_handlers
from routes import register_blueprints


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    # Third-party extensions
    init_extensions(app)

    # Blueprints
    register_blueprints(app)

    # Error handlers
    register_error_handlers(app)

    # Create tables *once*
    with app.app_context():
        db.create_all()

    return app


if __name__ == '__main__':
    create_app().run(debug=False)
