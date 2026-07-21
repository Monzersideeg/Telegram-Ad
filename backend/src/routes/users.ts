import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler, HttpError } from "../middleware/error.js";
import { getProfilePhotoFileId, downloadFile } from "../services/telegramApi.js";
import { query } from "../db/pool.js";
import type { Response } from "express";
import type { AuthedRequest } from "../types.js";

export const usersRouter = Router();

// Small in-memory photo cache to avoid hammering the Telegram API.
const cache = new Map<number, { buffer: Buffer; contentType: string; at: number }>();
const TTL_MS = 60 * 60 * 1000; // 1 hour
const DB_PHOTO_TTL_MS = 24 * 60 * 60 * 1000; // 24h persisted photo freshness

// Self-migration: the photo columns may not exist on a DB that predates them, and the
// serverless build doesn't run migrate.ts on boot, so we ADD them idempotently on first
// use (once per process). Failures are swallowed so a permission issue can't break /me.
let columnsEnsured: Promise<void> | null = null;
function ensurePhotoColumns(): Promise<void> {
  if (!columnsEnsured) {
    columnsEnsured = query(
      `ALTER TABLE users
         ADD COLUMN IF NOT EXISTS photo_data BYTEA,
         ADD COLUMN IF NOT EXISTS photo_content_type TEXT,
         ADD COLUMN IF NOT EXISTS photo_fetched_at TIMESTAMPTZ`
    )
      .then(() => undefined)
      .catch(() => undefined);
  }
  return columnsEnsured;
}

function sendPhoto(res: Response, buffer: Buffer, contentType: string): void {
  res.setHeader("Content-Type", contentType);
  res.setHeader("Cache-Control", "private, max-age=3600");
  res.send(buffer);
}

/**
 * GET /api/users/photo
 * Returns the authenticated user's Telegram profile photo, fetched server-side via
 * the Bot API (getUserProfilePhotos -> getFile -> download) and proxied to the
 * client. The token-bearing file URL never reaches the browser. 404 if no photo.
 */
usersRouter.get(
  "/photo",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res: Response) => {
    const tgId = req.auth!.tgUser.id;
    const now = Date.now();

    const hit = cache.get(tgId);
    if (hit && now - hit.at < TTL_MS) {
      return sendPhoto(res, hit.buffer, hit.contentType);
    }

    // 1) Persisted photo in the DB (saved from a previous Telegram fetch).
    try {
      await ensurePhotoColumns();
      const db = await query<{
        photo_data: Buffer | null;
        photo_content_type: string | null;
        photo_fetched_at: string | null;
      }>(
        "SELECT photo_data, photo_content_type, photo_fetched_at FROM users WHERE telegram_id = $1",
        [tgId]
      );
      const row = db.rows[0];
      if (
        row &&
        row.photo_data &&
        row.photo_fetched_at &&
        now - new Date(row.photo_fetched_at).getTime() < DB_PHOTO_TTL_MS
      ) {
        const buf = Buffer.isBuffer(row.photo_data)
          ? row.photo_data
          : Buffer.from(row.photo_data as unknown as Uint8Array);
        const ct = row.photo_content_type || "image/jpeg";
        cache.set(tgId, { buffer: buf, contentType: ct, at: now });
        return sendPhoto(res, buf, ct);
      }
    } catch {
      /* DB read/ensure failed — fall through to a live Telegram fetch */
    }

    // 2) Live fetch from the Telegram Bot API, then persist + cache. Any Bot API
    //    error (unknown/unresolvable user, rate limit, network) is treated as
    //    "no photo" (404) so this endpoint never 500s (the client falls back to initials).
    try {
      const fileId = await getProfilePhotoFileId(tgId);
      if (!fileId) throw new HttpError(404, "no_photo", "User has no profile photo");

      const { buffer, contentType } = await downloadFile(fileId);
      cache.set(tgId, { buffer, contentType, at: now });

      // Save to the database (fire-and-forget) so subsequent loads skip the Bot API.
      query(
        "UPDATE users SET photo_data = $1, photo_content_type = $2, photo_fetched_at = now() WHERE telegram_id = $3",
        [buffer, contentType, tgId]
      ).catch(() => undefined);

      return sendPhoto(res, buffer, contentType);
    } catch (err) {
      if (err instanceof HttpError) throw err;
      throw new HttpError(404, "no_photo", "Profile photo unavailable");
    }
  })
);
