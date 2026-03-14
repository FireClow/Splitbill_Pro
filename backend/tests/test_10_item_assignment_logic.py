"""
Unit tests for per-item quantity assignment split logic.
"""

import pytest

from server import calculate_splits


def make_bill(items):
    return {
        "bill_id": "bill_test",
        "participants": [
            {"participant_id": "u1", "name": "User 1"},
            {"participant_id": "u2", "name": "User 2"},
            {"participant_id": "u3", "name": "User 3"},
        ],
        "items": items,
        "subtotal": sum(float(i["price"]) * int(i["quantity"]) for i in items),
        "total_amount": sum(float(i["price"]) * int(i["quantity"]) for i in items),
        "tax_type": "percentage",
        "tax_value": 0,
        "service_charge": 0,
        "additional_fees": [],
        "splits": [],
    }


def test_per_item_one_user_consumes_all_units():
    bill = make_bill([
        {
            "item_id": "item_1",
            "name": "Nugget",
            "price": 2.0,
            "quantity": 3,
            "assigned_to": ["u1"],
            "assigned_quantities": {"u1": 3},
        }
    ])

    splits = calculate_splits(bill, "per_item")
    amounts = {s["participant_id"]: s["amount_due"] for s in splits}

    assert amounts["u1"] == 6.0
    assert amounts["u2"] == 0.0
    assert amounts["u3"] == 0.0


def test_per_item_multiple_users_different_quantities():
    bill = make_bill([
        {
            "item_id": "item_1",
            "name": "Sushi",
            "price": 2.0,
            "quantity": 3,
            "assigned_to": ["u1", "u3"],
            "assigned_quantities": {"u1": 2, "u3": 1},
        }
    ])

    splits = calculate_splits(bill, "per_item")
    amounts = {s["participant_id"]: s["amount_due"] for s in splits}

    assert amounts["u1"] == 4.0
    assert amounts["u2"] == 0.0
    assert amounts["u3"] == 2.0


def test_per_item_quantity_overflow_raises_error():
    bill = make_bill([
        {
            "item_id": "item_1",
            "name": "Overflow",
            "price": 2.0,
            "quantity": 3,
            "assigned_to": ["u1", "u2"],
            "assigned_quantities": {"u1": 2, "u2": 2},
        }
    ])

    with pytest.raises(ValueError, match="exceeds item quantity"):
        calculate_splits(bill, "per_item")


def test_per_item_zero_assignment_raises_error():
    bill = make_bill([
        {
            "item_id": "item_1",
            "name": "Zero",
            "price": 2.0,
            "quantity": 3,
            "assigned_to": [],
            "assigned_quantities": {},
        }
    ])

    with pytest.raises(ValueError, match="no valid quantity assignments"):
        calculate_splits(bill, "per_item")


def test_per_item_under_assignment_raises_error():
    bill = make_bill([
        {
            "item_id": "item_1",
            "name": "Under",
            "price": 2.0,
            "quantity": 3,
            "assigned_to": ["u1"],
            "assigned_quantities": {"u1": 2},
        }
    ])

    with pytest.raises(ValueError, match="must equal item quantity"):
        calculate_splits(bill, "per_item")
