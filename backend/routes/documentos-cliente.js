const router = require('express').Router();
const db     = require('../db');
const auth   = require('../middleware/auth');
const { htmlParaPdfBase64, mesclarTemplate, dadosParaTemplate } = require('../lib/pdf');

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
      'SELECT id, cliente_id, modelo_id, nome, gerado_em FROM documentos_cliente WHERE cliente_id = ? ORDER BY gerado_em DESC',
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
