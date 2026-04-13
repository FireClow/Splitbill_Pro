import { Request, Response } from "express";
import { reminderSchema } from "../models/validation.js";
import { sendReminder } from "../services/reminderService.js";
import { prisma } from "../config/prisma.js";

export async function reminderController(req: Request, res: Response) {
  const payload = reminderSchema.parse(req.body);
  const result = await sendReminder(payload);
  return res.json({ data: result });
}

export async function markSettlementPaidController(req: Request, res: Response) {
  const updated = await prisma.settlement.update({
    where: { id: req.params.settlementId },
    data: { status: "PAID" },
  });
  return res.json({ data: updated });
}
