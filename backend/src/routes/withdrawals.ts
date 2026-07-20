import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler, HttpError } from "../middleware/error.js";
import { requestWithdrawal, listWithdrawals } from "../services/withdrawals.js";
import { sendMessage } from "../services/telegramApi.js";
import { env } from "../config/env.js";
import type { AuthedRequest } from "../types.js";

export const withdrawalsRouter = Router();
withdrawalsRouter.use(requireAuth);

// Payout methods you actually support. Tune per your payout provider.
const METHODS = ["USDT-TRC20", "mobile-credit", "gift-card"];

withdrawalsRouter.get(
  "/config",
  asyncHandler(async (_req: AuthedRequest, res) => {
    res.json({
      minWithdrawal: env.economy.minWithdrawal,
      coinsPerUsd: env.economy.coinsPerUsd,
      methods: METHODS,
    });
  })
);

withdrawalsRouter.post(
  "/",
  asyncHandler(async (req: AuthedRequest, res) => {
    const { amount, method, destination } = req.body ?? {};
    if (!METHODS.includes(method)) {
      throw new HttpError(400, "invalid_method", `Supported: ${METHODS.join(", ")}`);
    }
    const w = await requestWithdrawal(
      req.auth!.dbUser.id,
      Number(amount),
      method,
      String(destination ?? "")
    );
    // Notify the user in Telegram (fire-and-forget; never blocks the response).
    sendMessage(
      req.auth!.tgUser.id,
      `💸 <b>Withdrawal requested</b>\nAmount: ${w.amount} coins\nMethod: ${w.method}\nStatus: pending review`
    ).catch(() => undefined);
    res.status(201).json({ withdrawal: w });
  })
);

withdrawalsRouter.get(
  "/",
  asyncHandler(async (req: AuthedRequest, res) => {
    const items = await listWithdrawals(req.auth!.dbUser.id);
    res.json({ items });
  })
);
