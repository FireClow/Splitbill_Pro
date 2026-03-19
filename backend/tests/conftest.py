import pytest
import requests
import os
import time
import subprocess
import socket
import sys
from pathlib import Path

# Use an isolated backend URL for pytest runs unless explicitly overridden.
DEFAULT_TEST_BASE_URL = os.environ.get('PYTEST_BACKEND_URL') or 'http://127.0.0.1:18001'
os.environ['EXPO_PUBLIC_BACKEND_URL'] = DEFAULT_TEST_BASE_URL
BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL') or DEFAULT_TEST_BASE_URL
if BASE_URL:
    BASE_URL = BASE_URL.rstrip('/')


def _is_port_open(host: str, port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.3)
        return sock.connect_ex((host, port)) == 0


@pytest.fixture(scope="session", autouse=True)
def ensure_backend_server():
    """Start local backend server when tests run without a pre-started API."""
    backend_dir = Path(__file__).resolve().parent.parent
    host = "127.0.0.1"
    default_port = 18001
    base_url = os.environ.get('EXPO_PUBLIC_BACKEND_URL') or f'http://{host}:{default_port}'
    parsed_port = default_port
    try:
        parsed_port = int(base_url.rsplit(':', 1)[1])
    except (TypeError, ValueError, IndexError):
        parsed_port = default_port
    port = parsed_port
    process = None

    if not _is_port_open(host, port):
        process = subprocess.Popen(
            [
                sys.executable,
                "-m",
                "uvicorn",
                "server:app",
                "--host",
                host,
                "--port",
                str(port),
            ],
            cwd=str(backend_dir),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

        ready = False
        health_url = f"http://{host}:{port}/api/health"
        for _ in range(80):
            if process and process.poll() is not None:
                break
            try:
                response = requests.get(health_url, timeout=1.0)
                if response.status_code == 200:
                    ready = True
                    break
            except Exception:
                time.sleep(0.25)

        if not ready:
            if process and process.poll() is None:
                process.terminate()
            raise RuntimeError(f"Backend test server failed to start on {health_url}")

    yield

    if process and process.poll() is None:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()

@pytest.fixture(scope="session")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session

@pytest.fixture(scope="session")
def auth_token(api_client):
    """Create a fresh valid session token for tests."""
    session_id = f"pytest-session-{int(time.time() * 1000)}"
    response = api_client.post(
        f"{BASE_URL}/api/auth/session",
        json={"session_id": session_id},
    )
    assert response.status_code == 200, f"Auth session creation failed: {response.text}"
    data = response.json()
    token = data.get("session_token")
    assert token, "session_token missing from auth/session response"
    return token

@pytest.fixture(scope="session")
def test_user_id(api_client, auth_headers):
    """Fetch current authenticated test user ID."""
    response = api_client.get(f"{BASE_URL}/api/auth/me", headers=auth_headers)
    assert response.status_code == 200, f"Failed to fetch current user: {response.text}"
    return response.json().get("user_id")

@pytest.fixture(scope="session")
def test_bill_id(api_client, auth_headers):
    """Create a seed bill and return its ID for endpoint tests."""
    payload = {
        "title": "TEST_Seed Bill",
        "currency": "USD",
        "items": [
            {"name": "Seed Item 1", "price": 10.0, "quantity": 1, "assigned_to": []},
            {"name": "Seed Item 2", "price": 15.0, "quantity": 1, "assigned_to": []},
        ],
        "participants": [
            {"name": "Alice", "contact_info": "alice@test.com"},
            {"name": "Bob", "contact_info": "bob@test.com"},
        ],
        "tax_type": "percentage",
        "tax_value": 0.0,
        "service_charge": 0.0,
        "split_method": "equal",
    }
    response = api_client.post(f"{BASE_URL}/api/bills", json=payload, headers=auth_headers)
    assert response.status_code == 200, f"Seed bill creation failed: {response.text}"
    bill_id = response.json().get("bill_id")
    assert bill_id, "bill_id missing from create bill response"
    return bill_id

@pytest.fixture(scope="session")
def auth_headers(auth_token):
    """Headers with auth token"""
    return {"Authorization": f"Bearer {auth_token}"}
