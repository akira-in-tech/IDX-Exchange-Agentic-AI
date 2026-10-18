import mysql from "mysql2/promise";

const DEFAULT_CONNECTION_LIMIT = 5;
let pool;

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/** Build database settings from environment variables without logging secrets. */
export function getDatabaseConfig(env = process.env) {
  return {
    host: env.MYSQL_HOST || "127.0.0.1",
    port: positiveInteger(env.MYSQL_PORT, 3306),
    user: env.MYSQL_USER || "root",
    password: env.MYSQL_PASSWORD || "",
    database: env.MYSQL_DATABASE || "idx_exchange",
    waitForConnections: true,
    connectionLimit: positiveInteger(env.MYSQL_CONNECTION_LIMIT, DEFAULT_CONNECTION_LIMIT),
    queueLimit: 0,
    decimalNumbers: true,
  };
}

/** Lazily create one reusable connection pool per Node process. */
export function getPool() {
  if (!pool) pool = mysql.createPool(getDatabaseConfig());
  return pool;
}

/** Execute prepared SQL and return only row data, never driver metadata. */
export async function query(sql, params = [], connectionPool = getPool()) {
  const [rows] = await connectionPool.execute(sql, params);
  return rows;
}

/** Close the pool so CLI commands and tests can exit cleanly. */
export async function closePool() {
  if (!pool) return;
  const currentPool = pool;
  pool = undefined;
  await currentPool.end();
}
