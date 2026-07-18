const router = require('express').Router();
const db     = require('../db');
const auth   = require('../middleware/auth');

router.use(auth);

// ── GET /api/tarefas/atrasadas ────────────────────
// Tarefas não concluídas com prazo vencido (para alerta do dashboard)
// Precisa vir antes de "/:clienteId" para não ser capturada por engano
router.get('/atrasadas', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT t.id, t.descricao, t.prazo_data, t.fase_id, c.id AS cliente_id, c.nome AS cliente_nome,
             DATEDIFF(CURDATE(), t.prazo_data) AS dias_atraso
      FROM tarefas_cliente t
      JOIN clientes c ON c.id = t.cliente_id
      WHERE t.concluida = 0
        AND t.prazo_data IS NOT NULL
        AND t.prazo_data < CURDATE()
        AND c.arquivado = 0
      ORDER BY t.prazo_data ASC
    `);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// ── GET /api/tarefas/:clienteId ───────────────────
router.get('/:clienteId', async (req, res) => {
  try {
    const cid = parseInt(req.params.clienteId);
    if (isNaN(cid)) return res.status(400).json({ erro: 'clienteId inválido' });
    const [rows] = await db.query(
      'SELECT * FROM tarefas_cliente WHERE cliente_id = ? ORDER BY concluida ASC, prazo_data ASC',
      [cid]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// ── POST /api/tarefas ─────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { cliente_id, fase_id, descricao, prazo_data } = req.body;
    if (!cliente_id || !descricao?.trim()) {
      return res.status(400).json({ erro: 'cliente_id e descricao são obrigatórios' });
    }
    const [r] = await db.query(
      'INSERT INTO tarefas_cliente (cliente_id, fase_id, descricao, prazo_data) VALUES (?,?,?,?)',
      [parseInt(cliente_id), fase_id || null, descricao.trim(), prazo_data || null]
    );
    const [[nova]] = await db.query('SELECT * FROM tarefas_cliente WHERE id = ?', [r.insertId]);
    res.status(201).json(nova);
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// ── PATCH /api/tarefas/:id ────────────────────────
router.patch('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ erro: 'ID inválido' });
    const { descricao, prazo_data, concluida } = req.body;
    const sets = []; const params = [];
    if (descricao !== undefined)  { sets.push('descricao=?');  params.push(descricao); }
    if (prazo_data !== undefined) { sets.push('prazo_data=?'); params.push(prazo_data || null); }
    if (concluida !== undefined)  { sets.push('concluida=?');  params.push(concluida ? 1 : 0); }
    if (!sets.length) return res.status(400).json({ erro: 'Nada para atualizar' });
    params.push(id);
    await db.query(`UPDATE tarefas_cliente SET ${sets.join(', ')} WHERE id=?`, params);
    const [[up]] = await db.query('SELECT * FROM tarefas_cliente WHERE id = ?', [id]);
    if (!up) return res.status(404).json({ erro: 'Tarefa não encontrada' });
    res.json(up);
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// ── DELETE /api/tarefas/:id ───────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ erro: 'ID inválido' });
    await db.query('DELETE FROM tarefas_cliente WHERE id = ?', [id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

module.exports = router;
