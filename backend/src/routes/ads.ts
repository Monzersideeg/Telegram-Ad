import { Router } from "express";
import crypto from "node:crypto";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler, HttpError } from "../middleware/error.js";
import { checkAdRateLimit, redis } from "../lib/redis.js";
import { query, withTransaction } from "../db/pool.js";
import { confirmAdView, creditInTx } from "../services/ledger.js";
import { env } from "../config/env.js";
import type { AuthedRequest } from "../types.js";

export const adsRouter = Router();
adsRouter.use(requireAuth);

const START_LOCK_SEC = 120;
const startLockKey = (userId: number) => `ad:startlock:${userId}`;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MIN_WATCH_MS = 2500;

/**
 * POST /api/ads/start
 * Creates an AdsGram rewarded-watch session after cooldown/daily-limit checks.
 * No coins are credited here. The client opens AdsGram immediately from the tap and
 * then calls /complete only after the AdsGram SDK resolves successfully.
 */
adsRouter.post(
  "/start",
  asyncHandler(async (req: AuthedRequest, res) => {
    const user = req.auth!.dbUser;
    if (!env.adsgram.rewardBlockId) throw new HttpError(503, "adsgram_not_configured", "Ads are not configured yet");

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
       VALUES ($1, $2, 'adsgram', 'pending', $3)`,
      [user.id, sessionId, req.ip ?? null]
    );

    res.json({
      sessionId,
      adNetwork: "adsgram",
      rewardBlockId: env.adsgram.rewardBlockId,
      interstitialBlockId: env.adsgram.interstitialBlockId,
      taskBlockId: env.adsgram.taskBlockId,
      rewardPerAd: env.economy.rewardPerAd,
    });
  })
);

/** GET /api/ads/status/:sessionId — mostly diagnostic; AdsGram reward flow uses /complete. */
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

/**
 * POST /api/ads/complete { sessionId }
 * Credits a rewarded AdsGram view after the SDK promise resolves on the client.
 * Server guards: valid pending session, min session age, idempotent settlement.
 */
adsRouter.post(
  "/complete",
  asyncHandler(async (req: AuthedRequest, res) => {
    const user = req.auth!.dbUser;
    const sessionId = typeof req.body?.sessionId === "string" ? req.body.sessionId.trim() : "";
    if (!/^[0-9a-f-]{8,}$/i.test(sessionId)) throw new HttpError(400, "bad_session");

    const row = await query<{ ad_network: string; status: string; created_at: string }>(
      `SELECT ad_network, status, created_at::text AS created_at FROM ad_views WHERE session_id = $1 AND user_id = $2`,
      [sessionId, user.id]
    );
    if (!row.rows[0]) throw new HttpError(404, "not_found");
    if (row.rows[0].ad_network !== "adsgram") throw new HttpError(403, "wrong_network", "Only AdsGram sessions are supported");
    if (row.rows[0].status !== "pending") throw new HttpError(409, "already_settled");
    const ageMs = Date.now() - new Date(row.rows[0].created_at).getTime();
    if (ageMs < MIN_WATCH_MS) throw new HttpError(425, "too_soon", "Ad not watched long enough");

    const result = await confirmAdView({
      sessionId,
      rewarded: true,
      eventType: "adsgram_reward_complete",
      ip: req.ip ?? null,
    });
    try { await redis.del(startLockKey(user.id)); } catch { /* ignore */ }

    res.json({
      status: result.result,
      reward: "reward" in result ? result.reward : 0,
      balance: "balance" in result ? result.balance : 0,
    });
  })
);

/**
 * POST /api/ads/task-complete { blockId }
 * Credits an AdsGram task reward after <adsgram-task> emits reward. One reward per
 * user/block/day protects against duplicate DOM events or reload spam.
 */
adsRouter.post(
  "/task-complete",
  asyncHandler(async (req: AuthedRequest, res) => {
    const user = req.auth!.dbUser;
    const blockId = typeof req.body?.blockId === "string" ? req.body.blockId.trim() : "";
    if (!env.adsgram.taskBlockId || blockId !== env.adsgram.taskBlockId) {
      throw new HttpError(400, "bad_task_block", "Task is not configured");
    }

    const day = new Date().toISOString().slice(0, 10);
    const sessionId = `task:${user.id}:${blockId}:${day}`;
    const reward = env.adsgram.taskReward;

    const result = await withTransaction(async (client) => {
      const existing = await client.query<{ status: string; reward_amount: string }>(
        "SELECT status, reward_amount::text FROM ad_views WHERE session_id = $1 FOR UPDATE",
        [sessionId]
      );
      if (existing.rows[0]?.status === "confirmed") {
        const b = await client.query<{ balance: string }>("SELECT balance::text FROM users WHERE id = $1", [user.id]);
        return { duplicate: true, balance: Number(b.rows[0]?.balance ?? 0), reward: 0 };
      }

      if (!existing.rows[0]) {
        await client.query(
          `INSERT INTO ad_views (user_id, session_id, ad_network, reward_amount, status, ip, confirmed_at)
           VALUES ($1, $2, 'adsgram_task', $3, 'confirmed', $4, now())`,
          [user.id, sessionId, reward, req.ip ?? null]
        );
      } else {
        await client.query(
          `UPDATE ad_views SET reward_amount = $2, status = 'confirmed', confirmed_at = now(), ip = COALESCE($3, ip)
           WHERE session_id = $1`,
          [sessionId, reward, req.ip ?? null]
        );
      }

      const balance = await creditInTx(client, user.id, reward, "ad_task_reward", { block_id: blockId, session_id: sessionId });
      return { duplicate: false, balance, reward };
    });

    res.json({ status: result.duplicate ? "duplicate" : "confirmed", reward: result.reward, balance: result.balance });
  })
);

/** POST /api/ads/abandon { sessionId } — closes a pending AdsGram reward session. */
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
