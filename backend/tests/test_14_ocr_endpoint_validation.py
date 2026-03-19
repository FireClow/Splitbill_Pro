"""
Integration tests for OCR endpoint validation behavior.
"""

import os
import requests
from io import BytesIO
import base64
import uuid
import json
from datetime import datetime, timezone

from PIL import Image
from pymongo import MongoClient

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL') or 'http://127.0.0.1:8000'
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


def _seed_receipt_image_for_user(auth_headers) -> str:
    me_response = requests.get(
        f"{BASE_URL}/api/auth/me",
        headers={"Authorization": auth_headers["Authorization"]},
        timeout=20,
    )
    assert me_response.status_code == 200, f"Failed to resolve current user: {me_response.text}"
    user_id = me_response.json().get("user_id")
    assert user_id, "Missing user_id from auth/me"

    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "splitbill_local")

    image = Image.new("RGB", (640, 1024), (255, 255, 255))
    buf = BytesIO()
    image.save(buf, format="PNG")

    image_id = f"pytest_receipt_{uuid.uuid4().hex[:12]}.png"
    client = MongoClient(mongo_url)
    try:
        client[db_name].receipt_images.insert_one({
            "image_id": image_id,
            "user_id": user_id,
            "image_bytes": buf.getvalue(),
            "ocr_text": "",
            "parsed_data": {},
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    finally:
        client.close()

    return image_id


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


def test_rescan_cropped_invalid_points_json_returns_400(auth_headers):
    image_id = _seed_receipt_image_for_user(auth_headers)
    response = requests.post(
        f"{BASE_URL}/api/ocr/rescan-cropped",
        headers={"Authorization": auth_headers["Authorization"]},
        data={
            "image_id": image_id,
            "crop_points_json": "{not-valid-json",
        },
        timeout=20,
    )
    assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
    assert "valid JSON" in response.text


def test_rescan_cropped_rejects_tiny_polygon(auth_headers):
    image_id = _seed_receipt_image_for_user(auth_headers)
    tiny = [
        {"x": 10, "y": 10},
        {"x": 12, "y": 10},
        {"x": 12, "y": 12},
        {"x": 10, "y": 12},
    ]
    response = requests.post(
        f"{BASE_URL}/api/ocr/rescan-cropped",
        headers={"Authorization": auth_headers["Authorization"]},
        data={
            "image_id": image_id,
            "crop_points_json": json.dumps(tiny),
        },
        timeout=20,
    )
    assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
    assert "area is too small" in response.text


def test_rescan_cropped_rejects_point_without_coordinates(auth_headers):
    image_id = _seed_receipt_image_for_user(auth_headers)
    malformed = [
        {"x": 50, "y": 50},
        {"x": 200},
        {"x": 210, "y": 300},
        {"x": 40, "y": 280},
    ]
    response = requests.post(
        f"{BASE_URL}/api/ocr/rescan-cropped",
        headers={"Authorization": auth_headers["Authorization"]},
        data={
            "image_id": image_id,
            "crop_points_json": json.dumps(malformed),
        },
        timeout=20,
    )
    assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
    assert "must have x and y" in response.text


def test_suggest_crop_returns_four_points(auth_headers):
    image_id = _seed_receipt_image_for_user(auth_headers)
    response = requests.post(
        f"{BASE_URL}/api/ocr/suggest-crop",
        headers={"Authorization": auth_headers["Authorization"]},
        data={"image_id": image_id},
        timeout=20,
    )

    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    payload = response.json()
    points = payload.get("points", [])
    assert len(points) == 4, f"Expected 4 points, got {len(points)}"
    for point in points:
        assert isinstance(point.get("x"), (int, float))
        assert isinstance(point.get("y"), (int, float))
        assert point["x"] >= 0
        assert point["y"] >= 0


def test_suggest_crop_unknown_image_returns_404(auth_headers):
    response = requests.post(
        f"{BASE_URL}/api/ocr/suggest-crop",
        headers={"Authorization": auth_headers["Authorization"]},
        data={"image_id": "missing-image-id"},
        timeout=20,
    )

    assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
