import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { pool } from "./pool.js";
import { logger } from "../lib/logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const sql = await readFile(path.join(__dirname, "schema.sql"), "utf8");
  logger.info("Applying schema...");
  await pool.query(sql);
  logger.info("Schema applied successfully.");
  await pool.end();
}

main().catch((err) => {
  logger.error("Migration failed", err);
  process.exit(1);
});
