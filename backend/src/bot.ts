import { Telegraf } from "telegraf";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { upsertUser, getReferralStats } from "./services/users.js";
import { getBalance } from "./services/ledger.js";

// Telegram bot for AcEarn. Run with: npm run bot
// - /start (with optional ref_<id> deep-link payload) → welcome + Mini App button
// - /balance, /invite, /help
// The Mini App button uses web_app, which requires FRONTEND_URL to be HTTPS and
// the Mini App to be configured via @BotFather (already attached: has_main_web_app).

const bot = new Telegraf(env.botToken);

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Parse the /start payload (e.g. "ref_123") in a Telegraf-version-safe way. */
function startPayload(ctx: { message?: { text?: string } }): string | undefined {
  const text = ctx.message?.text ?? "";
  return text.split(/\s+/)[1];
}

bot.start(async (ctx) => {
  const tg = ctx.from;
  if (!tg) return;
  const payload = startPayload(ctx); // e.g. "ref_123"
  await upsertUser(
    { id: tg.id, username: tg.username, first_name: tg.first_name },
    payload
  );

  const name = escapeHtml(tg.first_name || "friend");
  const welcome = [
    `👋 Welcome to <b>AcEarn</b>, ${name}!`,
    ``,
    `Watch short ads, earn coins 🪙, and withdraw once you reach <b>${env.economy.minWithdrawal}</b> coins.`,
    `Invite friends to earn <b>${env.economy.referralBonusPct}%</b> of their earnings.`,
    ``,
    `Tap below to open the app 👇`,
  ].join("\n");

  await ctx.reply(welcome, {
    parse_mode: "HTML",
    reply_markup: {
      keyboard: [[{ text: "🪙 Open Earn App", web_app: { url: env.frontendUrl } }]],
      resize_keyboard: true,
    },
  });
});

bot.command("balance", async (ctx) => {
  const tg = ctx.from;
  if (!tg) return;
  const u = await upsertUser({ id: tg.id, username: tg.username, first_name: tg.first_name });
  const balance = await getBalance(u.id);
  const usd = (balance / env.economy.coinsPerUsd).toFixed(2);
  await ctx.reply(
    `🪙 Your balance: <b>${balance.toLocaleString()}</b> coins\n≈ $${usd}\n\nWithdraw at ${env.economy.minWithdrawal} coins.`,
    { parse_mode: "HTML" }
  );
});

bot.command("invite", async (ctx) => {
  const tg = ctx.from;
  if (!tg) return;
  const u = await upsertUser({ id: tg.id, username: tg.username, first_name: tg.first_name });
  const stats = await getReferralStats(u.id);
  const link = `https://t.me/${env.botUsername}/app?startapp=ref_${tg.id}`;
  await ctx.reply(
    `👥 Your invite link:\n${link}\n\nEarn ${env.economy.referralBonusPct}% of what your friends earn.\nFriends: ${stats.count} · Earned: ${stats.earned} 🪙`
  );
});

bot.command("help", async (ctx) => {
  await ctx.reply(
    "AcEarn commands:\n/balance — your coins\n/invite — referral link\n\nOr tap '🪙 Open Earn App' to watch ads."
  );
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

bot
  .launch()
  .then(() => logger.info("Bot started (long polling)", { username: env.botUsername }))
  .catch((err) => {
    logger.error("Bot failed to start", String(err));
    process.exit(1);
  });
