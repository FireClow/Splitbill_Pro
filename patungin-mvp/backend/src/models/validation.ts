import { SplitMethod } from "@prisma/client";
import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(2).max(40),
  locale: z.enum(["id", "en"]).default("id"),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const createGroupSchema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().max(250).optional(),
  currency: z.string().length(3).default("IDR"),
  participants: z.array(z.object({
    displayName: z.string().min(2).max(50),
    userId: z.string().uuid().optional(),
  })).min(1),
});

export const createExpenseSchema = z.object({
  groupId: z.string().uuid(),
  title: z.string().min(2).max(120),
  totalAmount: z.number().positive(),
  payerMemberId: z.string().uuid(),
  splitMethod: z.nativeEnum(SplitMethod),
  note: z.string().max(250).optional(),
  participants: z.array(z.object({
    memberId: z.string().uuid(),
    amount: z.number().nonnegative().optional(),
    itemNote: z.string().max(120).optional(),
  })).min(1),
});

export const reminderSchema = z.object({
  settlementId: z.string().uuid(),
  locale: z.enum(["id", "en"]).default("id"),
});
