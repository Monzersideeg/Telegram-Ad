import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error.js";
import { getReferralStats } from "../services/users.js";
import { env } from "../config/env.js";
import type { AuthedRequest } from "../types.js";

export const referralsRouter = Router();
referralsRouter.use(requireAuth);

referralsRouter.get(
  "/",
  asyncHandler(async (req: AuthedRequest, res) => {
    const { dbUser, tgUser } = req.auth!;
    const stats = await getReferralStats(dbUser.id);
    res.json({
      link: `https://t.me/${env.botUsername}/app?startapp=ref_${tgUser.id}`,
      bonusPct: env.economy.referralBonusPct,
      dailyCap: env.economy.referralDailyCap,
      ...stats,
    });
  })
);
