const router = require('express').Router();
const db     = require('../db');
const auth   = require('../middleware/auth');

router.use(auth);

// ── GET /api/prints ───────────────────────────────
// Query params: ?cliente_id=&page=1&limit=50
router.get('/', async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;

    let sql = 'SELECT * FROM prints_processo WHERE 1=1';
    const params = [];

    if (req.user.role === 'cliente') {
      sql += ' AND cliente_id = ?';
      params.push(req.user.clienteId);
    } else if (req.query.cliente_id) {
      sql += ' AND cliente_id = ?';
      params.push(parseInt(req.query.cliente_id));
    }

    sql += ` ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (e) {
    console.error('[prints GET]', e);
    res.status(500).json({ erro: e.message });
  }
});

// ── GET /api/prints/:id ───────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ erro: 'ID inválido' });

    const [rows] = await db.query('SELECT * FROM prints_processo WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ erro: 'Print não encontrado' });

    if (req.user.role === 'cliente' && rows[0].cliente_id !== req.user.clienteId) {
      return res.status(403).json({ erro: 'Acesso negado' });
    }

    res.json(rows[0]);
  } catch (e) {
    console.error('[prints GET/:id]', e);
    res.status(500).json({ erro: e.message });
  }
});

// ── POST /api/prints ──────────────────────────────
router.post('/', async (req, res) => {
  if (req.user.role === 'cliente') return res.status(403).json({ erro: 'Acesso negado' });
  try {
    const { cliente_id, descricao, autor, autor_role, base64, drive_url, data, hora } = req.body;

    if (!cliente_id) return res.status(400).json({ erro: 'cliente_id é obrigatório' });

    const [r] = await db.query(
      'INSERT INTO prints_processo (cliente_id, descricao, autor, autor_role, base64, drive_url, data, hora) VALUES (?,?,?,?,?,?,?,?)',
      [
        parseInt(cliente_id),
        descricao || 'Print',
        autor || 'Equipe WB',
        autor_role || null,
        base64 || null,
        drive_url || null,
        data || null,
        hora || null
      ]
    );
    const [novo] = await db.query('SELECT * FROM prints_processo WHERE id = ?', [r.insertId]);
    res.status(201).json(novo[0]);
  } catch (e) {
    console.error('[prints POST]', e);
    res.status(500).json({ erro: e.message });
  }
});

// ── DELETE /api/prints/:id ────────────────────────
router.delete('/:id', async (req, res) => {
  if (req.user.role === 'cliente') return res.status(403).json({ erro: 'Acesso negado' });
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ erro: 'ID inválido' });

    const [result] = await db.query('DELETE FROM prints_processo WHERE id = ?', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ erro: 'Print não encontrado' });
    res.json({ ok: true });
  } catch (e) {
    console.error('[prints DELETE]', e);
    res.status(500).json({ erro: e.message });
  }
});

module.exports = router;
