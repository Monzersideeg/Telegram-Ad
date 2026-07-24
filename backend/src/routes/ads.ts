import { Router } from "express";
import crypto from "node:crypto";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler, HttpError } from "../middleware/error.js";
import { checkAdRateLimit, redis } from "../lib/redis.js";
import { query } from "../db/pool.js";
import { confirmAdView } from "../services/ledger.js";
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

    // Which ad network the client is about to show. Monetag confirms via S2S postback;
    // AdsGram confirms via the client SDK-verified /complete call. Both share this row.
    const network = req.body?.network === "adsgram" ? "adsgram" : "monetag";

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

    // The client generates the session id and passes it to the Monetag SDK *synchronously*
    // inside the tap (to preserve the user-gesture the interstitial needs). It then sends
    // that same id here so the S2S postback (ymid = sessionId) routes to this row. We only
    // accept a well-formed UUID; anything else falls back to a server-generated id.
    const UUID_RE =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const proposed =
      typeof req.body?.sessionId === "string" ? req.body.sessionId.trim() : "";
    const sessionId = UUID_RE.test(proposed) ? proposed : crypto.randomUUID();
    await query(
      `INSERT INTO ad_views (user_id, session_id, ad_network, status, ip)
       VALUES ($1, $2, $3, 'pending', $4)`,
      [user.id, sessionId, network, req.ip ?? null]
    );

    res.json({
      sessionId,
      adNetwork: network,
      zoneId: env.monetag.zoneId,
      blockId: env.adsgram.blockId,
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

// Min time a session must exist before a client-asserted completion is accepted
// (discourages bots that call /complete instantly without showing the ad).
const MIN_WATCH_MS = 2500;

/**
 * POST /api/ads/complete  { sessionId }
 * Client-asserted completion for ADSGRAM only. AdsGram's SDK verifies the view and
 * resolves show() only on a legitimate completed watch, so we credit on that resolved
 * promise here — still gated by the server session, rate-limits (enforced at /start),
 * once-per-session idempotency (confirmAdView), and a min-watch-time guard. Monetag
 * sessions must NOT use this; they confirm via the S2S postback.
 */
adsRouter.post(
  "/complete",
  asyncHandler(async (req: AuthedRequest, res) => {
    const user = req.auth!.dbUser;
    const sessionId =
      typeof req.body?.sessionId === "string" ? req.body.sessionId.trim() : "";
    if (!/^[0-9a-f-]{8,}$/i.test(sessionId)) throw new HttpError(400, "bad_session");

    const row = await query<{ ad_network: string; status: string; created_at: string }>(
      `SELECT ad_network, status, created_at::text AS created_at
         FROM ad_views WHERE session_id = $1 AND user_id = $2`,
      [sessionId, user.id]
    );
    if (!row.rows[0]) throw new HttpError(404, "not_found");
    if (row.rows[0].ad_network !== "adsgram") {
      throw new HttpError(403, "wrong_network", "This network confirms via postback");
    }
    if (row.rows[0].status !== "pending") throw new HttpError(409, "already_settled");
    const ageMs = Date.now() - new Date(row.rows[0].created_at).getTime();
    if (ageMs < MIN_WATCH_MS) throw new HttpError(425, "too_soon", "Ad not watched long enough");

    const result = await confirmAdView({
      sessionId,
      rewarded: true,
      eventType: "adsgram_client_complete",
      ip: req.ip ?? null,
    });
    try {
      await redis.del(startLockKey(user.id));
    } catch {
      /* lock expires on its own TTL */
    }
    res.json({
      status: result.result,
      reward: "reward" in result ? (result as { reward: number }).reward : 0,
      balance: "balance" in result ? (result as { balance: number }).balance : 0,
    });
  })
);

/**
 * POST /api/ads/abandon  { sessionId }
 * Called when an ad did not complete (skipped / errored / no feed) so the in-progress
 * lock is freed immediately and the pending row is closed as unrewarded. Idempotent.
 */
adsRouter.post(
  "/abandon",
  asyncHandler(async (req: AuthedRequest, res) => {
    const user = req.auth!.dbUser;
    const sessionId =
      typeof req.body?.sessionId === "string" ? req.body.sessionId.trim() : "";
    if (!/^[0-9a-f-]{8,}$/i.test(sessionId)) throw new HttpError(400, "bad_session");
    await query(
      `UPDATE ad_views SET status = 'unrewarded', confirmed_at = now()
        WHERE session_id = $1 AND user_id = $2 AND status = 'pending'`,
      [sessionId, user.id]
    );
    try {
      await redis.del(startLockKey(user.id));
    } catch {
      /* lock expires on its own TTL */
    }
    res.json({ ok: true });
  })
);
