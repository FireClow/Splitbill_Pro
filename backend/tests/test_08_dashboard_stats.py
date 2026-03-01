"""
Test Suite: Dashboard Stats
Tests dashboard statistics endpoint
"""
import pytest
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL') or 'http://localhost:8001'
if BASE_URL:
    BASE_URL = BASE_URL.rstrip('/')


class TestDashboardStats:
    """Dashboard statistics tests"""

    def test_get_dashboard_stats(self, api_client, auth_headers):
        """Test GET /api/dashboard/stats - Get user dashboard statistics"""
        response = api_client.get(f"{BASE_URL}/api/dashboard/stats", headers=auth_headers)
        assert response.status_code == 200, f"Get dashboard stats failed with status {response.status_code}"
        
        data = response.json()
        
        # Verify all required fields
        required_fields = ["total_bills", "active_bills", "settled_bills", "total_amount", "total_owed", "total_paid", "outstanding"]
        for field in required_fields:
            assert field in data, f"{field} missing from dashboard stats"
            assert isinstance(data[field], (int, float)), f"{field} should be numeric"
        
        # Verify logical relationships
        assert data["total_bills"] >= 0, "total_bills should be non-negative"
        assert data["total_bills"] >= data["active_bills"], "total_bills should be >= active_bills"
        assert data["total_bills"] >= data["settled_bills"], "total_bills should be >= settled_bills"
        assert data["active_bills"] + data["settled_bills"] <= data["total_bills"], "active + settled should <= total"
        
        print(f"✓ Dashboard stats retrieved:")
        print(f"  Total bills: {data['total_bills']}")
        print(f"  Active: {data['active_bills']}, Settled: {data['settled_bills']}")
        print(f"  Total amount: {data['total_amount']}")
        print(f"  Outstanding: {data['outstanding']}")

    def test_dashboard_stats_requires_auth(self, api_client):
        """Test GET /api/dashboard/stats without auth returns 401"""
        response = api_client.get(f"{BASE_URL}/api/dashboard/stats")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Dashboard stats correctly requires authentication")
