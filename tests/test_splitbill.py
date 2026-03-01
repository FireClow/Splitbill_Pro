"""Tests for Splitbill Pro."""
import pytest
from splitbill import Splitbill


def make_group():
    sb = Splitbill()
    sb.add_participant("Alice")
    sb.add_participant("Bob")
    sb.add_participant("Carol")
    return sb


# --- add_participant ---

def test_add_participant():
    sb = Splitbill()
    sb.add_participant("Alice")
    assert "Alice" in sb.participants


def test_add_participant_strips_whitespace():
    sb = Splitbill()
    sb.add_participant("  Alice  ")
    assert "Alice" in sb.participants


def test_add_participant_empty_name_raises():
    sb = Splitbill()
    with pytest.raises(ValueError, match="empty"):
        sb.add_participant("")


def test_add_participant_duplicate_raises():
    sb = Splitbill()
    sb.add_participant("Alice")
    with pytest.raises(ValueError, match="already exists"):
        sb.add_participant("Alice")


# --- add_expense ---

def test_add_expense_basic():
    sb = make_group()
    sb.add_expense("Dinner", 90.0, "Alice")
    assert len(sb.expenses) == 1


def test_add_expense_negative_amount_raises():
    sb = make_group()
    with pytest.raises(ValueError, match="positive"):
        sb.add_expense("Dinner", -10.0, "Alice")


def test_add_expense_zero_amount_raises():
    sb = make_group()
    with pytest.raises(ValueError, match="positive"):
        sb.add_expense("Free", 0.0, "Alice")


def test_add_expense_unknown_payer_raises():
    sb = make_group()
    with pytest.raises(ValueError, match="not found"):
        sb.add_expense("Dinner", 30.0, "Dave")


def test_add_expense_unknown_participant_in_split_raises():
    sb = make_group()
    with pytest.raises(ValueError, match="not found"):
        sb.add_expense("Dinner", 30.0, "Alice", split_among=["Alice", "Dave"])


def test_add_expense_empty_split_raises():
    sb = make_group()
    with pytest.raises(ValueError, match="at least one"):
        sb.add_expense("Dinner", 30.0, "Alice", split_among=[])


# --- balances ---

def test_balances_equal_split():
    """Alice pays 90 split equally among 3 → Alice +60, Bob -30, Carol -30."""
    sb = make_group()
    sb.add_expense("Dinner", 90.0, "Alice")
    bal = sb.balances()
    assert pytest.approx(bal["Alice"], abs=0.01) == 60.0
    assert pytest.approx(bal["Bob"], abs=0.01) == -30.0
    assert pytest.approx(bal["Carol"], abs=0.01) == -30.0


def test_balances_sum_to_zero():
    sb = make_group()
    sb.add_expense("Dinner", 90.0, "Alice")
    sb.add_expense("Taxi", 30.0, "Bob", split_among=["Alice", "Bob"])
    assert pytest.approx(sum(sb.balances().values()), abs=0.01) == 0.0


def test_balances_no_expenses():
    sb = make_group()
    for v in sb.balances().values():
        assert v == 0.0


# --- settlements ---

def test_settlements_simple():
    """Bob owes Alice 30."""
    sb = Splitbill()
    sb.add_participant("Alice")
    sb.add_participant("Bob")
    sb.add_expense("Lunch", 60.0, "Alice")  # Alice +30, Bob -30
    txns = sb.settlements()
    assert len(txns) == 1
    assert txns[0]["from"] == "Bob"
    assert txns[0]["to"] == "Alice"
    assert pytest.approx(txns[0]["amount"], abs=0.01) == 30.0


def test_settlements_already_settled():
    sb = Splitbill()
    sb.add_participant("Alice")
    sb.add_participant("Bob")
    # Alice pays 30, Bob pays 30 — net zero
    sb.add_expense("Lunch", 30.0, "Alice", split_among=["Alice"])
    sb.add_expense("Dinner", 30.0, "Bob", split_among=["Bob"])
    txns = sb.settlements()
    assert txns == []


def test_settlements_three_people():
    sb = make_group()
    sb.add_expense("Hotel", 90.0, "Alice")
    txns = sb.settlements()
    assert len(txns) == 2
    totals_paid = sum(t["amount"] for t in txns)
    assert pytest.approx(totals_paid, abs=0.01) == 60.0
