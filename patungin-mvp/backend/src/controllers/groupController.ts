import { Response } from "express";
import { createGroupSchema } from "../models/validation.js";
import { AuthenticatedRequest } from "../middlewares/auth.js";
import { createGroup, getGroupById, listGroups } from "../services/groupService.js";

export async function createGroupController(req: AuthenticatedRequest, res: Response) {
  const payload = createGroupSchema.parse(req.body);
  const group = await createGroup({
    creatorUserId: req.user!.userId,
    ...payload,
  });
  return res.status(201).json({ data: group });
}

export async function listGroupsController(req: AuthenticatedRequest, res: Response) {
  const groups = await listGroups(req.user!.userId);
  return res.json({ data: groups });
}

export async function getGroupDetailController(req: AuthenticatedRequest, res: Response) {
  const group = await getGroupById(req.params.groupId);
  return res.json({ data: group });
}
