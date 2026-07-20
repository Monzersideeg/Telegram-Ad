// Standalone correctness test for the initData HMAC verification.
// Run: npx tsx scripts/test-initdata.ts
//
// It independently constructs + signs an initData payload per Telegram's documented
// algorithm, then checks verifyInitData() accepts it and rejects tampering,
// wrong bot tokens, and stale auth_date.

import crypto from "node:crypto";
import { verifyInitData } from "../src/lib/telegram.js";

const BOT_TOKEN = "123456:TEST_TOKEN_FOR_UNIT_CHECK";

/** Independently sign an initData object the way Telegram does. */
function sign(fields: Record<string, string>, token: string): string {
  const pairs = Object.keys(fields)
    .sort()
    .map((k) => `${k}=${fields[k]}`);
  const dataCheckString = pairs.join("\n");
  const secretKey = crypto.createHmac("sha256", "WebAppData").update(token).digest();
  const hash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  const qs = new URLSearchParams({ ...fields, hash });
  return qs.toString();
}

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error("❌ FAIL:", msg);
    process.exit(1);
  }
  console.log("✅ pass:", msg);
}

const user = JSON.stringify({ id: 424242, first_name: "Test", username: "tester" });
const authDate = String(Math.floor(Date.now() / 1000));

// 1. Valid initData is accepted
const valid = sign(
  { auth_date: authDate, query_id: "AAEtest", user, start_param: "ref_999" },
  BOT_TOKEN
);
const ok = verifyInitData(valid, BOT_TOKEN);
assert(ok.ok === true, "valid initData accepted");
assert(ok.user?.id === 424242, "user id parsed");
assert(ok.startParam === "ref_999", "start_param parsed");

// 2. Tampered payload (changed balance/user) is rejected
const tampered = valid.replace("424242", "424243");
assert(verifyInitData(tampered, BOT_TOKEN).ok === false, "tampered initData rejected");

// 3. Wrong bot token is rejected
assert(verifyInitData(valid, "999:WRONG_TOKEN").ok === false, "wrong bot token rejected");

// 4. Stale auth_date (>24h) is rejected even if signature is valid
const stale = sign(
  { auth_date: String(Math.floor(Date.now() / 1000) - 90_000), user },
  BOT_TOKEN
);
assert(verifyInitData(stale, BOT_TOKEN).ok === false, "stale auth_date rejected");

// 5. Missing hash is rejected
assert(verifyInitData(`auth_date=${authDate}&user=${encodeURIComponent(user)}`, BOT_TOKEN).ok === false, "missing hash rejected");

console.log("\nAll initData verification checks passed.");
