import { Router, type Request, type Response } from "express";
import { env } from "../config/env.js";
import { asyncHandler, HttpError } from "../middleware/error.js";
import { logger } from "../lib/logger.js";
import { confirmAdView } from "../services/ledger.js";
import { recordAdReward } from "../lib/redis.js";

export const postbackRouter = Router();

function asString(v: unknown): string | null {
  if (typeof v === "string") return v;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  return null;
}

function asNumber(v: unknown): number | null {
  const s = asString(v);
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

async function handle(req: Request, res: Response) {
  const q = req.method === "POST" ? { ...req.query, ...(req.body || {}) } : req.query;
  const secret = asString(q.secret);
  if (!secret || secret !== env.monetag.postbackSecret) {
    logger.warn("Monetag postback rejected: bad secret", { ip: req.ip });
    throw new HttpError(403, "bad_secret", "Invalid postback secret");
  }

  const sessionId = asString(q[env.monetag.paramSession]);
  if (!sessionId) throw new HttpError(400, "missing_session", "Missing session id");

  const valueType = (asString(q[env.monetag.paramValueType]) || "").toLowerCase();
  const eventType = asString(q[env.monetag.paramEvent]) ?? null;
  const estimatedPrice = asNumber(q[env.monetag.paramPrice]);
  const rewarded = valueType === "valued" || valueType === "reward" || valueType === "rewarded";

  const result = await confirmAdView({
    sessionId,
    rewarded,
    estimatedPrice,
    eventType,
    ip: req.ip ?? null,
  });

  if (result.result === "confirmed") {
    await recordAdReward(result.userId, env.economy.adCooldownSeconds);
    logger.info("Monetag reward credited", { sessionId, userId: result.userId, reward: result.reward });
  } else {
    logger.info("Monetag postback settled without credit", { sessionId, result: result.result, valueType });
  }

  res.json({ ok: true, result: result.result });
}

postbackRouter.get("/monetag", asyncHandler(handle));
postbackRouter.post("/monetag", asyncHandler(handle));
