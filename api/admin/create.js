import { pool, initDb } from '../../lib/db.js';
import { withCors } from '../../lib/cors.js';
import { v4 as uuidv4 } from 'uuid';

const addDays = (d) => new Date(Date.now() + d*24*60*60*1000).toISOString();

export default withCors(async function handler(req, res) {
  try {
    await initDb();
    if (req.method !== 'POST') return res.status(405).json({ ok:false, error:'method_not_allowed' });

    const { plan='month', days, key, note, device } = req.body || {};
    const daysMap = { week:7, month:30, year:365, test:3 };
    const d = Number.isFinite(+days) ? +days : (daysMap[plan] ?? 30);
    const newKey = (key?.trim()) || ('SKU-' + plan.toUpperCase() + '-' + uuidv4().slice(0,8).toUpperCase());
    const expiresAt = addDays(d);

    await pool.query(
      'INSERT INTO licenses(key, plan, expires_at, device, is_active, note) VALUES($1,$2,$3,$4,TRUE,$5)',
      [newKey, plan, expiresAt, device ?? null, note ?? null]
    );
    return res.status(200).json({ ok:true, key:newKey, plan, expiresAt, device: device ?? null });
  } catch (e) {
    return res.status(400).json({ ok:false, error:e.message });
  }
});
