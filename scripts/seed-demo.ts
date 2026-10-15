import { seedDemo } from "../db/seeds/demo.js";
import { createPool } from "../src/database/pool.js";
import { readEnv } from "../src/config/env.js";
const pool = createPool(readEnv().DATABASE_URL);
try {
  console.log(JSON.stringify(await seedDemo(pool), null, 2));
} finally {
  await pool.end();
}
