// One-time bot setup + live smoke test against the real Telegram Bot API.
// Run: npx tsx scripts/setup-bot.ts
// - Verifies BOT_TOKEN via getMe()
// - Registers the command menu (setMyCommands)

import { getMe, setMyCommands } from "../src/services/telegramApi.js";
import { logger } from "../src/lib/logger.js";

async function main() {
  const me = await getMe();
  logger.info("getMe OK", me);

  await setMyCommands([
    { command: "start", description: "Start earning — open the app" },
    { command: "balance", description: "Show my coin balance" },
    { command: "invite", description: "Get my referral link" },
    { command: "help", description: "How it works" },
  ]);
  logger.info("setMyCommands OK — bot command menu registered");

  console.log("\n✅ Bot is live and configured:", `@${me.username}`);
}

main().catch((err) => {
  logger.error("setup-bot failed", String(err));
  process.exit(1);
});
