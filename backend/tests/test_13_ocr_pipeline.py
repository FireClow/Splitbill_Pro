"""
Unit tests for OCR processing pipeline and dependency checks.
"""

from io import BytesIO
import base64

import pytest
from PIL import Image

from ocr_service import decode_base64_image_data, get_tesseract_status, validate_receipt_upload
from receipt_processor import OCREngine, OCRError, ReceiptParser


def _sample_png_bytes(color=(255, 255, 255)):
    image = Image.new("RGB", (320, 180), color)
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def _sample_jpeg_bytes(color=(255, 255, 255)):
    image = Image.new("RGB", (320, 180), color)
    buffer = BytesIO()
    image.save(buffer, format="JPEG")
    return buffer.getvalue()


def test_ocr_engine_valid_image_pipeline(monkeypatch):
    monkeypatch.setattr(
        "receipt_processor.get_ocr_runtime_status",
        lambda: {
            "available": True,
            "provider": "tesseract",
            "google_vision": {"available": False},
            "tesseract": {"available": True},
        },
    )
    monkeypatch.setattr(
        "receipt_processor.pytesseract.image_to_string",
        lambda *_args, **_kwargs: "Burger 5.50\nFries 2.50\nDrink 1.50",
    )

    text = OCREngine.extract_text_from_image(_sample_png_bytes())
    assert "Burger" in text
    assert "Fries" in text


def test_ocr_engine_missing_tesseract_raises(monkeypatch):
    monkeypatch.setattr(
        "receipt_processor.get_ocr_runtime_status",
        lambda: {
            "available": False,
            "provider": "tesseract",
            "google_vision": {"available": False},
            "tesseract": {"available": False},
        },
    )

    with pytest.raises(OCRError, match="No OCR provider available"):
        OCREngine.extract_text_from_image(_sample_png_bytes())


def test_ocr_engine_empty_text_raises(monkeypatch):
    monkeypatch.setattr(
        "receipt_processor.get_ocr_runtime_status",
        lambda: {
            "available": True,
            "provider": "tesseract",
            "google_vision": {"available": False},
            "tesseract": {"available": True},
        },
    )
    monkeypatch.setattr("receipt_processor.pytesseract.image_to_string", lambda *_args, **_kwargs: "   ")

    with pytest.raises(OCRError, match="empty text"):
        OCREngine.extract_text_from_image(_sample_png_bytes())


def test_ocr_engine_invalid_image_bytes_raises(monkeypatch):
    monkeypatch.setattr(
        "receipt_processor.get_ocr_runtime_status",
        lambda: {
            "available": True,
            "provider": "tesseract",
            "google_vision": {"available": False},
            "tesseract": {"available": True},
        },
    )

    with pytest.raises(OCRError):
        OCREngine.extract_text_from_image(b"not-a-real-image")


def test_receipt_parser_simple_lines_to_items():
    parsed = ReceiptParser.parse_receipt("Burger 5.50\nFries 2.50\nDrink 1.50")

    assert len(parsed["items"]) == 3
    assert parsed["items"][0]["name"].lower() == "burger"
    assert parsed["items"][0]["price"] == 5.5
    assert parsed["subtotal"] == 9.5
    assert parsed["total"] == 9.5


def test_tesseract_status_missing_returns_install_instructions(monkeypatch):
    monkeypatch.setattr("ocr_service._detect_tesseract_cmd", lambda: None)

    def _raise(*_args, **_kwargs):
        raise RuntimeError("missing")

    monkeypatch.setattr("ocr_service.pytesseract.get_tesseract_version", _raise)

    status = get_tesseract_status()
    assert status["available"] is False
    assert "install_instructions" in status


def test_validate_receipt_upload_valid_jpeg_passes():
    fmt = validate_receipt_upload("receipt.jpg", "image/jpeg", _sample_jpeg_bytes())
    assert fmt == "JPEG"


def test_decode_base64_data_url_valid_image():
    encoded = base64.b64encode(_sample_png_bytes()).decode("utf-8")
    payload = f"data:image/png;base64,{encoded}"
    decoded = decode_base64_image_data(payload)
    assert decoded.startswith(b"\x89PNG")


def test_decode_base64_data_url_invalid_raises():
    with pytest.raises(ValueError, match="Invalid base64"):
        decode_base64_image_data("data:image/jpeg;base64,@@invalid@@")


def test_receipt_parser_indonesian_multi_line_quantity_format():
    text = "Indomie Bangladesh Jumbo\n3 x Rp25.000\nIndomie Bangladesh Spesial\n2 x Rp25.000"
    parsed = ReceiptParser.parse_receipt(text)

    assert len(parsed["items"]) == 2
    assert parsed["items"][0]["quantity"] == 3
    assert parsed["items"][0]["price"] == 25000.0
    assert parsed["items"][1]["quantity"] == 2
    assert parsed["items"][1]["price"] == 25000.0
