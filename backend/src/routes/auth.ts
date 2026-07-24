import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/error.js";
import { env } from "../config/env.js";
import { query } from "../db/pool.js";
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

    // Diagnostic: who referred the current user (if anyone). Lets us verify from the
    // UI whether the referral deep-link actually delivered its start_param on a device.
    let referredByUsername: string | null = null;
    const refBy = (dbUser as { referred_by?: number | null }).referred_by;
    if (refBy) {
      const rb = await query<{ username: string | null; first_name: string | null }>(
        "SELECT username, first_name FROM users WHERE id = $1",
        [refBy]
      );
      if (rb.rows[0]) referredByUsername = rb.rows[0].username || rb.rows[0].first_name;
    }

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
      referredByUsername,
      isAdmin: env.adminTelegramIds.includes(tgUser.id),
      config: {
        rewardPerAd: env.economy.rewardPerAd,
        minWithdrawal: env.economy.minWithdrawal,
        coinsPerUsd: env.economy.coinsPerUsd,
        adCooldownSeconds: env.economy.adCooldownSeconds,
        maxAdsPerDay: env.economy.maxAdsPerDay,
        referralBonusPct: env.economy.referralBonusPct,
        monetagZoneId: env.monetag.zoneId,
        adsgramBlockId: env.adsgram.blockId,
        adsgramEnabled: !!env.adsgram.blockId,
      },
    });
  })
);
