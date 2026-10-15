import { createApp } from "./app.js";
import { readEnv } from "./config/env.js";
import { createPool } from "./database/pool.js";

const env = readEnv();
const pool = createPool(env.DATABASE_URL);
await pool.query("SELECT 1");
const server = createApp(pool).listen(env.PORT, "0.0.0.0", () =>
  console.log(`API disponible sur le port ${env.PORT}`),
);
server.on("error", async (error) => {
  console.error("Démarrage impossible", error.message);
  await pool.end();
  process.exitCode = 1;
});
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  const timeout = setTimeout(() => process.exit(1), 10000).unref();
  server.close(async () => {
    await pool.end();
    clearTimeout(timeout);
  });
}
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
