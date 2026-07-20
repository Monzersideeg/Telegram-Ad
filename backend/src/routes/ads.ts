import { Router } from "express";
import crypto from "node:crypto";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler, HttpError } from "../middleware/error.js";
import { checkAdRateLimit, redis } from "../lib/redis.js";
import { query } from "../db/pool.js";
import { env } from "../config/env.js";
import type { AuthedRequest } from "../types.js";

export const adsRouter = Router();
adsRouter.use(requireAuth);

// Max seconds a started session may stay "in progress" before another can start.
const START_LOCK_SEC = 120;
const startLockKey = (userId: number) => `ad:startlock:${userId}`;

/**
 * POST /api/ads/start
 * Opens a watch session after passing rate-limit checks. The client shows the
 * Monetag ad with sub1=telegram_id and sub2=sessionId, then polls /status.
 * No coins are credited here — only the verified S2S postback credits.
 */
adsRouter.post(
  "/start",
  asyncHandler(async (req: AuthedRequest, res) => {
    const user = req.auth!.dbUser;

    const rl = await checkAdRateLimit(
      user.id,
      env.economy.adCooldownSeconds,
      env.economy.maxAdsPerDay
    );
    if (!rl.allowed) {
      throw new HttpError(
        429,
        rl.reason === "cooldown" ? "cooldown" : "daily_limit",
        rl.reason === "cooldown" ? "Please wait before the next ad" : "Daily ad limit reached",
        { retryAfterSec: rl.retryAfterSec ?? null }
      );
    }

    // Prevent opening many parallel sessions (farm mitigation). Fails open if Redis
    // is down — the DB session-status idempotency still prevents double-crediting.
    let acquired: string | null = "OK";
    try {
      acquired = await redis.set(startLockKey(user.id), "1", "EX", START_LOCK_SEC, "NX");
    } catch {
      acquired = "OK"; // Redis unavailable → skip the in-progress lock
    }
    if (acquired !== "OK") {
      throw new HttpError(429, "ad_in_progress", "Finish your current ad first");
    }

    const sessionId = crypto.randomUUID();
    await query(
      `INSERT INTO ad_views (user_id, session_id, status, ip)
       VALUES ($1, $2, 'pending', $3)`,
      [user.id, sessionId, req.ip ?? null]
    );

    res.json({
      sessionId,
      adNetwork: "monetag",
      zoneId: env.monetag.zoneId,
      rewardPerAd: env.economy.rewardPerAd,
      // Passed to the Monetag SDK as `ymid`; the S2S postback echoes it back so we
      // can route the confirmed reward to exactly this watch session.
      ymid: sessionId,
      requestVar: "watch_button",
    });
  })
);

/**
 * GET /api/ads/status/:sessionId
 * Client polls this after showing the ad. Returns pending -> confirmed/rejected.
 */
adsRouter.get(
  "/status/:sessionId",
  asyncHandler(async (req: AuthedRequest, res) => {
    const user = req.auth!.dbUser;
    const r = await query<{ status: string; reward_amount: string }>(
      `SELECT status, reward_amount::text FROM ad_views
        WHERE session_id = $1 AND user_id = $2`,
      [req.params.sessionId, user.id]
    );
    if (!r.rows[0]) throw new HttpError(404, "not_found");
    const { status, reward_amount } = r.rows[0];
    if (status === "confirmed" || status === "rejected" || status === "unrewarded") {
      try {
        await redis.del(startLockKey(user.id));
      } catch {
        /* Redis unavailable — the lock expires on its own TTL */
      }
    }
    res.json({ status, reward: Number(reward_amount) });
  })
);
