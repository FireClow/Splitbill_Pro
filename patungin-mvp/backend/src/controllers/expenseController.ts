import { Response } from "express";
import { createExpenseSchema } from "../models/validation.js";
import { AuthenticatedRequest } from "../middlewares/auth.js";
import { createExpense, getGroupBalances, recalculateSettlements } from "../services/expenseService.js";

export async function createExpenseController(req: AuthenticatedRequest, res: Response) {
  const payload = createExpenseSchema.parse(req.body);
  const expense = await createExpense(payload);
  return res.status(201).json({ data: expense });
}

export async function getBalancesController(req: AuthenticatedRequest, res: Response) {
  const balances = await getGroupBalances(req.params.groupId);
  return res.json({ data: balances });
}

export async function getSettlementsController(req: AuthenticatedRequest, res: Response) {
  const settlements = await recalculateSettlements(req.params.groupId);
  return res.json({ data: settlements });
}
