import { Pool } from 'pg';

let _pool = globalThis.__WB_LIC_POOL__;
if (!_pool) {
  _pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  globalThis.__WB_LIC_POOL__ = _pool;
}

export const pool = _pool;

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS licenses (
      id SERIAL PRIMARY KEY,
      key TEXT UNIQUE NOT NULL,
      plan TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      device TEXT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      note TEXT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_licenses_key ON licenses(key);
  `);
}
