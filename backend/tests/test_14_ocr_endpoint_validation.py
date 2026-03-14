"""
Integration tests for OCR endpoint validation behavior.
"""

import os
import requests
from io import BytesIO
import base64

from PIL import Image

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL') or 'http://localhost:8001'
if BASE_URL:
    BASE_URL = BASE_URL.rstrip('/')


def _post_multipart(auth_headers, files):
    return requests.post(
        f"{BASE_URL}/api/ocr/scan-receipt",
        files=files,
        headers={"Authorization": auth_headers["Authorization"]},
        timeout=20,
    )


def _sample_jpeg_bytes():
    image = Image.new("RGB", (320, 180), (255, 255, 255))
    buffer = BytesIO()
    image.save(buffer, format="JPEG")
    return buffer.getvalue()


def _post_base64_json(auth_headers, image_data):
    return requests.post(
        f"{BASE_URL}/api/ocr/scan-receipt",
        json={"image": image_data},
        headers={"Authorization": auth_headers["Authorization"]},
        timeout=20,
    )


def test_scan_receipt_valid_jpeg_upload_is_accepted(auth_headers):
    files = {
        "file": ("receipt.jpg", _sample_jpeg_bytes(), "image/jpeg"),
    }
    response = _post_multipart(auth_headers, files)
    assert response.status_code in (200, 400), f"Unexpected status {response.status_code}: {response.text}"
    assert "Only JPG, JPEG, and PNG images are supported" not in response.text


def test_scan_receipt_valid_base64_upload_is_accepted(auth_headers):
    encoded = base64.b64encode(_sample_jpeg_bytes()).decode("utf-8")
    payload = f"data:image/jpeg;base64,{encoded}"
    response = _post_base64_json(auth_headers, payload)
    assert response.status_code in (200, 400), f"Unexpected status {response.status_code}: {response.text}"
    assert "Invalid base64" not in response.text
    assert "Only JPG, JPEG, and PNG images are supported" not in response.text


def test_scan_receipt_invalid_file_type_returns_400(auth_headers):
    files = {
        "file": ("receipt.txt", b"hello", "text/plain"),
    }

    response = _post_multipart(auth_headers, files)
    assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"


def test_scan_receipt_invalid_image_bytes_returns_400(auth_headers):
    files = {
        "file": ("receipt.png", b"invalid-image-content", "image/png"),
    }

    response = _post_multipart(auth_headers, files)
    assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"


def test_scan_receipt_oversized_upload_returns_400(auth_headers):
    oversized = b"\xff\xd8\xff" + (b"0" * (10 * 1024 * 1024 + 2))
    files = {
        "file": ("receipt.jpg", oversized, "image/jpeg"),
    }

    response = _post_multipart(auth_headers, files)
    assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
