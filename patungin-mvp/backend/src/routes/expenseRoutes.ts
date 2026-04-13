import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { authMiddleware } from "../middlewares/auth.js";
import { createExpenseController } from "../controllers/expenseController.js";

export const expenseRoutes = Router();

expenseRoutes.use(authMiddleware);
expenseRoutes.post("/", asyncHandler(createExpenseController));
