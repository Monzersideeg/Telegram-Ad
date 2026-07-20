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
import type { AuthedRequest } from "../types.js";

export const gamesRouter = Router();
gamesRouter.use(requireAuth);

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
