"""
Test Suite: Bills CRUD Operations
Tests create, read, update, delete bill operations with data persistence verification
"""
import pytest
import os
import time

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL') or 'http://localhost:8001'
if BASE_URL:
    BASE_URL = BASE_URL.rstrip('/')


class TestBillsCRUD:
    """Bill CRUD operations tests"""
    
    created_bill_id = None

    def test_create_bill_and_verify_persistence(self, api_client, auth_headers):
        """Test POST /api/bills - Create new bill and GET to verify persistence"""
        bill_payload = {
            "title": "TEST_Dinner at Italian Restaurant",
            "currency": "USD",
            "items": [
                {"name": "Pizza Margherita", "price": 15.50, "quantity": 2, "assigned_to": []},
                {"name": "Pasta Carbonara", "price": 18.00, "quantity": 1, "assigned_to": []}
            ],
            "participants": [
                {"name": "Alice", "contact_info": "alice@test.com"},
                {"name": "Bob", "contact_info": ""}
            ],
            "tax_type": "percentage",
            "tax_value": 10.0,
            "service_charge": 5.0,
            "split_method": "equal"
        }
        
        response = api_client.post(f"{BASE_URL}/api/bills", json=bill_payload, headers=auth_headers)
        assert response.status_code == 200, f"Create bill failed with status {response.status_code}: {response.text}"
        
        data = response.json()
        assert "bill_id" in data, "bill_id missing in response"
        assert data["title"] == bill_payload["title"], "Title mismatch"
        assert len(data["items"]) == 2, f"Expected 2 items, got {len(data['items'])}"
        assert len(data["participants"]) == 3, f"Expected 3 participants (owner + 2), got {len(data['participants'])}"
        assert "subtotal" in data, "subtotal missing"
        assert "total_amount" in data, "total_amount missing"
        assert "splits" in data, "splits missing"
        assert len(data["splits"]) == 3, f"Expected 3 splits, got {len(data['splits'])}"
        
        TestBillsCRUD.created_bill_id = data["bill_id"]
        print(f"✓ Bill created successfully - ID: {TestBillsCRUD.created_bill_id}, Total: {data['total_amount']}")
        
        # GET to verify persistence
        time.sleep(0.5)
        get_response = api_client.get(f"{BASE_URL}/api/bills/{TestBillsCRUD.created_bill_id}", headers=auth_headers)
        assert get_response.status_code == 200, "Failed to retrieve created bill"
        
        get_data = get_response.json()
        assert get_data["bill_id"] == TestBillsCRUD.created_bill_id, "Bill ID mismatch on GET"
        assert get_data["title"] == bill_payload["title"], "Title not persisted correctly"
        print(f"✓ Bill persistence verified - Retrieved bill with correct data")

    def test_get_bills_list(self, api_client, auth_headers):
        """Test GET /api/bills - Get all bills for authenticated user"""
        response = api_client.get(f"{BASE_URL}/api/bills", headers=auth_headers)
        assert response.status_code == 200, f"Get bills failed with status {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        assert len(data) >= 1, "Should have at least one bill (the test bill)"
        
        # Verify test bill is in the list
        if TestBillsCRUD.created_bill_id:
            test_bill = next((b for b in data if b["bill_id"] == TestBillsCRUD.created_bill_id), None)
            assert test_bill is not None, "Created test bill not found in bills list"
            print(f"✓ Get bills list passed - Found {len(data)} bills including test bill")
        else:
            print(f"✓ Get bills list passed - Found {len(data)} bills")

    def test_get_bill_detail(self, api_client, auth_headers, test_bill_id):
        """Test GET /api/bills/{bill_id} - Get specific bill details"""
        response = api_client.get(f"{BASE_URL}/api/bills/{test_bill_id}", headers=auth_headers)
        assert response.status_code == 200, f"Get bill detail failed with status {response.status_code}"
        
        data = response.json()
        assert data["bill_id"] == test_bill_id, "Bill ID mismatch"
        assert "title" in data, "title missing"
        assert "items" in data, "items missing"
        assert "participants" in data, "participants missing"
        assert "splits" in data, "splits missing"
        print(f"✓ Get bill detail passed - Bill: {data['title']}")

    def test_get_bill_not_found(self, api_client, auth_headers):
        """Test GET /api/bills/{bill_id} with non-existent bill returns 404"""
        response = api_client.get(f"{BASE_URL}/api/bills/non_existent_bill_123", headers=auth_headers)
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Get non-existent bill correctly returns 404")

    def test_update_bill(self, api_client, auth_headers):
        """Test PUT /api/bills/{bill_id} - Update bill and verify changes"""
        if not TestBillsCRUD.created_bill_id:
            pytest.skip("No test bill created")
        
        update_payload = {
            "title": "TEST_Updated Dinner at Italian Restaurant",
            "tax_value": 15.0
        }
        
        response = api_client.put(
            f"{BASE_URL}/api/bills/{TestBillsCRUD.created_bill_id}",
            json=update_payload,
            headers=auth_headers
        )
        assert response.status_code == 200, f"Update bill failed with status {response.status_code}"
        
        data = response.json()
        assert data["title"] == update_payload["title"], "Title not updated"
        assert data["tax_value"] == update_payload["tax_value"], "Tax value not updated"
        print(f"✓ Update bill passed - New title: {data['title']}")
        
        # Verify update persisted
        time.sleep(0.5)
        get_response = api_client.get(f"{BASE_URL}/api/bills/{TestBillsCRUD.created_bill_id}", headers=auth_headers)
        get_data = get_response.json()
        assert get_data["title"] == update_payload["title"], "Update not persisted"
        print("✓ Update persistence verified")

    def test_delete_bill_and_verify(self, api_client, auth_headers):
        """Test DELETE /api/bills/{bill_id} - Delete bill and verify with GET"""
        if not TestBillsCRUD.created_bill_id:
            pytest.skip("No test bill created")
        
        response = api_client.delete(
            f"{BASE_URL}/api/bills/{TestBillsCRUD.created_bill_id}",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Delete bill failed with status {response.status_code}"
        
        data = response.json()
        assert "message" in data, "Success message missing"
        print(f"✓ Delete bill passed - Bill {TestBillsCRUD.created_bill_id} deleted")
        
        # Verify deletion with GET
        time.sleep(0.5)
        get_response = api_client.get(f"{BASE_URL}/api/bills/{TestBillsCRUD.created_bill_id}", headers=auth_headers)
        assert get_response.status_code == 404, f"Deleted bill still accessible, status: {get_response.status_code}"
        print("✓ Deletion verified - Bill no longer accessible")
