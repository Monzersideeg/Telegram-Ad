// Full integration test of the service layer against the live database (Supabase).
// Exercises real services end-to-end, then deletes all test data (CASCADE).
// Run: npx tsx scripts/integration-supabase.ts
import { pool } from "../src/db/pool.js";
import { disconnectRedis } from "../src/lib/redis.js";
import { upsertUser } from "../src/services/users.js";
import { credit, getBalance, getTransactions } from "../src/services/ledger.js";
import {
  checkIn, getStreakStatus, spin, getSpinStatus,
  getMissions, claimMission, getLeaderboard, getMyRank,
} from "../src/services/games.js";
import { requestWithdrawal, listWithdrawals } from "../src/services/withdrawals.js";

const TEST_TG_ID = 888888888;
let testUserId = 0;

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error("ASSERT FAILED: " + msg);
  console.log("  ✅ " + msg);
}

async function cleanup() {
  if (!testUserId) return;
  await pool.query("DELETE FROM users WHERE id = $1", [testUserId]); // CASCADE removes child rows
}

async function main() {
  console.log("▶ Creating test user…");
  const u = await upsertUser({ id: TEST_TG_ID, username: "integ_test", first_name: "Integ" });
  testUserId = u.id;
  assert(!!testUserId, `test user created (db id=${testUserId})`);

  console.log("▶ Daily check-in…");
  const before = await getStreakStatus(testUserId);
  const ci = await checkIn(testUserId);
  assert(!ci.alreadyCheckedIn && ci.reward > 0, `check-in credited +${ci.reward} (streak ${ci.streakDays})`);
  const after = await getStreakStatus(testUserId);
  assert(after.checkedInToday === true, "streak status now shows checked-in today");
  const ci2 = await checkIn(testUserId);
  assert(ci2.alreadyCheckedIn === true, "second same-day check-in is blocked (idempotent)");

  console.log("▶ Lucky Spin…");
  const sp = await spin(testUserId);
  assert(sp.available === true && (sp as any).reward > 0, `spin won +${(sp as any).reward}`);
  const spStatus = await getSpinStatus(testUserId);
  assert(spStatus.available === false && spStatus.retryAfterSec > 0, `spin now on cooldown (${spStatus.retryAfterSec}s)`);

  console.log("▶ Missions…");
  const ms = await getMissions(testUserId);
  assert(ms.length === 3, `3 missions returned (${ms.map((m) => m.id).join(", ")})`);
  const claim = await claimMission(testUserId, "join_telegram");
  assert(claim.reward > 0, `claimed join_telegram +${claim.reward}`);
  let dupErr = "";
  try { await claimMission(testUserId, "join_telegram"); } catch (e: any) { dupErr = e.code || e.message; }
  assert(dupErr === "already_claimed", "re-claiming the same mission is rejected");

  console.log("▶ Ledger (credit + balance + transactions)…");
  await credit(testUserId, 2000, "admin_adjust", { reason: "integration test funding" });
  const bal = await getBalance(testUserId);
  assert(bal >= 2000, `balance after funding = ${bal} (>= 2000)`);
  const txs = await getTransactions(testUserId, 20);
  assert(txs.length >= 4, `ledger has ${txs.length} entries (check-in, spin, mission, funding)`);

  console.log("▶ Withdrawal (escrow)…");
  const wd = await requestWithdrawal(testUserId, 1000, "USDT-TRC20", "TEST_ADDRESS_xyz");
  assert(wd.status === "pending" && wd.amount === 1000, `withdrawal #${wd.id} created (pending, 1000)`);
  const balAfterWd = await getBalance(testUserId);
  assert(balAfterWd === bal - 1000, `balance deducted by escrow (${bal} → ${balAfterWd})`);
  const wds = await listWithdrawals(testUserId);
  assert(wds.length === 1, "withdrawal appears in history");

  console.log("▶ Leaderboard + rank…");
  const lb = await getLeaderboard(50);
  assert(Array.isArray(lb), `leaderboard returned ${lb.length} rows`);
  const rank = await getMyRank(testUserId);
  assert(rank.rank >= 1 && rank.earned > 0, `my rank = #${rank.rank}, earned = ${rank.earned}`);

  console.log("\n🎉 ALL INTEGRATION CHECKS PASSED against the live database.");
}

main()
  .catch((e) => {
    console.error("\n❌ Integration test failed:", e instanceof Error ? e.message : String(e));
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup();
    console.log("🧹 Test data cleaned up.");
    await disconnectRedis();
    await pool.end();
  });
