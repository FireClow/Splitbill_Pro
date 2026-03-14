import os
import shutil
import base64
import io
import re
from typing import Any, Dict, Optional

import pytesseract
from PIL import Image, UnidentifiedImageError


WINDOWS_DEFAULT_TESSERACT = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
WINDOWS_INSTALL_LINK = "https://github.com/UB-Mannheim/tesseract/releases"
MAX_RECEIPT_IMAGE_BYTES = 10 * 1024 * 1024  # 10MB
SUPPORTED_IMAGE_FORMATS = {"JPEG", "PNG"}


def get_tesseract_install_instructions() -> Dict[str, str]:
    return {
        "download": WINDOWS_INSTALL_LINK,
        "path": r"C:\Program Files\Tesseract-OCR",
        "verify_command": "tesseract --version",
    }


def _detect_tesseract_cmd() -> Optional[str]:
    configured_path = os.environ.get("TESSERACT_CMD", "").strip()
    if configured_path and os.path.isfile(configured_path):
        return configured_path

    in_path = shutil.which("tesseract")
    if in_path:
        return in_path

    if os.name == "nt" and os.path.isfile(WINDOWS_DEFAULT_TESSERACT):
        return WINDOWS_DEFAULT_TESSERACT

    return None


def get_tesseract_status() -> Dict[str, Any]:
    tesseract_cmd = _detect_tesseract_cmd()

    if tesseract_cmd:
        pytesseract.pytesseract.tesseract_cmd = tesseract_cmd

    try:
        version = str(pytesseract.get_tesseract_version())
        return {
            "available": True,
            "version": version,
            "binary": tesseract_cmd or "tesseract",
        }
    except Exception:
        return {
            "available": False,
            "version": None,
            "binary": tesseract_cmd,
            "install_instructions": get_tesseract_install_instructions(),
        }


def build_missing_tesseract_error() -> Dict[str, Any]:
    return {
        "error": "Tesseract OCR not installed",
        "install_instructions": get_tesseract_install_instructions(),
    }


def decode_base64_image_data(image_data: str) -> bytes:
    if not image_data or not isinstance(image_data, str):
        raise ValueError("No base64 image provided")

    payload = image_data.strip()
    # Expected DataURL: data:image/jpeg;base64,<...>
    if payload.startswith("data:image"):
        match = re.match(r"^data:image/[a-zA-Z0-9.+-]+;base64,(.+)$", payload, flags=re.DOTALL)
        if not match:
            raise ValueError("Invalid base64 image format. Expected data:image/...;base64,...")
        payload = match.group(1)

    try:
        return base64.b64decode(payload, validate=True)
    except Exception as exc:
        raise ValueError("Invalid base64 image content") from exc


def detect_image_format(image_bytes: bytes) -> str:
    try:
        with Image.open(io.BytesIO(image_bytes)) as image:
            image.load()
            detected = str(image.format or "").upper()
    except UnidentifiedImageError as exc:
        raise ValueError("Unsupported file. Please upload a valid JPEG or PNG image") from exc
    except Exception as exc:
        raise ValueError("Invalid image file") from exc

    if detected not in SUPPORTED_IMAGE_FORMATS:
        raise ValueError("Only JPG, JPEG, and PNG images are supported")
    return detected


def validate_receipt_upload(filename: Optional[str], content_type: Optional[str], image_bytes: bytes) -> str:
    del filename  # Validation is based on actual image bytes, not extension.
    del content_type

    if not image_bytes:
        raise ValueError("File is empty")

    if len(image_bytes) > MAX_RECEIPT_IMAGE_BYTES:
        raise ValueError("Image too large (max 10MB)")

    return detect_image_format(image_bytes)
