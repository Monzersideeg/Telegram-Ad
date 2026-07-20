import { query, withTransaction } from "../db/pool.js";
import { env } from "../config/env.js";
import { creditInTx } from "./ledger.js";
import { HttpError } from "../middleware/error.js";

// ============================ Daily check-in ============================

function checkinRewardFor(streak: number): number {
  return env.economy.checkinReward + Math.min(streak, 7) * env.economy.checkinStreakStep;
}

export async function getStreakStatus(userId: number) {
  const u = await query<{ streak_days: number }>(
    "SELECT streak_days FROM users WHERE id = $1",
    [userId]
  );
  const streakDays = Number(u.rows[0]?.streak_days ?? 0);

  const today = await query(
    "SELECT 1 FROM checkins WHERE user_id = $1 AND day = CURRENT_DATE",
    [userId]
  );
  const checkedInToday = today.rows.length > 0;

  // Streak the user would have if they check in now.
  let prospectiveStreak = streakDays;
  if (!checkedInToday) {
    const yday = await query<{ streak: number }>(
      "SELECT streak FROM checkins WHERE user_id = $1 AND day = CURRENT_DATE - 1",
      [userId]
    );
    prospectiveStreak = yday.rows[0] ? Number(yday.rows[0].streak) + 1 : 1;
  }

  return { streakDays, checkedInToday, nextReward: checkinRewardFor(prospectiveStreak) };
}

export async function checkIn(userId: number) {
  return withTransaction(async (client) => {
    const lock = await client.query<{ streak_days: number; balance: string }>(
      "SELECT streak_days, balance::text FROM users WHERE id = $1 FOR UPDATE",
      [userId]
    );
    if (!lock.rows[0]) throw new HttpError(404, "user_not_found");

    const yday = await client.query<{ streak: number }>(
      "SELECT streak FROM checkins WHERE user_id = $1 AND day = CURRENT_DATE - 1",
      [userId]
    );
    const newStreak = yday.rows[0] ? Number(yday.rows[0].streak) + 1 : 1;
    const reward = checkinRewardFor(newStreak);

    // Once-per-day guard.
    const ins = await client.query(
      `INSERT INTO checkins (user_id, day, streak, reward)
       VALUES ($1, CURRENT_DATE, $2, $3)
       ON CONFLICT (user_id, day) DO NOTHING
       RETURNING id`,
      [userId, newStreak, reward]
    );
    if (ins.rowCount === 0) {
      return {
        alreadyCheckedIn: true,
        streakDays: Number(lock.rows[0].streak_days),
        reward: 0,
        balance: Number(lock.rows[0].balance),
      };
    }

    const balance = await creditInTx(client, userId, reward, "streak_bonus", {
      streak: newStreak,
    });
    await client.query("UPDATE users SET streak_days = $2 WHERE id = $1", [userId, newStreak]);

    return { alreadyCheckedIn: false, streakDays: newStreak, reward, balance };
  });
}

// ============================ Missions ============================

interface MissionDef {
  id: string;
  reward: number;
  target: number;
}

const MISSION_DEFS: MissionDef[] = [
  { id: "join_telegram", reward: env.economy.missionJoinTelegram, target: 1 },
  { id: "watch_10_ads", reward: env.economy.missionWatch10, target: 10 },
  { id: "invite_3_friends", reward: env.economy.missionInvite3, target: 3 },
];

async function missionProgress(userId: number, id: string): Promise<number> {
  if (id === "join_telegram") return 1; // always claimable once
  if (id === "watch_10_ads") {
    const r = await query(
      "SELECT COUNT(*)::int AS n FROM transactions WHERE user_id = $1 AND type = 'ad_reward'",
      [userId]
    );
    return Number(r.rows[0].n);
  }
  if (id === "invite_3_friends") {
    const r = await query("SELECT COUNT(*)::int AS n FROM users WHERE referred_by = $1", [userId]);
    return Number(r.rows[0].n);
  }
  return 0;
}

export async function getMissions(userId: number) {
  const claimedRes = await query<{ mission_id: string }>(
    "SELECT mission_id FROM missions WHERE user_id = $1",
    [userId]
  );
  const claimed = new Set(claimedRes.rows.map((r) => r.mission_id));

  const items = [];
  for (const def of MISSION_DEFS) {
    const progress = await missionProgress(userId, def.id);
    const eligible = def.id === "join_telegram" ? true : progress >= def.target;
    items.push({
      id: def.id,
      reward: def.reward,
      target: def.target,
      progress: Math.min(progress, def.target),
      claimed: claimed.has(def.id),
      eligible,
    });
  }
  return items;
}

export async function claimMission(userId: number, missionId: string) {
  const def = MISSION_DEFS.find((m) => m.id === missionId);
  if (!def) throw new HttpError(400, "invalid_mission");

  const progress = await missionProgress(userId, missionId);
  const eligible = def.id === "join_telegram" ? true : progress >= def.target;
  if (!eligible) throw new HttpError(400, "not_eligible", "Mission requirements not met");

  return withTransaction(async (client) => {
    // Atomic claim guard (UNIQUE user_id+mission_id). If it conflicts, no credit.
    const ins = await client.query(
      `INSERT INTO missions (user_id, mission_id, reward)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, mission_id) DO NOTHING
       RETURNING id`,
      [userId, missionId, def.reward]
    );
    if (ins.rowCount === 0) throw new HttpError(409, "already_claimed", "Mission already claimed");

    const balance = await creditInTx(client, userId, def.reward, "mission_reward", {
      mission_id: missionId,
    });
    return { reward: def.reward, balance };
  });
}

// ============================ Leaderboard ============================

export async function getLeaderboard(limit = 50) {
  const r = await query(
    `
    WITH totals AS (
      SELECT user_id, COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) AS earned
      FROM transactions GROUP BY user_id
    ),
    refs AS (
      SELECT referred_by AS user_id,
             COUNT(*) AS referral_count,
             COALESCE(SUM(CASE WHEN balance > 0 THEN 1 ELSE 0 END), 0) AS active_referral_count
      FROM users
      WHERE referred_by IS NOT NULL
      GROUP BY referred_by
    )
    SELECT u.telegram_id, u.username, u.first_name,
           COALESCE(t.earned, 0)::text AS earned,
           COALESCE(rf.referral_count, 0)::int AS referral_count,
           COALESCE(rf.active_referral_count, 0)::int AS active_referral_count
    FROM users u
    LEFT JOIN totals t ON t.user_id = u.id
    LEFT JOIN refs rf ON rf.user_id = u.id
    WHERE u.banned = false
    ORDER BY COALESCE(t.earned, 0) DESC, u.id ASC
    LIMIT $1
    `,
    [limit]
  );
  return r.rows.map((row) => ({
    telegramId: Number(row.telegram_id),
    username: row.username,
    firstName: row.first_name,
    earned: Number(row.earned),
    referralCount: Number(row.referral_count),
    activeReferralCount: Number(row.active_referral_count),
  }));
}

export async function getMyRank(userId: number) {
  const earnedRes = await query<{ earned: string }>(
    "SELECT COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0)::text AS earned FROM transactions WHERE user_id = $1",
    [userId]
  );
  const myEarned = Number(earnedRes.rows[0].earned);

  const rankRes = await query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM (
       SELECT COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) AS earned
       FROM transactions GROUP BY user_id
     ) t WHERE t.earned > $1`,
    [myEarned]
  );
  const rank = Number(rankRes.rows[0].n) + 1;

  const refRes = await query<{ n: number }>(
    "SELECT COUNT(*)::int AS n FROM users WHERE referred_by = $1",
    [userId]
  );
  const activeRes = await query<{ n: number }>(
    "SELECT COUNT(*)::int AS n FROM users WHERE referred_by = $1 AND balance > 0",
    [userId]
  );

  return {
    earned: myEarned,
    rank,
    referralCount: Number(refRes.rows[0].n),
    activeReferralCount: Number(activeRes.rows[0].n),
  };
}

// ============================ Lucky Spin ============================

// Matches the frontend wheel (value in coins) and its weighted distribution.
const SPIN_PRIZES = [10, 25, 50, 100, 150, 200, 500, 1000];

function pickSpinPrize(): number {
  const r = Math.random();
  if (r < 0.25) return 10;
  if (r < 0.5) return 25;
  if (r < 0.7) return 150;
  if (r < 0.85) return 50;
  if (r < 0.93) return 100;
  if (r < 0.97) return 200;
  if (r < 0.99) return 500;
  return 1000;
}

export async function getSpinStatus(userId: number) {
  const cooldown = env.economy.spinCooldownSeconds;
  const last = await query<{ created_at: string; reward: number }>(
    "SELECT created_at, reward FROM spins WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1",
    [userId]
  );
  if (!last.rows[0]) {
    return { available: true, retryAfterSec: 0, cooldownSeconds: cooldown, lastReward: null };
  }
  const elapsedSec = (Date.now() - new Date(last.rows[0].created_at).getTime()) / 1000;
  const available = elapsedSec >= cooldown;
  return {
    available,
    retryAfterSec: available ? 0 : Math.ceil(cooldown - elapsedSec),
    cooldownSeconds: cooldown,
    lastReward: Number(last.rows[0].reward),
  };
}

export async function spin(userId: number) {
  const cooldown = env.economy.spinCooldownSeconds;
  return withTransaction(async (client) => {
    const lock = await client.query<{ id: number }>(
      "SELECT id FROM users WHERE id = $1 FOR UPDATE",
      [userId]
    );
    if (!lock.rows[0]) throw new HttpError(404, "user_not_found");

    const last = await client.query<{ created_at: string }>(
      "SELECT created_at FROM spins WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1",
      [userId]
    );
    if (last.rows[0]) {
      const elapsedSec = (Date.now() - new Date(last.rows[0].created_at).getTime()) / 1000;
      if (elapsedSec < cooldown) {
        return { available: false, retryAfterSec: Math.ceil(cooldown - elapsedSec) };
      }
    }

    const reward = pickSpinPrize();
    await client.query("INSERT INTO spins (user_id, reward) VALUES ($1, $2)", [userId, reward]);
    const balance = await creditInTx(client, userId, reward, "spin_reward", {});

    return { available: true, reward, balance, retryAfterSec: cooldown };
  });
}

export { SPIN_PRIZES };
