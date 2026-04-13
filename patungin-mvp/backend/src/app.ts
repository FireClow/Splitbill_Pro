import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { Request, Response } from "express";
import { authRoutes } from "./routes/authRoutes.js";
import { groupRoutes } from "./routes/groupRoutes.js";
import { expenseRoutes } from "./routes/expenseRoutes.js";
import { reminderRoutes } from "./routes/reminderRoutes.js";
import { errorHandler } from "./middlewares/errorHandler.js";

export const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", service: "patungin-backend" });
});

app.use("/api/auth", authRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/reminders", reminderRoutes);

app.use(errorHandler);
