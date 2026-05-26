import os
import io
import zipfile
import fitz  # pymupdf

from . import config


class PdfError(Exception):
    """Raised when PDF operations fail."""
    pass


def read_page_count(file_path: str) -> int:
    try:
        doc = fitz.open(file_path)
        count = doc.page_count
        doc.close()
        return count
    except Exception as e:
        raise PdfError(f"无法读取PDF文件: {e}")


def render_page_image(file_path: str, page_num: int) -> bytes:
    """Render a single PDF page as PNG image bytes."""
    try:
        doc = fitz.open(file_path)
        if page_num < 1 or page_num > doc.page_count:
            doc.close()
            raise PdfError(f"页码 {page_num} 超出范围 1-{doc.page_count}")
        page = doc[page_num - 1]
        pix = page.get_pixmap(dpi=config.PREVIEW_DPI)
        img_bytes = pix.tobytes("png")
        doc.close()
        return img_bytes
    except PdfError:
        raise
    except Exception as e:
        raise PdfError(f"渲染页面失败: {e}")


def split_pdf(file_path: str, ranges: list, output_dir: str) -> list:
    """
    Split a PDF by page ranges.

    Args:
        file_path: Path to the source PDF.
        ranges: List of dicts with keys: start, end, filename.
        output_dir: Directory to write output files.

    Returns:
        List of dicts with keys: index, path, filename, pages, size.
    """
    results = []
    try:
        src = fitz.open(file_path)
        total_pages = src.page_count

        for idx, r in enumerate(ranges):
            start = max(1, int(r["start"]))
            end = min(total_pages, int(r["end"]))

            if start > end or start > total_pages:
                results.append({
                    "index": idx,
                    "filename": r.get("filename", f"part_{idx + 1}.pdf"),
                    "pages": 0,
                    "size": 0,
                    "error": f"无效区间: {start}-{end}"
                })
                continue

            dst = fitz.open()
            dst.insert_pdf(src, from_page=start - 1, to_page=end - 1)

            safe_name = os.path.basename(r.get("filename", f"part_{idx + 1}.pdf"))
            if not safe_name.endswith(".pdf"):
                safe_name += ".pdf"

            out_path = os.path.join(output_dir, safe_name)
            dst.save(out_path)
            dst.close()

            file_size = os.path.getsize(out_path)

            results.append({
                "index": idx,
                "filename": safe_name,
                "path": out_path,
                "pages": end - start + 1,
                "size": file_size,
            })

        src.close()
    except Exception as e:
        raise PdfError(f"分割PDF失败: {e}")

    return results


def create_zip(file_paths: list, output_path: str) -> str:
    """Pack multiple files into a ZIP archive."""
    with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for fp in file_paths:
            zf.write(fp, os.path.basename(fp))
    return output_path