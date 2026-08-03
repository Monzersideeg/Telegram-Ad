import { Router, type NextFunction, type Request, type Response } from "express";
import crypto from "node:crypto";
import { env } from "../config/env.js";
import { redis } from "../lib/redis.js";
import { asyncHandler, HttpError } from "../middleware/error.js";
import {
  listPendingWithdrawals,
  reviewWithdrawal,
  markWithdrawalPaid,
} from "../services/withdrawals.js";
import { credit } from "../services/ledger.js";
import { sendMessage } from "../services/telegramApi.js";
import { query } from "../db/pool.js";

export const adminWebRouter = Router();

interface AdminSession {
  email: string;
  csrf: string;
  iat: number;
  exp: number;
  role: "admin";
}

interface AdminRequest extends Request {
  adminSession?: AdminSession;
}

function b64urlJson(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj)).toString("base64url");
}

function sign(body: string): string {
  return crypto.createHmac("sha256", env.adminWeb.sessionSecret).update(body).digest("base64url");
}

function createSession(email: string): { token: string; session: AdminSession } {
  const now = Math.floor(Date.now() / 1000);
  const session: AdminSession = {
    email,
    role: "admin",
    csrf: crypto.randomBytes(24).toString("base64url"),
    iat: now,
    exp: now + env.adminWeb.sessionMaxAgeSeconds,
  };
  const body = b64urlJson(session);
  return { token: `${body}.${sign(body)}`, session };
}

function verifySessionToken(token: string): AdminSession | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = sign(body);
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const session = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as AdminSession;
    if (session.role !== "admin" || !session.email || !session.csrf || !session.exp) return null;
    if (session.exp < Math.floor(Date.now() / 1000)) return null;
    return session;
  } catch {
    return null;
  }
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

async function verifyPassword(password: string): Promise<boolean> {
  if (!env.adminWeb.email || (!env.adminWeb.passwordHash && !env.adminWeb.password)) {
    throw new HttpError(503, "admin_not_configured", "Admin email/password is not configured.");
  }

  if (env.adminWeb.passwordHash) {
    const parts = env.adminWeb.passwordHash.split("$");
    if (parts.length !== 3 || parts[0] !== "scrypt") return false;
    const [, salt, expectedHex] = parts;
    const derived = await new Promise<Buffer>((resolve, reject) => {
      crypto.scrypt(password, salt, 64, (err, key) => (err ? reject(err) : resolve(key)));
    });
    return timingSafeStringEqual(derived.toString("hex"), expectedHex);
  }

  // Dev-only fallback: useful locally, intentionally discouraged in production.
  return timingSafeStringEqual(password, env.adminWeb.password);
}

async function bumpLoginFailures(req: Request, email: string): Promise<void> {
  try {
    const key = `admin:login:${req.ip}:${email.toLowerCase()}`;
    const n = await redis.incr(key);
    if (n === 1) await redis.expire(key, 15 * 60);
  } catch {
    /* Redis unavailable: skip persistent rate accounting. */
  }
}

async function assertLoginAllowed(req: Request, email: string): Promise<void> {
  try {
    const key = `admin:login:${req.ip}:${email.toLowerCase()}`;
    const n = Number(await redis.get(key)) || 0;
    if (n >= 8) throw new HttpError(429, "too_many_attempts", "Too many login attempts. Try again later.");
  } catch (err) {
    if (err instanceof HttpError) throw err;
  }
}

function cookieOptions(maxAgeMs?: number) {
  const prod = env.nodeEnv === "production";
  return {
    httpOnly: true,
    secure: prod,
    sameSite: prod ? ("none" as const) : ("lax" as const),
    path: "/",
    maxAge: maxAgeMs,
  };
}

function clearAdminCookie(res: Response): void {
  res.clearCookie(env.adminWeb.cookieName, cookieOptions(0));
}

function adminActorId(): number {
  // withdrawals.reviewed_by is a BIGINT column from the old Telegram-admin system.
  // For the web admin, use configured actor id when available, otherwise 0.
  return env.adminTelegramIds[0] || 0;
}

function isTrustedOrigin(req: Request): boolean {
  const origin = req.header("origin");
  if (!origin) return true; // same-origin / non-browser tools
  const allowed = new Set([
    env.frontendUrl,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ]);
  return allowed.has(origin);
}

function requireAdminSession(req: AdminRequest, _res: Response, next: NextFunction): void {
  try {
    const token = String(req.cookies?.[env.adminWeb.cookieName] || "");
    const session = verifySessionToken(token);
    if (!session) throw new HttpError(401, "admin_unauthorized", "Admin login required");

    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      if (!isTrustedOrigin(req)) throw new HttpError(403, "bad_origin", "Invalid request origin");
      const csrf = req.header("x-admin-csrf") || "";
      if (!timingSafeStringEqual(csrf, session.csrf)) {
        throw new HttpError(403, "bad_csrf", "Invalid CSRF token");
      }
    }

    req.adminSession = session;
    next();
  } catch (err) {
    next(err);
  }
}

// ---------- admin auth (email/password + httpOnly signed cookie) ----------

adminWebRouter.post(
  "/auth/login",
  asyncHandler(async (req: Request, res: Response) => {
    if (!isTrustedOrigin(req)) throw new HttpError(403, "bad_origin", "Invalid request origin");

    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    if (!email || !password) throw new HttpError(400, "missing_credentials", "Email and password are required");

    await assertLoginAllowed(req, email);

    const emailOk = timingSafeStringEqual(email, env.adminWeb.email.trim().toLowerCase());
    const passOk = emailOk ? await verifyPassword(password) : false;
    if (!emailOk || !passOk) {
      await bumpLoginFailures(req, email);
      throw new HttpError(401, "invalid_credentials", "Invalid email or password");
    }

    const { token, session } = createSession(email);
    res.cookie(env.adminWeb.cookieName, token, cookieOptions(env.adminWeb.sessionMaxAgeSeconds * 1000));
    res.json({ ok: true, admin: { email: session.email }, csrf: session.csrf, expiresAt: session.exp });
  })
);

adminWebRouter.post(
  "/auth/logout",
  (req: AdminRequest, res: Response, next: NextFunction) => {
    // Logout should work even if the token has expired; CSRF is checked only when a
    // valid session exists so users are never trapped on the login screen.
    const token = String(req.cookies?.[env.adminWeb.cookieName] || "");
    const session = token ? verifySessionToken(token) : null;
    if (session && !isTrustedOrigin(req)) {
      next(new HttpError(403, "bad_origin", "Invalid request origin"));
      return;
    }
    clearAdminCookie(res);
    res.json({ ok: true });
  }
);

adminWebRouter.get(
  "/auth/me",
  requireAdminSession,
  asyncHandler(async (req: AdminRequest, res: Response) => {
    res.json({ admin: { email: req.adminSession!.email }, csrf: req.adminSession!.csrf, expiresAt: req.adminSession!.exp });
  })
);

// Everything below is protected by the web admin session.
adminWebRouter.use(requireAdminSession);

/** GET /api/web-admin/stats — high-level dashboard numbers. */
adminWebRouter.get(
  "/stats",
  asyncHandler(async (_req, res) => {
    const [users, coins, pending, adsToday, flagged, withdrawals, paid, txs] = await Promise.all([
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
      query<{ n: string }>("SELECT COUNT(*)::text AS n FROM withdrawals"),
      query<{ n: string }>(
        `SELECT COALESCE(SUM(amount), 0)::text AS n FROM withdrawals WHERE status IN ('approved', 'paid')`
      ),
      query<{ n: string }>("SELECT COUNT(*)::text AS n FROM transactions"),
    ]);
    res.json({
      users: Number(users.rows[0].n),
      totalCoins: Number(coins.rows[0].n),
      pendingWithdrawals: Number(pending.rows[0].n),
      pendingWithdrawalCoins: Number(pending.rows[0].total),
      confirmedAdsToday: Number(adsToday.rows[0].n),
      flaggedUsers: Number(flagged.rows[0].n),
      totalWithdrawals: Number(withdrawals.rows[0].n),
      paidWithdrawalCoins: Number(paid.rows[0].n),
      transactions: Number(txs.rows[0].n),
      coinsPerUsd: env.economy.coinsPerUsd,
      minWithdrawal: env.economy.minWithdrawal,
      rewardPerAd: env.economy.rewardPerAd,
      maxAdsPerDay: env.economy.maxAdsPerDay,
      adsgramEnabled: !!env.adsgram.rewardBlockId,
    });
  })
);

/** GET /api/web-admin/withdrawals — pending queue with user context. */
adminWebRouter.get(
  "/withdrawals",
  asyncHandler(async (_req, res) => {
    const items = await listPendingWithdrawals();
    res.json({ items });
  })
);

/** POST /api/web-admin/withdrawals/:id/review  { action: 'approve'|'reject', reason? } */
adminWebRouter.post(
  "/withdrawals/:id/review",
  asyncHandler(async (req: AdminRequest, res) => {
    const id = Number(req.params.id);
    const { action, reason } = req.body ?? {};
    if (action !== "approve" && action !== "reject") {
      throw new HttpError(400, "invalid_action");
    }
    const w = await reviewWithdrawal(id, action, adminActorId(), reason);
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

/** POST /api/web-admin/withdrawals/:id/paid — mark an approved withdrawal as paid. */
adminWebRouter.post(
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

/** GET /api/web-admin/users/:telegramId — look up a user before adjusting/flagging. */
adminWebRouter.get(
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

/** POST /api/web-admin/users/:telegramId/adjust  { amount, reason } — manual balance change. */
adminWebRouter.post(
  "/users/:telegramId/adjust",
  asyncHandler(async (req: AdminRequest, res) => {
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
      admin_email: req.adminSession!.email,
    });
    res.json({ balance });
  })
);

/** POST /api/web-admin/users/:telegramId/flags  { banned?, shadow_banned? } */
adminWebRouter.post(
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
