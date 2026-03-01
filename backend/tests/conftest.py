import pytest
import requests
import os

# Use the public frontend URL for testing (backend is accessible via /api prefix through ingress)
BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL') or 'http://localhost:8001'
if BASE_URL:
    BASE_URL = BASE_URL.rstrip('/')

@pytest.fixture(scope="session")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session

@pytest.fixture(scope="session")
def auth_token():
    """Test session token from environment"""
    return "test_session_1772214064321"

@pytest.fixture(scope="session")
def test_user_id():
    """Test user ID"""
    return "test-user-1772214064321"

@pytest.fixture(scope="session")
def test_bill_id():
    """Test bill ID"""
    return "bill_245a52a13495"

@pytest.fixture
def auth_headers(auth_token):
    """Headers with auth token"""
    return {"Authorization": f"Bearer {auth_token}"}
