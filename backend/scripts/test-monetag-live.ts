// LIVE end-to-end test of the Monetag rewarded-ad crediting flow against the REAL DB.
// Starts the API in-process, then simulates exactly what Monetag's S2S postback does:
//   watch session → valued postback → coins credited (idempotent, not_valued, bad-secret).
// Run: npx tsx scripts/test-monetag-live.ts
import crypto from "node:crypto";

process.env.START_SERVER = "false"; // import the app without auto-listening

import { env } from "../src/config/env.js";

/** Build a validly-signed Telegram initData (mirrors the backend's verification). */
function makeInitData(botToken: string, user: Record<string, unknown>): string {
  const fields: Record<string, string> = {
    user: JSON.stringify(user),
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: "AAHmonetagtest",
  };
  const dcs = Object.keys(fields).sort().map((k) => `${k}=${fields[k]}`).join("\n");
  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const hash = crypto.createHmac("sha256", secretKey).update(dcs).digest("hex");
  return new URLSearchParams({ ...fields, hash }).toString();
}

const TEST_TG_ID = 777777777;

async function main() {
  const { app } = await import("../src/index.js");
  const { pool } = await import("../src/db/pool.js");
  const { disconnectRedis } = await import("../src/lib/redis.js");

  const server = app.listen(0);
  await new Promise<void>((r) => server.on("listening", () => r()));
  const addr = server.address();
  const port = addr && typeof addr === "object" ? addr.port : 0;
  const base = `http://127.0.0.1:${port}`;

  const initData = makeInitData(env.botToken, {
    id: TEST_TG_ID,
    username: "monetag_test",
    first_name: "MT",
  });
  const authHeaders = { "x-telegram-init-data": initData };

  const getBalance = async (): Promise<number> => {
    const r = await fetch(`${base}/api/ledger/balance`, { headers: authHeaders });
    return (await r.json()).balance as number;
  };

  let pass = 0;
  let fail = 0;
  const check = (cond: boolean, msg: string) => {
    if (cond) { pass++; console.log("  ✅ " + msg); }
    else { fail++; console.log("  ❌ " + msg); }
  };

  console.log(`▶ Monetag live flow → ${base} (rewardPerAd=${env.economy.rewardPerAd})`);

  try {
    const balBefore = await getBalance();
    console.log(`  test user @monetag_test (tg ${TEST_TG_ID}), balance before: ${balBefore}`);

    // 1. Frontend opens a watch session
    const startRes = await fetch(`${base}/api/ads/start`, { method: "POST", headers: authHeaders });
    const start = (await startRes.json()) as { sessionId?: string };
    check(startRes.ok && !!start.sessionId, `POST /api/ads/start → session ${String(start.sessionId).slice(0, 8)}…`);
    const sessionId = start.sessionId as string;

    // 2. Monetag fires a VALUED S2S postback (the real integration point)
    const secret = encodeURIComponent(env.monetag.postbackSecret);
    const pbValued = `${base}/api/postback/monetag?secret=${secret}&ymid=${encodeURIComponent(sessionId)}&value=valued&price=0.0123&event=impression&telegram_id=${TEST_TG_ID}`;
    const pbRes = await fetch(pbValued);
    const pb = (await pbRes.json()) as { result?: string };
    check(pbRes.ok && pb.result === "confirmed", `S2S postback (valued) → result=${pb.result}`);

    // 3. Balance credited by exactly rewardPerAd
    const balAfter = await getBalance();
    check(balAfter === balBefore + env.economy.rewardPerAd, `balance credited ${balBefore} → ${balAfter} (+${env.economy.rewardPerAd})`);

    // 4. Duplicate postback is idempotent (no double credit)
    await fetch(pbValued);
    const balDup = await getBalance();
    check(balDup === balAfter, `duplicate postback did NOT double-credit (still ${balDup})`);

    // 5. A NOT_VALUED postback credits nothing
    const start2 = (await (await fetch(`${base}/api/ads/start`, { method: "POST", headers: authHeaders })).json()) as { sessionId?: string };
    const pbNv = `${base}/api/postback/monetag?secret=${secret}&ymid=${encodeURIComponent(start2.sessionId as string)}&value=not_valued&price=0&event=impression`;
    const pbNvJson = (await (await fetch(pbNv)).json()) as { result?: string };
    const balNv = await getBalance();
    check(pbNvJson.result === "unrewarded" && balNv === balAfter, `not_valued postback → unrewarded, no credit (balance ${balNv})`);

    // 6. Wrong secret is rejected
    const badRes = await fetch(`${base}/api/postback/monetag?secret=WRONG&ymid=${sessionId}&value=valued`);
    check(badRes.status === 403, `wrong postback secret rejected (HTTP ${badRes.status})`);

    console.log(`\n${fail === 0 ? "🎉" : "⚠"} Monetag live flow: ${pass} passed, ${fail} failed`);
  } finally {
    await pool.query("DELETE FROM users WHERE telegram_id = $1", [TEST_TG_ID]).catch(() => undefined);
    console.log("  🧹 test user cleaned up");
    server.close();
    await disconnectRedis();
    await pool.end().catch(() => undefined);
  }
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("FATAL:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
