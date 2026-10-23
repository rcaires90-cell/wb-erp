const router = require('express').Router();
const db     = require('../db');
const auth   = require('../middleware/auth');
const rateLimit = require('express-rate-limit');
const { sendEmail } = require('../lib/email');
const { agoraSP, gerarDisponibilidade, escHtml } = require('../lib/agendaPublica');
const agenda = require('../lib/agendaServico');

// ══ ROTAS PÚBLICAS (sem login) ═══════════════════════════════════════════
// Usadas pela landing page (escolher horário) e por agendamento.html (link
// do e-mail: confirmar / cancelar / reagendar). Ficam antes do router.use(auth).
const limiterPublico = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 60,
  keyGenerator: (req) => req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip,
  message: { erro: 'Muitas tentativas. Tente novamente mais tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const TOKEN_RE = /^[a-f0-9]{48}$/;

// GET /api/agendamentos/publico/horarios — dias e horários livres
router.get('/publico/horarios', limiterPublico, async (req, res) => {
  try {
    const conf = await agenda.carregarConfig(db);
    let excetoId = null;
    // Ao reagendar, o horário atual da própria pessoa não conta como ocupado
    if (TOKEN_RE.test(req.query.token || '')) {
      const [[ag]] = await db.query('SELECT id FROM agendamentos WHERE token = ?', [req.query.token]);
      excetoId = ag?.id || null;
    }
    const ocupados = await agenda.carregarOcupados(db, conf, excetoId);
    res.json({ ativa: conf.ativa, dias: gerarDisponibilidade(conf, ocupados) });
  } catch (e) {
    console.error('[agendamentos/publico/horarios]', e.message);
    res.status(500).json({ erro: 'Não foi possível carregar os horários.' });
  }
});

async function buscarPorToken(token) {
  if (!TOKEN_RE.test(token || '')) return null;
  const [[ag]] = await db.query(
    `SELECT a.id, DATE_FORMAT(a.data, '%Y-%m-%d') AS data, a.hora, a.tipo, a.status, a.obs, a.tel,
            COALESCE(c.nome, a.cliente_nome) AS nome, COALESCE(NULLIF(c.email, ''), a.email) AS email
     FROM agendamentos a LEFT JOIN clientes c ON a.cliente_id = c.id
     WHERE a.token = ?`, [token]);
  return ag || null;
}
const jaPassou = (ag) => {
  const agora = agoraSP();
  return ag.data < agora.data || (ag.data === agora.data && String(ag.hora).slice(0, 5) < agora.hora);
};
const publico = (ag) => ({ nome: ag.nome, data: ag.data, hora: String(ag.hora).slice(0, 5), tipo: ag.tipo, status: ag.status || 'confirmado', passou: jaPassou(ag) });

// GET /api/agendamentos/publico/:token
router.get('/publico/:token', limiterPublico, async (req, res) => {
  try {
    const ag = await buscarPorToken(req.params.token);
    if (!ag) return res.status(404).json({ erro: 'Agendamento não encontrado' });
    res.json(publico(ag));
  } catch (e) {
    console.error('[agendamentos/publico GET]', e.message);
    res.status(500).json({ erro: 'Erro ao carregar o agendamento.' });
  }
});

// POST /api/agendamentos/publico/:token/confirmar
router.post('/publico/:token/confirmar', limiterPublico, async (req, res) => {
  try {
    const ag = await buscarPorToken(req.params.token);
    if (!ag) return res.status(404).json({ erro: 'Agendamento não encontrado' });
    if (ag.status === 'cancelado') return res.status(409).json({ erro: 'Este agendamento foi cancelado. Escolha um novo horário.' });
    if (jaPassou(ag)) return res.status(409).json({ erro: 'Este horário já passou.' });
    if (ag.status !== 'confirmado') {
      await db.query("UPDATE agendamentos SET status = 'confirmado', confirmado_em = NOW() WHERE id = ?", [ag.id]);
      agenda.sincronizarGoogle(db, ag.id);
      agenda.avisarEquipe(`✅ Presença confirmada — ${ag.nome}`, ag, ' confirmou presença.')
        .catch(e => console.error('[agendamentos] aviso equipe:', e.message));
    }
    res.json(publico({ ...ag, status: 'confirmado' }));
  } catch (e) {
    console.error('[agendamentos/publico confirmar]', e.message);
    res.status(500).json({ erro: 'Não foi possível confirmar. Tente novamente.' });
  }
});

// POST /api/agendamentos/publico/:token/cancelar
router.post('/publico/:token/cancelar', limiterPublico, async (req, res) => {
  try {
    const ag = await buscarPorToken(req.params.token);
    if (!ag) return res.status(404).json({ erro: 'Agendamento não encontrado' });
    if (jaPassou(ag)) return res.status(409).json({ erro: 'Este horário já passou.' });
    if (ag.status !== 'cancelado') {
      await db.query("UPDATE agendamentos SET status = 'cancelado', cancelado_em = NOW() WHERE id = ?", [ag.id]);
      agenda.sincronizarGoogle(db, ag.id);
      agenda.avisarEquipe(`❌ Agendamento cancelado — ${ag.nome}`, ag, ' cancelou o atendimento pela internet. O horário foi liberado.')
        .catch(e => console.error('[agendamentos] aviso equipe:', e.message));
    }
    res.json(publico({ ...ag, status: 'cancelado' }));
  } catch (e) {
    console.error('[agendamentos/publico cancelar]', e.message);
    res.status(500).json({ erro: 'Não foi possível cancelar. Tente novamente.' });
  }
});

// POST /api/agendamentos/publico/:token/reagendar  { data, hora }
// Já entra confirmado — a pessoa acabou de escolher o horário.
router.post('/publico/:token/reagendar', limiterPublico, async (req, res) => {
  try {
    const ag = await buscarPorToken(req.params.token);
    if (!ag) return res.status(404).json({ erro: 'Agendamento não encontrado' });
    const { data, hora } = req.body || {};
    if (!(await agenda.verificarHorario(db, data, hora, ag.id))) {
      return res.status(409).json({ erro: 'Esse horário não está mais disponível. Escolha outro.' });
    }
    await db.query(
      "UPDATE agendamentos SET data = ?, hora = ?, status = 'confirmado', confirmado_em = NOW(), cancelado_em = NULL WHERE id = ?",
      [data, hora, ag.id]);
    agenda.sincronizarGoogle(db, ag.id);
    const novo = { ...ag, data, hora };
    agenda.avisarEquipe(`🔁 Reagendado — ${ag.nome}`, novo,
      ` reagendou pela internet (antes: ${escHtml(ag.data.split('-').reverse().join('/'))} às ${escHtml(String(ag.hora).slice(0, 5))}).`)
      .catch(e => console.error('[agendamentos] aviso equipe:', e.message));
    res.json(publico({ ...novo, status: 'confirmado' }));
  } catch (e) {
    console.error('[agendamentos/publico reagendar]', e.message);
    res.status(500).json({ erro: 'Não foi possível reagendar. Tente novamente.' });
  }
});

router.use(auth);

// ── Google Agenda da empresa ─────────────────────
// GET /api/agendamentos/google/status — testa a conexão de verdade
router.get('/google/status', async (_req, res) => {
  const google = require('../lib/googleCalendar');
  if (!google.ativo()) return res.json({ ativo: false });
  try {
    const hoje = agoraSP().data;
    google.limparCacheOcupados();
    await google.periodosOcupados(hoje, hoje);
    let conta = null;
    try { conta = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON).client_email; } catch {}
    res.json({ ativo: true, ok: true, calendario: process.env.GOOGLE_CALENDAR_ID, conta });
  } catch (e) {
    res.json({ ativo: true, ok: false, erro: e.message });
  }
});

// POST /api/agendamentos/google/sincronizar — manda pro Google todos os
// agendamentos de hoje em diante (usado uma vez ao conectar a agenda)
router.post('/google/sincronizar', async (_req, res) => {
  const google = require('../lib/googleCalendar');
  if (!google.ativo()) return res.status(400).json({ erro: 'Google Agenda não configurado' });
  try {
    const [rows] = await db.query(
      "SELECT id FROM agendamentos WHERE data >= ? AND (status IS NULL OR status <> 'cancelado') ORDER BY data, hora",
      [agoraSP().data]);
    for (const r of rows) await agenda.sincronizarGoogle(db, r.id);
    res.json({ ok: true, total: rows.length });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// ── GET /api/agendamentos ─────────────────────────
// Query params: ?data=YYYY-MM-DD&cliente_id=&page=1&limit=100
router.get('/', async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(5000, Math.max(1, parseInt(req.query.limit) || 100));
    const offset = (page - 1) * limit;

    let sql = 'SELECT * FROM agendamentos WHERE 1=1';
    const params = [];

    if (req.query.cliente_id) {
      sql += ' AND cliente_id = ?';
      params.push(parseInt(req.query.cliente_id));
    }

    if (req.query.data) {
      sql += ' AND data = ?';
      params.push(req.query.data);
    }

    sql += ` ORDER BY data ASC, hora ASC LIMIT ${limit} OFFSET ${offset}`;

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (e) {
    console.error('[agendamentos GET]', e);
    res.status(500).json({ erro: e.message });
  }
});

// ── GET /api/agendamentos/:id ─────────────────────
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ erro: 'ID inválido' });

    const [rows] = await db.query('SELECT * FROM agendamentos WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ erro: 'Agendamento não encontrado' });

    res.json(rows[0]);
  } catch (e) {
    console.error('[agendamentos GET/:id]', e);
    res.status(500).json({ erro: e.message });
  }
});

// ── POST /api/agendamentos ────────────────────────
router.post('/', async (req, res) => {
  try {
    const { cliente_id, cliente_nome, data, hora, tipo, obs, colaborador } = req.body;

    if (!data) return res.status(400).json({ erro: 'data é obrigatória' });
    if (!hora) return res.status(400).json({ erro: 'hora é obrigatória' });

    // Começa 'pendente': o cliente confirma pelo link do e-mail, ou a equipe
    // marca como confirmado na Agenda (ex.: depois de falar no WhatsApp).
    const token = agenda.novoToken();
    const [r] = await db.query(
      `INSERT INTO agendamentos (cliente_id, cliente_nome, data, hora, tipo, obs, colaborador, status, token, origem)
       VALUES (?,?,?,?,?,?,?, 'pendente', ?, 'Equipe')`,
      [
        cliente_id ? parseInt(cliente_id) : null,
        cliente_nome || null,
        data,
        hora,
        tipo || 'Reunião',
        obs || null,
        colaborador || null,
        token,
      ]
    );
    const [novo] = await db.query('SELECT * FROM agendamentos WHERE id = ?', [r.insertId]);
    agenda.sincronizarGoogle(db, r.insertId);

    // E-mail para o cliente com botão de confirmar presença
    if (cliente_id) {
      try {
        const [cli] = await db.query('SELECT nome, email FROM clientes WHERE id = ?', [parseInt(cliente_id)]);
        if (cli.length && cli[0].email) {
          await sendEmail(
            cli[0].email,
            '📅 Novo agendamento — WB Assessoria',
            `<div style="font-family:Arial,sans-serif;max-width:500px;padding:24px;background:#f9f9f9;border-radius:8px">
              <h2 style="color:#c9a84c;margin-top:0">WB Assessoria Migratória</h2>
              <p>Olá, <b>${escHtml(cli[0].nome)}</b>! Marcamos um atendimento para você:</p>
              ${agenda.blocoDataHora(data, hora, tipo || 'Reunião')}
              ${obs ? `<p style="color:#555"><b>Obs:</b> ${escHtml(obs)}</p>` : ''}
              <p>Clique abaixo para <b>confirmar sua presença</b>:</p>
              ${agenda.botoesConfirmacao(token)}
              ${agenda.rodape()}
            </div>`
          );
        }
      } catch(e) { console.error('[agendamentos] email confirmação:', e.message); }
    }

    res.status(201).json(novo[0]);
  } catch (e) {
    console.error('[agendamentos POST]', e);
    res.status(500).json({ erro: e.message });
  }
});

// ── PATCH /api/agendamentos/:id ───────────────────
router.patch('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ erro: 'ID inválido' });

    const allowed = ['cliente_id', 'cliente_nome', 'data', 'hora', 'tipo', 'obs', 'colaborador', 'status', 'email', 'tel'];
    if ('status' in req.body && !['pendente', 'confirmado', 'cancelado'].includes(req.body.status)) {
      return res.status(400).json({ erro: 'status inválido' });
    }
    const setClauses = [];
    const params = [];

    for (const key of allowed) {
      if (key in req.body) {
        setClauses.push(`${key} = ?`);
        params.push(req.body[key]);
      }
    }

    if (!setClauses.length) return res.status(400).json({ erro: 'Nenhum campo para atualizar' });
    if (req.body.status === 'confirmado') setClauses.push('confirmado_em = COALESCE(confirmado_em, NOW())');
    if (req.body.status === 'cancelado')  setClauses.push('cancelado_em = NOW()');

    params.push(id);
    await db.query(`UPDATE agendamentos SET ${setClauses.join(', ')} WHERE id = ?`, params);

    const [up] = await db.query('SELECT * FROM agendamentos WHERE id = ?', [id]);
    if (!up.length) return res.status(404).json({ erro: 'Agendamento não encontrado' });
    agenda.sincronizarGoogle(db, id);
    res.json(up[0]);
  } catch (e) {
    console.error('[agendamentos PATCH]', e);
    res.status(500).json({ erro: e.message });
  }
});

// ── DELETE /api/agendamentos/:id ──────────────────
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ erro: 'ID inválido' });

    const [[antes]] = await db.query('SELECT google_event_id FROM agendamentos WHERE id = ?', [id]);
    const [result] = await db.query('DELETE FROM agendamentos WHERE id = ?', [id]);
    if (antes?.google_event_id) {
      require('../lib/googleCalendar').removerEvento(antes.google_event_id)
        .catch(e => console.error('[google] remover evento:', e.message));
    }
    if (result.affectedRows === 0) return res.status(404).json({ erro: 'Agendamento não encontrado' });
    res.json({ ok: true });
  } catch (e) {
    console.error('[agendamentos DELETE]', e);
    res.status(500).json({ erro: e.message });
  }
});

module.exports = router;
