// api/index.js — Express как serverless для Vercel

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

// Логи неожиданных ошибок — чтобы видеть их в Vercel Logs
process.on('unhandledRejection', (r) => console.error('UNHANDLED REJECTION', r));
process.on('uncaughtException',  (e) => console.error('UNCAUGHT EXCEPTION', e));

// ----------------- APP -----------------
const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

// ----------------- DB ------------------
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function initDb() {
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
initDb().catch(console.error);

// helper
const addDays = (d) => new Date(Date.now() + d*24*60*60*1000).toISOString();

// ----------------- ROUTES ---------------

// health
app.get('/api/ping', (req, res) => res.json({ ok: true }));

// PUBLIC: verify
app.get('/api/license/verify', async (req, res) => {
  try {
    const { key, device } = req.query;
    if (!key) return res.json({ ok:false, reason:'missing_key' });

    const { rows } = await pool.query(
      'SELECT key, plan, expires_at, is_active, device FROM licenses WHERE key=$1 LIMIT 1',
      [key]
    );
    const row = rows[0];
    if (!row) return res.json({ ok:false, reason:'not_found' });
    if (!row.is_active) return res.json({ ok:false, reason:'revoked' });
    if (row.device && device && row.device !== device) {
      return res.json({ ok:false, reason:'bound_to_other_device' });
    }

    const ok = Date.now() < new Date(row.expires_at).getTime();
    res.json({ ok, plan: row.plan, expiresAt: row.expires_at });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok:false, error:'server_error' });
  }
});

// ADMIN: create
app.post('/api/admin/create', async (req, res) => {
  try {
    const { plan='month', days, key, note, device } = req.body || {};
    const map = { week:7, month:30, year:365, test:3 };
    const d = Number.isFinite(+days) ? +days : (map[plan] ?? 30);
    const newKey = (key?.trim()) || ('SKU-' + plan.toUpperCase() + '-' + uuidv4().slice(0,8).toUpperCase());
    const expiresAt = addDays(d);

    await pool.query(
      'INSERT INTO licenses(key, plan, expires_at, device, is_active, note) VALUES($1,$2,$3,$4,TRUE,$5)',
      [newKey, plan, expiresAt, device ?? null, note ?? null]
    );

    res.json({ ok:true, key:newKey, plan, expiresAt, device: device ?? null });
  } catch (e) {
    console.error(e);
    res.status(400).json({ ok:false, error:e.message });
  }
});

// ADMIN: extend
app.post('/api/admin/extend', async (req, res) => {
  try {
    const { key, days=30 } = req.body || {};
    if (!key) return res.status(400).json({ ok:false, error:'missing_key' });

    const { rows } = await pool.query('SELECT expires_at FROM licenses WHERE key=$1', [key]);
    if (!rows[0]) return res.status(404).json({ ok:false, error:'not_found' });

    const base = new Date(rows[0].expires_at).getTime();
    const newExp = new Date(Math.max(Date.now(), base) + days*24*60*60*1000).toISOString();
    await pool.query('UPDATE licenses SET expires_at=$1 WHERE key=$2', [newExp, key]);

    res.json({ ok:true, key, expiresAt:newExp });
  } catch (e) {
    console.error(e);
    res.status(400).json({ ok:false, error:e.message });
  }
});

// ADMIN: set-active
app.post('/api/admin/set-active', async (req, res) => {
  try {
    const { key, isActive } = req.body || {};
    if (!key || typeof isActive !== 'boolean') {
      return res.status(400).json({ ok:false, error:'missing_params' });
    }
    const r = await pool.query('UPDATE licenses SET is_active=$1 WHERE key=$2', [isActive, key]);
    if (!r.rowCount) return res.status(404).json({ ok:false, error:'not_found' });
    res.json({ ok:true });
  } catch (e) {
    console.error(e);
    res.status(400).json({ ok:false, error:e.message });
  }
});

// ADMIN: bind-device
app.post('/api/admin/bind-device', async (req, res) => {
  try {
    const { key, device } = req.body || {};
    if (!key || !device) return res.status(400).json({ ok:false, error:'missing_params' });
    const r = await pool.query('UPDATE licenses SET device=$1 WHERE key=$2', [device, key]);
    if (!r.rowCount) return res.status(404).json({ ok:false, error:'not_found' });
    res.json({ ok:true });
  } catch (e) {
    console.error(e);
    res.status(400).json({ ok:false, error:e.message });
  }
});

// ADMIN: info
app.get('/api/admin/info', async (req, res) => {
  try {
    const { key } = req.query;
    if (!key) return res.status(400).json({ ok:false, error:'missing_key' });
    const { rows } = await pool.query('SELECT * FROM licenses WHERE key=$1', [key]);
    if (!rows[0]) return res.status(404).json({ ok:false, error:'not_found' });
    res.json({ ok:true, license: rows[0] });
  } catch (e) {
    console.error(e);
    res.status(400).json({ ok:false, error:e.message });
  }
});

// Экспортим app — Vercel сам поднимет handler
module.exports = app;
