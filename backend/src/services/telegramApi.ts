import { env } from "../config/env.js";

// Minimal Bot API client using global fetch (Node 18+). Used by the HTTP API
// (profile photo proxy) and for notifications. The bot token stays server-side —
// file URLs that embed the token are never sent to the client.

const API_BASE = `https://api.telegram.org/bot${env.botToken}`;
const FILE_BASE = `https://api.telegram.org/file/bot${env.botToken}`;

interface TgResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
}

async function call<T>(method: string, params?: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${API_BASE}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params ?? {}),
  });
  const json = (await res.json()) as TgResponse<T>;
  if (!json.ok) {
    throw new Error(`Telegram API ${method} failed: ${json.description ?? res.status}`);
  }
  return json.result as T;
}

export interface BotInfo {
  id: number;
  username: string;
  first_name: string;
}
export const getMe = () => call<BotInfo>("getMe");

interface PhotoSize {
  file_id: string;
  width: number;
  height: number;
}
interface UserProfilePhotos {
  total_count: number;
  photos: PhotoSize[][];
}

/** Returns the file_id of the user's largest current profile photo, or null. */
export async function getProfilePhotoFileId(telegramId: number): Promise<string | null> {
  const r = await call<UserProfilePhotos>("getUserProfilePhotos", {
    user_id: telegramId,
    limit: 1,
    offset: 0,
  });
  const first = r.photos?.[0];
  if (!first || first.length === 0) return null;
  // Each photo is an array of sizes sorted smallest -> largest; take the largest.
  return first[first.length - 1].file_id;
}

interface TgFile {
  file_id: string;
  file_path?: string;
}

/** Download a file by file_id. Returns raw bytes + content type. */
export async function downloadFile(
  fileId: string
): Promise<{ buffer: Buffer; contentType: string }> {
  const f = await call<TgFile>("getFile", { file_id: fileId });
  if (!f.file_path) throw new Error("file_path missing from getFile");
  const res = await fetch(`${FILE_BASE}/${f.file_path}`);
  if (!res.ok) throw new Error(`file download failed: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get("content-type") || "image/jpeg";
  return { buffer, contentType };
}

/** Send a text message to a user (by their telegram id == chat id for DMs). */
export function sendMessage(
  chatId: number,
  text: string,
  extra?: Record<string, unknown>
): Promise<unknown> {
  return call("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    ...(extra ?? {}),
  });
}

export function setMyCommands(
  commands: { command: string; description: string }[]
): Promise<unknown> {
  return call("setMyCommands", { commands });
}
