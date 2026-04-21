const router  = require('express').Router();
const db      = require('../db');
const auth    = require('../middleware/auth');
const bcrypt  = require('bcryptjs');
const nodemailer = require('nodemailer');

function emailTransport() {
  if (!process.env.EMAIL_USER) return null;
  return nodemailer.createTransport({
    host: 'smtp.gmail.com', port: 465, secure: true, family: 4,
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
  });
}

async function enviarEmail(to, subject, html) {
  const t = emailTransport();
  if (!t) return;
  try { await t.sendMail({ from: process.env.EMAIL_USER, to, subject, html }); } catch {}
}

// ── GET /api/portal/mensagens/:clienteId ──────────────────────────────────────
router.get('/mensagens/:clienteId', auth, async (req, res) => {
  try {
    const cid = parseInt(req.params.clienteId);
    if (req.user.role === 'cliente' && req.user.clienteId !== cid)
      return res.status(403).json({ erro: 'Acesso negado' });
    const [rows] = await db.query(
      'SELECT * FROM mensagens_portal WHERE cliente_id=? ORDER BY criado_em ASC', [cid]
    );
    if (req.user.role !== 'cliente')
      await db.query('UPDATE mensagens_portal SET lida=1 WHERE cliente_id=? AND remetente="cliente"', [cid]);
    else
      await db.query('UPDATE mensagens_portal SET lida=1 WHERE cliente_id=? AND remetente="equipe"', [cid]);
    res.json(rows);
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

// ── POST /api/portal/mensagens ────────────────────────────────────────────────
router.post('/mensagens', auth, async (req, res) => {
  try {
    const { cliente_id, texto } = req.body;
    if (!texto?.trim()) return res.status(400).json({ erro: 'Texto obrigatório' });
    const cid = parseInt(cliente_id);
    if (req.user.role === 'cliente' && req.user.clienteId !== cid)
      return res.status(403).json({ erro: 'Acesso negado' });
    const remetente = req.user.role === 'cliente' ? 'cliente' : 'equipe';
    const [r] = await db.query(
      'INSERT INTO mensagens_portal (cliente_id, remetente, texto) VALUES (?,?,?)',
      [cid, remetente, texto.trim()]
    );
    if (remetente === 'equipe') {
      const [[c]] = await db.query('SELECT nome, email FROM clientes WHERE id=?', [cid]);
      if (c?.email) {
        await enviarEmail(c.email, 'Nova mensagem da equipe WB Assessoria',
          `<p>Olá, <b>${c.nome}</b>!</p><p>A equipe WB enviou uma mensagem:</p><blockquote>${texto}</blockquote><p>Acesse seu portal para responder.</p>`
        );
      }
    }
    res.json({ id: r.insertId, remetente, texto: texto.trim(), criado_em: new Date() });
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

// ── GET /api/portal/documentos/:clienteId ────────────────────────────────────
router.get('/documentos/:clienteId', auth, async (req, res) => {
  try {
    const cid = parseInt(req.params.clienteId);
    if (req.user.role === 'cliente' && req.user.clienteId !== cid)
      return res.status(403).json({ erro: 'Acesso negado' });
    const [rows] = await db.query(
      'SELECT id, nome, tipo, status, obs, criado_em FROM documentos_portal WHERE cliente_id=? ORDER BY criado_em DESC', [cid]
    );
    res.json(rows);
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

// ── POST /api/portal/documentos ───────────────────────────────────────────────
router.post('/documentos', auth, async (req, res) => {
  try {
    const { cliente_id, nome, tipo, base64 } = req.body;
    if (!nome || !base64) return res.status(400).json({ erro: 'Nome e arquivo obrigatórios' });
    const cid = parseInt(cliente_id);
    if (req.user.role === 'cliente' && req.user.clienteId !== cid)
      return res.status(403).json({ erro: 'Acesso negado' });
    const [r] = await db.query(
      'INSERT INTO documentos_portal (cliente_id, nome, tipo, base64) VALUES (?,?,?,?)',
      [cid, nome, tipo || 'outro', base64]
    );
    const [[cli]] = await db.query('SELECT nome FROM clientes WHERE id=?', [cid]);
    await enviarEmail(
      process.env.EMAIL_USER || 'wbassessoria.contato@gmail.com',
      `Novo documento enviado — ${cli?.nome}`,
      `<p>O cliente <b>${cli?.nome}</b> enviou o documento: <b>${nome}</b>. Acesse o sistema para revisar.</p>`
    );
    res.json({ id: r.insertId, nome, status: 'pendente' });
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

// ── PUT /api/portal/documentos/:id/status ─────────────────────────────────────
router.put('/documentos/:id/status', auth, async (req, res) => {
  try {
    if (req.user.role === 'cliente') return res.status(403).json({ erro: 'Acesso negado' });
    const { status, obs } = req.body;
    await db.query('UPDATE documentos_portal SET status=?, obs=? WHERE id=?', [status, obs||null, req.params.id]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

// ── GET /api/portal/dados ─────────────────────────────────────────────────────
router.get('/dados', auth, async (req, res) => {
  try {
    if (req.user.role !== 'cliente') return res.status(403).json({ erro: 'Acesso negado' });
    const [[c]] = await db.query(
      'SELECT id, nome, email, tel, cpf, rnm, pais, endereco, portal_login FROM clientes WHERE id=?',
      [req.user.clienteId]
    );
    res.json(c);
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

// ── PUT /api/portal/dados ─────────────────────────────────────────────────────
router.put('/dados', auth, async (req, res) => {
  try {
    if (req.user.role !== 'cliente') return res.status(403).json({ erro: 'Acesso negado' });
    const { tel, endereco, nova_senha } = req.body;
    await db.query('UPDATE clientes SET tel=?, endereco=? WHERE id=?',
      [tel||null, endereco||null, req.user.clienteId]);
    if (nova_senha?.trim()) {
      const hash = await bcrypt.hash(nova_senha, 10);
      await db.query('UPDATE clientes SET portal_senha=? WHERE id=?', [hash, req.user.clienteId]);
    }
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

// ── GET /api/portal/nao-lidas/:clienteId ─────────────────────────────────────
router.get('/nao-lidas/:clienteId', auth, async (req, res) => {
  try {
    const cid = parseInt(req.params.clienteId);
    const remetente = req.user.role === 'cliente' ? 'equipe' : 'cliente';
    const [[r]] = await db.query(
      'SELECT COUNT(*) as total FROM mensagens_portal WHERE cliente_id=? AND remetente=? AND lida=0',
      [cid, remetente]
    );
    res.json({ total: r.total });
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

module.exports = router;
