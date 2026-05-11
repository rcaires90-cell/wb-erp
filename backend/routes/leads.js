const router   = require('express').Router();
const db       = require('../db');
const auth     = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

const VALORES_SERVICO = {
  'Naturalização Brasileira':                                       2790,
  'Naturalização Provisória (crianças/adolescentes)':               1790,
  'Autorização de Residência (CPLP / Reunião Familiar / Mercosul)': 1250,
  'Renovação de Autorização de Residência':                          650,
  'Agendamento de Autorização de Residência':                        200,
  'Visto Americano de Turismo':                                     1600,
};

const SERVICOS_VALIDOS  = new Set(Object.keys(VALORES_SERVICO));
const RNM_VALIDOS       = new Set(['nenhum','temporario','permanente','']);
const ESTADOS_VALIDOS   = new Set(['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO','']);

// Rate limit restrito só para o endpoint público: 8 envios por IP a cada hora
const limiterPublico = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 8,
  keyGenerator: (req) => req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip,
  message: { erro: 'Muitas tentativas. Tente novamente mais tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /api/leads/publico — sem autenticação (formulário público da landing page)
router.post('/publico', limiterPublico, async (req, res) => {
  try {
    const { nome, tel, email, pais, servico, rnm_tipo, tempo_no_pais, cidade, estado, _hp } = req.body;

    // Honeypot: bots preenchem o campo oculto, humanos não
    if (_hp) return res.json({ ok: true });

    // Validações básicas
    if (!nome?.trim() || nome.trim().length > 200) return res.status(400).json({ erro: 'Nome inválido' });
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ erro: 'E-mail inválido' });
    if (servico && !SERVICOS_VALIDOS.has(servico)) return res.status(400).json({ erro: 'Serviço inválido' });
    if (rnm_tipo && !RNM_VALIDOS.has(rnm_tipo)) return res.status(400).json({ erro: 'Campo inválido' });
    if (estado && !ESTADOS_VALIDOS.has(estado)) return res.status(400).json({ erro: 'Estado inválido' });

    // Sanitização de tamanho
    const s = (v, max) => (v||'').toString().trim().slice(0, max) || null;
    const nomeClean   = s(nome, 200);
    const telClean    = s(tel, 30);
    const emailClean  = s(email, 200);
    const paisClean   = s(pais, 100);
    const cidadeClean = s(cidade, 100);

    // Bloqueio de duplicata: mesmo email ou telefone nas últimas 2h
    if (emailClean || telClean) {
      const [dup] = await db.query(
        `SELECT id FROM leads WHERE created_at >= NOW() - INTERVAL 2 HOUR AND (email = ? OR tel = ?) LIMIT 1`,
        [emailClean || '__', telClean || '__']
      );
      if (dup.length) return res.json({ ok: true }); // retorna ok silenciosamente
    }

    const valor_estimado = VALORES_SERVICO[servico] || 0;
    const obs = [
      paisClean           ? `País: ${paisClean}`                     : null,
      rnm_tipo            ? `RNM: ${rnm_tipo}`                       : null,
      tempo_no_pais       ? `Tempo no Brasil: ${tempo_no_pais}`      : null,
      cidadeClean && estado ? `Localização: ${cidadeClean}/${estado}` : (cidadeClean || estado || null),
    ].filter(Boolean).join(' | ');

    try {
      await db.query(
        `INSERT INTO leads (nome, tel, email, pais, servico, rnm_tipo, tempo_no_pais, cidade, estado, origem, status, obs, valor_estimado)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Landing Page', 'novo', ?, ?)`,
        [nomeClean, telClean, emailClean, paisClean, servico||null,
         rnm_tipo||null, tempo_no_pais||null, cidadeClean, estado||null, obs||null, valor_estimado]
      );
    } catch {
      await db.query(
        `INSERT INTO leads (nome, tel, email, servico, origem, status, obs, valor_estimado)
         VALUES (?, ?, ?, ?, 'Landing Page', 'novo', ?, ?)`,
        [nomeClean, telClean, emailClean, servico||null, obs||null, valor_estimado]
      );
    }

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
