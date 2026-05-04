const router = require('express').Router();
const db     = require('../db');
const auth   = require('../middleware/auth');

// POST /api/leads/publico — sem autenticação (formulário público da landing page)
router.post('/publico', async (req, res) => {
  try {
    const { nome, tel, email, pais, servico, rnm_tipo, tempo_no_pais, cidade, estado } = req.body;
    if (!nome?.trim()) return res.status(400).json({ erro: 'Nome obrigatório' });
    await db.query(
      `INSERT INTO leads (nome, tel, email, pais, servico, rnm_tipo, tempo_no_pais, cidade, estado, origem, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Landing Page', 'novo')`,
      [nome.trim(), tel||null, email||null, pais||null, servico||null, rnm_tipo||null, tempo_no_pais||null, cidade||null, estado||null]
    );
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

router.use(auth);

const STATUS_LABELS = {
  novo: 'Novo', contato_feito: 'Contato Feito', proposta_enviada: 'Proposta Enviada',
  negociando: 'Negociando', fechado: 'Fechado', perdido: 'Perdido',
};

// GET /api/leads
router.get('/', async (req, res) => {
  try {
    let sql = 'SELECT * FROM leads WHERE 1=1';
    const params = [];
    if (req.query.status) { sql += ' AND status=?'; params.push(req.query.status); }
    if (req.query.busca) {
      const t = `%${req.query.busca}%`;
      sql += ' AND (nome LIKE ? OR tel LIKE ? OR email LIKE ?)';
      params.push(t, t, t);
    }
    sql += ' ORDER BY created_at DESC';
    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

// POST /api/leads
router.post('/', async (req, res) => {
  try {
    const { nome, tel, email, pais, servico, origem, status, responsavel, valor_estimado, obs } = req.body;
    if (!nome?.trim()) return res.status(400).json({ erro: 'Nome obrigatório' });
    const [r] = await db.query(
      `INSERT INTO leads (nome,tel,email,pais,servico,origem,status,responsavel,valor_estimado,obs,criado_por)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [nome.trim(), tel||null, email||null, pais||null,
       servico||'Naturalização Brasileira', origem||'Indicação',
       status||'novo', responsavel||'Renato Caires',
       parseFloat(valor_estimado)||0, obs||null, req.user.nome]
    );
    const [[novo]] = await db.query('SELECT * FROM leads WHERE id=?', [r.insertId]);
    res.status(201).json(novo);
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

// PATCH /api/leads/:id
router.patch('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const ALLOWED = ['nome','tel','email','pais','servico','origem','status','responsavel','valor_estimado','obs'];
    const sets = []; const params = [];
    for (const k of ALLOWED) {
      if (k in req.body) { sets.push(`${k}=?`); params.push(req.body[k]); }
    }
    if (!sets.length) return res.status(400).json({ erro: 'Nenhum campo válido' });
    params.push(id);
    await db.query(`UPDATE leads SET ${sets.join(',')} WHERE id=?`, params);
    const [[upd]] = await db.query('SELECT * FROM leads WHERE id=?', [id]);
    res.json(upd);
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

// DELETE /api/leads/:id
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM leads WHERE id=?', [parseInt(req.params.id)]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

// POST /api/leads/:id/converter — converte lead em cliente
router.post('/:id/converter', async (req, res) => {
  try {
    const [[lead]] = await db.query('SELECT * FROM leads WHERE id=?', [parseInt(req.params.id)]);
    if (!lead) return res.status(404).json({ erro: 'Lead não encontrado' });
    const [r] = await db.query(
      `INSERT INTO clientes (nome,email,tel,pais,servico,responsavel,valor,status,data_cadastro,dados_json)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [lead.nome, lead.email, lead.tel, lead.pais, lead.servico,
       lead.responsavel, parseFloat(lead.valor_estimado)||0,
       'Pendente Documentação', new Date().toLocaleDateString('pt-BR'), '{}']
    );
    await db.query('UPDATE leads SET status=? WHERE id=?', ['fechado', lead.id]);
    const [[novo]] = await db.query('SELECT * FROM clientes WHERE id=?', [r.insertId]);
    res.json({ ok: true, cliente: novo, lead_id: lead.id });
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

module.exports = router;
