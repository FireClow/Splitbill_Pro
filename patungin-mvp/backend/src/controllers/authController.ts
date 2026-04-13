import { Request, Response } from "express";
import { loginSchema, registerSchema } from "../models/validation.js";
import { loginUser, registerUser } from "../services/authService.js";

export async function registerController(req: Request, res: Response) {
  const payload = registerSchema.parse(req.body);
  const user = await registerUser(payload);
  return res.status(201).json({ data: user });
}

export async function loginController(req: Request, res: Response) {
  const payload = loginSchema.parse(req.body);
  const data = await loginUser(payload);
  return res.json({ data });
}
