import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler, HttpError } from "../middleware/error.js";
import {
  getStreakStatus,
  checkIn,
  getMissions,
  claimMission,
  getLeaderboard,
  getMyRank,
  getSpinStatus,
  spin,
} from "../services/games.js";
import { env } from "../config/env.js";
import { query } from "../db/pool.js";
import type { AuthedRequest } from "../types.js";

export const gamesRouter = Router();
gamesRouter.use(requireAuth);

// Anonymize a username / name for the public live feed (never leak full handles).
function anonymize(username: string | null, firstName: string | null): string {
  const base = (username || firstName || "user").trim();
  if (!base) return "@user";
  const masked = base.length <= 3 ? base[0] + "••" : base.slice(0, 2) + "•••" + base.slice(-1);
  return "@" + masked;
}

/**
 * GET /api/feed — real, anonymized global activity for the dashboard "Live Feed"
 * ticker (recent rewards + new joins). No synthetic data.
 */
gamesRouter.get(
  "/feed",
  asyncHandler(async (_req, res) => {
    const tx = await query<{
      username: string | null;
      first_name: string | null;
      type: string;
      amount: string;
      created_at: string;
    }>(
      `SELECT u.username, u.first_name, t.type, t.amount::text, t.created_at
         FROM transactions t
         JOIN users u ON u.id = t.user_id
        WHERE u.banned = false
          AND t.type IN ('ad_reward','streak_bonus','mission_reward','spin_reward','referral_bonus')
        ORDER BY t.created_at DESC
        LIMIT 40`
    );
    const joins = await query<{ username: string | null; first_name: string | null; created_at: string }>(
      `SELECT username, first_name, created_at FROM users
        WHERE banned = false ORDER BY created_at DESC LIMIT 40`
    );

    const label = (type: string, amount: number): string => {
      switch (type) {
        case "ad_reward": return `earned +${amount} ACN from an ad`;
        case "streak_bonus": return `claimed a daily check-in (+${amount})`;
        case "spin_reward": return `won +${amount} ACN on the Lucky Spin`;
        case "mission_reward": return `completed a mission (+${amount})`;
        case "referral_bonus": return `received a referral bonus (+${amount})`;
        default: return `earned +${amount} ACN`;
      }
    };

    const events = [
      ...tx.rows.map((r) => ({
        at: new Date(r.created_at).getTime(),
        text: `${anonymize(r.username, r.first_name)} ${label(r.type, Number(r.amount))}`,
      })),
      ...joins.rows.map((r) => ({
        at: new Date(r.created_at).getTime(),
        text: `${anonymize(r.username, r.first_name)} just joined AcEarn`,
      })),
    ]
      .sort((a, b) => b.at - a.at)
      .slice(0, 25);

    res.json({ events });
  })
);

// ----- Daily check-in / streak -----
gamesRouter.get(
  "/streak",
  asyncHandler(async (req: AuthedRequest, res) => {
    res.json(await getStreakStatus(req.auth!.dbUser.id));
  })
);

gamesRouter.post(
  "/streak/checkin",
  asyncHandler(async (req: AuthedRequest, res) => {
    res.json(await checkIn(req.auth!.dbUser.id));
  })
);

// ----- Missions -----
gamesRouter.get(
  "/missions",
  asyncHandler(async (req: AuthedRequest, res) => {
    res.json({ missions: await getMissions(req.auth!.dbUser.id) });
  })
);

gamesRouter.post(
  "/missions/claim",
  asyncHandler(async (req: AuthedRequest, res) => {
    const missionId = String(req.body?.missionId ?? "");
    res.json(await claimMission(req.auth!.dbUser.id, missionId));
  })
);

// ----- Leaderboard -----
gamesRouter.get(
  "/leaderboard",
  asyncHandler(async (req: AuthedRequest, res) => {
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const [leaders, me] = await Promise.all([
      getLeaderboard(limit),
      getMyRank(req.auth!.dbUser.id),
    ]);
    res.json({ leaders, me, coinsPerUsd: env.economy.coinsPerUsd });
  })
);

// ----- Lucky Spin -----
gamesRouter.get(
  "/spin",
  asyncHandler(async (req: AuthedRequest, res) => {
    res.json(await getSpinStatus(req.auth!.dbUser.id));
  })
);

gamesRouter.post(
  "/spin",
  asyncHandler(async (req: AuthedRequest, res) => {
    const result = await spin(req.auth!.dbUser.id);
    if (!result.available) {
      throw new HttpError(429, "cooldown", "Lucky Spin is on cooldown", {
        retryAfterSec: result.retryAfterSec,
      });
    }
    res.json({
      reward: (result as { reward: number }).reward,
      balance: (result as { balance: number }).balance,
      cooldownSeconds: env.economy.spinCooldownSeconds,
    });
  })
);
