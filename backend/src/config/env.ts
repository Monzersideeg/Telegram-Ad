import "dotenv/config";

function required(name: string): string {
  const v = process.env[name];
  if (v === undefined || v === "") {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

function num(name: string, fallback: number): number {
  const v = process.env[name];
  if (v === undefined || v === "") return fallback;
  const n = Number(v);
  if (Number.isNaN(n)) throw new Error(`Env var ${name} must be a number`);
  return n;
}

function list(name: string): string[] {
  const v = process.env[name] || "";
  return v.split(",").map((s) => s.trim()).filter(Boolean);
}

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: num("PORT", 8787),

  botToken: required("BOT_TOKEN"),
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
  botUsername: process.env.BOT_USERNAME || "YourEarnBot",

  databaseUrl: required("DATABASE_URL"),
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",

  monetag: {
    postbackSecret: required("MONETAG_POSTBACK_SECRET"),
    zoneId: process.env.MONETAG_ZONE_ID || "",
    // Postback query-param names. WE choose these in the Monetag postback URL
    // template (Monetag fills the {macros} at send time). Keep in sync with the
    // URL you configure in the Monetag dashboard:
    //   /api/postback/monetag?secret=XXX&ymid={ymid}&event={event_type}
    //     &value={reward_event_type}&price={estimated_price}&telegram_id={telegram_id}
    paramSession: process.env.MONETAG_PARAM_SESSION || "ymid", // we pass sessionId as ymid
    paramValueType: process.env.MONETAG_PARAM_VALUE || "value", // valued / non_valued / not_valued
    paramPrice: process.env.MONETAG_PARAM_PRICE || "price", // estimated_price (USD)
    paramTelegramId: process.env.MONETAG_PARAM_TELEGRAM_ID || "telegram_id",
    paramEvent: process.env.MONETAG_PARAM_EVENT || "event", // impression / click
  },

  economy: {
    rewardPerAd: num("REWARD_PER_AD", 10),
    adCooldownSeconds: num("AD_COOLDOWN_SECONDS", 45),
    maxAdsPerDay: num("MAX_ADS_PER_DAY", 40),
    referralBonusPct: num("REFERRAL_BONUS_PCT", 10),
    referralDailyCap: num("REFERRAL_DAILY_CAP", 500),
    minWithdrawal: num("MIN_WITHDRAWAL", 1000),
    coinsPerUsd: num("COINS_PER_USD", 1000),
    // Game features (all rewards in coins)
    checkinReward: num("CHECKIN_REWARD", 25),
    checkinStreakStep: num("CHECKIN_STREAK_STEP", 5), // + per streak day, capped at 7 days
    missionJoinTelegram: num("MISSION_JOIN_TELEGRAM_REWARD", 100),
    missionWatch10: num("MISSION_WATCH10_REWARD", 150),
    missionInvite3: num("MISSION_INVITE3_REWARD", 300),
    spinCooldownSeconds: num("SPIN_COOLDOWN_SECONDS", 86400), // 24h between spins
  },

  adminTelegramIds: list("ADMIN_TELEGRAM_IDS").map((s) => Number(s)),
  adminSecret: process.env.ADMIN_SECRET || "change-me-admin-secret",
};

export type Env = typeof env;
