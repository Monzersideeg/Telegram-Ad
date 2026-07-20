// Verifies database connectivity (e.g. to Supabase) and that the schema is applied.
// Run: npm run check:db
import { pool } from "../src/db/pool.js";

const EXPECTED = [
  "users",
  "ad_views",
  "transactions",
  "withdrawals",
  "referral_daily",
  "missions",
  "checkins",
  "spins",
];

async function main() {
  const v = await pool.query("SELECT version()");
  console.log("✅ Connected to database");
  console.log("   " + String(v.rows[0].version).split(",")[0]);

  const r = await pool.query(`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`);
  const present = new Set(r.rows.map((x) => x.tablename));

  console.log("\nTables in 'public':");
  let missing = 0;
  for (const t of EXPECTED) {
    const ok = present.has(t);
    if (!ok) missing++;
    console.log(`   ${ok ? "✅" : "⬜ missing"}  ${t}`);
  }

  if (missing > 0) {
    console.log(`\n⚠ ${missing} table(s) missing — run: npm run migrate`);
  } else {
    console.log("\n🎉 All expected tables present.");
  }

  await pool.end();
}

main().catch((e) => {
  console.error("❌ DB check failed:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
