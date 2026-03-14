from __future__ import annotations

from decimal import Decimal
from functools import lru_cache
from typing import Any, Dict, Mapping, MutableMapping, Optional, Sequence, Set, Tuple


def calculateUnitPrice(item: Mapping[str, Any]) -> Decimal:
    quantity = int(item.get("quantity", 0) or 0)
    if quantity <= 0:
        raise ValueError(f'Item "{item.get("name", "Unnamed item")}" must have quantity > 0.')

    if item.get("unit_price") is not None:
        unit_price = Decimal(str(item.get("unit_price")))
    elif item.get("total_price") is not None:
        total_price = Decimal(str(item.get("total_price")))
        unit_price = total_price / Decimal(str(quantity))
    else:
        unit_price = Decimal(str(item.get("price", 0)))

    if unit_price < 0:
        raise ValueError(f'Item "{item.get("name", "Unnamed item")}" must have non-negative price.')
    return unit_price


def assignItemQuantity(
    assignments: Mapping[str, int],
    userId: str,
    quantity: int,
    itemQuantity: int,
) -> Dict[str, int]:
    if itemQuantity <= 0:
        raise ValueError("itemQuantity must be greater than zero.")
    if quantity < 0:
        raise ValueError("Assigned quantity cannot be negative.")

    updated = dict(assignments)
    if quantity == 0:
        updated.pop(userId, None)
    else:
        updated[userId] = int(quantity)

    total_assigned = sum(int(v) for v in updated.values() if int(v) > 0)
    if total_assigned > itemQuantity:
        raise ValueError(
            f"Assigned quantity ({total_assigned}) exceeds item quantity ({itemQuantity})."
        )

    return {k: int(v) for k, v in updated.items() if int(v) > 0}


def validateAssignments(
    item: Mapping[str, Any],
    validUserIds: Optional[Set[str]] = None,
) -> Dict[str, int]:
    item_name = str(item.get("name", "Unnamed item"))
    item_quantity = int(item.get("quantity", 1) or 1)

    assignment: Dict[str, int] = {}
    raw_assignment = item.get("assigned_quantities") or {}
    if isinstance(raw_assignment, Mapping):
        for user_id, qty in raw_assignment.items():
            if validUserIds is not None and user_id not in validUserIds:
                continue
            parsed_qty = int(qty)
            if parsed_qty < 0:
                raise ValueError(
                    f'Item "{item_name}" has negative assignment for user "{user_id}".'
                )
            if parsed_qty > 0:
                assignment[user_id] = parsed_qty

    if not assignment:
        raw_assignments_list = item.get("assignments") or []
        if isinstance(raw_assignments_list, list):
            for entry in raw_assignments_list:
                if not isinstance(entry, Mapping):
                    continue
                user_id = entry.get("userId") or entry.get("user_id") or entry.get("participantId") or entry.get("participant_id")
                if not user_id:
                    continue
                if validUserIds is not None and user_id not in validUserIds:
                    continue
                parsed_qty = int(entry.get("quantity", 0) or 0)
                if parsed_qty < 0:
                    raise ValueError(
                        f'Item "{item_name}" has negative assignment for user "{user_id}".'
                    )
                if parsed_qty > 0:
                    assignment[user_id] = parsed_qty

    if not assignment:
        assigned_to = [pid for pid in item.get("assigned_to", []) if validUserIds is None or pid in validUserIds]
        assigned_to = list(dict.fromkeys(assigned_to))
        if len(assigned_to) == 1:
            assignment[assigned_to[0]] = item_quantity
        elif len(assigned_to) == item_quantity:
            assignment = {pid: 1 for pid in assigned_to}

    total_assigned = sum(assignment.values())
    if total_assigned <= 0:
        raise ValueError(
            f'Item "{item_name}" has no valid quantity assignments. '
            f'Assign quantities so total equals {item_quantity}.'
        )
    if total_assigned > item_quantity:
        raise ValueError(
            f'Item "{item_name}" assigned quantity ({total_assigned}) exceeds item quantity ({item_quantity}).'
        )
    if total_assigned != item_quantity:
        raise ValueError(
            f'Item "{item_name}" assigned quantity ({total_assigned}) must equal item quantity ({item_quantity}).'
        )

    return assignment


def calculateUserCost(assignedQuantity: int, unitPrice: Decimal) -> Decimal:
    if assignedQuantity < 0:
        raise ValueError("assignedQuantity cannot be negative.")
    return unitPrice * Decimal(str(assignedQuantity))


def getRemainingQuantity(item: Mapping[str, Any], assignment: Optional[Mapping[str, int]] = None) -> int:
    item_quantity = int(item.get("quantity", 0) or 0)
    assignment_map = dict(assignment or validateAssignments(item, None))
    assigned_total = sum(int(v) for v in assignment_map.values() if int(v) > 0)
    return max(0, item_quantity - assigned_total)


def _item_signature(item: Mapping[str, Any], participantIds: Tuple[str, ...]) -> Tuple[Any, ...]:
    assignment = validateAssignments(item, set(participantIds))
    assignment_signature = tuple(sorted(assignment.items(), key=lambda x: x[0]))
    return (
        str(item.get("item_id", "")),
        str(item.get("name", "")),
        str(item.get("price", 0)),
        str(item.get("unit_price", "")),
        str(item.get("total_price", "")),
        int(item.get("quantity", 0) or 0),
        assignment_signature,
    )


@lru_cache(maxsize=4096)
def _calculate_item_allocations_cached(signature: Tuple[Any, ...]) -> Tuple[Tuple[str, Decimal], ...]:
    _, item_name, item_price, unit_price, total_price, item_quantity, assignment_signature = signature
    item_data = {
        "name": item_name,
        "price": Decimal(item_price),
        "unit_price": Decimal(unit_price) if unit_price != "" else None,
        "total_price": Decimal(total_price) if total_price != "" else None,
        "quantity": int(item_quantity),
        "assigned_quantities": dict(assignment_signature),
    }
    unit_price = calculateUnitPrice(item_data)
    allocations = []
    for user_id, qty in assignment_signature:
        allocations.append((user_id, calculateUserCost(int(qty), unit_price)))
    return tuple(allocations)


def calculateBillTotals(
    items: Sequence[Mapping[str, Any]],
    participants: Sequence[Mapping[str, Any]],
) -> Dict[str, Decimal]:
    participant_ids = tuple(p["participant_id"] for p in participants)
    totals: Dict[str, Decimal] = {pid: Decimal("0") for pid in participant_ids}

    for item in items:
        signature = _item_signature(item, participant_ids)
        allocations = _calculate_item_allocations_cached(signature)
        for user_id, cost in allocations:
            if user_id in totals:
                totals[user_id] += cost

    return totals


def normalize_item_payload(item: MutableMapping[str, Any], valid_participant_ids: Set[str]) -> Dict[str, Any]:
    normalized = dict(item)
    assigned_to = [pid for pid in normalized.get("assigned_to", []) if pid in valid_participant_ids]
    normalized["assigned_to"] = list(dict.fromkeys(assigned_to))

    raw_assignment = normalized.get("assigned_quantities") or {}
    raw_assignments_list = normalized.get("assignments") or []
    assignment: Dict[str, int] = {}
    if isinstance(raw_assignment, Mapping):
        for user_id, qty in raw_assignment.items():
            if user_id not in valid_participant_ids:
                continue
            parsed_qty = int(qty)
            if parsed_qty > 0:
                assignment[user_id] = parsed_qty

    if not assignment and isinstance(raw_assignments_list, list):
        for entry in raw_assignments_list:
            if not isinstance(entry, Mapping):
                continue
            user_id = entry.get("userId") or entry.get("user_id") or entry.get("participantId") or entry.get("participant_id")
            if not user_id or user_id not in valid_participant_ids:
                continue
            parsed_qty = int(entry.get("quantity", 0) or 0)
            if parsed_qty > 0:
                assignment[user_id] = parsed_qty

    if not assignment and normalized["assigned_to"]:
        item_quantity = int(normalized.get("quantity", 1) or 1)
        if len(normalized["assigned_to"]) == 1:
            assignment[normalized["assigned_to"][0]] = item_quantity
        elif len(normalized["assigned_to"]) == item_quantity:
            assignment = {pid: 1 for pid in normalized["assigned_to"]}

    has_explicit_assignment_payload = bool(raw_assignment) or bool(raw_assignments_list) or bool(normalized.get("assigned_to"))
    if assignment:
        validateAssignments(
            {
                "name": normalized.get("name"),
                "quantity": normalized.get("quantity"),
                "assigned_quantities": assignment,
            },
            valid_participant_ids,
        )
    elif has_explicit_assignment_payload:
        validateAssignments(
            {
                "name": normalized.get("name"),
                "quantity": normalized.get("quantity"),
                "assigned_quantities": assignment,
            },
            valid_participant_ids,
        )

    normalized["assigned_quantities"] = assignment
    if assignment:
        normalized["assigned_to"] = list(assignment.keys())
    normalized["assignments"] = [
        {"userId": user_id, "quantity": qty}
        for user_id, qty in assignment.items()
    ]

    item_quantity = int(normalized.get("quantity", 0) or 0)
    unit_price = Decimal(str(normalized.get("price", 0)))
    normalized["unit_price"] = float(unit_price)
    normalized["total_price"] = float((unit_price * Decimal(str(item_quantity))).quantize(Decimal("0.01")))
    return normalized


def normalize_assignment_map(item: Mapping[str, Any], valid_participant_ids: Set[str]) -> Dict[str, int]:
    return validateAssignments(item, valid_participant_ids)
