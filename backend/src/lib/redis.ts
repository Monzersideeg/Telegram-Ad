import Redis from "ioredis";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";

// Redis powers anti-fraud rate limiting (ad cooldowns, daily caps, referral caps).
// It is OPTIONAL: if Redis is unreachable, the app degrades gracefully — rate limits
// are skipped with a one-time warning (fail-open) instead of crashing or hanging.
// In production with Redis running, everything works normally.
export const redis = new Redis(env.redisUrl, {
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false, // reject commands fast when disconnected (don't queue forever)
  connectTimeout: 3000,
  // Keep retrying with backoff so a Redis restart is recovered in a long-running server.
  retryStrategy: (times) => Math.min(times * 500, 5000),
});

let redisWarned = false;
redis.on("error", (err) => {
  if (!redisWarned) {
    redisWarned = true;
    logger.warn(
      "Redis unavailable — rate limiting disabled (fail-open). " +
        (err instanceof Error ? err.message : String(err))
    );
  }
});

const dayKey = () => new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)

/** Ad-watch rate limit. Fails open (allowed) if Redis is down. */
export async function checkAdRateLimit(
  userId: number,
  cooldownSec: number,
  maxPerDay: number
): Promise<{ allowed: boolean; reason?: string; retryAfterSec?: number }> {
  try {
    const ttl = await redis.ttl(`ad:cooldown:${userId}`);
    if (ttl > 0) return { allowed: false, reason: "cooldown", retryAfterSec: ttl };
    const count = Number(await redis.get(`ad:daily:${dayKey()}:${userId}`)) || 0;
    if (count >= maxPerDay) return { allowed: false, reason: "daily_limit" };
    return { allowed: true };
  } catch {
    return { allowed: true }; // fail open
  }
}

/** Record a confirmed ad reward (cooldown + daily counter). No-op if Redis is down. */
export async function recordAdReward(userId: number, cooldownSec: number): Promise<void> {
  try {
    await redis.set(`ad:cooldown:${userId}`, "1", "EX", cooldownSec);
    const key = `ad:daily:${dayKey()}:${userId}`;
    const n = await redis.incr(key);
    if (n === 1) await redis.expire(key, 86_400 + 3600);
  } catch {
    /* rate limiting degraded */
  }
}

/** Referral-bonus daily cap. Fails open (grants full bonus) if Redis is down. */
export async function addReferralBonus(
  referrerId: number,
  amount: number,
  dailyCap: number
): Promise<{ granted: number; capped: boolean }> {
  try {
    const key = `ref:daily:${dayKey()}:${referrerId}`;
    const current = Number(await redis.get(key)) || 0;
    const room = Math.max(0, dailyCap - current);
    const granted = Math.min(amount, room);
    if (granted > 0) {
      const n = await redis.incrby(key, granted);
      if (n === granted) await redis.expire(key, 86_400 + 3600);
    }
    return { granted, capped: granted < amount };
  } catch {
    return { granted: amount, capped: false }; // fail open
  }
}

/** Replay guard. Fails open (treats as fresh) if Redis is down. */
export async function markClickProcessed(clickId: string): Promise<boolean> {
  try {
    const res = await redis.set(`postback:click:${clickId}`, "1", "EX", 86_400 * 7, "NX");
    return res === "OK";
  } catch {
    return true;
  }
}

/** Cleanly close the Redis connection (used by scripts/tests so the process can exit). */
export async function disconnectRedis(): Promise<void> {
  try {
    redis.disconnect();
  } catch {
    /* ignore */
  }
}
