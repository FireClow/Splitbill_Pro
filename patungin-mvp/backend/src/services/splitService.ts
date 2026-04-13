import { SplitMethod } from "@prisma/client";
import { AppError } from "../middlewares/errorHandler.js";

type ParticipantInput = {
  memberId: string;
  amount?: number;
  itemNote?: string;
};

export type ComputedShare = {
  memberId: string;
  amount: number;
  itemNote?: string;
};

const toCents = (value: number) => Math.round(value * 100);
const fromCents = (value: number) => Number((value / 100).toFixed(2));

export function computeShares(splitMethod: SplitMethod, totalAmount: number, participants: ParticipantInput[]): ComputedShare[] {
  if (participants.length === 0) {
    throw new AppError("Participants are required");
  }

  const totalCents = toCents(totalAmount);

  if (splitMethod === "EQUAL") {
    const base = Math.floor(totalCents / participants.length);
    const remainder = totalCents % participants.length;
    return participants.map((participant, index) => ({
      memberId: participant.memberId,
      amount: fromCents(base + (index < remainder ? 1 : 0)),
      itemNote: participant.itemNote,
    }));
  }

  if (splitMethod === "CUSTOM" || splitMethod === "PER_ITEM") {
    const missing = participants.some((p) => p.amount === undefined);
    if (missing) {
      throw new AppError("All participant amounts are required for this split method");
    }

    const sum = participants.reduce((acc, p) => acc + toCents(p.amount ?? 0), 0);
    if (sum !== totalCents) {
      throw new AppError("Custom split total must match expense total");
    }

    return participants.map((participant) => ({
      memberId: participant.memberId,
      amount: Number((participant.amount ?? 0).toFixed(2)),
      itemNote: participant.itemNote,
    }));
  }

  throw new AppError("Unsupported split method");
}

type Balance = {
  memberId: string;
  netCents: number;
};

export type SimplifiedDebt = {
  fromMemberId: string;
  toMemberId: string;
  amount: number;
};

export function simplifyDebts(balances: Balance[]): SimplifiedDebt[] {
  const creditors = balances
    .filter((entry) => entry.netCents > 0)
    .map((entry) => ({ ...entry }))
    .sort((a, b) => b.netCents - a.netCents);

  const debtors = balances
    .filter((entry) => entry.netCents < 0)
    .map((entry) => ({ memberId: entry.memberId, netCents: Math.abs(entry.netCents) }))
    .sort((a, b) => b.netCents - a.netCents);

  const result: SimplifiedDebt[] = [];
  let c = 0;
  let d = 0;

  while (c < creditors.length && d < debtors.length) {
    const amount = Math.min(creditors[c].netCents, debtors[d].netCents);
    if (amount > 0) {
      result.push({
        fromMemberId: debtors[d].memberId,
        toMemberId: creditors[c].memberId,
        amount: fromCents(amount),
      });
      creditors[c].netCents -= amount;
      debtors[d].netCents -= amount;
    }

    if (creditors[c].netCents === 0) c += 1;
    if (debtors[d].netCents === 0) d += 1;
  }

  return result;
}
