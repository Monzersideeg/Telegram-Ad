import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler, HttpError } from "../middleware/error.js";
import { getProfilePhotoFileId, downloadFile } from "../services/telegramApi.js";
import type { Response } from "express";
import type { AuthedRequest } from "../types.js";

export const usersRouter = Router();

// Small in-memory photo cache to avoid hammering the Telegram API.
const cache = new Map<number, { buffer: Buffer; contentType: string; at: number }>();
const TTL_MS = 60 * 60 * 1000; // 1 hour

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
      res.setHeader("Content-Type", hit.contentType);
      res.setHeader("Cache-Control", "private, max-age=3600");
      res.send(hit.buffer);
      return;
    }

    const fileId = await getProfilePhotoFileId(tgId);
    if (!fileId) throw new HttpError(404, "no_photo", "User has no profile photo");

    const { buffer, contentType } = await downloadFile(fileId);
    cache.set(tgId, { buffer, contentType, at: now });

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.send(buffer);
  })
);
