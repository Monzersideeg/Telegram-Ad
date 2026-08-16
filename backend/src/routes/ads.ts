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

const START_LOCK_SEC = 120;
const startLockKey = (userId: number) => `ad:startlock:${userId}`;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;

/** POST /api/ads/start — creates a pending Monetag watch session. */
adsRouter.post(
  "/start",
  asyncHandler(async (req: AuthedRequest, res) => {
    const user = req.auth!.dbUser;
    if (!env.monetag.zoneId) throw new HttpError(503, "monetag_not_configured", "Ads are not configured yet");

    const rl = await checkAdRateLimit(user.id, env.economy.adCooldownSeconds, env.economy.maxAdsPerDay);
    if (!rl.allowed) {
      throw new HttpError(
        429,
        rl.reason === "cooldown" ? "cooldown" : "daily_limit",
        rl.reason === "cooldown" ? "Please wait before the next ad" : "Daily ad limit reached",
        { retryAfterSec: rl.retryAfterSec ?? null }
      );
    }

    let acquired: string | null = "OK";
    try {
      acquired = await redis.set(startLockKey(user.id), "1", "EX", START_LOCK_SEC, "NX");
    } catch {
      acquired = "OK";
    }
    if (acquired !== "OK") throw new HttpError(429, "ad_in_progress", "Finish your current ad first");

    const proposed = typeof req.body?.sessionId === "string" ? req.body.sessionId.trim() : "";
    const sessionId = UUID_RE.test(proposed) ? proposed : crypto.randomUUID();
    await query(
      `INSERT INTO ad_views (user_id, session_id, ad_network, status, ip)
       VALUES ($1, $2, 'monetag', 'pending', $3)`,
      [user.id, sessionId, req.ip ?? null]
    );

    res.json({
      sessionId,
      adNetwork: "monetag",
      zoneId: env.monetag.zoneId,
      rewardPerAd: env.economy.rewardPerAd,
      ymid: sessionId,
      requestVar: "watch_button",
      telegramId: user.telegram_id,
    });
  })
);

/** GET /api/ads/status/:sessionId — client polls until Monetag S2S postback settles. */
adsRouter.get(
  "/status/:sessionId",
  asyncHandler(async (req: AuthedRequest, res) => {
    const user = req.auth!.dbUser;
    const r = await query<{ status: string; reward_amount: string }>(
      `SELECT status, reward_amount::text FROM ad_views WHERE session_id = $1 AND user_id = $2`,
      [req.params.sessionId, user.id]
    );
    if (!r.rows[0]) throw new HttpError(404, "not_found");
    const { status, reward_amount } = r.rows[0];
    if (["confirmed", "rejected", "unrewarded"].includes(status)) {
      try { await redis.del(startLockKey(user.id)); } catch { /* ignore */ }
    }
    res.json({ status, reward: Number(reward_amount) });
  })
);

/** POST /api/ads/abandon { sessionId } — closes pending session if the SDK did not show/complete. */
adsRouter.post(
  "/abandon",
  asyncHandler(async (req: AuthedRequest, res) => {
    const user = req.auth!.dbUser;
    const sessionId = typeof req.body?.sessionId === "string" ? req.body.sessionId.trim() : "";
    if (!/^[0-9a-f-]{8,}$/i.test(sessionId)) throw new HttpError(400, "bad_session");
    await query(
      `UPDATE ad_views SET status = 'unrewarded', confirmed_at = now()
        WHERE session_id = $1 AND user_id = $2 AND status = 'pending'`,
      [sessionId, user.id]
    );
    try { await redis.del(startLockKey(user.id)); } catch { /* ignore */ }
    res.json({ ok: true });
  })
);
