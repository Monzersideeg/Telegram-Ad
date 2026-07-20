import type { NextFunction, Response } from "express";
import { env } from "../config/env.js";
import { verifyInitData } from "../lib/telegram.js";
import { upsertUser, updateStreak } from "../services/users.js";
import { HttpError } from "./error.js";
import type { AuthedRequest } from "../types.js";

/** Extract raw initData from the request (header preferred, query fallback for dev). */
function extractInitData(req: AuthedRequest): string {
  return (
    (req.header("x-telegram-init-data") as string) ||
    (req.query.initData as string) ||
    ""
  );
}

/**
 * Core auth middleware. Verifies Telegram initData, upserts the user (capturing
 * the referral from start_param on first launch), updates the daily streak, and
 * attaches req.auth. Rejects banned users.
 */
export async function requireAuth(
  req: AuthedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const initData = extractInitData(req);
    const result = verifyInitData(initData, env.botToken);
    if (!result.ok || !result.user) {
      throw new HttpError(401, "invalid_init_data", result.error);
    }

    const dbUser = await upsertUser(result.user, result.startParam);
    if (dbUser.banned) {
      throw new HttpError(403, "banned", "Account is banned");
    }

    // Refresh streak on activity (fire-and-forget correctness is fine here).
    const withStreak = await updateStreak(dbUser.id);

    req.auth = {
      tgUser: result.user,
      dbUser: withStreak ?? dbUser,
      startParam: result.startParam,
    };
    next();
  } catch (err) {
    next(err);
  }
}

/** Allow access only to configured admin telegram ids. */
export function requireAdmin(req: AuthedRequest, _res: Response, next: NextFunction): void {
  const tgId = req.auth?.tgUser.id;
  if (tgId === undefined || !env.adminTelegramIds.includes(tgId)) {
    next(new HttpError(403, "forbidden", "Admin only"));
    return;
  }
  next();
}
