import { pool, initDb } from '../../lib/db.js';
import { withCors } from '../../lib/cors.js';

export default withCors(async function handler(req, res) {
  try {
    await initDb();
    if (req.method !== 'GET') return res.status(405).json({ ok:false, error:'method_not_allowed' });

    const { key } = req.query || {};
    if (!key) return res.status(400).json({ ok:false, error:'missing_key' });

    const { rows } = await pool.query('SELECT * FROM licenses WHERE key=$1', [key]);
    if (!rows[0]) return res.status(404).json({ ok:false, error:'not_found' });

    return res.status(200).json({ ok:true, license: rows[0] });
  } catch (e) {
    return res.status(400).json({ ok:false, error:e.message });
  }
});
