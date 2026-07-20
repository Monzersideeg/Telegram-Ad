import { Router } from "express";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { asyncHandler, HttpError } from "../middleware/error.js";
import {
  listPendingWithdrawals,
  reviewWithdrawal,
  markWithdrawalPaid,
} from "../services/withdrawals.js";
import { credit } from "../services/ledger.js";
import { sendMessage } from "../services/telegramApi.js";
import { query } from "../db/pool.js";
import type { AuthedRequest } from "../types.js";

export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);

/** GET /api/admin/stats — high-level dashboard numbers. */
adminRouter.get(
  "/stats",
  asyncHandler(async (_req, res) => {
    const [users, coins, pending, adsToday, flagged] = await Promise.all([
      query<{ n: string }>("SELECT COUNT(*)::text AS n FROM users"),
      query<{ n: string }>("SELECT COALESCE(SUM(balance), 0)::text AS n FROM users"),
      query<{ n: string; total: string }>(
        `SELECT COUNT(*)::text AS n, COALESCE(SUM(amount), 0)::text AS total
           FROM withdrawals WHERE status = 'pending'`
      ),
      query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM ad_views
          WHERE status = 'confirmed' AND confirmed_at >= CURRENT_DATE`
      ),
      query<{ n: string }>(
        "SELECT COUNT(*)::text AS n FROM users WHERE shadow_banned OR banned"
      ),
    ]);
    res.json({
      users: Number(users.rows[0].n),
      totalCoins: Number(coins.rows[0].n),
      pendingWithdrawals: Number(pending.rows[0].n),
      pendingWithdrawalCoins: Number(pending.rows[0].total),
      confirmedAdsToday: Number(adsToday.rows[0].n),
      flaggedUsers: Number(flagged.rows[0].n),
    });
  })
);

/** GET /api/admin/withdrawals — pending queue with user context. */
adminRouter.get(
  "/withdrawals",
  asyncHandler(async (_req, res) => {
    const items = await listPendingWithdrawals();
    res.json({ items });
  })
);

/** POST /api/admin/withdrawals/:id/review  { action: 'approve'|'reject', reason? } */
adminRouter.post(
  "/withdrawals/:id/review",
  asyncHandler(async (req: AuthedRequest, res) => {
    const id = Number(req.params.id);
    const { action, reason } = req.body ?? {};
    if (action !== "approve" && action !== "reject") {
      throw new HttpError(400, "invalid_action");
    }
    const w = await reviewWithdrawal(id, action, req.auth!.tgUser.id, reason);
    // Notify the withdrawal owner in Telegram.
    const owner = await query<{ telegram_id: number }>(
      "SELECT telegram_id FROM users WHERE id = $1",
      [w.user_id]
    );
    if (owner.rows[0]) {
      const msg =
        action === "approve"
          ? `✅ <b>Withdrawal #${w.id} approved</b>\nYour ${w.amount} coins via ${w.method} are being processed.`
          : `❌ <b>Withdrawal #${w.id} rejected</b>\nYour ${w.amount} coins have been refunded.${reason ? `\nReason: ${reason}` : ""}`;
      sendMessage(Number(owner.rows[0].telegram_id), msg).catch(() => undefined);
    }
    res.json({ withdrawal: w });
  })
);

/** POST /api/admin/withdrawals/:id/paid — mark an approved withdrawal as paid. */
adminRouter.post(
  "/withdrawals/:id/paid",
  asyncHandler(async (req, res) => {
    const w = await markWithdrawalPaid(Number(req.params.id));
    const owner = await query<{ telegram_id: number }>(
      "SELECT telegram_id FROM users WHERE id = $1",
      [w.user_id]
    );
    if (owner.rows[0]) {
      sendMessage(
        Number(owner.rows[0].telegram_id),
        `🎉 <b>Withdrawal #${w.id} paid!</b>\n${w.amount} coins sent via ${w.method}.`
      ).catch(() => undefined);
    }
    res.json({ withdrawal: w });
  })
);

/** GET /api/admin/users/:telegramId — look up a user before adjusting/flagging. */
adminRouter.get(
  "/users/:telegramId",
  asyncHandler(async (req, res) => {
    const r = await query(
      `SELECT id, telegram_id, username, first_name, balance::text, referred_by,
              streak_days, shadow_banned, banned, created_at
         FROM users WHERE telegram_id = $1`,
      [Number(req.params.telegramId)]
    );
    if (!r.rows[0]) throw new HttpError(404, "user_not_found");
    const u = r.rows[0];
    res.json({
      user: {
        ...u,
        telegram_id: Number(u.telegram_id),
        balance: Number(u.balance),
        referred_by: u.referred_by ? Number(u.referred_by) : null,
      },
    });
  })
);

/** POST /api/admin/users/:telegramId/adjust  { amount, reason } — manual balance change. */
adminRouter.post(
  "/users/:telegramId/adjust",
  asyncHandler(async (req: AuthedRequest, res) => {
    const amount = Number(req.body?.amount);
    const reason = String(req.body?.reason ?? "manual adjustment");
    if (!Number.isInteger(amount) || amount === 0) {
      throw new HttpError(400, "invalid_amount");
    }
    const u = await query<{ id: number }>(
      "SELECT id FROM users WHERE telegram_id = $1",
      [Number(req.params.telegramId)]
    );
    if (!u.rows[0]) throw new HttpError(404, "user_not_found");
    const balance = await credit(u.rows[0].id, amount, "admin_adjust", {
      reason,
      admin: req.auth!.tgUser.id,
    });
    res.json({ balance });
  })
);

/** POST /api/admin/users/:telegramId/flags  { banned?, shadow_banned? } */
adminRouter.post(
  "/users/:telegramId/flags",
  asyncHandler(async (req, res) => {
    const { banned, shadow_banned } = req.body ?? {};
    const r = await query(
      `UPDATE users SET
         banned = COALESCE($2, banned),
         shadow_banned = COALESCE($3, shadow_banned),
         updated_at = now()
       WHERE telegram_id = $1
       RETURNING id, telegram_id, banned, shadow_banned`,
      [
        Number(req.params.telegramId),
        typeof banned === "boolean" ? banned : null,
        typeof shadow_banned === "boolean" ? shadow_banned : null,
      ]
    );
    if (!r.rows[0]) throw new HttpError(404, "user_not_found");
    res.json({ user: r.rows[0] });
  })
);
