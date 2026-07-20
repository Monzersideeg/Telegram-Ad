import crypto from "node:crypto";

export interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

export interface InitDataResult {
  ok: boolean;
  error?: string;
  user?: TelegramUser;
  startParam?: string;
  authDate?: number;
}

/**
 * Verify Telegram WebApp initData (HMAC-SHA256).
 *
 * Algorithm (per Telegram docs):
 *   1. Parse initData as an application/x-www-form-urlencoded string.
 *   2. Remove `hash`; keep the rest.
 *   3. Sort remaining pairs alphabetically by key, join as `key=value\n...`.
 *   4. secret_key = HMAC_SHA256(key="WebAppData", data=bot_token)
 *   5. expected   = HMAC_SHA256(key=secret_key, data=data_check_string) as hex
 *   6. Constant-time compare expected === hash.
 *   7. Reject if auth_date is older than maxAgeSec (default 24h).
 */
export function verifyInitData(
  initData: string,
  botToken: string,
  maxAgeSec = 86_400
): InitDataResult {
  if (!initData) return { ok: false, error: "empty initData" };

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return { ok: false, error: "missing hash" };

  params.delete("hash");

  const pairs = [...params.entries()].sort((a, b) =>
    a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0
  );
  const dataCheckString = pairs.map(([k, v]) => `${k}=${v}`).join("\n");

  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();
  const expected = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(hash, "utf8");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, error: "hash mismatch" };
  }

  const authDate = Number(params.get("auth_date") || 0);
  if (!authDate) return { ok: false, error: "missing auth_date" };
  const ageSec = Math.floor(Date.now() / 1000) - authDate;
  if (ageSec > maxAgeSec) return { ok: false, error: "auth_date too old" };
  if (ageSec < -300) return { ok: false, error: "auth_date in the future" };

  let user: TelegramUser | undefined;
  const userRaw = params.get("user");
  if (userRaw) {
    try {
      user = JSON.parse(userRaw) as TelegramUser;
    } catch {
      return { ok: false, error: "invalid user payload" };
    }
  }
  if (!user || typeof user.id !== "number") {
    return { ok: false, error: "missing user" };
  }

  return {
    ok: true,
    user,
    authDate,
    startParam: params.get("start_param") || undefined,
  };
}
