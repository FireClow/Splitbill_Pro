"""
Unit tests for item assignment service functions.
"""

from decimal import Decimal

import pytest

from item_assignment import (
    assignItemQuantity,
    calculateBillTotals,
    calculateUnitPrice,
    calculateUserCost,
    getRemainingQuantity,
    validateAssignments,
)


def test_calculate_unit_price():
    item = {"name": "Sushi", "price": 2.5, "quantity": 3}
    assert calculateUnitPrice(item) == Decimal("2.5")


def test_assign_item_quantity_immutable_and_valid():
    current = {"u1": 1}
    updated = assignItemQuantity(current, "u2", 2, itemQuantity=3)
    assert current == {"u1": 1}
    assert updated == {"u1": 1, "u2": 2}


def test_assign_item_quantity_overflow_raises():
    with pytest.raises(ValueError, match="exceeds item quantity"):
        assignItemQuantity({"u1": 2}, "u2", 2, itemQuantity=3)


def test_validate_assignments_equal_quantity_passes():
    item = {
        "name": "Burger",
        "price": 4,
        "quantity": 3,
        "assigned_quantities": {"u1": 2, "u3": 1},
    }
    assignment = validateAssignments(item, {"u1", "u2", "u3"})
    assert assignment == {"u1": 2, "u3": 1}


def test_validate_assignments_from_assignments_array_passes():
    item = {
        "name": "Pizza",
        "price": 2,
        "quantity": 3,
        "assignments": [
            {"userId": "u1", "quantity": 2},
            {"userId": "u2", "quantity": 1},
        ],
    }
    assignment = validateAssignments(item, {"u1", "u2", "u3"})
    assert assignment == {"u1": 2, "u2": 1}


def test_validate_assignments_zero_raises():
    item = {
        "name": "Zero",
        "price": 4,
        "quantity": 3,
        "assigned_quantities": {},
        "assigned_to": [],
    }
    with pytest.raises(ValueError, match="no valid quantity assignments"):
        validateAssignments(item, {"u1", "u2"})


def test_calculate_user_cost_formula():
    unit_price = Decimal("2")
    assert calculateUserCost(2, unit_price) == Decimal("4")
    assert calculateUserCost(1, unit_price) == Decimal("2")


def test_get_remaining_quantity_returns_zero_when_complete():
    item = {
        "name": "Sushi",
        "price": 2,
        "quantity": 3,
        "assigned_quantities": {"u1": 2, "u2": 1},
    }
    assert getRemainingQuantity(item) == 0


def test_calculate_bill_totals_multiple_users_uneven_quantities():
    participants = [
        {"participant_id": "u1", "name": "User 1"},
        {"participant_id": "u2", "name": "User 2"},
        {"participant_id": "u3", "name": "User 3"},
    ]
    items = [
        {
            "item_id": "i1",
            "name": "Rice",
            "price": 2,
            "quantity": 3,
            "assigned_quantities": {"u1": 2, "u3": 1},
        },
        {
            "item_id": "i2",
            "name": "Tea",
            "price": 1,
            "quantity": 2,
            "assigned_quantities": {"u2": 1, "u3": 1},
        },
    ]

    totals = calculateBillTotals(items, participants)
    assert totals["u1"] == Decimal("4")
    assert totals["u2"] == Decimal("1")
    assert totals["u3"] == Decimal("3")


def test_floating_price_precision_uses_decimal_exactly():
    participants = [{"participant_id": "u1", "name": "User 1"}, {"participant_id": "u2", "name": "User 2"}]
    items = [
        {
            "item_id": "i1",
            "name": "Decimal Item",
            "price": 0.1,
            "quantity": 3,
            "assigned_quantities": {"u1": 1, "u2": 2},
        }
    ]
    totals = calculateBillTotals(items, participants)
    assert totals["u1"] == Decimal("0.1")
    assert totals["u2"] == Decimal("0.2")
