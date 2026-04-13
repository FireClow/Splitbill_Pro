"""
Test Suite: Splits and Payments
Tests split recalculation and payment tracking
"""
import pytest
import os
from decimal import Decimal

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL') or 'http://127.0.0.1:8000'
if BASE_URL:
    BASE_URL = BASE_URL.rstrip('/')


class TestSplitsAndPayments:
    """Splits and payments tests"""

    def _create_bill_for_equal_split(self, api_client, auth_headers, title: str, item_price: float, participants_count: int = 3):
        participants = [
            {"name": f"Person {idx + 1}", "contact_info": f"p{idx + 1}@test.com"}
            for idx in range(participants_count)
        ]

        payload = {
            "title": title,
            "currency": "USD",
            "items": [{"name": "Single Item", "price": item_price, "quantity": 1}],
            "participants": participants,
            "tax_type": "fixed",
            "tax_value": 0,
            "service_charge": 0,
            "split_method": "equal",
        }

        response = api_client.post(
            f"{BASE_URL}/api/bills",
            json=payload,
            headers=auth_headers,
        )
        assert response.status_code == 200, f"Create bill failed: {response.status_code} {response.text}"
        return response.json()

    @staticmethod
    def _sum_split_amounts_exact(splits):
        return sum(Decimal(str(split["amount_due"])) for split in splits)

    def test_equal_split_uneven_total_sums_exactly(self, api_client, auth_headers):
        """Equal split must sum exactly to total for uneven amounts (e.g. 100 / 3)."""
        bill = self._create_bill_for_equal_split(
            api_client,
            auth_headers,
            title="TEST_equal_100_over_3",
            item_price=100.00,
            participants_count=3,
        )

        split_response = api_client.post(
            f"{BASE_URL}/api/bills/{bill['bill_id']}/split",
            json={"method": "equal"},
            headers=auth_headers,
        )
        assert split_response.status_code == 200, f"Recalculate split failed: {split_response.status_code} {split_response.text}"

        data = split_response.json()
        splits = data["splits"]
        total_due = self._sum_split_amounts_exact(splits)
        bill_total = Decimal(str(data["total_amount"]))

        assert total_due == bill_total, f"Split sum {total_due} must equal bill total {bill_total}"
        amounts = sorted(Decimal(str(s["amount_due"])) for s in splits)
        assert amounts == [Decimal("33.33"), Decimal("33.33"), Decimal("33.34")]

    @pytest.mark.parametrize(
        "tiny_total,expected_sorted",
        [
            (0.01, [Decimal("0.00"), Decimal("0.00"), Decimal("0.01")]),
            (0.02, [Decimal("0.00"), Decimal("0.01"), Decimal("0.01")]),
        ],
    )
    def test_equal_split_tiny_amounts(self, api_client, auth_headers, tiny_total, expected_sorted):
        """Equal split must handle very small totals with exact cent distribution."""
        bill = self._create_bill_for_equal_split(
            api_client,
            auth_headers,
            title=f"TEST_equal_tiny_{tiny_total}",
            item_price=tiny_total,
            participants_count=3,
        )

        split_response = api_client.post(
            f"{BASE_URL}/api/bills/{bill['bill_id']}/split",
            json={"method": "equal"},
            headers=auth_headers,
        )
        assert split_response.status_code == 200, f"Recalculate split failed: {split_response.status_code} {split_response.text}"

        data = split_response.json()
        splits = data["splits"]
        total_due = self._sum_split_amounts_exact(splits)
        bill_total = Decimal(str(data["total_amount"]))

        assert total_due == bill_total, f"Split sum {total_due} must equal bill total {bill_total}"
        amounts = sorted(Decimal(str(s["amount_due"])) for s in splits)
        assert amounts == expected_sorted

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

    def test_split_percentage_must_sum_to_100(self, api_client, auth_headers, test_bill_id):
        """Percentage split should return 400 if percentages do not total 100."""
        bill_response = api_client.get(f"{BASE_URL}/api/bills/{test_bill_id}", headers=auth_headers)
        assert bill_response.status_code == 200, f"Failed to fetch bill: {bill_response.status_code}"
        participants = bill_response.json().get("participants", [])
        assert len(participants) >= 2, "Need at least 2 participants for percentage split test"

        payload = {
            "method": "percentage",
            "percentages": {
                participants[0]["participant_id"]: 60,
                participants[1]["participant_id"]: 30,
            },
        }

        response = api_client.post(
            f"{BASE_URL}/api/bills/{test_bill_id}/split",
            json=payload,
            headers=auth_headers,
        )
        assert response.status_code == 400, f"Expected 400 for invalid percentage sum, got {response.status_code}: {response.text}"
        assert "sum to exactly 100" in response.text

    def test_split_custom_must_equal_total(self, api_client, auth_headers, test_bill_id):
        """Custom split should return 400 if amount total does not match bill total."""
        bill_response = api_client.get(f"{BASE_URL}/api/bills/{test_bill_id}", headers=auth_headers)
        assert bill_response.status_code == 200, f"Failed to fetch bill: {bill_response.status_code}"
        data = bill_response.json()
        participants = data.get("participants", [])
        assert len(participants) >= 2, "Need at least 2 participants for custom split test"

        payload = {
            "method": "custom",
            "custom_splits": {
                participants[0]["participant_id"]: 1.00,
                participants[1]["participant_id"]: 1.00,
            },
        }

        response = api_client.post(
            f"{BASE_URL}/api/bills/{test_bill_id}/split",
            json=payload,
            headers=auth_headers,
        )
        assert response.status_code == 400, f"Expected 400 for invalid custom total, got {response.status_code}: {response.text}"
        assert "must equal bill total" in response.text

    def test_payment_cannot_exceed_amount_due(self, api_client, auth_headers, test_bill_id):
        """Payment update should fail with 400 when amount_paid is greater than amount_due."""
        bill_response = api_client.get(f"{BASE_URL}/api/bills/{test_bill_id}", headers=auth_headers)
        assert bill_response.status_code == 200, f"Failed to fetch bill: {bill_response.status_code}"
        splits = bill_response.json().get("splits", [])
        assert splits, "No splits available for overpay validation test"

        target_split = splits[0]
        payload = {
            "amount_paid": float(target_split["amount_due"]) + 0.01,
            "status": "partial",
        }

        response = api_client.put(
            f"{BASE_URL}/api/bills/{test_bill_id}/payments/{target_split['participant_id']}",
            json=payload,
            headers=auth_headers,
        )
        assert response.status_code == 400, f"Expected 400 for overpayment, got {response.status_code}: {response.text}"
        assert "cannot be greater than amount due" in response.text

    def test_payment_participant_id_must_exist(self, api_client, auth_headers, test_bill_id):
        """Payment update should fail with 400 when participant_id is not in bill."""
        payload = {
            "amount_paid": 1.00,
            "status": "partial",
        }

        response = api_client.put(
            f"{BASE_URL}/api/bills/{test_bill_id}/payments/part_nonexistent",
            json=payload,
            headers=auth_headers,
        )
        assert response.status_code == 400, f"Expected 400 for invalid participant_id, got {response.status_code}: {response.text}"
        assert "Invalid participant_id" in response.text
