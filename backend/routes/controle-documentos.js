const router = require('express').Router();
const db     = require('../db');
const auth   = require('../middleware/auth');
const { htmlParaPdfBase64 } = require('../lib/pdf');

// Lista padrão definida pela equipe; as 2 linhas em branco são pra documentos avulsos.
const ITENS_PADRAO = [
  'E-mail com a informação do agendamento (Impresso)',
  'Declaração de adaptação de nome',
  'RNM ORIGINAL',
  'Comprovante de situação cadastral',
  'Certidão Criminal Estadual de todos Estados em que morou',
  'Certidão Criminal Federal de todos Estados em que morou',
  'Atestado Criminal legalizado',
  'Tradução ORIGINAL do Atestado Criminal',
  'Carteira de trabalho / Extrato CNIS',
  'Comprovante de endereço atualizado',
  'Passaporte ( Todos que tiver )',
  'Certificado de língua portuguesa (ORIGINAL)',
  'Declaração de aula presencial (ORIGINAL)',
  '',
  '',
].map(documento => ({ documento, ok: false, observacao: '' }));

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

function fmtDataBR(iso) {
  if (!iso) return '';
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  return (y && m && d) ? `${d}/${m}/${y}` : '';
}

function montarHtmlControle(nomeCliente, d) {
  const linhasItens = (Array.isArray(d.itens) ? d.itens : []).map(it => `
    <tr>
      <td style="padding:6px 8px;border:1px solid #ccc">${esc(it.documento)}</td>
      <td style="padding:6px 8px;border:1px solid #ccc;text-align:center;font-size:14px">${it.ok ? '☑' : '☐'}</td>
      <td style="padding:6px 8px;border:1px solid #ccc">${esc(it.observacao)}</td>
    </tr>`).join('');

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font-family:Arial,sans-serif;color:#222;font-size:12px;padding:0;margin:0}
    h1{font-size:15px;margin:0 0 4px;color:#8a6d1f}
    h2{font-size:13px;margin:0 0 10px;color:#222}
    table{width:100%;border-collapse:collapse;margin-top:6px}
    th{background:#f2ede0;border:1px solid #ccc;padding:6px 8px;text-align:left;font-size:11px;text-transform:uppercase}
    .campo{margin-top:14px}
    .campo-label{font-weight:700;font-size:11px;text-transform:uppercase;color:#555;margin-bottom:3px}
    .campo-box{border:1px solid #ccc;border-radius:4px;padding:8px;min-height:36px;white-space:pre-wrap}
  </style></head><body>
    <h1>WB ASSESSORIA MIGRATÓRIA — CONTROLE DE DOCUMENTOS</h1>
    <h2>${esc(nomeCliente)}</h2>
    <div style="font-size:11px;margin-bottom:8px">
      Processo nº: ${esc(d.processo_n) || '______________________'} &nbsp;&nbsp;&nbsp;
      Protocolo: ${esc(d.protocolo) || '______________________'} &nbsp;&nbsp;&nbsp;
      Data: ${fmtDataBR(d.data_controle) || '____/____/______'}
    </div>
    <table>
      <tr><th style="width:58%">DOCUMENTO</th><th style="width:10%">OK</th><th>OBSERVAÇÃO</th></tr>
      ${linhasItens}
    </table>
    <div class="campo">
      <div class="campo-label">Situação Atual</div>
      <div class="campo-box">${esc(d.situacao_atual)}</div>
    </div>
    <div class="campo">
      <div class="campo-label">Pendências</div>
      <div class="campo-box">${esc(d.pendencias)}</div>
    </div>
    <div class="campo">
      <div class="campo-label">Próximo Passo / Prazo</div>
      <div class="campo-box">${esc(d.proximo_passo)}</div>
    </div>
  </body></html>`;
}

router.use(auth);

// ── GET /api/controle-documentos/padrao/itens ─────
router.get('/padrao/itens', (req, res) => res.json(ITENS_PADRAO));

// ── GET /api/controle-documentos/:clienteId ───────
router.get('/:clienteId', async (req, res) => {
  try {
    const cid = parseInt(req.params.clienteId);
    if (isNaN(cid)) return res.status(400).json({ erro: 'clienteId inválido' });

    const [[row]] = await db.query('SELECT * FROM controle_documentos WHERE cliente_id = ?', [cid]);
    if (!row) {
      return res.json({
        cliente_id: cid, processo_n: '', protocolo: '', data_controle: '',
        itens: ITENS_PADRAO, situacao_atual: '', pendencias: '', proximo_passo: '',
      });
    }

    let itens = ITENS_PADRAO;
    try {
      const parsed = JSON.parse(row.itens_json);
      if (Array.isArray(parsed) && parsed.length) itens = parsed;
    } catch { /* mantém padrão se o JSON salvo estiver corrompido */ }

    res.json({
      cliente_id: cid,
      processo_n: row.processo_n || '',
      protocolo: row.protocolo || '',
      data_controle: row.data_controle ? String(row.data_controle).slice(0, 10) : '',
      itens,
      situacao_atual: row.situacao_atual || '',
      pendencias: row.pendencias || '',
      proximo_passo: row.proximo_passo || '',
    });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// ── PATCH /api/controle-documentos/:clienteId ─────
router.patch('/:clienteId', async (req, res) => {
  try {
    const cid = parseInt(req.params.clienteId);
    if (isNaN(cid)) return res.status(400).json({ erro: 'clienteId inválido' });

    const { processo_n, protocolo, data_controle, itens, situacao_atual, pendencias, proximo_passo } = req.body;
    const itensJson = JSON.stringify(Array.isArray(itens) && itens.length ? itens : ITENS_PADRAO);

    await db.query(
      `INSERT INTO controle_documentos
        (cliente_id, processo_n, protocolo, data_controle, itens_json, situacao_atual, pendencias, proximo_passo)
       VALUES (?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE
         processo_n = VALUES(processo_n), protocolo = VALUES(protocolo), data_controle = VALUES(data_controle),
         itens_json = VALUES(itens_json), situacao_atual = VALUES(situacao_atual),
         pendencias = VALUES(pendencias), proximo_passo = VALUES(proximo_passo), updated_at = NOW()`,
      [cid, processo_n || null, protocolo || null, data_controle || null, itensJson,
       situacao_atual || null, pendencias || null, proximo_passo || null]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// ── POST /api/controle-documentos/:clienteId/pdf ──
// Gera o PDF a partir dos dados enviados no corpo (reflete o que está na
// tela na hora, mesmo que ainda não tenha sido salvo).
router.post('/:clienteId/pdf', async (req, res) => {
  try {
    const cid = parseInt(req.params.clienteId);
    if (isNaN(cid)) return res.status(400).json({ erro: 'clienteId inválido' });

    const [[cliente]] = await db.query('SELECT nome FROM clientes WHERE id = ?', [cid]);
    if (!cliente) return res.status(404).json({ erro: 'Cliente não encontrado' });

    const { processo_n, protocolo, data_controle, itens, situacao_atual, pendencias, proximo_passo } = req.body;
    const html = montarHtmlControle(cliente.nome, {
      processo_n, protocolo, data_controle,
      itens: Array.isArray(itens) && itens.length ? itens : ITENS_PADRAO,
      situacao_atual, pendencias, proximo_passo,
    });
    const pdf_base64 = await htmlParaPdfBase64(html);
    res.json({ pdf_base64 });
  } catch (e) {
    console.error('[controle-documentos PDF]', e);
    res.status(500).json({ erro: e.message });
  }
});

module.exports = router;
