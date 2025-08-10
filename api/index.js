app.get('/api/ping-db', async (req, res) => {
  try {
    const r = await pool.query('select 1');
    res.json({ ok: true, rows: r.rows });
  } catch (e) {
    res.status(500).json({ ok:false, error: String(e) });
  }
});
