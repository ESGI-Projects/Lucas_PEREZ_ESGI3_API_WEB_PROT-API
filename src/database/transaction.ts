import type { Pool, PoolClient } from "pg";
import { AppError } from "../http/errors.js";

// Aucun effet externe (mail, réponse HTTP...) ne doit être exécuté dans le callback :
// PostgreSQL peut demander de rejouer toute la transaction.
export async function transaction<T>(
  pool: Pool,
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
      const result = await work(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      const code = (error as { code?: string }).code;
      if (code !== "40001" && code !== "40P01") throw error;
      if (attempt === 4)
        throw new AppError(
          503,
          "concurrence",
          "Service temporairement occupé",
          "Réessayez la demande.",
        );
    } finally {
      client.release();
    }
    await new Promise((resolve) =>
      setTimeout(resolve, 10 + Math.random() * 25),
    );
  }
  throw new Error("Transaction sans résultat");
}
