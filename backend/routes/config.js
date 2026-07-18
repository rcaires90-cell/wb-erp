const router = require('express').Router();
const db     = require('../db');
const auth   = require('../middleware/auth');

router.use(auth);

// ── GET /api/config ───────────────────────────────
// Retorna todas as configurações do sistema como objeto chave:valor
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT chave, valor FROM config_sistema');
    const config = {};
    rows.forEach(r => { config[r.chave] = r.valor; });
    res.json(config);
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// ── PUT /api/config ────────────────────────────────
// Body: { chave, valor } — upsert de uma configuração
router.put('/', async (req, res) => {
  if (req.user.role === 'colaborador') return res.status(403).json({ erro: 'Acesso negado' });
  try {
    const { chave, valor } = req.body;
    if (!chave) return res.status(400).json({ erro: 'chave é obrigatória' });
    await db.query(
      'INSERT INTO config_sistema (chave, valor) VALUES (?,?) ON DUPLICATE KEY UPDATE valor=?',
      [chave, valor ?? null, valor ?? null]
    );
    res.json({ ok: true, chave, valor });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// ── GET /api/config/fase-prazos ───────────────────
router.get('/fase-prazos', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM fase_prazos ORDER BY servico_grupo, fase_id');
    res.json(rows);
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// ── PUT /api/config/fase-prazos/:faseId ───────────
router.put('/fase-prazos/:faseId', async (req, res) => {
  if (req.user.role === 'colaborador') return res.status(403).json({ erro: 'Acesso negado' });
  try {
    const { prazo_dias } = req.body;
    const dias = parseInt(prazo_dias);
    if (isNaN(dias) || dias < 1) return res.status(400).json({ erro: 'prazo_dias inválido' });
    await db.query('UPDATE fase_prazos SET prazo_dias = ? WHERE fase_id = ?', [dias, req.params.faseId]);
    res.json({ ok: true, fase_id: req.params.faseId, prazo_dias: dias });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// ── GET /api/config/modelos-documentos ────────────
router.get('/modelos-documentos', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM modelos_documentos ORDER BY nome ASC');
    res.json(rows);
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// ── POST /api/config/modelos-documentos ───────────
router.post('/modelos-documentos', async (req, res) => {
  if (req.user.role === 'colaborador') return res.status(403).json({ erro: 'Acesso negado' });
  try {
    const { nome, tipo, conteudo_html } = req.body;
    if (!nome?.trim() || !conteudo_html?.trim()) {
      return res.status(400).json({ erro: 'nome e conteudo_html são obrigatórios' });
    }
    const [r] = await db.query(
      'INSERT INTO modelos_documentos (nome, tipo, conteudo_html) VALUES (?,?,?)',
      [nome.trim(), tipo || 'outro', conteudo_html]
    );
    const [[novo]] = await db.query('SELECT * FROM modelos_documentos WHERE id = ?', [r.insertId]);
    res.status(201).json(novo);
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// ── PATCH /api/config/modelos-documentos/:id ──────
router.patch('/modelos-documentos/:id', async (req, res) => {
  if (req.user.role === 'colaborador') return res.status(403).json({ erro: 'Acesso negado' });
  try {
    const { nome, tipo, conteudo_html, ativo } = req.body;
    const sets = []; const params = [];
    if (nome !== undefined)          { sets.push('nome=?');          params.push(nome); }
    if (tipo !== undefined)          { sets.push('tipo=?');          params.push(tipo); }
    if (conteudo_html !== undefined) { sets.push('conteudo_html=?'); params.push(conteudo_html); }
    if (ativo !== undefined)         { sets.push('ativo=?');         params.push(ativo ? 1 : 0); }
    if (!sets.length) return res.status(400).json({ erro: 'Nada para atualizar' });
    params.push(req.params.id);
    await db.query(`UPDATE modelos_documentos SET ${sets.join(', ')} WHERE id=?`, params);
    const [[up]] = await db.query('SELECT * FROM modelos_documentos WHERE id = ?', [req.params.id]);
    res.json(up);
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// ── DELETE /api/config/modelos-documentos/:id ─────
router.delete('/modelos-documentos/:id', async (req, res) => {
  if (req.user.role === 'colaborador') return res.status(403).json({ erro: 'Acesso negado' });
  try {
    await db.query('DELETE FROM modelos_documentos WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

module.exports = router;
