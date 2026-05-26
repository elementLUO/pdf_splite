import os

from flask import Flask, render_template

from server.config import MAX_FILE_SIZE, UPLOAD_DIR, OUTPUT_DIR
from server.routes import api, cleanup_old_files


def create_app() -> Flask:
    app = Flask(__name__)
    app.config["MAX_CONTENT_LENGTH"] = MAX_FILE_SIZE

    # Ensure data directories exist
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    app.register_blueprint(api, url_prefix="/api")

    @app.route("/")
    def index():
        return render_template("index.html")

    @app.errorhandler(413)
    def too_large(e):
        from flask import jsonify
        return jsonify({"code": 1, "message": "文件大小超过 600MB 限制"}), 413

    return app


if __name__ == "__main__":
    app = create_app()
    cleanup_old_files()
    app.run(debug=True, host="127.0.0.1", port=5000)