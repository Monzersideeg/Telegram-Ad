import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler, HttpError } from "../middleware/error.js";
import { confirmAdView } from "../services/ledger.js";
import { recordAdReward } from "../lib/redis.js";
import { env } from "../config/env.js";
import { query } from "../db/pool.js";
import type { AuthedRequest } from "../types.js";

// DEVELOPMENT ONLY. Lets you exercise the full watch -> postback -> credit loop
// without a live Monetag zone. This router is mounted ONLY when NODE_ENV=development.
// It still goes through the real confirmAdView() path (idempotency, ledger, referral),
// so it mirrors production behavior. Never enable in production.
export const devRouter = Router();
devRouter.use(requireAuth);

devRouter.post(
  "/simulate-postback",
  asyncHandler(async (req: AuthedRequest, res) => {
    if (env.nodeEnv === "production") throw new HttpError(404, "not_found");

    const sessionId = String(req.body?.sessionId ?? "");
    if (!sessionId) throw new HttpError(400, "missing_session");

    const own = await query(
      "SELECT 1 FROM ad_views WHERE session_id = $1 AND user_id = $2",
      [sessionId, req.auth!.dbUser.id]
    );
    if (!own.rows[0]) throw new HttpError(404, "not_found");

    const result = await confirmAdView({
      sessionId,
      rewarded: true, // dev simulates a paid (valued) view
      estimatedPrice: 0,
      eventType: "impression",
    });
    if (result.result === "confirmed") {
      await recordAdReward(result.userId, env.economy.adCooldownSeconds);
    }
    res.json({ result: result.result });
  })
);
