import pg from "pg";

// Préserve les six décimales PostgreSQL des timestamps utilisés par les curseurs.
pg.types.setTypeParser(1184, (value) =>
  value.replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00"),
);
pg.types.setTypeParser(1082, (value) => value);

export function createPool(connectionString: string) {
  const pool = new pg.Pool({
    connectionString,
    max: 12,
    connectionTimeoutMillis: 5000,
  });
  pool.on("error", (error) =>
    console.error("Connexion PostgreSQL inactive interrompue", error.message),
  );
  return pool;
}

export type Database = Pick<pg.PoolClient, "query">;
