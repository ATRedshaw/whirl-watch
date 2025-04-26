"""
Convenience function so app.py can 'import register_blueprints' and keep things tidy.
"""
def register_blueprints(app):
    from .misc import misc_bp
    from .auth import auth_bp
    from .email_verification import email_verification_bp
    from .password_reset import password_reset_bp
    from .user import user_bp
    from .media import media_bp
    from .lists import lists_bp

    # Note: url_prefix for every BP is '/api' inside each module
    app.register_blueprint(misc_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(email_verification_bp)
    app.register_blueprint(password_reset_bp)
    app.register_blueprint(user_bp)
    app.register_blueprint(media_bp)
    app.register_blueprint(lists_bp)

