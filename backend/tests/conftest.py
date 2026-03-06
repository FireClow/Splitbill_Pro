import pytest
import requests
import os
import time

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
