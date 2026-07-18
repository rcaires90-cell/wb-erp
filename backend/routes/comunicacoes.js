const router = require('express').Router();
const db     = require('../db');
const auth   = require('../middleware/auth');

router.use(auth);

db.query(`CREATE TABLE IF NOT EXISTS comunicacoes (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  cliente_id   INT NOT NULL,
  tipo         VARCHAR(50) DEFAULT 'Outro',
  texto        TEXT NOT NULL,
  usuario_nome VARCHAR(100),
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_cliente (cliente_id)
)`).catch(e => console.error('[comunicacoes] createTable:', e.message));

// GET /api/comunicacoes?cliente_id=X
router.get('/', async (req, res) => {
  try {
    const cid = parseInt(req.query.cliente_id);
    if (isNaN(cid)) return res.status(400).json({ erro: 'cliente_id obrigatório' });
    const [rows] = await db.query(
      'SELECT * FROM comunicacoes WHERE cliente_id = ? ORDER BY created_at DESC',
      [cid]
    );
    res.json(rows);
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

// POST /api/comunicacoes
router.post('/', async (req, res) => {
  try {
    const { cliente_id, tipo, texto } = req.body;
    if (!cliente_id || !texto?.trim())
      return res.status(400).json({ erro: 'cliente_id e texto são obrigatórios' });
    const usuario_nome = req.user.nome || req.user.email || 'Sistema';
    const [r] = await db.query(
      'INSERT INTO comunicacoes (cliente_id, tipo, texto, usuario_nome) VALUES (?,?,?,?)',
      [parseInt(cliente_id), tipo || 'Outro', texto.trim(), usuario_nome]
    );
    const [[novo]] = await db.query('SELECT * FROM comunicacoes WHERE id = ?', [r.insertId]);
    res.status(201).json(novo);
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

// DELETE /api/comunicacoes/:id
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ erro: 'ID inválido' });
    await db.query('DELETE FROM comunicacoes WHERE id = ?', [id]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

module.exports = router;
