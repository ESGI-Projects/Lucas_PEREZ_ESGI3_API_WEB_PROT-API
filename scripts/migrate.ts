import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createPool } from "../src/database/pool.js";
import { readEnv } from "../src/config/env.js";

const pool = createPool(readEnv().DATABASE_URL);
const client = await pool.connect();
try {
  await client.query("SELECT pg_advisory_lock(736421)");
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
  for (const name of (await readdir("db/migrations"))
    .filter((n) => n.endsWith(".sql"))
    .sort()) {
    const sql = await readFile(`db/migrations/${name}`, "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    const existing = await client.query(
      "SELECT checksum FROM schema_migrations WHERE name=$1",
      [name],
    );
    if (existing.rowCount) {
      if (existing.rows[0].checksum !== checksum)
        throw new Error(`Migration modifiée après application : ${name}`);
      continue;
    }
    await client.query("BEGIN");
    try {
      // Compatibilité avec le volume créé par le Compose de la séance 1.
      // Les volumes personnalisés exigent une migration spécifique.
      const legacy = await client.query(
        "SELECT to_regclass('public.adherents') IS NOT NULL AS exists",
      );
      const populated =
        name === "002_kit.sql"
          ? (
              await client.query(
                "SELECT EXISTS(SELECT 1 FROM adherents) AS exists",
              )
            ).rows[0].exists
          : false;
      if (!(name === "001_schema.sql" && legacy.rows[0].exists) && !populated)
        await client.query(sql);
      await client.query(
        "INSERT INTO schema_migrations (name, checksum) VALUES ($1,$2)",
        [name, checksum],
      );
      await client.query("COMMIT");
      console.log(`Migration appliquée : ${name}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
} finally {
  await client.query("SELECT pg_advisory_unlock(736421)");
  client.release();
  await pool.end();
}
