"""
Test Suite: Share Links
Tests share link creation and access
"""
import pytest
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL') or 'http://localhost:8001'
if BASE_URL:
    BASE_URL = BASE_URL.rstrip('/')


class TestShareLinks:
    """Share links tests"""
    
    share_token = None

    def test_create_share_link(self, api_client, auth_headers, test_bill_id):
        """Test POST /api/bills/{bill_id}/share - Create share link"""
        share_payload = {
            "expires_hours": 72,
            "public_access": True
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/bills/{test_bill_id}/share",
            json=share_payload,
            headers=auth_headers
        )
        assert response.status_code == 200, f"Create share link failed with status {response.status_code}"
        
        data = response.json()
        assert "token" in data, "token missing"
        assert "link_id" in data, "link_id missing"
        assert "expires_at" in data, "expires_at missing"
        assert data["bill_id"] == test_bill_id, "bill_id mismatch"
        
        TestShareLinks.share_token = data["token"]
        print(f"✓ Share link created - Token: {TestShareLinks.share_token[:20]}...")

    def test_get_shared_bill(self, api_client):
        """Test GET /api/share/{token} - Access shared bill without auth"""
        if not TestShareLinks.share_token:
            pytest.skip("No share token created")
        
        response = api_client.get(f"{BASE_URL}/api/share/{TestShareLinks.share_token}")
        assert response.status_code == 200, f"Get shared bill failed with status {response.status_code}"
        
        data = response.json()
        assert "bill_id" in data, "bill_id missing"
        assert "title" in data, "title missing"
        assert "items" in data, "items missing"
        assert "participants" in data, "participants missing"
        print(f"✓ Shared bill accessed - Bill: {data['title']}")

    def test_get_shared_bill_invalid_token(self, api_client):
        """Test GET /api/share/{token} with invalid token returns 404"""
        response = api_client.get(f"{BASE_URL}/api/share/invalid_token_12345")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Invalid share token correctly returns 404")
