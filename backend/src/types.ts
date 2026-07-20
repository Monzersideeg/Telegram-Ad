import type { Request } from "express";
import type { TelegramUser } from "./lib/telegram.js";

export interface DbUser {
  id: number;
  telegram_id: number;
  username: string | null;
  first_name: string | null;
  balance: number;
  referred_by: number | null;
  streak_days: number;
  last_active_day: string | null;
  shadow_banned: boolean;
  banned: boolean;
  created_at: string;
}

export interface AuthContext {
  tgUser: TelegramUser;
  dbUser: DbUser;
  startParam?: string;
}

export interface AuthedRequest extends Request {
  auth?: AuthContext;
}
