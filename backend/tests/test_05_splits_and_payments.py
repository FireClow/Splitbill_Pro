"""
Test Suite: Splits and Payments
Tests split recalculation and payment tracking
"""
import pytest
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL') or 'http://127.0.0.1:8000'
if BASE_URL:
    BASE_URL = BASE_URL.rstrip('/')


class TestSplitsAndPayments:
    """Splits and payments tests"""

    def test_recalculate_split_equal(self, api_client, auth_headers, test_bill_id):
        """Test POST /api/bills/{bill_id}/split - Recalculate with equal split"""
        split_payload = {
            "method": "equal"
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/bills/{test_bill_id}/split",
            json=split_payload,
            headers=auth_headers
        )
        assert response.status_code == 200, f"Recalculate split failed with status {response.status_code}"
        
        data = response.json()
        assert "splits" in data, "splits field missing"
        assert data["split_method"] == "equal", "Split method not updated"
        
        # Verify equal distribution
        splits = data["splits"]
        if len(splits) > 1:
            amounts = [s["amount_due"] for s in splits]
            # Check if amounts are roughly equal (within 1 cent due to rounding)
            max_diff = max(amounts) - min(amounts)
            assert max_diff <= 0.02, f"Equal split not properly distributed, max diff: {max_diff}"
            print(f"✓ Equal split calculated - {len(splits)} participants, amounts: {amounts}")
        else:
            print(f"✓ Equal split calculated - 1 participant pays full amount")

    def test_recalculate_split_per_item(self, api_client, auth_headers, test_bill_id):
        """Test POST /api/bills/{bill_id}/split - Recalculate with per_item split"""
        # Ensure each item has valid quantity assignment before switching to per_item.
        bill_response = api_client.get(
            f"{BASE_URL}/api/bills/{test_bill_id}",
            headers=auth_headers
        )
        assert bill_response.status_code == 200, f"Failed to get bill for assignment setup: {bill_response.status_code}"
        bill_data = bill_response.json()
        participants = bill_data.get("participants", [])
        items = bill_data.get("items", [])
        assert participants, "Test bill has no participants"

        first_participant_id = participants[0]["participant_id"]
        for item in items:
            update_payload = {
                "assigned_to": [first_participant_id],
                "assigned_quantities": {first_participant_id: item.get("quantity", 1)}
            }
            update_response = api_client.put(
                f"{BASE_URL}/api/bills/{test_bill_id}/items/{item['item_id']}",
                json=update_payload,
                headers=auth_headers
            )
            assert update_response.status_code == 200, (
                f"Failed to set item assignment for {item['item_id']}: {update_response.status_code} {update_response.text}"
            )

        split_payload = {
            "method": "per_item"
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/bills/{test_bill_id}/split",
            json=split_payload,
            headers=auth_headers
        )
        assert response.status_code == 200, f"Recalculate split failed with status {response.status_code}"
        
        data = response.json()
        assert "splits" in data, "splits field missing"
        assert data["split_method"] == "per_item", "Split method not updated"
        print(f"✓ Per-item split calculated - {len(data['splits'])} participants")

    def test_update_payment_status(self, api_client, auth_headers, test_bill_id):
        """Test PUT /api/bills/{bill_id}/payments/{participant_id} - Mark payment as paid"""
        # First get the bill to find a participant
        get_response = api_client.get(f"{BASE_URL}/api/bills/{test_bill_id}", headers=auth_headers)
        assert get_response.status_code == 200, "Failed to get bill"
        
        bill_data = get_response.json()
        splits = bill_data.get("splits", [])
        
        if not splits:
            pytest.skip("No splits in test bill")
        
        # Find an unpaid split
        unpaid_split = next((s for s in splits if s["status"] == "unpaid"), splits[0])
        participant_id = unpaid_split["participant_id"]
        amount_due = unpaid_split["amount_due"]
        
        payment_payload = {
            "amount_paid": amount_due,
            "status": "paid"
        }
        
        response = api_client.put(
            f"{BASE_URL}/api/bills/{test_bill_id}/payments/{participant_id}",
            json=payment_payload,
            headers=auth_headers
        )
        assert response.status_code == 200, f"Update payment failed with status {response.status_code}"
        
        data = response.json()
        updated_split = next((s for s in data["splits"] if s["participant_id"] == participant_id), None)
        assert updated_split is not None, "Split not found after update"
        assert updated_split["status"] == "paid", "Payment status not updated"
        assert updated_split["amount_paid"] == amount_due, "Amount paid not updated"
        print(f"✓ Payment updated - Participant {participant_id} marked as paid: {amount_due}")
