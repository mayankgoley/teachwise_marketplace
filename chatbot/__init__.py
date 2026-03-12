from chatbot.backend.routes import chatbot_bp


def register_chatbot(app):
    """Register the chatbot blueprint with the Flask app.

    Add this to app.py:
        from chatbot import register_chatbot
        register_chatbot(app)
    """
    app.register_blueprint(chatbot_bp)

    csrf = app.extensions.get('csrf')
    if csrf:
        csrf.exempt(chatbot_bp)
