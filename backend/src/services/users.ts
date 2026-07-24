import { query } from "../db/pool.js";
import type { TelegramUser } from "../lib/telegram.js";
import { logger } from "../lib/logger.js";
import type { DbUser } from "../types.js";

const USER_COLS = `
  id, telegram_id, username, first_name, balance, referred_by,
  streak_days, last_active_day, shadow_banned, banned, created_at
`;

/** Parse a referral telegram id out of a start_param like "ref_123456". */
function parseReferrerTelegramId(startParam?: string): number | null {
  if (!startParam) return null;
  const m = /^ref_(\d+)$/.exec(startParam);
  return m ? Number(m[1]) : null;
}

/**
 * Create the user on first launch (capturing referral), or refresh profile fields
 * on subsequent launches. Referral (referred_by) is only ever set at creation.
 */
export async function upsertUser(
  tgUser: TelegramUser,
  startParam?: string
): Promise<DbUser> {
  let referredBy: number | null = null;
  const refTgId = parseReferrerTelegramId(startParam);
  if (refTgId && refTgId !== tgUser.id) {
    const r = await query<{ id: number }>(
      "SELECT id FROM users WHERE telegram_id = $1",
      [refTgId]
    );
    if (r.rows[0]) referredBy = r.rows[0].id;
  }

  const res = await query<DbUser>(
    `
    INSERT INTO users (telegram_id, username, first_name, referred_by)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (telegram_id) DO UPDATE SET
      username    = EXCLUDED.username,
      first_name  = EXCLUDED.first_name,
      -- Backfill referral attribution if the user first opened the app without a ref
      -- link and only later arrived through one (referral is never overwritten once set).
      referred_by = COALESCE(users.referred_by, EXCLUDED.referred_by),
      updated_at  = now()
    RETURNING ${USER_COLS}
    `,
    [tgUser.id, tgUser.username ?? null, tgUser.first_name ?? null, referredBy]
  );

  return res.rows[0];
}

/**
 * Update the daily streak. Called on authenticated activity.
 *   - same UTC day as last_active_day: no change
 *   - consecutive day: streak + 1
 *   - gap: reset to 1
 */
export async function updateStreak(userId: number): Promise<DbUser | null> {
  const res = await query<DbUser>(
    `
    UPDATE users AS u SET
      streak_days = CASE
        WHEN u.last_active_day = CURRENT_DATE THEN u.streak_days
        WHEN u.last_active_day = CURRENT_DATE - INTERVAL '1 day' THEN u.streak_days + 1
        ELSE 1
      END,
      last_active_day = CURRENT_DATE,
      updated_at = now()
    WHERE u.id = $1
    RETURNING ${USER_COLS}
    `,
    [userId]
  );
  return res.rows[0] ?? null;
}

export async function getUserByDbId(id: number): Promise<DbUser | null> {
  const res = await query<DbUser>(
    `SELECT ${USER_COLS} FROM users WHERE id = $1`,
    [id]
  );
  return res.rows[0] ?? null;
}

export async function getReferralStats(userId: number) {
  // Number of invited users = users whose referred_by points here (independent of
  // whether they've generated a paid ad yet). Total commission earned = the sum of
  // this user's referral_bonus credits. (The old query cross-joined these two sets
  // and returned 0 / wrong numbers until a valued ad paid out.)
  const countRes = await query<{ n: string }>(
    "SELECT COUNT(*)::text AS n FROM users WHERE referred_by = $1",
    [userId]
  );
  const earnedRes = await query<{ n: string }>(
    `SELECT COALESCE(SUM(amount), 0)::text AS n
       FROM transactions WHERE user_id = $1 AND type = 'referral_bonus'`,
    [userId]
  );

  // Real, per-referee numbers: each invited user, what they've earned, and the
  // commission this referrer actually received from them (via referral_bonus meta).
  const friends = await query<{
    id: number;
    username: string | null;
    first_name: string | null;
    created_at: string;
    total_earned: string;
    commission: string;
  }>(
    `
    SELECT u.id, u.username, u.first_name, u.created_at,
           COALESCE((SELECT SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END)
                       FROM transactions WHERE user_id = u.id), 0)::text AS total_earned,
           COALESCE((SELECT SUM(amount) FROM transactions
                       WHERE user_id = $1 AND type = 'referral_bonus'
                         AND meta->>'from_user' = u.id::text), 0)::text AS commission
      FROM users u
     WHERE u.referred_by = $1
     ORDER BY u.created_at DESC
     LIMIT 100
    `,
    [userId]
  );

  return {
    count: Number(countRes.rows[0]?.n ?? 0),
    earned: Number(earnedRes.rows[0]?.n ?? 0),
    friends: friends.rows.map((r) => ({
      id: Number(r.id),
      username: r.username,
      firstName: r.first_name,
      createdAt: r.created_at,
      totalEarned: Number(r.total_earned),
      commission: Number(r.commission),
    })),
  };
}

export { logger };
