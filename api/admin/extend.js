import { pool, initDb } from '../../lib/db.js';
import { withCors } from '../../lib/cors.js';

export default withCors(async function handler(req, res) {
  try {
    await initDb();
    if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'method_not_allowed' });

    const { key, days=30 } = req.body || {};
    if (!key) return res.status(400).json({ ok:false, error:'missing_key' });

    const { rows } = await pool.query('SELECT expires_at FROM licenses WHERE key=$1', [key]);
    if (!rows[0]) return res.status(404).json({ ok:false, error:'not_found' });

    const base = new Date(rows[0].expires_at).getTime();
    const newExp = new Date(Math.max(Date.now(), base) + days*24*60*60*1000).toISOString();
    await pool.query('UPDATE licenses SET expires_at=$1 WHERE key=$2', [newExp, key]);

    return res.status(200).json({ ok:true, key, expiresAt:newExp });
  } catch (e) {
    return res.status(400).json({ ok:false, error:e.message });
  }
});
