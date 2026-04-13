import { prisma } from "../config/prisma.js";
import { AppError } from "../middlewares/errorHandler.js";

export async function createGroup(input: {
  creatorUserId: string;
  name: string;
  description?: string;
  currency: string;
  participants: Array<{ displayName: string; userId?: string }>;
}) {
  const creatorMember = await prisma.group.create({
    data: {
      name: input.name,
      description: input.description,
      currency: input.currency.toUpperCase(),
      createdBy: input.creatorUserId,
      members: {
        create: input.participants.map((participant) => ({
          displayName: participant.displayName,
          userId: participant.userId,
          isGuest: !participant.userId,
        })),
      },
    },
    include: {
      members: true,
    },
  });

  return creatorMember;
}

export async function listGroups(userId: string) {
  return prisma.group.findMany({
    where: {
      OR: [
        { createdBy: userId },
        { members: { some: { userId } } },
      ],
    },
    include: {
      members: true,
      expenses: {
        select: { id: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getGroupById(groupId: string) {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      members: true,
      expenses: {
        include: {
          participants: true,
        },
        orderBy: { createdAt: "desc" },
      },
      settlements: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!group) {
    throw new AppError("Group not found", 404);
  }

  return group;
}
