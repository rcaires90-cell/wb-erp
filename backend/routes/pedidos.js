// Pedidos que clientes fazem pela internet (landing/formulários, opção
// "já sou cliente"). Aparecem na ficha do cliente, aba "📨 Pedidos".
const router = require('express').Router();
const db     = require('../db');
const auth   = require('../middleware/auth');
const { MOTIVOS_CLIENTE, VALORES_SERVICO } = require('../lib/servicos');

router.use(auth);

// GET /api/pedidos?cliente_id=  | ?sem_cliente=1 (disse que é cliente e não foi
// achado no cadastro) | sem filtro = todos os abertos
router.get('/', async (req, res) => {
  try {
    const params = [];
    let sql = `SELECT p.*, DATE_FORMAT(a.data, '%Y-%m-%d') AS ag_data, a.hora AS ag_hora, a.status AS ag_status
               FROM pedidos_cliente p LEFT JOIN agendamentos a ON a.id = p.agendamento_id WHERE 1=1`;
    if (req.query.cliente_id) { sql += ' AND p.cliente_id = ?'; params.push(parseInt(req.query.cliente_id)); }
    else if (req.query.sem_cliente === '1') sql += " AND p.cliente_id IS NULL AND p.status = 'aberto'";
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

// POST /api/pedidos/:id/vincular  { cliente_id } — a equipe achou quem é:
// o pedido vai pra ficha, vira tarefa, e agendamento/lead passam a apontar
// pro cadastro certo
router.post('/:id/vincular', async (req, res) => {
  try {
    const id = parseInt(req.params.id), cid = parseInt(req.body?.cliente_id);
    if (!cid) return res.status(400).json({ erro: 'Escolha o cliente' });
    const [[p]] = await db.query('SELECT * FROM pedidos_cliente WHERE id = ?', [id]);
    if (!p) return res.status(404).json({ erro: 'Pedido não encontrado' });
    const [[c]] = await db.query('SELECT id, nome FROM clientes WHERE id = ?', [cid]);
    if (!c) return res.status(404).json({ erro: 'Cliente não encontrado' });
    let tarefaId = p.tarefa_id;
    if (!tarefaId) {
      const txt = (MOTIVOS_CLIENTE[p.motivo] || 'Pedido') + (p.servico ? ` — ${p.servico}` : '');
      const [t] = await db.query(
        'INSERT INTO tarefas_cliente (cliente_id, fase_id, descricao, prazo_data) VALUES (?, NULL, ?, DATE_ADD(CURDATE(), INTERVAL 1 DAY))',
        [cid, `Responder pedido pela internet: ${txt}`.slice(0, 300)]);
      tarefaId = t.insertId;
    }
    await db.query('UPDATE pedidos_cliente SET cliente_id = ?, tarefa_id = ? WHERE id = ?', [cid, tarefaId, id]);
    if (p.agendamento_id) {
      await db.query("UPDATE agendamentos SET cliente_id = ?, cliente_nome = ?, ja_cliente = 1, obs = REPLACE(obs, ' | ⚠️ Disse que é cliente, mas não foi encontrado no cadastro', '') WHERE id = ?", [cid, c.nome, p.agendamento_id]);
      require('../lib/agendaServico').sincronizarGoogle(db, p.agendamento_id);
    }
    if (p.lead_id) await db.query('UPDATE leads SET cliente_id = ? WHERE id = ?', [cid, p.lead_id]);
    res.json({ ok: true, cliente: c });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// POST /api/pedidos/:id/prospeccao — não é cliente: vira lead de prospecção
// (ou, se já tinha virado lead de "novo serviço", esse lead vai pra prospecção)
router.post('/:id/prospeccao', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [[p]] = await db.query('SELECT * FROM pedidos_cliente WHERE id = ?', [id]);
    if (!p) return res.status(404).json({ erro: 'Pedido não encontrado' });
    let leadId = p.lead_id;
    const obs = [`Pediu como cliente pela internet, mas não é cliente. Motivo: ${MOTIVOS_CLIENTE[p.motivo] || p.motivo}`, p.assunto ? 'Assunto: ' + p.assunto : null].filter(Boolean).join(' | ');
    if (leadId) {
      await db.query('UPDATE leads SET upsell = 0, ja_era_cliente = 0, cliente_id = NULL, origem = ? WHERE id = ?', ['Pedido (não era cliente)', leadId]);
    } else {
      const [l] = await db.query(
        `INSERT INTO leads (nome, tel, email, servico, origem, status, obs, valor_estimado, criado_por)
         VALUES (?, ?, ?, ?, 'Pedido (não era cliente)', 'novo', ?, ?, ?)`,
        [p.nome, p.tel, p.email, p.servico || null, obs, VALORES_SERVICO[p.servico] || 0, req.user?.nome || null]);
      leadId = l.insertId;
    }
    if (p.agendamento_id) await db.query('UPDATE agendamentos SET ja_cliente = 0, lead_id = ? WHERE id = ?', [leadId, p.agendamento_id]);
    await db.query("UPDATE pedidos_cliente SET status = 'respondido', respondido_em = NOW(), respondido_por = ?, lead_id = ? WHERE id = ?",
      [(req.user?.nome || '') + ' (enviado pra prospecção)', leadId, id]);
    res.json({ ok: true, lead_id: leadId });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

module.exports = router;
