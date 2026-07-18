const router = require('express').Router();
const db     = require('../db');
const auth   = require('../middleware/auth');
const { sendEmail } = require('../lib/email');

router.use(auth);

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

    const [r] = await db.query(
      'INSERT INTO agendamentos (cliente_id, cliente_nome, data, hora, tipo, obs, colaborador) VALUES (?,?,?,?,?,?,?)',
      [
        cliente_id ? parseInt(cliente_id) : null,
        cliente_nome || null,
        data,
        hora,
        tipo || 'Reunião',
        obs || null,
        colaborador || null
      ]
    );
    const [novo] = await db.query('SELECT * FROM agendamentos WHERE id = ?', [r.insertId]);

    // Email de confirmação para o cliente
    if (cliente_id) {
      try {
        const [cli] = await db.query('SELECT nome, email FROM clientes WHERE id = ?', [parseInt(cliente_id)]);
        if (cli.length && cli[0].email) {
          const dataFmt = new Date(data + 'T12:00:00').toLocaleDateString('pt-BR');
          await sendEmail(
            cli[0].email,
            '📅 Agendamento confirmado — WB Assessoria',
            `<div style="font-family:Arial,sans-serif;max-width:500px;padding:24px;background:#f9f9f9;border-radius:8px">
              <h2 style="color:#c9a84c">WB Assessoria Migratória</h2>
              <p>Olá, <b>${cli[0].nome}</b>!</p>
              <p>Seu agendamento foi confirmado:</p>
              <table style="border-collapse:collapse;width:100%;margin:12px 0">
                <tr><td style="padding:6px;color:#666">Data:</td><td style="padding:6px;font-weight:bold">${dataFmt}</td></tr>
                <tr><td style="padding:6px;color:#666">Horário:</td><td style="padding:6px;font-weight:bold">${hora}</td></tr>
                <tr><td style="padding:6px;color:#666">Tipo:</td><td style="padding:6px;font-weight:bold">${tipo || 'Reunião'}</td></tr>
                ${obs ? `<tr><td style="padding:6px;color:#666">Obs:</td><td style="padding:6px">${obs}</td></tr>` : ''}
              </table>
              <p style="color:#888;font-size:13px">Em caso de dúvidas entre em contato pelo WhatsApp: (11) 91425-8886</p>
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

    const allowed = ['cliente_id', 'cliente_nome', 'data', 'hora', 'tipo', 'obs', 'colaborador'];
    const setClauses = [];
    const params = [];

    for (const key of allowed) {
      if (key in req.body) {
        setClauses.push(`${key} = ?`);
        params.push(req.body[key]);
      }
    }

    if (!setClauses.length) return res.status(400).json({ erro: 'Nenhum campo para atualizar' });

    params.push(id);
    await db.query(`UPDATE agendamentos SET ${setClauses.join(', ')} WHERE id = ?`, params);

    const [up] = await db.query('SELECT * FROM agendamentos WHERE id = ?', [id]);
    if (!up.length) return res.status(404).json({ erro: 'Agendamento não encontrado' });
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

    const [result] = await db.query('DELETE FROM agendamentos WHERE id = ?', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ erro: 'Agendamento não encontrado' });
    res.json({ ok: true });
  } catch (e) {
    console.error('[agendamentos DELETE]', e);
    res.status(500).json({ erro: e.message });
  }
});

module.exports = router;
