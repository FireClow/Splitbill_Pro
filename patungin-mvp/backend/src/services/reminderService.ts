import { prisma } from "../config/prisma.js";
import { AppError } from "../middlewares/errorHandler.js";

const templates = {
  id: "Eh jangan lupa ya 🙏",
  en: "Friendly ping, do not forget this one 🙏",
};

export async function sendReminder(input: { settlementId: string; locale: "id" | "en" }) {
  const settlement = await prisma.settlement.findUnique({
    where: { id: input.settlementId },
    include: {
      fromMember: true,
      toMember: true,
      group: true,
    },
  });

  if (!settlement) {
    throw new AppError("Settlement not found", 404);
  }

  if (settlement.status === "PAID") {
    throw new AppError("Settlement already paid", 400);
  }

  const message = `${templates[input.locale]} ${settlement.fromMember.displayName}, ${settlement.toMember.displayName} nunggu transfer ${settlement.amount} ${settlement.group.currency}.`;

  const updated = await prisma.settlement.update({
    where: { id: settlement.id },
    data: {
      reminderCount: { increment: 1 },
      lastRemindedAt: new Date(),
    },
    select: {
      id: true,
      reminderCount: true,
      lastRemindedAt: true,
    },
  });

  return {
    message,
    settlement: updated,
  };
}
