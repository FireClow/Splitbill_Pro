import os
import shutil
import base64
import io
import re
from typing import Any, Dict, Optional

import httpx
import pytesseract
from PIL import Image, UnidentifiedImageError


WINDOWS_DEFAULT_TESSERACT = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
WINDOWS_INSTALL_LINK = "https://github.com/UB-Mannheim/tesseract/releases"
MAX_RECEIPT_IMAGE_BYTES = 10 * 1024 * 1024  # 10MB
SUPPORTED_IMAGE_FORMATS = {"JPEG", "PNG"}
GOOGLE_VISION_ENDPOINT = "https://vision.googleapis.com/v1/images:annotate"


def get_ocr_provider() -> str:
    provider = os.environ.get("OCR_PROVIDER", "auto").strip().lower()
    if provider not in {"auto", "tesseract", "google_vision"}:
        return "auto"
    return provider


def get_google_vision_status() -> Dict[str, Any]:
    api_key = os.environ.get("GOOGLE_VISION_API_KEY", "").strip()
    return {
        "available": bool(api_key),
        "provider": "google_vision",
        "configured": bool(api_key),
    }


def get_ocr_runtime_status() -> Dict[str, Any]:
    provider = get_ocr_provider()
    tesseract_status = get_tesseract_status()
    google_status = get_google_vision_status()

    if provider == "tesseract":
        available = bool(tesseract_status.get("available"))
    elif provider == "google_vision":
        available = bool(google_status.get("available"))
    else:
        available = bool(google_status.get("available") or tesseract_status.get("available"))

    return {
        "provider": provider,
        "available": available,
        "tesseract": tesseract_status,
        "google_vision": google_status,
    }


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


def build_missing_ocr_error() -> Dict[str, Any]:
    provider = get_ocr_provider()

    if provider == "google_vision":
        return {
            "error": "Google Vision OCR is not configured",
            "provider": provider,
            "required_env": ["GOOGLE_VISION_API_KEY"],
        }

    if provider == "tesseract":
        return {
            **build_missing_tesseract_error(),
            "provider": provider,
        }

    return {
        "error": "No OCR provider is available",
        "provider": provider,
        "options": {
            "google_vision": {
                "required_env": ["GOOGLE_VISION_API_KEY"],
            },
            "tesseract": get_tesseract_install_instructions(),
        },
    }


def extract_text_google_vision(image_bytes: bytes, timeout_seconds: float = 25.0) -> str:
    api_key = os.environ.get("GOOGLE_VISION_API_KEY", "").strip()
    if not api_key:
        raise ValueError("GOOGLE_VISION_API_KEY is not configured")

    image_b64 = base64.b64encode(image_bytes).decode("ascii")
    payload = {
        "requests": [
            {
                "image": {"content": image_b64},
                "features": [{"type": "DOCUMENT_TEXT_DETECTION"}],
            }
        ]
    }

    with httpx.Client(timeout=timeout_seconds) as client:
        response = client.post(f"{GOOGLE_VISION_ENDPOINT}?key={api_key}", json=payload)

    if response.status_code >= 400:
        raise RuntimeError(f"Google Vision API request failed with status {response.status_code}")

    data = response.json()
    responses = data.get("responses") if isinstance(data, dict) else None
    if not responses or not isinstance(responses, list):
        raise RuntimeError("Google Vision returned invalid response")

    first = responses[0] if responses else {}
    if isinstance(first, dict) and first.get("error"):
        message = first.get("error", {}).get("message", "Google Vision OCR error")
        raise RuntimeError(str(message))

    full_text = ""
    if isinstance(first, dict):
        full_text_annotation = first.get("fullTextAnnotation")
        if isinstance(full_text_annotation, dict):
            full_text = str(full_text_annotation.get("text") or "")

        if not full_text:
            text_annotations = first.get("textAnnotations")
            if isinstance(text_annotations, list) and text_annotations:
                first_text = text_annotations[0]
                if isinstance(first_text, dict):
                    full_text = str(first_text.get("description") or "")

    return full_text.strip()


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
