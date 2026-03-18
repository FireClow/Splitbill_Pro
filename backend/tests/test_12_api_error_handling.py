"""
API error-handling regression tests for edge cases.
Ensures user input errors never surface as HTTP 500.
"""

import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL') or 'http://localhost:8001'
if BASE_URL:
    BASE_URL = BASE_URL.rstrip('/')


def test_create_bill_missing_required_title_returns_422(api_client, auth_headers):
    payload = {
        "currency": "USD",
        "items": [{"name": "Tea", "price": 1.0, "quantity": 1}],
        "participants": [{"name": "Alice"}],
        "tax_type": "fixed",
        "tax_value": 0.0,
        "service_charge": 0.0,
        "split_method": "equal",
    }
    response = api_client.post(f"{BASE_URL}/api/bills", json=payload, headers=auth_headers)
    assert response.status_code == 422, f"Expected 422, got {response.status_code}: {response.text}"


def test_create_bill_zero_quantity_returns_422(api_client, auth_headers):
    payload = {
        "title": "TEST_Zero quantity",
        "currency": "USD",
        "items": [{"name": "Soup", "price": 3.5, "quantity": 0}],
        "participants": [{"name": "Alice"}],
        "tax_type": "fixed",
        "tax_value": 0.0,
        "service_charge": 0.0,
        "split_method": "equal",
    }
    response = api_client.post(f"{BASE_URL}/api/bills", json=payload, headers=auth_headers)
    assert response.status_code == 422, f"Expected 422, got {response.status_code}: {response.text}"


def test_create_bill_negative_assignment_returns_400(api_client, auth_headers):
    participant_client_id = "edge_u1"
    payload = {
        "title": "TEST_Negative assignment",
        "currency": "USD",
        "items": [
            {
                "name": "Rice",
                "price": 2.0,
                "quantity": 2,
                "assigned_to": [participant_client_id],
                "assigned_quantities": {participant_client_id: -1},
                "assignments": [{"userId": participant_client_id, "quantity": -1}],
            }
        ],
        "participants": [{"name": "Edge User", "client_id": participant_client_id}],
        "tax_type": "fixed",
        "tax_value": 0.0,
        "service_charge": 0.0,
        "split_method": "per_item",
    }

    response = api_client.post(f"{BASE_URL}/api/bills", json=payload, headers=auth_headers)
    assert response.status_code in (400, 422), f"Expected 400/422, got {response.status_code}: {response.text}"
    assert response.status_code != 500, f"User error must not return 500: {response.text}"


def test_create_bill_under_assignment_returns_400(api_client, auth_headers):
    participant_client_id = "edge_u2"
    payload = {
        "title": "TEST_Under assignment",
        "currency": "USD",
        "items": [
            {
                "name": "Noodles",
                "price": 4.0,
                "quantity": 3,
                "assigned_to": [participant_client_id],
                "assigned_quantities": {participant_client_id: 2},
                "assignments": [{"userId": participant_client_id, "quantity": 2}],
            }
        ],
        "participants": [{"name": "Edge User 2", "client_id": participant_client_id}],
        "tax_type": "fixed",
        "tax_value": 0.0,
        "service_charge": 0.0,
        "split_method": "per_item",
    }

    response = api_client.post(f"{BASE_URL}/api/bills", json=payload, headers=auth_headers)
    assert response.status_code == 400, f"Expected 400 for under-assignment, got {response.status_code}: {response.text}"


def test_create_bill_floating_precision_per_item_split(api_client, auth_headers):
    u1 = "float_u1"
    u2 = "float_u2"
    payload = {
        "title": "TEST_Floating precision",
        "currency": "USD",
        "items": [
            {
                "name": "Decimal Item",
                "price": 0.1,
                "quantity": 3,
                "assigned_to": [u1, u2],
                "assigned_quantities": {u1: 1, u2: 2},
                "assignments": [{"userId": u1, "quantity": 1}, {"userId": u2, "quantity": 2}],
            }
        ],
        "participants": [
            {"name": "Float 1", "client_id": u1},
            {"name": "Float 2", "client_id": u2},
        ],
        "tax_type": "fixed",
        "tax_value": 0.0,
        "service_charge": 0.0,
        "split_method": "per_item",
    }

    response = api_client.post(f"{BASE_URL}/api/bills", json=payload, headers=auth_headers)
    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

    data = response.json()
    split_amounts = [float(s["amount_due"]) for s in data["splits"]]
    assert sorted(split_amounts) == [0.1, 0.2], f"Unexpected floating split values: {split_amounts}"
