import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { authMiddleware } from "../middlewares/auth.js";
import { createGroupController, getGroupDetailController, listGroupsController } from "../controllers/groupController.js";
import { getBalancesController, getSettlementsController } from "../controllers/expenseController.js";

export const groupRoutes = Router();

groupRoutes.use(authMiddleware);
groupRoutes.get("/", asyncHandler(listGroupsController));
groupRoutes.post("/", asyncHandler(createGroupController));
groupRoutes.get("/:groupId", asyncHandler(getGroupDetailController));
groupRoutes.get("/:groupId/balances", asyncHandler(getBalancesController));
groupRoutes.get("/:groupId/settlements", asyncHandler(getSettlementsController));
