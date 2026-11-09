// Pedidos que clientes fazem pela internet (landing/formulários, opção
// "já sou cliente"). Aparecem na ficha do cliente, aba "📨 Pedidos".
const router = require('express').Router();
const db     = require('../db');
const auth   = require('../middleware/auth');
const { MOTIVOS_CLIENTE } = require('../lib/servicos');

router.use(auth);

// GET /api/pedidos?cliente_id=  (sem cliente_id = os ainda abertos de todos)
router.get('/', async (req, res) => {
  try {
    const params = [];
    let sql = `SELECT p.*, DATE_FORMAT(a.data, '%Y-%m-%d') AS ag_data, a.hora AS ag_hora, a.status AS ag_status
               FROM pedidos_cliente p LEFT JOIN agendamentos a ON a.id = p.agendamento_id WHERE 1=1`;
    if (req.query.cliente_id) { sql += ' AND p.cliente_id = ?'; params.push(parseInt(req.query.cliente_id)); }
    else sql += " AND p.status = 'aberto'";
    sql += ' ORDER BY p.created_at DESC LIMIT 200';
    const [rows] = await db.query(sql, params);
    res.json(rows.map(r => ({ ...r, motivo_label: MOTIVOS_CLIENTE[r.motivo] || r.motivo || '—' })));
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// PATCH /api/pedidos/:id  { status: 'aberto' | 'respondido' }
// Respondido também conclui a tarefa que o pedido criou.
router.patch('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const status = req.body?.status;
    if (!['aberto', 'respondido'].includes(status)) return res.status(400).json({ erro: 'status inválido' });
    await db.query(
      `UPDATE pedidos_cliente SET status = ?, respondido_em = ${status === 'respondido' ? 'NOW()' : 'NULL'}, respondido_por = ? WHERE id = ?`,
      [status, status === 'respondido' ? (req.user?.nome || null) : null, id]);
    const [[p]] = await db.query('SELECT tarefa_id FROM pedidos_cliente WHERE id = ?', [id]);
    if (p?.tarefa_id) await db.query('UPDATE tarefas_cliente SET concluida = ? WHERE id = ?', [status === 'respondido' ? 1 : 0, p.tarefa_id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

module.exports = router;
