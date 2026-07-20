import { query, withTransaction } from "../db/pool.js";
import { env } from "../config/env.js";
import { creditInTx } from "./ledger.js";
import { HttpError } from "../middleware/error.js";

export interface Withdrawal {
  id: number;
  user_id: number;
  amount: number;
  method: string;
  destination: string;
  status: string;
  reject_reason: string | null;
  created_at: string;
  updated_at: string;
}

const W_COLS = `id, user_id, amount::text, method, destination, status, reject_reason, created_at, updated_at`;

function mapW(row: Record<string, unknown>): Withdrawal {
  return { ...row, amount: Number(row.amount) } as unknown as Withdrawal;
}

/**
 * Request a withdrawal. Uses the escrow pattern: the balance is deducted
 * immediately (as a negative 'withdrawal' ledger entry) so it cannot be
 * double-spent while the request is pending. On rejection the amount is refunded.
 */
export async function requestWithdrawal(
  userId: number,
  amount: number,
  method: string,
  destination: string
): Promise<Withdrawal> {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new HttpError(400, "invalid_amount", "Amount must be a positive integer");
  }
  if (amount < env.economy.minWithdrawal) {
    throw new HttpError(400, "below_minimum", `Minimum withdrawal is ${env.economy.minWithdrawal} coins`);
  }
  if (!method?.trim() || !destination?.trim()) {
    throw new HttpError(400, "invalid_destination", "Method and destination are required");
  }

  return withTransaction(async (client) => {
    const u = await client.query<{ balance: string; shadow_banned: boolean; banned: boolean }>(
      "SELECT balance, shadow_banned, banned FROM users WHERE id = $1 FOR UPDATE",
      [userId]
    );
    if (!u.rows[0]) throw new HttpError(404, "user_not_found");
    if (u.rows[0].banned) throw new HttpError(403, "banned");

    const balance = Number(u.rows[0].balance);
    if (amount > balance) {
      throw new HttpError(400, "insufficient_balance", "Amount exceeds balance");
    }

    // Escrow: deduct now.
    await creditInTx(client, userId, -amount, "withdrawal", { method, destination });

    const w = await client.query(
      `INSERT INTO withdrawals (user_id, amount, method, destination, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING ${W_COLS}`,
      [userId, amount, method.trim(), destination.trim()]
    );
    return mapW(w.rows[0]);
  });
}

export async function listWithdrawals(userId: number): Promise<Withdrawal[]> {
  const r = await query(
    `SELECT ${W_COLS} FROM withdrawals WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
    [userId]
  );
  return r.rows.map(mapW);
}

export async function listPendingWithdrawals(): Promise<
  (Withdrawal & { telegram_id: number; username: string | null; shadow_banned: boolean })[]
> {
  const r = await query(
    `SELECT w.id, w.user_id, w.amount::text, w.method, w.destination, w.status,
            w.reject_reason, w.created_at, w.updated_at,
            u.telegram_id, u.username, u.shadow_banned
       FROM withdrawals w JOIN users u ON u.id = w.user_id
      WHERE w.status = 'pending'
      ORDER BY w.created_at ASC`
  );
  return r.rows.map((row) => ({
    ...mapW(row),
    telegram_id: Number(row.telegram_id),
    username: row.username as string | null,
    shadow_banned: row.shadow_banned as boolean,
  }));
}

/** Admin: approve or reject a pending withdrawal. Rejection refunds the escrow. */
export async function reviewWithdrawal(
  withdrawalId: number,
  action: "approve" | "reject",
  adminTelegramId: number,
  reason?: string
): Promise<Withdrawal> {
  return withTransaction(async (client) => {
    const w = await client.query(
      `SELECT ${W_COLS} FROM withdrawals WHERE id = $1 FOR UPDATE`,
      [withdrawalId]
    );
    if (!w.rows[0]) throw new HttpError(404, "not_found");
    const withdrawal = mapW(w.rows[0]);
    if (withdrawal.status !== "pending") {
      throw new HttpError(400, "already_reviewed", `Withdrawal is ${withdrawal.status}`);
    }

    if (action === "reject") {
      // Refund escrowed amount.
      await creditInTx(client, withdrawal.user_id, withdrawal.amount, "withdrawal_refund", {
        withdrawal_id: withdrawalId,
        reason: reason ?? null,
      });
      const upd = await client.query(
        `UPDATE withdrawals
            SET status = 'rejected', reject_reason = $2, reviewed_by = $3, updated_at = now()
          WHERE id = $1 RETURNING ${W_COLS}`,
        [withdrawalId, reason ?? null, adminTelegramId]
      );
      return mapW(upd.rows[0]);
    }

    const upd = await client.query(
      `UPDATE withdrawals
          SET status = 'approved', reviewed_by = $2, updated_at = now()
        WHERE id = $1 RETURNING ${W_COLS}`,
      [withdrawalId, adminTelegramId]
    );
    return mapW(upd.rows[0]);
  });
}

export async function markWithdrawalPaid(withdrawalId: number): Promise<Withdrawal> {
  const r = await query(
    `UPDATE withdrawals SET status = 'paid', updated_at = now()
      WHERE id = $1 AND status = 'approved' RETURNING ${W_COLS}`,
    [withdrawalId]
  );
  if (!r.rows[0]) throw new HttpError(400, "not_approved", "Withdrawal is not in approved state");
  return mapW(r.rows[0]);
}
