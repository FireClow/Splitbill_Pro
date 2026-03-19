"""
Test Suite: Bills CRUD Operations
Tests create, read, update, delete bill operations with data persistence verification
"""
import pytest
import os
import time

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL') or 'http://127.0.0.1:8000'
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
        assert len(data["participants"]) == 2, f"Expected 2 participants, got {len(data['participants'])}"
        assert "subtotal" in data, "subtotal missing"
        assert "total_amount" in data, "total_amount missing"
        assert "splits" in data, "splits missing"
        assert len(data["splits"]) == 2, f"Expected 2 splits, got {len(data['splits'])}"
        
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

    def test_create_bill_per_item_assignment_with_client_ids(self, api_client, auth_headers):
        """Test create bill with quantity assignment keyed by participant client_id."""
        participant_alice = f"alice_{int(time.time() * 1000)}"
        participant_bob = f"bob_{int(time.time() * 1000)}"

        bill_payload = {
            "title": "TEST_Create with quantity assignment",
            "currency": "USD",
            "items": [
                {
                    "name": "Grilled Chicken",
                    "price": 12.0,
                    "quantity": 3,
                    "assigned_to": [participant_alice, participant_bob],
                    "assigned_quantities": {
                        participant_alice: 2,
                        participant_bob: 1,
                    },
                    "assignments": [
                        {"userId": participant_alice, "quantity": 2},
                        {"userId": participant_bob, "quantity": 1},
                    ],
                }
            ],
            "participants": [
                {"name": "Alice Quantity", "contact_info": "", "client_id": participant_alice},
                {"name": "Bob Quantity", "contact_info": "", "client_id": participant_bob},
            ],
            "tax_type": "fixed",
            "tax_value": 0.0,
            "service_charge": 0.0,
            "split_method": "per_item",
        }

        response = api_client.post(f"{BASE_URL}/api/bills", json=bill_payload, headers=auth_headers)
        assert response.status_code == 200, f"Create per_item bill failed with status {response.status_code}: {response.text}"

        data = response.json()
        assert "bill_id" in data, "bill_id missing in create response"
        assert data["split_method"] == "per_item", "split_method mismatch"
        assert len(data.get("participants", [])) == 2, "Expected exactly 2 participants"

        item = data["items"][0]
        assigned_quantities = item.get("assigned_quantities", {})
        assert len(assigned_quantities) == 2, "Expected 2 participant quantity assignments"
        assert sum(int(v) for v in assigned_quantities.values()) == 3, "Assigned quantity total must match item quantity"

        split_amounts = [float(s["amount_due"]) for s in data.get("splits", [])]
        assert sorted(split_amounts) == [12.0, 24.0], f"Unexpected per_item split amounts: {split_amounts}"
        print("✓ Create per_item bill with client_id assignment mapping passed")

    def test_owner_like_participant_not_duplicated_by_backend(self, api_client, auth_headers):
        """Owner-like participant entries should remain explicit and deduplicate by client_id only."""
        me_response = api_client.get(f"{BASE_URL}/api/auth/me", headers=auth_headers)
        assert me_response.status_code == 200, f"Failed to fetch auth/me: {me_response.text}"
        me = me_response.json()

        owner_like_id = f"owner_like_{int(time.time() * 1000)}"
        friend_id = f"friend_{int(time.time() * 1000)}"

        bill_payload = {
            "title": "TEST_Owner-like participant dedupe",
            "currency": "USD",
            "items": [
                {
                    "name": "Noodles",
                    "price": 12.0,
                    "quantity": 2,
                    "assigned_to": [owner_like_id, friend_id],
                    "assigned_quantities": {owner_like_id: 1, friend_id: 1},
                    "assignments": [
                        {"userId": owner_like_id, "quantity": 1},
                        {"userId": friend_id, "quantity": 1},
                    ],
                }
            ],
            "participants": [
                {"name": me.get("name", "Owner"), "contact_info": me.get("email", ""), "client_id": owner_like_id},
                {"name": me.get("name", "Owner"), "contact_info": me.get("email", ""), "client_id": owner_like_id},
                {"name": "Friend", "contact_info": "", "client_id": friend_id},
            ],
            "tax_type": "fixed",
            "tax_value": 0.0,
            "service_charge": 0.0,
            "split_method": "per_item",
        }

        response = api_client.post(f"{BASE_URL}/api/bills", json=bill_payload, headers=auth_headers)
        assert response.status_code == 200, f"Create bill failed with status {response.status_code}: {response.text}"
        data = response.json()

        assert len(data.get("participants", [])) == 2, "Duplicate participant should be removed by client_id"
        participant_names = [p["name"] for p in data["participants"]]
        assert participant_names.count(me.get("name", "Owner")) == 1, "Owner-like participant duplicated unexpectedly"
        assert len(data.get("splits", [])) == 2, "Split count must match deduplicated participant count"

    def test_bill_history_keeps_exact_participant_count(self, api_client, auth_headers):
        """Save then reload history should preserve exact participant count and ids."""
        participant_ids = [
            f"hist_{int(time.time() * 1000)}_a",
            f"hist_{int(time.time() * 1000)}_b",
            f"hist_{int(time.time() * 1000)}_c",
        ]

        bill_payload = {
            "title": "TEST_History participants consistency",
            "currency": "USD",
            "items": [
                {
                    "name": "Combo",
                    "price": 9.0,
                    "quantity": 3,
                    "assigned_to": participant_ids,
                    "assigned_quantities": {
                        participant_ids[0]: 1,
                        participant_ids[1]: 1,
                        participant_ids[2]: 1,
                    },
                    "assignments": [
                        {"userId": participant_ids[0], "quantity": 1},
                        {"userId": participant_ids[1], "quantity": 1},
                        {"userId": participant_ids[2], "quantity": 1},
                    ],
                }
            ],
            "participants": [
                {"name": "History A", "contact_info": "", "client_id": participant_ids[0]},
                {"name": "History B", "contact_info": "", "client_id": participant_ids[1]},
                {"name": "History C", "contact_info": "", "client_id": participant_ids[2]},
            ],
            "tax_type": "fixed",
            "tax_value": 0.0,
            "service_charge": 0.0,
            "split_method": "per_item",
        }

        create_response = api_client.post(f"{BASE_URL}/api/bills", json=bill_payload, headers=auth_headers)
        assert create_response.status_code == 200, f"Create history bill failed: {create_response.text}"
        created = create_response.json()
        bill_id = created["bill_id"]

        assert len(created.get("participants", [])) == 3, "Create response participant count mismatch"
        created_participant_ids = {p["participant_id"] for p in created["participants"]}

        detail_response = api_client.get(f"{BASE_URL}/api/bills/{bill_id}", headers=auth_headers)
        assert detail_response.status_code == 200, f"Get bill detail failed: {detail_response.text}"
        detail = detail_response.json()
        assert len(detail.get("participants", [])) == 3, "Bill detail participant count mismatch"
        detail_participant_ids = {p["participant_id"] for p in detail["participants"]}
        assert detail_participant_ids == created_participant_ids, "Participant IDs changed after reload"

        history_response = api_client.get(f"{BASE_URL}/api/bills", headers=auth_headers)
        assert history_response.status_code == 200, f"Get bill history failed: {history_response.text}"
        history_data = history_response.json().get("bills", [])
        history_bill = next((b for b in history_data if b.get("bill_id") == bill_id), None)
        assert history_bill is not None, "Created bill missing from history"
        assert len(history_bill.get("participants", [])) == 3, "History participant count mismatch"

    def test_create_bill_per_item_invalid_assignment_returns_400(self, api_client, auth_headers):
        """Test create bill rejects assignment quantity overflow/mismatch on create path."""
        participant_alice = f"alice_invalid_{int(time.time() * 1000)}"

        bill_payload = {
            "title": "TEST_Invalid quantity assignment on create",
            "currency": "USD",
            "items": [
                {
                    "name": "Soup",
                    "price": 10.0,
                    "quantity": 2,
                    "assigned_to": [participant_alice],
                    "assigned_quantities": {participant_alice: 3},
                    "assignments": [{"userId": participant_alice, "quantity": 3}],
                }
            ],
            "participants": [
                {"name": "Alice Invalid", "contact_info": "", "client_id": participant_alice},
            ],
            "tax_type": "fixed",
            "tax_value": 0.0,
            "service_charge": 0.0,
            "split_method": "per_item",
        }

        response = api_client.post(f"{BASE_URL}/api/bills", json=bill_payload, headers=auth_headers)
        assert response.status_code == 400, f"Expected 400, got {response.status_code}: {response.text}"
        print("✓ Invalid create-bill assignment correctly rejected with 400")

    def test_get_bills_list(self, api_client, auth_headers):
        """Test GET /api/bills - Get all bills for authenticated user"""
        response = api_client.get(f"{BASE_URL}/api/bills", headers=auth_headers)
        assert response.status_code == 200, f"Get bills failed with status {response.status_code}"
        
        data = response.json()
        assert isinstance(data, dict), "Response should be an object"
        assert "bills" in data, "Response should include bills field"
        assert isinstance(data["bills"], list), "bills field should be a list"
        assert len(data["bills"]) >= 1, "Should have at least one bill (the test bill)"
        
        # Verify test bill is in the list
        if TestBillsCRUD.created_bill_id:
            test_bill = next((b for b in data["bills"] if b["bill_id"] == TestBillsCRUD.created_bill_id), None)
            assert test_bill is not None, "Created test bill not found in bills list"
            print(f"✓ Get bills list passed - Found {len(data['bills'])} bills including test bill")
        else:
            print(f"✓ Get bills list passed - Found {len(data['bills'])} bills")

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
