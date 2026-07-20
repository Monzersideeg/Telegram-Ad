import { Router } from "express";
import type { Request, Response } from "express";
import { asyncHandler, HttpError } from "../middleware/error.js";
import { confirmAdView } from "../services/ledger.js";
import { recordAdReward } from "../lib/redis.js";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";

export const postbackRouter = Router();

const asString = (v: unknown): string | undefined =>
  v === undefined || v === null ? undefined : String(v);
const asNumber = (v: unknown): number | undefined => {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

/**
 * GET/POST /api/postback/monetag
 *
 * Server-to-server reward callback invoked by Monetag after a confirmed ad event.
 *
 * Configure this URL template in the Monetag dashboard (per SDK zone):
 *   https://YOURDOMAIN/api/postback/monetag?secret=XXX&ymid={ymid}
 *     &event={event_type}&value={reward_event_type}&price={estimated_price}
 *     &telegram_id={telegram_id}&zone={zone_id}&sub={sub_zone_id}&source={request_var}
 *
 * Security & correctness:
 *   1. Reject unless `secret` matches MONETAG_POSTBACK_SECRET. (Monetag postbacks
 *      have no built-in signature, so the secret in the URL authenticates them;
 *      the URL is known only to you + Monetag.)
 *   2. `ymid` carries our watch sessionId, so the reward routes to the exact view.
 *   3. Credit ONLY when reward_event_type === 'valued' (paid). Monetag docs use both
 *      'non_valued' and 'not_valued' for unpaid — anything not exactly 'valued' is
 *      treated as unpaid (recorded, not credited), protecting your margins.
 *   4. confirmAdView() is idempotent (row lock + status check), so retried or
 *      duplicate postbacks never double-credit.
 *   5. Coin amount is the configured REWARD_PER_AD — `price` is logged for revenue
 *      tracking only, never used to mint coins.
 */
async function handle(req: Request, res: Response): Promise<void> {
  const q: Record<string, unknown> = { ...(req.query as object), ...(req.body as object) };

  const secret = asString(q.secret);
  if (!secret || secret !== env.monetag.postbackSecret) {
    logger.warn("Monetag postback rejected: bad secret", { ip: req.ip });
    throw new HttpError(403, "bad_secret");
  }

  const sessionId = asString(q[env.monetag.paramSession]); // ymid
  if (!sessionId) {
    throw new HttpError(400, "missing_session", "postback missing ymid/session");
  }

  const valueType = (asString(q[env.monetag.paramValueType]) || "").toLowerCase();
  const rewarded = valueType === "valued";
  const estimatedPrice = asNumber(q[env.monetag.paramPrice]) ?? null;
  const eventType = asString(q[env.monetag.paramEvent]) ?? null;

  const result = await confirmAdView({
    sessionId,
    rewarded,
    estimatedPrice,
    eventType,
    ip: req.ip ?? null,
  });

  if (result.result === "confirmed") {
    // Enforce cooldown + daily cap now that a reward was actually paid.
    await recordAdReward(result.userId, env.economy.adCooldownSeconds);
    logger.info("Ad reward credited (valued postback)", {
      sessionId,
      userId: result.userId,
      reward: result.reward,
      referral: result.referralGranted,
      price: estimatedPrice,
    });
  } else {
    logger.info("Monetag postback settled (no credit)", {
      sessionId,
      result: result.result,
      valueType,
      eventType,
    });
  }

  // Always 200 for a validly-authenticated postback so Monetag doesn't retry forever.
  res.json({ status: "ok", result: result.result });
}

postbackRouter.get("/monetag", asyncHandler(handle));
postbackRouter.post("/monetag", asyncHandler(handle));
