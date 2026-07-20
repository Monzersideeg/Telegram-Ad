import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error.js";
import { getBalance, getTransactions } from "../services/ledger.js";
import type { AuthedRequest } from "../types.js";

export const ledgerRouter = Router();
ledgerRouter.use(requireAuth);

ledgerRouter.get(
  "/balance",
  asyncHandler(async (req: AuthedRequest, res) => {
    const balance = await getBalance(req.auth!.dbUser.id);
    res.json({ balance });
  })
);

ledgerRouter.get(
  "/transactions",
  asyncHandler(async (req: AuthedRequest, res) => {
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const items = await getTransactions(req.auth!.dbUser.id, limit, offset);
    res.json({ items });
  })
);
