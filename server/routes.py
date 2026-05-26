import io
import os
import shutil
import tempfile

from flask import Blueprint, request, jsonify, send_file

from . import config
from .utils import generate_file_id, sanitize_filename, allowed_file
from .pdf_service import read_page_count, render_page_image, split_pdf, create_zip, PdfError

api = Blueprint("api", __name__)


def _upload_dir():
    return config.UPLOAD_DIR


def _output_dir(file_id: str):
    d = os.path.join(config.OUTPUT_DIR, file_id)
    os.makedirs(d, exist_ok=True)
    return d


@api.route("/upload", methods=["POST"])
def upload():
    if "file" not in request.files:
        return jsonify({"code": 1, "message": "未选择文件"}), 400

    f = request.files["file"]
    if not f.filename or not allowed_file(f.filename):
        return jsonify({"code": 1, "message": "不支持的文件类型，仅接受 PDF 文件"}), 400

    file_id = generate_file_id()
    os.makedirs(_upload_dir(), exist_ok=True)
    save_path = os.path.join(_upload_dir(), f"{file_id}.pdf")
    f.save(save_path)

    try:
        page_count = read_page_count(save_path)
    except PdfError as e:
        os.remove(save_path)
        return jsonify({"code": 1, "message": str(e)}), 400

    file_size = os.path.getsize(save_path)

    return jsonify({
        "code": 0,
        "data": {
            "file_id": file_id,
            "original_name": f.filename,
            "file_size": file_size,
            "page_count": page_count,
        }
    })


@api.route("/preview/<file_id>/<int:page>")
def preview(file_id, page):
    file_path = os.path.join(_upload_dir(), f"{file_id}.pdf")
    if not os.path.exists(file_path):
        return jsonify({"code": 1, "message": "文件不存在，请重新上传"}), 404

    try:
        img_bytes = render_page_image(file_path, page)
    except PdfError as e:
        return jsonify({"code": 1, "message": str(e)}), 400

    return send_file(
        io.BytesIO(img_bytes),
        mimetype="image/png",
    )


@api.route("/suggest-ranges", methods=["POST"])
def suggest_ranges():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"code": 1, "message": "请求体格式错误"}), 400

    file_id = data.get("file_id", "")
    parts = int(data.get("parts", 1))

    file_path = os.path.join(_upload_dir(), f"{file_id}.pdf")
    if not os.path.exists(file_path):
        return jsonify({"code": 1, "message": "文件不存在"}), 404

    try:
        total = read_page_count(file_path)
    except PdfError as e:
        return jsonify({"code": 1, "message": str(e)}), 400

    if parts < 1 or parts > total:
        return jsonify({"code": 1, "message": f"份数需在 1-{total} 之间"}), 400

    per_part = total // parts
    remainder = total % parts

    ranges = []
    current = 1
    for i in range(parts):
        extra = 1 if i < remainder else 0
        end = current + per_part + extra - 1
        ranges.append({"start": current, "end": end})
        current = end + 1

    return jsonify({"code": 0, "data": {"ranges": ranges}})


@api.route("/split", methods=["POST"])
def split():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"code": 1, "message": "请求体格式错误"}), 400

    file_id = data.get("file_id", "")
    ranges = data.get("ranges", [])

    file_path = os.path.join(_upload_dir(), f"{file_id}.pdf")
    if not os.path.exists(file_path):
        return jsonify({"code": 1, "message": "文件不存在，请重新上传"}), 404

    if not ranges or not isinstance(ranges, list):
        return jsonify({"code": 1, "message": "请提供有效的分割区间"}), 400

    out_dir = _output_dir(file_id)
    # Clean previous outputs
    for f in os.listdir(out_dir):
        os.remove(os.path.join(out_dir, f))

    try:
        results = split_pdf(file_path, ranges, out_dir)
    except PdfError as e:
        return jsonify({"code": 1, "message": str(e)}), 500

    files = []
    for r in results:
        entry = {
            "index": r["index"],
            "filename": r["filename"],
            "pages": r["pages"],
            "size": r["size"],
            "download_url": f"/api/download/{file_id}/{r['index']}",
        }
        if "error" in r:
            entry["error"] = r["error"]
        files.append(entry)

    return jsonify({
        "code": 0,
        "data": {
            "files": files,
            "zip_url": f"/api/download/{file_id}/zip",
        }
    })


@api.route("/download/<file_id>/<identifier>")
def download(file_id, identifier):
    out_dir = _output_dir(file_id)

    if identifier == "zip":
        pdf_files = sorted(
            [os.path.join(out_dir, f) for f in os.listdir(out_dir) if f.endswith(".pdf")],
            key=lambda x: os.path.getsize(x)
        )
        if not pdf_files:
            return jsonify({"code": 1, "message": "没有可下载的文件"}), 404

        zip_path = os.path.join(tempfile.gettempdir(), f"pdf_split_{file_id}.zip")
        create_zip(pdf_files, zip_path)
        return send_file(
            zip_path,
            mimetype="application/zip",
            as_attachment=True,
            download_name="split_bundle.zip",
        )

    try:
        index = int(identifier)
    except ValueError:
        return jsonify({"code": 1, "message": "无效的下载标识"}), 400

    # Find the file by scanning output dir for matching filename containing the index pattern
    # We stored the filename in split results, but here we need to find it
    out_dir = _output_dir(file_id)
    if not os.path.isdir(out_dir):
        return jsonify({"code": 1, "message": "没有可下载的文件"}), 404

    pdf_files = sorted([f for f in os.listdir(out_dir) if f.endswith(".pdf") and f != "bundle.zip"])
    if index < 0 or index >= len(pdf_files):
        return jsonify({"code": 1, "message": "无效的文件索引"}), 404

    file_path = os.path.join(out_dir, pdf_files[index])
    return send_file(
        file_path,
        mimetype="application/pdf",
        as_attachment=True,
        download_name=pdf_files[index],
    )


def cleanup_old_files():
    """Remove uploaded files older than threshold."""
    import time
    threshold = time.time() - config.CLEANUP_THRESHOLD_MINUTES * 60
    for directory in [config.UPLOAD_DIR, config.OUTPUT_DIR]:
        if not os.path.isdir(directory):
            continue
        for item in os.listdir(directory):
            item_path = os.path.join(directory, item)
            try:
                if os.path.getmtime(item_path) < threshold:
                    if os.path.isdir(item_path):
                        shutil.rmtree(item_path)
                    else:
                        os.remove(item_path)
            except OSError:
                pass