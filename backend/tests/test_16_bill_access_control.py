import os
import time

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL') or 'http://127.0.0.1:8000'
if BASE_URL:
    BASE_URL = BASE_URL.rstrip('/')


def _create_auth_headers(api_client, suffix: str) -> dict:
    response = api_client.post(
        f"{BASE_URL}/api/auth/session",
        json={"session_id": f"pytest-access-{suffix}-{int(time.time() * 1000)}"},
    )
    assert response.status_code == 200, f"Failed to create auth session: {response.text}"
    token = response.json().get("session_token")
    assert token, "session_token missing in auth/session response"
    return {"Authorization": f"Bearer {token}"}


def _create_bill_for_owner(api_client, owner_headers: dict) -> str:
    payload = {
        "title": "ACCESS CONTROL BILL",
        "currency": "USD",
        "items": [
            {
                "name": "Shared Noodles",
                "price": 24.0,
                "quantity": 1,
                "assignments": [{"userId": "p_owner", "quantity": 1}],
            }
        ],
        "participants": [
            {"name": "Owner Person", "client_id": "p_owner", "contact_info": "owner@test.local"}
        ],
        "tax_type": "percentage",
        "tax_value": 0,
        "service_charge": 0,
        "split_method": "per_item",
    }
    response = api_client.post(f"{BASE_URL}/api/bills", json=payload, headers=owner_headers)
    assert response.status_code == 200, f"Bill create failed: {response.text}"
    bill_id = response.json().get("bill_id")
    assert bill_id, "bill_id missing from create bill response"
    return bill_id


def test_non_owner_cannot_view_or_modify_foreign_bill(api_client):
    owner_headers = _create_auth_headers(api_client, "owner")
    stranger_headers = _create_auth_headers(api_client, "stranger")
    bill_id = _create_bill_for_owner(api_client, owner_headers)

    read_response = api_client.get(f"{BASE_URL}/api/bills/{bill_id}", headers=stranger_headers)
    assert read_response.status_code == 403, read_response.text

    update_response = api_client.put(
        f"{BASE_URL}/api/bills/{bill_id}",
        json={"title": "Hacked"},
        headers=stranger_headers,
    )
    assert update_response.status_code == 403, update_response.text


def test_non_owner_cannot_create_share_link_for_foreign_bill(api_client):
    owner_headers = _create_auth_headers(api_client, "owner-share")
    stranger_headers = _create_auth_headers(api_client, "stranger-share")
    bill_id = _create_bill_for_owner(api_client, owner_headers)

    share_response = api_client.post(
        f"{BASE_URL}/api/bills/{bill_id}/share",
        json={"expires_hours": 24, "public_access": True},
        headers=stranger_headers,
    )
    assert share_response.status_code == 403, share_response.text
