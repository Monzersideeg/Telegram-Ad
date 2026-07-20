import dns from "node:dns";
import pg from "pg";
import { env } from "../config/env.js";

// Prefer IPv4: some environments (containers/sandboxes) lack IPv6 egress, and managed
// Postgres hosts can resolve to IPv6 first, causing "ENETUNREACH". Forcing IPv4-first
// makes connections deterministic there. (No effect where IPv6 works fine.)
dns.setDefaultResultOrder("ipv4first");

// Managed Postgres providers (Supabase, Neon, RDS, …) require TLS. Without an `ssl`
// config node-postgres fails with "The server does not support SSL connections".
// SSL is auto-enabled for Supabase URLs; override explicitly with DATABASE_SSL=true|false
// (e.g. DATABASE_SSL=false for a local Docker Postgres that has no TLS).
const sslEnabled = process.env.DATABASE_SSL
  ? process.env.DATABASE_SSL !== "false"
  : /supabase\.co|supabase\.com/.test(env.databaseUrl);

export const pool = new pg.Pool({
  connectionString: env.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
  // rejectUnauthorized:false works out-of-the-box with Supabase's pooler. For maximum
  // security, download Supabase's CA cert and use { ca: <cert> } instead.
  ssl: sslEnabled ? { rejectUnauthorized: false } : undefined,
});

pool.on("error", (err) => {
  // eslint-disable-next-line no-console
  console.error("Unexpected PG pool error", err);
});

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params);
}

/** Run a callback inside a transaction. Rolls back on throw. */
export async function withTransaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
