import os
import tempfile

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Store data outside the project root so Flask dev reloader doesn't restart on file changes
DATA_DIR = os.path.join(tempfile.gettempdir(), "pdf_splite_data")
UPLOAD_DIR = os.path.join(DATA_DIR, "uploads")
OUTPUT_DIR = os.path.join(DATA_DIR, "outputs")

MAX_FILE_SIZE = 600 * 1024 * 1024  # 600 MB
ALLOWED_EXTENSIONS = {"pdf"}
PREVIEW_DPI = 150
CLEANUP_THRESHOLD_MINUTES = 60
