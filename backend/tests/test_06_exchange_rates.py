"""
Test Suite: Exchange Rates
Tests exchange rate API integration
"""
import pytest
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL') or 'http://127.0.0.1:8000'
if BASE_URL:
    BASE_URL = BASE_URL.rstrip('/')


class TestExchangeRates:
    """Exchange rates tests"""

    def test_get_exchange_rate_usd_to_eur(self, api_client):
        """Test GET /api/exchange-rates?base=USD&target=EUR"""
        response = api_client.get(f"{BASE_URL}/api/exchange-rates?base=USD&target=EUR")
        assert response.status_code == 200, f"Get exchange rate failed with status {response.status_code}"
        
        data = response.json()
        assert "base_currency" in data, "base_currency missing"
        assert "target_currency" in data, "target_currency missing"
        assert "rate" in data, "rate missing"
        assert data["base_currency"] == "USD", "Base currency mismatch"
        assert data["target_currency"] == "EUR", "Target currency mismatch"
        assert isinstance(data["rate"], (int, float)), "Rate should be numeric"
        assert data["rate"] > 0, "Rate should be positive"
        print(f"✓ Exchange rate retrieved - USD to EUR: {data['rate']}")

    def test_get_exchange_rate_gbp_to_usd(self, api_client):
        """Test GET /api/exchange-rates?base=GBP&target=USD"""
        response = api_client.get(f"{BASE_URL}/api/exchange-rates?base=GBP&target=USD")
        assert response.status_code == 200, f"Get exchange rate failed with status {response.status_code}"
        
        data = response.json()
        assert data["base_currency"] == "GBP", "Base currency mismatch"
        assert data["target_currency"] == "USD", "Target currency mismatch"
        assert data["rate"] > 0, "Rate should be positive"
        print(f"✓ Exchange rate retrieved - GBP to USD: {data['rate']}")

    def test_get_currencies_list(self, api_client):
        """Test GET /api/currencies - Get supported currencies"""
        response = api_client.get(f"{BASE_URL}/api/currencies")
        assert response.status_code == 200, f"Get currencies failed with status {response.status_code}"
        
        data = response.json()
        assert "currencies" in data, "currencies field missing"
        assert isinstance(data["currencies"], list), "currencies should be a list"
        assert len(data["currencies"]) > 0, "currencies list should not be empty"
        assert "USD" in data["currencies"], "USD should be in currencies list"
        assert "EUR" in data["currencies"], "EUR should be in currencies list"
        print(f"✓ Currencies list retrieved - {len(data['currencies'])} currencies supported")
