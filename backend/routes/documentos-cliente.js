const router    = require('express').Router();
const db        = require('../db');
const auth      = require('../middleware/auth');
const crypto    = require('crypto');
const rateLimit = require('express-rate-limit');
const { htmlParaPdfBase64, mesclarTemplate, dadosParaTemplate } = require('../lib/pdf');

// Rate limit restrito só pro endpoint público de assinatura: 20 tentativas
// por IP a cada hora (visualizar + assinar)
const limiterAssinatura = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  keyGenerator: (req) => req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip,
  message: { erro: 'Muitas tentativas. Tente novamente mais tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── GET /api/documentos-cliente/assinar/:token ────
// Sem autenticação — o cliente acessa pelo link público pra ver/assinar o
// documento. O token funciona como a "chave" de acesso a esse documento
// específico (só quem tem o link consegue ver).
router.get('/assinar/:token', limiterAssinatura, async (req, res) => {
  try {
    const [[doc]] = await db.query(
      `SELECT d.id, d.nome, d.pdf_base64, d.assinado_em, d.assinado_nome, c.nome AS cliente_nome
       FROM documentos_cliente d LEFT JOIN clientes c ON c.id = d.cliente_id
       WHERE d.assinatura_token = ?`,
      [req.params.token]
    );
    if (!doc) return res.status(404).json({ erro: 'Link inválido ou expirado' });
    res.json({
      nome: doc.nome,
      pdf_base64: doc.pdf_base64,
      cliente_nome: doc.cliente_nome,
      assinado: !!doc.assinado_em,
      assinado_em: doc.assinado_em,
      assinado_nome: doc.assinado_nome,
    });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// ── POST /api/documentos-cliente/assinar/:token ───
// Sem autenticação — registra a assinatura eletrônica (nome digitado +
// IP + data/hora). É uma assinatura "clique pra concordar" com trilha de
// auditoria (nome, IP, timestamp) — não é certificado digital ICP-Brasil
// nem integração com provedor de assinatura (Clicksign/DocuSign/D4Sign).
router.post('/assinar/:token', limiterAssinatura, async (req, res) => {
  try {
    const { nome } = req.body;
    if (!nome?.trim() || nome.trim().length > 200) return res.status(400).json({ erro: 'Nome inválido' });

    const [[doc]] = await db.query(
      'SELECT id, assinado_em FROM documentos_cliente WHERE assinatura_token = ?',
      [req.params.token]
    );
    if (!doc) return res.status(404).json({ erro: 'Link inválido ou expirado' });
    if (doc.assinado_em) return res.status(409).json({ erro: 'Este documento já foi assinado' });

    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || null;

    await db.query(
      'UPDATE documentos_cliente SET assinado_em = NOW(), assinado_nome = ?, assinado_ip = ? WHERE id = ?',
      [nome.trim().slice(0, 200), ip, doc.id]
    );

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

router.use(auth);

// Gera (ou regera) os documentos de um cliente a partir dos modelos ativos.
// Usado tanto no cadastro automático quanto no botão manual "Gerar novamente".
async function gerarDocumentosCliente(clienteId) {
  const [[cliente]] = await db.query('SELECT * FROM clientes WHERE id = ?', [clienteId]);
  if (!cliente) return [];

  const [modelos] = await db.query('SELECT * FROM modelos_documentos WHERE ativo = 1');
  if (!modelos.length) return [];

  const dados = dadosParaTemplate(cliente);
  const gerados = [];

  for (const modelo of modelos) {
    try {
      const htmlMesclado = mesclarTemplate(modelo.conteudo_html, dados);
      const pdfBase64 = await htmlParaPdfBase64(htmlMesclado);
      const [r] = await db.query(
        'INSERT INTO documentos_cliente (cliente_id, modelo_id, nome, pdf_base64) VALUES (?,?,?,?)',
        [clienteId, modelo.id, modelo.nome, pdfBase64]
      );
      gerados.push({ id: r.insertId, nome: modelo.nome });
    } catch (e) {
      console.error(`[documentos-cliente] Erro ao gerar "${modelo.nome}" para cliente ${clienteId}:`, e.message);
    }
  }
  return gerados;
}

// ── GET /api/documentos-cliente/:clienteId ────────
// Lista os documentos gerados (sem o base64, pra não pesar o payload)
router.get('/:clienteId', async (req, res) => {
  try {
    const cid = parseInt(req.params.clienteId);
    if (isNaN(cid)) return res.status(400).json({ erro: 'clienteId inválido' });
    const [rows] = await db.query(
      'SELECT id, cliente_id, modelo_id, nome, gerado_em, assinado_em, assinado_nome FROM documentos_cliente WHERE cliente_id = ? ORDER BY gerado_em DESC',
      [cid]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// ── GET /api/documentos-cliente/:clienteId/:docId/pdf ─
// Retorna o base64 de um documento específico (pro download)
router.get('/:clienteId/:docId/pdf', async (req, res) => {
  try {
    const { clienteId, docId } = req.params;
    const [[doc]] = await db.query(
      'SELECT nome, pdf_base64 FROM documentos_cliente WHERE id = ? AND cliente_id = ?',
      [docId, clienteId]
    );
    if (!doc) return res.status(404).json({ erro: 'Documento não encontrado' });
    res.json({ nome: doc.nome, pdf_base64: doc.pdf_base64 });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// ── POST /api/documentos-cliente/:clienteId/:docId/link-assinatura ─
// Gera (ou reaproveita) o token de assinatura e devolve o link público
router.post('/:clienteId/:docId/link-assinatura', async (req, res) => {
  try {
    const { clienteId, docId } = req.params;
    const [[doc]] = await db.query(
      'SELECT id, assinatura_token, assinado_em FROM documentos_cliente WHERE id = ? AND cliente_id = ?',
      [docId, clienteId]
    );
    if (!doc) return res.status(404).json({ erro: 'Documento não encontrado' });

    let token = doc.assinatura_token;
    if (!token) {
      token = crypto.randomBytes(24).toString('hex');
      await db.query('UPDATE documentos_cliente SET assinatura_token = ? WHERE id = ?', [token, doc.id]);
    }

    res.json({
      url: `https://sistema.wbassessoriamigratoria.com.br/assinar.html?token=${token}`,
      assinado: !!doc.assinado_em,
    });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// ── POST /api/documentos-cliente/:clienteId/gerar ─
// Gera (ou regera) os documentos desse cliente a partir dos modelos ativos
router.post('/:clienteId/gerar', async (req, res) => {
  try {
    const cid = parseInt(req.params.clienteId);
    if (isNaN(cid)) return res.status(400).json({ erro: 'clienteId inválido' });
    const gerados = await gerarDocumentosCliente(cid);
    res.json({ ok: true, gerados: gerados.length, documentos: gerados });
  } catch (e) {
    console.error('[documentos-cliente POST /gerar]', e);
    res.status(500).json({ erro: e.message });
  }
});

// ── DELETE /api/documentos-cliente/:id ────────────
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM documentos_cliente WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

module.exports = router;
module.exports.gerarDocumentosCliente = gerarDocumentosCliente;
