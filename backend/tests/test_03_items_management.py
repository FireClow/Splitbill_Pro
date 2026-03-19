"""
Test Suite: Bill Items Management
Tests adding, updating, and deleting items from bills
"""
import pytest
import os
import time

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL') or 'http://127.0.0.1:8000'
if BASE_URL:
    BASE_URL = BASE_URL.rstrip('/')


class TestItemsManagement:
    """Bill items management tests"""

    def test_add_item_to_bill(self, api_client, auth_headers, test_bill_id):
        """Test POST /api/bills/{bill_id}/items - Add new item to bill"""
        item_payload = {
            "name": "TEST_Tiramisu",
            "price": 8.50,
            "quantity": 1,
            "assigned_to": []
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/bills/{test_bill_id}/items",
            json=item_payload,
            headers=auth_headers
        )
        assert response.status_code == 200, f"Add item failed with status {response.status_code}: {response.text}"
        
        data = response.json()
        assert "items" in data, "items field missing"
        
        # Find the newly added item
        new_item = next((i for i in data["items"] if i["name"] == item_payload["name"]), None)
        assert new_item is not None, "Newly added item not found in response"
        assert new_item["price"] == item_payload["price"], "Item price mismatch"
        print(f"✓ Add item passed - Item: {new_item['name']}, Price: {new_item['price']}")
        
        # Verify total was recalculated
        assert "total_amount" in data, "total_amount missing"
        print(f"✓ Bill total recalculated: {data['total_amount']}")

    def test_delete_item_from_bill(self, api_client, auth_headers, test_bill_id):
        """Test DELETE /api/bills/{bill_id}/items/{item_id} - Remove item from bill"""
        # First get the bill to find an item to delete
        get_response = api_client.get(f"{BASE_URL}/api/bills/{test_bill_id}", headers=auth_headers)
        assert get_response.status_code == 200, "Failed to get bill"
        
        bill_data = get_response.json()
        items = bill_data.get("items", [])
        
        if not items:
            pytest.skip("No items in test bill to delete")
        
        # Find TEST_ item or use first item
        item_to_delete = next((i for i in items if "TEST_" in i.get("name", "")), items[0])
        item_id = item_to_delete["item_id"]
        
        response = api_client.delete(
            f"{BASE_URL}/api/bills/{test_bill_id}/items/{item_id}",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Delete item failed with status {response.status_code}"
        
        data = response.json()
        remaining_items = data.get("items", [])
        
        # Verify item is removed
        deleted_item = next((i for i in remaining_items if i["item_id"] == item_id), None)
        assert deleted_item is None, "Item still present after deletion"
        print(f"✓ Delete item passed - Item {item_id} removed")
        
        # Verify total was recalculated
        assert "total_amount" in data, "total_amount missing"
        print(f"✓ Bill total recalculated after deletion: {data['total_amount']}")

    def test_update_item_invalid_assignment_returns_400(self, api_client, auth_headers, test_bill_id):
        """Test invalid assignment sum/overflow is rejected by API."""
        get_response = api_client.get(f"{BASE_URL}/api/bills/{test_bill_id}", headers=auth_headers)
        assert get_response.status_code == 200, "Failed to get bill"

        bill_data = get_response.json()
        items = bill_data.get("items", [])
        participants = bill_data.get("participants", [])
        if not items or not participants:
            pytest.skip("Missing items or participants for invalid assignment test")

        item = items[0]
        participant_id = participants[0]["participant_id"]
        invalid_qty = int(item.get("quantity", 1)) + 1

        payload = {
            "assigned_to": [participant_id],
            "assigned_quantities": {participant_id: invalid_qty},
            "assignments": [{"userId": participant_id, "quantity": invalid_qty}],
        }
        response = api_client.put(
            f"{BASE_URL}/api/bills/{test_bill_id}/items/{item['item_id']}",
            json=payload,
            headers=auth_headers,
        )
        assert response.status_code == 400, f"Expected 400 for overflow assignment, got {response.status_code}: {response.text}"
        print("✓ Invalid assignment correctly rejected with 400")
