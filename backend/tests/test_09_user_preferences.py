"""
Test Suite: User Preferences (Currency Settings)
Tests user preference management including preferred currency
"""
import pytest
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL') or 'http://127.0.0.1:8000'
if BASE_URL:
    BASE_URL = BASE_URL.rstrip('/')


class TestUserPreferences:
    """User preferences tests"""

    def test_get_user_preferences(self, api_client, auth_headers):
        """Test GET /api/user/preferences - Get user preferences"""
        response = api_client.get(f"{BASE_URL}/api/user/preferences", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "user_id" in data
        assert "preferred_currency" in data
        assert data["preferred_currency"] in [
            "USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "CNY",
            "INR", "SGD", "HKD", "NZD", "KRW", "MXN", "BRL", "ZAR",
            "SEK", "NOK", "DKK", "THB", "IDR", "MYR", "PHP", "TWD",
            "TRY", "PLN", "CZK", "HUF", "ILS", "AED"
        ]
        print(f"✓ User preferences retrieved - preferred_currency: {data['preferred_currency']}")

    def test_update_user_preferences_to_eur(self, api_client, auth_headers):
        """Test PUT /api/user/preferences - Update to EUR"""
        response = api_client.put(
            f"{BASE_URL}/api/user/preferences",
            headers=auth_headers,
            json={"preferred_currency": "EUR"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["preferred_currency"] == "EUR"
        print(f"✓ Currency updated to EUR")

    def test_update_user_preferences_to_gbp(self, api_client, auth_headers):
        """Test PUT /api/user/preferences - Update to GBP"""
        response = api_client.put(
            f"{BASE_URL}/api/user/preferences",
            headers=auth_headers,
            json={"preferred_currency": "GBP"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["preferred_currency"] == "GBP"
        print(f"✓ Currency updated to GBP")

    def test_update_user_preferences_to_idr(self, api_client, auth_headers):
        """Test PUT /api/user/preferences - Update to IDR (Indonesian Rupiah)"""
        response = api_client.put(
            f"{BASE_URL}/api/user/preferences",
            headers=auth_headers,
            json={"preferred_currency": "IDR"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["preferred_currency"] == "IDR"
        print(f"✓ Currency updated to IDR")

    def test_get_preferences_persists(self, api_client, auth_headers):
        """Test that preferences persist across API calls"""
        # Set to SGD
        api_client.put(
            f"{BASE_URL}/api/user/preferences",
            headers=auth_headers,
            json={"preferred_currency": "SGD"}
        )
        
        # Get should return SGD
        response = api_client.get(f"{BASE_URL}/api/user/preferences", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["preferred_currency"] == "SGD"
        print(f"✓ Preferences persisted correctly")

    def test_dashboard_stats_includes_currency(self, api_client, auth_headers):
        """Test that dashboard stats respects preferred currency"""
        # Set currency to EUR
        api_client.put(
            f"{BASE_URL}/api/user/preferences",
            headers=auth_headers,
            json={"preferred_currency": "EUR"}
        )
        
        # Get dashboard stats
        response = api_client.get(f"{BASE_URL}/api/dashboard/stats", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "currency" in data
        assert data["currency"] == "EUR"
        assert "outstanding" in data
        print(f"✓ Dashboard stats includes currency: {data['currency']}")

    def test_analytics_summary_includes_currency(self, api_client, auth_headers):
        """Test that analytics summary includes preferred currency"""
        # Set currency to JPY
        api_client.put(
            f"{BASE_URL}/api/user/preferences",
            headers=auth_headers,
            json={"preferred_currency": "JPY"}
        )
        
        # Get analytics summary
        response = api_client.get(f"{BASE_URL}/api/analytics/summary", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "preferred_currency" in data
        assert data["preferred_currency"] == "JPY"
        print(f"✓ Analytics summary includes preferred currency: {data['preferred_currency']}")

    def test_analytics_spending_includes_currency(self, api_client, auth_headers):
        """Test that analytics spending includes preferred currency"""
        # Set currency to AUD
        api_client.put(
            f"{BASE_URL}/api/user/preferences",
            headers=auth_headers,
            json={"preferred_currency": "AUD"}
        )
        
        # Get analytics spending
        response = api_client.get(f"{BASE_URL}/api/analytics/spending", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "currency" in data
        assert data["currency"] == "AUD"
        print(f"✓ Analytics spending includes currency: {data['currency']}")

    def test_invalid_currency_code(self, api_client, auth_headers):
        """Test that invalid currency codes are rejected"""
        response = api_client.put(
            f"{BASE_URL}/api/user/preferences",
            headers=auth_headers,
            json={"preferred_currency": "INVALID"}
        )
        # Should fail validation
        assert response.status_code in [400, 422]
        print(f"✓ Invalid currency code rejected")

    def test_currency_case_insensitive(self, api_client, auth_headers):
        """Test that currency codes are case-insensitive"""
        response = api_client.put(
            f"{BASE_URL}/api/user/preferences",
            headers=auth_headers,
            json={"preferred_currency": "eur"}
        )
        assert response.status_code == 200
        
        data = response.json()
        # Should be converted to uppercase
        assert data["preferred_currency"] == "EUR"
        print(f"✓ Currency codes are case-insensitive")
