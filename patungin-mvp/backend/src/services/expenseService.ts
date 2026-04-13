import { prisma } from "../config/prisma.js";
import { AppError } from "../middlewares/errorHandler.js";
import { computeShares, simplifyDebts } from "./splitService.js";

const toCents = (v: number) => Math.round(v * 100);

export async function createExpense(input: {
  groupId: string;
  title: string;
  totalAmount: number;
  splitMethod: "EQUAL" | "CUSTOM" | "PER_ITEM";
  payerMemberId: string;
  note?: string;
  participants: Array<{ memberId: string; amount?: number; itemNote?: string }>;
}) {
  const group = await prisma.group.findUnique({
    where: { id: input.groupId },
    include: { members: true },
  });

  if (!group) {
    throw new AppError("Group not found", 404);
  }

  const payerExists = group.members.some((member: { id: string }) => member.id === input.payerMemberId);
  if (!payerExists) {
    throw new AppError("Payer is not in this group");
  }

  const shares = computeShares(input.splitMethod, input.totalAmount, input.participants);

  const expense = await prisma.expense.create({
    data: {
      groupId: input.groupId,
      title: input.title,
      totalAmount: input.totalAmount,
      splitMethod: input.splitMethod,
      payerMemberId: input.payerMemberId,
      note: input.note,
      participants: {
        create: shares.map((share) => ({
          memberId: share.memberId,
          amount: share.amount,
          itemNote: share.itemNote,
        })),
      },
    },
    include: {
      participants: true,
    },
  });

  await recalculateSettlements(input.groupId);

  return expense;
}

export async function getGroupBalances(groupId: string) {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      members: true,
      expenses: {
        include: {
          participants: true,
        },
      },
    },
  });

  if (!group) {
    throw new AppError("Group not found", 404);
  }

  const netMap = new Map<string, number>();
  group.members.forEach((member: { id: string }) => netMap.set(member.id, 0));

  for (const expense of group.expenses) {
    netMap.set(expense.payerMemberId, (netMap.get(expense.payerMemberId) ?? 0) + toCents(Number(expense.totalAmount)));
    for (const share of expense.participants) {
      netMap.set(share.memberId, (netMap.get(share.memberId) ?? 0) - toCents(Number(share.amount)));
    }
  }

  const balances = group.members.map((member: { id: string; displayName: string }) => ({
    memberId: member.id,
    displayName: member.displayName,
    netAmount: Number(((netMap.get(member.id) ?? 0) / 100).toFixed(2)),
  }));

  return balances;
}

export async function recalculateSettlements(groupId: string) {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      members: true,
      expenses: {
        include: {
          participants: true,
        },
      },
    },
  });

  if (!group) {
    throw new AppError("Group not found", 404);
  }

  const net = new Map<string, number>();
  group.members.forEach((member: { id: string }) => net.set(member.id, 0));

  for (const expense of group.expenses) {
    net.set(expense.payerMemberId, (net.get(expense.payerMemberId) ?? 0) + toCents(Number(expense.totalAmount)));
    for (const participant of expense.participants) {
      net.set(participant.memberId, (net.get(participant.memberId) ?? 0) - toCents(Number(participant.amount)));
    }
  }

  const simplified = simplifyDebts(
    Array.from(net.entries()).map(([memberId, netCents]) => ({ memberId, netCents })),
  );

  await prisma.$transaction([
    prisma.settlement.deleteMany({ where: { groupId } }),
    prisma.settlement.createMany({
      data: simplified.map((debt) => ({
        groupId,
        fromMemberId: debt.fromMemberId,
        toMemberId: debt.toMemberId,
        amount: debt.amount,
      })),
    }),
  ]);

  return simplified;
}
