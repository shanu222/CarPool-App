import dotenv from "dotenv";
import { Pool } from "pg";

dotenv.config();

let pool;

const getPool = () => {
  if (pool) {
    return pool;
  }

  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("POSTGRES_URL (or DATABASE_URL) is required for identity auth module");
  }

  pool = new Pool({
    connectionString,
    ssl:
      process.env.POSTGRES_SSL === "false"
        ? false
        : {
            rejectUnauthorized: process.env.POSTGRES_SSL_REJECT_UNAUTHORIZED === "true",
          },
  });

  return pool;
};

export const query = async (text, params = []) => {
  const db = getPool();
  return db.query(text, params);
};

export const withTransaction = async (handler) => {
  const db = getPool();
  const client = await db.connect();

  try {
    await client.query("BEGIN");
    const value = await handler(client);
    await client.query("COMMIT");
    return value;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const testPostgresConnection = async () => {
  await query("SELECT 1");
};
