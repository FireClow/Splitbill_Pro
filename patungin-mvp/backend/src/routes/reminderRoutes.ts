import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { authMiddleware } from "../middlewares/auth.js";
import { markSettlementPaidController, reminderController } from "../controllers/reminderController.js";

export const reminderRoutes = Router();

reminderRoutes.use(authMiddleware);
reminderRoutes.post("/", asyncHandler(reminderController));
reminderRoutes.patch("/settlements/:settlementId/pay", asyncHandler(markSettlementPaidController));
