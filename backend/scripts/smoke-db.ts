// End-to-end DML smoke test against the configured database (e.g. Supabase):
// inserts a clearly-marked test row inside a transaction, reads it back, deletes it,
// and commits — proving read + write + delete work, leaving no data behind.
// Run: npx tsx scripts/smoke-db.ts
import { pool } from "../src/db/pool.js";

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const ins = await client.query(
      `INSERT INTO users (telegram_id, username, first_name, balance)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [999999999, "smoke_test", "Smoke", 0]
    );
    const id = ins.rows[0].id;
    const sel = await client.query("SELECT id, username, balance FROM users WHERE id = $1", [id]);
    await client.query("DELETE FROM users WHERE id = $1", [id]);
    await client.query("COMMIT");
    console.log(
      `✅ DML smoke test passed: inserted → read (username=${sel.rows[0].username}) → deleted test row.`
    );
  } catch (e) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error("❌ smoke test failed:", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
