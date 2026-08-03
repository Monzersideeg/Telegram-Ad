import { Router } from "express";
import crypto from "node:crypto";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler, HttpError } from "../middleware/error.js";
import { checkAdRateLimit, recordAdReward, redis } from "../lib/redis.js";
import { query, withTransaction } from "../db/pool.js";
import { confirmAdView, creditInTx, getBalance } from "../services/ledger.js";
import { env } from "../config/env.js";
import type { AuthedRequest } from "../types.js";

export const adsRouter = Router();

const START_LOCK_SEC = 120;
const startLockKey = (userId: number) => `ad:startlock:${userId}`;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;
const MIN_WATCH_MS = 2500;

function firstString(v: unknown): string {
  return typeof v === "string" ? v.trim() : Array.isArray(v) && typeof v[0] === "string" ? v[0].trim() : "";
}

async function settleLatestPendingAdsGramSession(params: {
  telegramId: number;
  source: "reward_url" | "client_complete";
  ip?: string | null;
}) {
  const user = await query<{ id: number }>("SELECT id FROM users WHERE telegram_id = $1", [params.telegramId]);
  const userId = user.rows[0]?.id;
  if (!userId) return { result: "user_not_found" as const, reward: 0, balance: 0 };

  const pending = await query<{ session_id: string }>(
    `SELECT session_id
       FROM ad_views
      WHERE user_id = $1
        AND ad_network = 'adsgram'
        AND status = 'pending'
        AND created_at >= now() - INTERVAL '10 minutes'
      ORDER BY created_at DESC
      LIMIT 1`,
    [userId]
  );

  if (pending.rows[0]) {
    const settled = await confirmAdView({
      sessionId: pending.rows[0].session_id,
      rewarded: true,
      eventType: `adsgram_${params.source}`,
      ip: params.ip ?? null,
    });
    try {
      await redis.del(startLockKey(userId));
      if (settled.result === "confirmed") await recordAdReward(userId, env.economy.adCooldownSeconds);
    } catch {
      /* optional rate-limit bookkeeping */
    }
    return {
      result: settled.result,
      reward: "reward" in settled ? settled.reward : 0,
      balance: "balance" in settled ? settled.balance : await getBalance(userId),
    };
  }

  // If client completion already settled this reward before AdsGram's server GET arrived,
  // return duplicate/ok instead of crediting again.
  const recent = await query<{ reward_amount: string }>(
    `SELECT reward_amount::text
       FROM ad_views
      WHERE user_id = $1
        AND ad_network = 'adsgram'
        AND status = 'confirmed'
        AND confirmed_at >= now() - INTERVAL '10 minutes'
      ORDER BY confirmed_at DESC
      LIMIT 1`,
    [userId]
  );

  if (recent.rows[0]) {
    return { result: "duplicate" as const, reward: Number(recent.rows[0].reward_amount || 0), balance: await getBalance(userId) };
  }

  return { result: "no_pending_session" as const, reward: 0, balance: await getBalance(userId) };
}

/**
 * GET /api/ads/reward-url?secret=...&userid=[userId]
 * Public AdsGram Reward URL endpoint. Paste this URL into the AdsGram reward block
 * settings. AdsGram replaces [userId] with the Telegram ID and calls this endpoint
 * after the reward event. We only credit a recent pending AdsGram session for that
 * user; otherwise we return ok without minting coins.
 */
adsRouter.get(
  "/reward-url",
  asyncHandler(async (req, res) => {
    if (env.adsgram.rewardSecret) {
      const secret = firstString(req.query.secret);
      if (secret !== env.adsgram.rewardSecret) throw new HttpError(403, "bad_secret", "Invalid reward URL secret");
    }

    const rawUserId = firstString(req.query.userid ?? req.query.userId ?? req.query.user_id ?? req.query.tgid ?? req.query.telegram_id);
    const telegramId = Number(rawUserId);
    if (!Number.isFinite(telegramId) || telegramId <= 0) {
      throw new HttpError(400, "bad_userid", "Missing or invalid Telegram user id");
    }

    const result = await settleLatestPendingAdsGramSession({
      telegramId,
      source: "reward_url",
      ip: req.ip ?? null,
    });

    // Always JSON 200 after authentication/user parsing so AdsGram does not retry forever.
    res.json({ ok: true, ...result });
  })
);

adsRouter.use(requireAuth);

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

    const row = await query<{ ad_network: string; status: string; created_at: string; reward_amount: string }>(
      `SELECT ad_network, status, created_at::text AS created_at, reward_amount::text
         FROM ad_views WHERE session_id = $1 AND user_id = $2`,
      [sessionId, user.id]
    );
    const view = row.rows[0];
    if (!view) throw new HttpError(404, "not_found");
    if (view.ad_network !== "adsgram") throw new HttpError(403, "wrong_network", "Only AdsGram sessions are supported");

    if (view.status === "confirmed") {
      res.json({ status: "confirmed", reward: Number(view.reward_amount || 0), balance: await getBalance(user.id) });
      return;
    }
    if (view.status !== "pending") throw new HttpError(409, "already_settled");

    const ageMs = Date.now() - new Date(view.created_at).getTime();
    if (ageMs < MIN_WATCH_MS) throw new HttpError(425, "too_soon", "Ad not watched long enough");

    const result = await confirmAdView({
      sessionId,
      rewarded: true,
      eventType: "adsgram_client_complete",
      ip: req.ip ?? null,
    });
    try {
      await redis.del(startLockKey(user.id));
      if (result.result === "confirmed") await recordAdReward(user.id, env.economy.adCooldownSeconds);
    } catch {
      /* optional rate-limit bookkeeping */
    }

    res.json({
      status: result.result,
      reward: "reward" in result ? result.reward : 0,
      balance: "balance" in result ? result.balance : await getBalance(user.id),
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
