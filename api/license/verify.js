import { pool, initDb } from '../../lib/db.js';
import { withCors } from '../../lib/cors.js';

export default withCors(async function handler(req, res) {
  try {
    await initDb();
    if (req.method !== 'GET') return res.status(405).json({ ok:false, error:'method_not_allowed' });

    const { key, device } = req.query;
    if (!key) return res.status(200).json({ ok:false, reason:'missing_key' });

    const { rows } = await pool.query(
      'SELECT key, plan, expires_at, is_active, device as bound_device FROM licenses WHERE key=$1 LIMIT 1',
      [key]
    );
    const row = rows[0];
    if (!row) return res.status(200).json({ ok:false, reason:'not_found' });
    if (!row.is_active) return res.status(200).json({ ok:false, reason:'revoked' });
    if (row.bound_device && device && row.bound_device !== device) {
      return res.status(200).json({ ok:false, reason:'bound_to_other_device' });
    }

    const ok = Date.now() < new Date(row.expires_at).getTime();
    return res.status(200).json({ ok, plan: row.plan, expiresAt: row.expires_at });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok:false, error:'server_error' });
  }
});
