import uuid
import re
import os


def generate_file_id() -> str:
    return uuid.uuid4().hex


def sanitize_filename(filename: str) -> str:
    """Remove path separators and null bytes from filename."""
    name = os.path.basename(filename)
    name = name.replace("\x00", "")
    name = re.sub(r'[\\/:*?"<>|]', "_", name)
    if not name:
        name = "untitled"
    return name


def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() == "pdf"