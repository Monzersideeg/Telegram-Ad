import type { PoolClient } from "pg";
import { query, withTransaction } from "../db/pool.js";
import { env } from "../config/env.js";
import { addReferralBonus } from "../lib/redis.js";
import { HttpError } from "../middleware/error.js";
import { logger } from "../lib/logger.js";

/**
 * Credit/debit a user's balance atomically. MUST be called within a transaction
 * where the caller controls commit/rollback. Locks the user row (FOR UPDATE) to
 * serialize concurrent balance changes, updates the cached balance, and appends
 * an immutable ledger row. Returns the new balance.
 */
export async function creditInTx(
  client: PoolClient,
  userId: number,
  amount: number,
  type: string,
  meta?: Record<string, unknown>
): Promise<number> {
  const lock = await client.query<{ balance: string }>(
    "SELECT balance FROM users WHERE id = $1 FOR UPDATE",
    [userId]
  );
  if (!lock.rows[0]) throw new HttpError(404, "user_not_found");

  const newBalance = Number(lock.rows[0].balance) + amount;
  if (newBalance < 0) throw new HttpError(400, "insufficient_balance");

  await client.query(
    "UPDATE users SET balance = $2, updated_at = now() WHERE id = $1",
    [userId, newBalance]
  );
  await client.query(
    `INSERT INTO transactions (user_id, type, amount, balance_after, meta)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, type, amount, newBalance, meta ? JSON.stringify(meta) : null]
  );
  return newBalance;
}

/** Standalone credit that manages its own transaction (admin adjustments, etc.). */
export async function credit(
  userId: number,
  amount: number,
  type: string,
  meta?: Record<string, unknown>
): Promise<number> {
  return withTransaction((client) => creditInTx(client, userId, amount, type, meta));
}

export type ConfirmResult =
  | { result: "not_found" }
  | { result: "duplicate" }
  | { result: "rejected" }
  | { result: "unrewarded"; userId: number }
  | { result: "confirmed"; userId: number; reward: number; balance: number; referralGranted: number };

/**
 * Settle an ad view from a verified S2S postback. This is the ONLY place ad coins
 * are minted.
 *
 * Monetag fires postbacks for both paid ("valued") and unpaid ("non_valued" /
 * "not_valued") events. We credit the user ONLY for valued events — paying out for
 * unpaid traffic would lose money. The coin amount is the configured REWARD_PER_AD
 * (we never trust network-supplied amounts). Idempotent and safe against postback
 * ordering; the ad_view row is locked (FOR UPDATE) so concurrent postbacks
 * serialize and a late "valued" can upgrade an earlier "unrewarded" exactly once:
 *   valued     + pending/unrewarded -> credit, status 'confirmed'
 *   valued     + confirmed          -> duplicate (already paid)
 *   not_valued + pending            -> status 'unrewarded', no credit
 *   not_valued + unrewarded/confirmed -> no-op
 */
export async function confirmAdView(params: {
  sessionId: string;
  rewarded: boolean; // true only when reward_event_type === 'valued'
  estimatedPrice?: number | null;
  eventType?: string | null; // impression / click (for logging/analytics)
  ip?: string | null;
}): Promise<ConfirmResult> {
  const { sessionId, rewarded, estimatedPrice, eventType, ip } = params;

  return withTransaction(async (client): Promise<ConfirmResult> => {
    const avRes = await client.query<{ id: number; user_id: number; status: string }>(
      "SELECT id, user_id, status FROM ad_views WHERE session_id = $1 FOR UPDATE",
      [sessionId]
    );
    const av = avRes.rows[0];
    if (!av) return { result: "not_found" };
    if (av.status === "confirmed") return { result: "duplicate" };
    if (av.status === "rejected") return { result: "rejected" };

    const userId = Number(av.user_id);

    // Unpaid event: record the view but do NOT credit. A later valued postback can
    // still upgrade this session to 'confirmed'.
    if (!rewarded) {
      if (av.status === "pending") {
        await client.query(
          `UPDATE ad_views
             SET status = 'unrewarded', reward_amount = 0, estimated_price = $2,
                 ip = COALESCE($3, ip), confirmed_at = now()
           WHERE id = $1`,
          [av.id, estimatedPrice ?? null, ip ?? null]
        );
      }
      return { result: "unrewarded", userId };
    }

    // Paid (valued) event: credit the fixed reward.
    const reward = env.economy.rewardPerAd;
    const balance = await creditInTx(client, userId, reward, "ad_reward", {
      session_id: sessionId,
      event_type: eventType ?? null,
      estimated_price: estimatedPrice ?? null,
    });

    await client.query(
      `UPDATE ad_views
         SET status = 'confirmed', reward_amount = $2, estimated_price = $3,
             ip = COALESCE($4, ip), confirmed_at = now()
       WHERE id = $1`,
      [av.id, reward, estimatedPrice ?? null, ip ?? null]
    );

    // Referral bonus on paid rewards only, daily-capped per referrer.
    let referralGranted = 0;
    const uRes = await client.query<{ referred_by: number | null; shadow_banned: boolean }>(
      "SELECT referred_by, shadow_banned FROM users WHERE id = $1",
      [userId]
    );
    const row = uRes.rows[0];
    if (row && row.referred_by && Number(row.referred_by) !== userId && !row.shadow_banned) {
      const referrerId = Number(row.referred_by);
      const bonus = Math.floor((reward * env.economy.referralBonusPct) / 100);
      if (bonus > 0) {
        const { granted } = await addReferralBonus(
          referrerId,
          bonus,
          env.economy.referralDailyCap
        );
        if (granted > 0) {
          await creditInTx(client, referrerId, granted, "referral_bonus", {
            from_user: userId,
            session_id: sessionId,
          });
          await client.query(
            `INSERT INTO referral_daily (referrer_id, day, earned)
             VALUES ($1, CURRENT_DATE, $2)
             ON CONFLICT (referrer_id, day)
             DO UPDATE SET earned = referral_daily.earned + EXCLUDED.earned`,
            [referrerId, granted]
          );
          referralGranted = granted;
        }
      }
    }

    return { result: "confirmed", userId, reward, balance, referralGranted };
  });
}

export async function getBalance(userId: number): Promise<number> {
  const r = await query<{ balance: string }>(
    "SELECT balance FROM users WHERE id = $1",
    [userId]
  );
  return Number(r.rows[0]?.balance ?? 0);
}

export async function getTransactions(userId: number, limit = 50, offset = 0) {
  const r = await query<{
    id: number;
    type: string;
    amount: string;
    balance_after: string;
    meta: unknown;
    created_at: string;
  }>(
    `SELECT id, type, amount::text, balance_after::text, meta, created_at
       FROM transactions WHERE user_id = $1
      ORDER BY created_at DESC, id DESC
      LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );
  return r.rows.map((t) => ({
    ...t,
    amount: Number(t.amount),
    balance_after: Number(t.balance_after),
  }));
}
