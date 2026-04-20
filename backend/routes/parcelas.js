const router = require('express').Router();
const db     = require('../db');
const auth   = require('../middleware/auth');

router.use(auth);

// ── GET /api/parcelas ─────────────────────────────
// Query params: ?cliente_id=&paga=&page=1&limit=100
router.get('/', async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit) || 100));
    const offset = (page - 1) * limit;

    let sql = `
      SELECT p.*, c.nome AS cliente_nome
      FROM parcelas p
      LEFT JOIN clientes c ON p.cliente_id = c.id
      WHERE 1=1`;
    const params = [];

    if (req.user.role === 'cliente') {
      sql += ' AND p.cliente_id = ?';
      params.push(req.user.clienteId);
    } else if (req.query.cliente_id) {
      sql += ' AND p.cliente_id = ?';
      params.push(parseInt(req.query.cliente_id));
    }

    if (req.query.paga !== undefined) {
      sql += ' AND p.paga = ?';
      params.push(req.query.paga === '1' ? 1 : 0);
    }

    sql += ' ORDER BY p.vencimento ASC';
    sql += ` LIMIT ${limit} OFFSET ${offset}`;

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (e) {
    console.error('[parcelas GET]', e);
    res.status(500).json({ erro: e.message });
  }
});

// ── GET /api/parcelas/:id ─────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ erro: 'ID inválido' });

    const [rows] = await db.query(
      'SELECT p.*, c.nome AS cliente_nome FROM parcelas p LEFT JOIN clientes c ON p.cliente_id = c.id WHERE p.id = ?',
      [id]
    );
    if (!rows.length) return res.status(404).json({ erro: 'Parcela não encontrada' });

    if (req.user.role === 'cliente' && rows[0].cliente_id !== req.user.clienteId) {
      return res.status(403).json({ erro: 'Acesso negado' });
    }

    res.json(rows[0]);
  } catch (e) {
    console.error('[parcelas GET/:id]', e);
    res.status(500).json({ erro: e.message });
  }
});

// ── POST /api/parcelas ────────────────────────────
router.post('/', async (req, res) => {
  if (req.user.role === 'cliente') return res.status(403).json({ erro: 'Acesso negado' });
  try {
    const { cliente_id, descricao, valor, vencimento, forma_pgto, obs } = req.body;

    if (!cliente_id) return res.status(400).json({ erro: 'cliente_id é obrigatório' });
    if (!valor || isNaN(parseFloat(valor))) return res.status(400).json({ erro: 'valor inválido' });

    const [r] = await db.query(
      'INSERT INTO parcelas (cliente_id, descricao, valor, vencimento, forma_pgto, obs, paga) VALUES (?,?,?,?,?,?,0)',
      [
        parseInt(cliente_id),
        descricao || null,
        parseFloat(valor),
        vencimento || null,
        forma_pgto || 'PIX',
        obs || null
      ]
    );
    const [novo] = await db.query(
      'SELECT p.*, c.nome AS cliente_nome FROM parcelas p LEFT JOIN clientes c ON p.cliente_id = c.id WHERE p.id = ?',
      [r.insertId]
    );
    res.status(201).json(novo[0]);
  } catch (e) {
    console.error('[parcelas POST]', e);
    res.status(500).json({ erro: e.message });
  }
});

// ── PATCH /api/parcelas/:id ───────────────────────
router.patch('/:id', async (req, res) => {
  if (req.user.role === 'cliente') return res.status(403).json({ erro: 'Acesso negado' });
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ erro: 'ID inválido' });

    const { descricao, valor, vencimento, forma_pgto, paga, data_pgto, obs } = req.body;

    await db.query(
      'UPDATE parcelas SET descricao=?, valor=?, vencimento=?, forma_pgto=?, paga=?, data_pgto=?, obs=? WHERE id=?',
      [
        descricao ?? null,
        valor !== undefined ? parseFloat(valor) : 0,
        vencimento ?? null,
        forma_pgto || 'PIX',
        paga ? 1 : 0,
        data_pgto ?? null,
        obs ?? null,
        id
      ]
    );
    const [up] = await db.query('SELECT * FROM parcelas WHERE id = ?', [id]);
    if (!up.length) return res.status(404).json({ erro: 'Parcela não encontrada' });
    res.json(up[0]);
  } catch (e) {
    console.error('[parcelas PATCH]', e);
    res.status(500).json({ erro: e.message });
  }
});

// ── DELETE /api/parcelas/:id ──────────────────────
router.delete('/:id', async (req, res) => {
  if (req.user.role === 'cliente') return res.status(403).json({ erro: 'Acesso negado' });
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ erro: 'ID inválido' });

    const [result] = await db.query('DELETE FROM parcelas WHERE id = ?', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ erro: 'Parcela não encontrada' });
    res.json({ ok: true });
  } catch (e) {
    console.error('[parcelas DELETE]', e);
    res.status(500).json({ erro: e.message });
  }
});

module.exports = router;
