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
      username   = EXCLUDED.username,
      first_name = EXCLUDED.first_name,
      updated_at = now()
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
  const res = await query<{ count: string; earned: string }>(
    `
    SELECT
      COUNT(*)::text AS count,
      COALESCE(SUM(t.amount), 0)::text AS earned
    FROM users u
    JOIN transactions t ON t.user_id = $1 AND t.type = 'referral_bonus'
    WHERE u.referred_by = $1
    `,
    [userId]
  );
  const list = await query<{ username: string | null; first_name: string | null; created_at: string }>(
    `SELECT username, first_name, created_at FROM users WHERE referred_by = $1
     ORDER BY created_at DESC LIMIT 50`,
    [userId]
  );
  return {
    count: Number(res.rows[0]?.count ?? 0),
    earned: Number(res.rows[0]?.earned ?? 0),
    recent: list.rows,
  };
}

export { logger };
