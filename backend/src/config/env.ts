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

const legacyAdsgramBlock = process.env.ADSGRAM_BLOCK_ID || "";

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: num("PORT", 8787),

  botToken: required("BOT_TOKEN"),
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
  botUsername: process.env.BOT_USERNAME || "YourEarnBot",

  databaseUrl: required("DATABASE_URL"),
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",

  adsgram: {
    // Rewarded block is used by the large WATCH AD button.
    rewardBlockId: process.env.ADSGRAM_REWARD_BLOCK_ID || legacyAdsgramBlock,
    // Interstitial block should be in the int-xxx format and is shown on natural tab transitions.
    interstitialBlockId: process.env.ADSGRAM_INTERSTITIAL_BLOCK_ID || legacyAdsgramBlock,
    // Task block should be in the task-xxx format and renders as <adsgram-task> below the watch button.
    taskBlockId: process.env.ADSGRAM_TASK_BLOCK_ID || "",
    taskReward: num("ADSGRAM_TASK_REWARD", num("REWARD_PER_AD", 10)),
    rewardSecret: process.env.ADSGRAM_REWARD_SECRET || "",
  },

  economy: {
    rewardPerAd: num("REWARD_PER_AD", 10),
    adCooldownSeconds: num("AD_COOLDOWN_SECONDS", 45),
    maxAdsPerDay: num("MAX_ADS_PER_DAY", 40),
    referralBonusPct: num("REFERRAL_BONUS_PCT", 10),
    referralDailyCap: num("REFERRAL_DAILY_CAP", 500),
    minWithdrawal: num("MIN_WITHDRAWAL", 1000),
    coinsPerUsd: num("COINS_PER_USD", 1000),
    checkinReward: num("CHECKIN_REWARD", 25),
    checkinStreakStep: num("CHECKIN_STREAK_STEP", 5),
    missionJoinTelegram: num("MISSION_JOIN_TELEGRAM_REWARD", 100),
    missionWatch10: num("MISSION_WATCH10_REWARD", 150),
    missionInvite3: num("MISSION_INVITE3_REWARD", 300),
    spinCooldownSeconds: num("SPIN_COOLDOWN_SECONDS", 86400),
  },

  adminTelegramIds: list("ADMIN_TELEGRAM_IDS").map((s) => Number(s)),
  adminSecret: process.env.ADMIN_SECRET || "change-me-admin-secret",
  adminWeb: {
    email: process.env.ADMIN_EMAIL || "",
    passwordHash: process.env.ADMIN_PASSWORD_HASH || "",
    password: process.env.ADMIN_PASSWORD || "",
    sessionSecret: process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_SECRET || "change-me-admin-secret",
    cookieName: process.env.ADMIN_COOKIE_NAME || "acearn_admin",
    sessionMaxAgeSeconds: num("ADMIN_SESSION_MAX_AGE_SECONDS", 60 * 60 * 8),
  },
};

export type Env = typeof env;
