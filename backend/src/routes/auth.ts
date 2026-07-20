import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error.js";
import { env } from "../config/env.js";
import type { AuthedRequest } from "../types.js";

export const authRouter = Router();

/**
 * GET /api/auth/me
 * The auth middleware has already verified initData, upserted the user (capturing
 * any referral from start_param), and refreshed the streak. Returns the profile,
 * balance, streak, economy config, and the user's referral deep link.
 */
authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const { dbUser, tgUser } = req.auth!;
    const referralLink = `https://t.me/${env.botUsername}/app?startapp=ref_${tgUser.id}`;
    res.json({
      user: {
        id: dbUser.id,
        telegramId: dbUser.telegram_id,
        username: dbUser.username,
        firstName: dbUser.first_name,
        photoUrl: tgUser.photo_url ?? null,
      },
      balance: Number(dbUser.balance),
      streakDays: dbUser.streak_days,
      referralLink,
      isAdmin: env.adminTelegramIds.includes(tgUser.id),
      config: {
        rewardPerAd: env.economy.rewardPerAd,
        minWithdrawal: env.economy.minWithdrawal,
        coinsPerUsd: env.economy.coinsPerUsd,
        adCooldownSeconds: env.economy.adCooldownSeconds,
        maxAdsPerDay: env.economy.maxAdsPerDay,
        referralBonusPct: env.economy.referralBonusPct,
        monetagZoneId: env.monetag.zoneId,
      },
    });
  })
);
