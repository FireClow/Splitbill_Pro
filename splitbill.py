"""Splitbill Pro - Split bills and expenses among a group of people."""

from __future__ import annotations

BALANCE_THRESHOLD = 0.005


class Splitbill:
    """Manage participants and shared expenses."""

    def __init__(self) -> None:
        self.participants: list[str] = []
        self.expenses: list[dict] = []

    def add_participant(self, name: str) -> None:
        """Add a participant by name."""
        name = name.strip()
        if not name:
            raise ValueError("Participant name cannot be empty.")
        if name in self.participants:
            raise ValueError(f"Participant '{name}' already exists.")
        self.participants.append(name)

    def add_expense(self, description: str, amount: float, paid_by: str, split_among: list[str] | None = None) -> None:
        """Record an expense paid by one person and shared among others.

        Args:
            description: Short description of the expense.
            amount: Total cost of the expense (must be positive).
            paid_by: Name of the participant who paid.
            split_among: List of participants sharing the cost.
                         Defaults to all participants.
        """
        if amount <= 0:
            raise ValueError("Expense amount must be positive.")
        if paid_by not in self.participants:
            raise ValueError(f"Participant '{paid_by}' not found.")
        if split_among is None:
            split_among = list(self.participants)
        for person in split_among:
            if person not in self.participants:
                raise ValueError(f"Participant '{person}' not found.")
        if not split_among:
            raise ValueError("split_among must include at least one participant.")
        self.expenses.append({
            "description": description,
            "amount": amount,
            "paid_by": paid_by,
            "split_among": split_among,
        })

    def balances(self) -> dict[str, float]:
        """Compute the net balance for each participant.

        A positive balance means the person is owed money;
        a negative balance means they owe money.
        """
        balance: dict[str, float] = {p: 0.0 for p in self.participants}
        for expense in self.expenses:
            share = expense["amount"] / len(expense["split_among"])
            balance[expense["paid_by"]] += expense["amount"]
            for person in expense["split_among"]:
                balance[person] -= share
        return balance

    def settlements(self) -> list[dict]:
        """Calculate the minimum set of transactions to settle all debts.

        Returns:
            List of dicts with keys 'from', 'to', and 'amount'.
        """
        balance = self.balances()
        creditors = sorted(
            [(p, b) for p, b in balance.items() if b > BALANCE_THRESHOLD],
            key=lambda x: -x[1],
        )
        debtors = sorted(
            [(p, -b) for p, b in balance.items() if b < -BALANCE_THRESHOLD],
            key=lambda x: -x[1],
        )
        transactions = []
        i, j = 0, 0
        while i < len(creditors) and j < len(debtors):
            creditor, credit = creditors[i]
            debtor, debt = debtors[j]
            amount = round(min(credit, debt), 2)
            transactions.append({"from": debtor, "to": creditor, "amount": amount})
            creditors[i] = (creditor, credit - amount)
            debtors[j] = (debtor, debt - amount)
            if creditors[i][1] < BALANCE_THRESHOLD:
                i += 1
            if debtors[j][1] < BALANCE_THRESHOLD:
                j += 1
        return transactions


def main() -> None:
    """Interactive CLI for Splitbill Pro."""
    sb = Splitbill()
    print("=== Splitbill Pro ===\n")

    # Add participants
    print("Enter participant names (blank line to finish):")
    while True:
        name = input("  Name: ").strip()
        if not name:
            break
        try:
            sb.add_participant(name)
        except ValueError as exc:
            print(f"  Error: {exc}")

    if len(sb.participants) < 2:
        print("Need at least 2 participants. Exiting.")
        return

    # Add expenses
    print("\nEnter expenses (blank description to finish):")
    while True:
        desc = input("  Description: ").strip()
        if not desc:
            break
        try:
            amount = float(input("  Amount: "))
            paid_by = input("  Paid by: ").strip()
            split_input = input(
                f"  Split among (comma-separated, or blank for all [{', '.join(sb.participants)}]): "
            ).strip()
            split_among = [s.strip() for s in split_input.split(",")] if split_input else None
            sb.add_expense(desc, amount, paid_by, split_among)
        except ValueError as exc:
            print(f"  Error: {exc}")

    # Show results
    print("\n--- Balances ---")
    for person, balance in sb.balances().items():
        status = f"+{balance:.2f}" if balance >= 0 else f"{balance:.2f}"
        print(f"  {person}: {status}")

    print("\n--- Settlements ---")
    settlements = sb.settlements()
    if not settlements:
        print("  All settled up!")
    for txn in settlements:
        print(f"  {txn['from']} pays {txn['to']}: {txn['amount']:.2f}")


if __name__ == "__main__":
    main()
