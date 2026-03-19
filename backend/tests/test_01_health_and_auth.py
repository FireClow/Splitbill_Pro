"""
Test Suite: Health Check and Authentication Endpoints
Tests basic connectivity and auth flow
"""
import pytest
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL') or 'http://127.0.0.1:8000'
if BASE_URL:
    BASE_URL = BASE_URL.rstrip('/')


class TestHealthAndAuth:
    """Health check and authentication tests"""

    def test_health_endpoint(self, api_client):
        """Test GET /api/health returns 200 and service info"""
        response = api_client.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200, f"Health check failed with status {response.status_code}"
        
        data = response.json()
        assert data["status"] == "ok", "Health status is not ok"
        assert "service" in data, "Service name missing"
        assert data["service"] == "SplitBill Pro API", f"Unexpected service name: {data.get('service')}"
        print(f"✓ Health check passed - Service: {data['service']}")

    def test_auth_me_with_valid_token(self, api_client, auth_headers, test_user_id):
        """Test GET /api/auth/me with valid bearer token"""
        response = api_client.get(f"{BASE_URL}/api/auth/me", headers=auth_headers)
        assert response.status_code == 200, f"Auth /me failed with status {response.status_code}"
        
        data = response.json()
        assert "user_id" in data, "user_id field missing"
        assert "email" in data, "email field missing"
        assert "name" in data, "name field missing"
        assert data["user_id"] == test_user_id, f"User ID mismatch: {data.get('user_id')} != {test_user_id}"
        print(f"✓ Auth /me passed - User: {data['name']} ({data['email']})")

    def test_auth_me_without_token(self, api_client):
        """Test GET /api/auth/me without token returns 401"""
        response = api_client.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Auth /me without token correctly returns 401")

    def test_auth_me_with_invalid_token(self, api_client):
        """Test GET /api/auth/me with invalid token returns 401"""
        headers = {"Authorization": "Bearer invalid_token_12345"}
        response = api_client.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Auth /me with invalid token correctly returns 401")
