const router      = require('express').Router();
const db          = require('../db');
const auth        = require('../middleware/auth');
const https       = require('https');
const { sendEmail } = require('../lib/email');

const PORTAL_URL  = 'https://wb-erp-production.up.railway.app';
const EQUIPE_EMAIL = process.env.EQUIPE_EMAIL || 'wbassessoria.contato@gmail.com';

// Busca resultados do DOU para um nome/termo
// data = 'DD-MM-YYYY' para dia específico | null = histórico completo (2020 até hoje)
async function buscarDOU(termo, data) {
  const query = encodeURIComponent(termo);
  let url;
  if (data) {
    url = `https://www.in.gov.br/consulta/-/buscar/dou?q=${query}&s=do1&exactDate=${data}&delta=20&start=0`;
  } else {
    const hoje = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    url = `https://www.in.gov.br/consulta/-/buscar/dou?q=${query}&s=do1&exactDate=personalizado&publishFrom=2020-01-01&publishTo=${hoje}&delta=20&start=0`;
  }

  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120',
        'Accept': 'text/html,application/xhtml+xml',
      },
      timeout: 15000,
    }, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try {
          // O DOU embute os resultados como JSON na página
          const match = body.match(/"jsonArray":(\[[\s\S]*?\])(?=\s*[,}])/);
          if (!match) { resolve([]); return; }
          const hits = JSON.parse(match[1]);
          resolve(hits);
        } catch (e) {
          resolve([]);
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout DOU')); });
  });
}

function linkDOU(hit) {
  if (!hit?.urlTitle || !hit?.pubDate) return null;
  const [d, m, a] = (hit.pubDate || '').split('/');
  if (!d) return null;
  return `https://www.in.gov.br/web/dou/-/${hit.urlTitle}`;
}

// ── GET /api/dou/verificar?data=DD-MM-YYYY&historico=1 ───────────────────────
// data ausente ou historico=1 → busca todo o histórico desde 2020
router.get('/verificar', auth, async (req, res) => {
  if (req.user.role === 'cliente') return res.status(403).json({ erro: 'Acesso negado' });
  try {
    const historico = req.query.historico === '1';
    const data      = historico ? null : (req.query.data || new Date().toLocaleDateString('pt-BR').replace(/\//g, '-'));

    // Busca clientes de Naturalização
    const [clientes] = await db.query(
      `SELECT id, nome, email, servico, processo_protocolo FROM clientes
       WHERE arquivado = 0 AND servico LIKE '%Naturaliza%'
       ORDER BY nome ASC`
    );

    if (!clientes.length) return res.json({ data, verificados: 0, encontrados: [] });

    const encontrados = [];

    for (const c of clientes) {
      // Prioridade: número do processo (preciso) → nome completo (fallback)
      let termo;
      if (c.processo_protocolo && c.processo_protocolo.trim()) {
        termo = `"${c.processo_protocolo.trim()}"`;
      } else {
        const partes = c.nome.trim().split(/\s+/);
        termo = partes.length >= 2
          ? `"${partes[0]} ${partes[partes.length - 1]}"`
          : `"${c.nome}"`;
      }

      let hits = [];
      try { hits = await buscarDOU(termo, data); } catch(e) { continue; }

      for (const hit of hits) {
        if (!hit.title && !hit.content) continue;

        // Verifica se já foi notificado
        const [ja] = await db.query(
          'SELECT id FROM alertas_dou WHERE cliente_id=? AND classPK=?',
          [c.id, hit.classPK || hit.urlTitle || hit.title]
        );
        if (ja.length) continue;

        // Salva o alerta (usa data real da publicação quando disponível)
        const link    = linkDOU(hit);
        const dataPub = hit.pubDate || data || null;
        await db.query(
          `INSERT INTO alertas_dou (cliente_id, data_pub, titulo, conteudo, link, classPK)
           VALUES (?,?,?,?,?,?)`,
          [c.id, dataPub, hit.title || '', (hit.content||'').replace(/<[^>]+>/g,'').slice(0,500), link, hit.classPK || hit.urlTitle || hit.title]
        );

        encontrados.push({
          cliente_id:   c.id,
          cliente_nome: c.nome,
          titulo:       hit.title,
          data:         hit.pubDate,
          link,
          trecho:       (hit.content||'').replace(/<[^>]+>/g,'').slice(0,300),
        });
      }
    }

    // Envia email de resumo para a equipe se encontrou algo
    if (encontrados.length > 0) {
      const linhas = encontrados.map(e => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:700;color:#c9a84c">${e.cliente_nome}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee">${e.titulo}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:0.85em;color:#555">${e.trecho}...</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee">${e.link ? `<a href="${e.link}" style="color:#c9a84c">Ver publicação</a>` : '—'}</td>
        </tr>`).join('');

      const periodoLabel = data || 'histórico completo (desde 2020)';
      try {
        await sendEmail(
          EQUIPE_EMAIL,
          `🗞️ Diário Oficial — ${encontrados.length} publicação(ões) encontrada(s) — ${periodoLabel}`,
          `<div style="font-family:Arial,sans-serif;max-width:700px;padding:24px;background:#f9f9f9;border-radius:8px">
            <h2 style="color:#c9a84c">WB Assessoria Migratória</h2>
            <p>Foram encontradas <b>${encontrados.length}</b> publicação(ões) no Diário Oficial — <b>${periodoLabel}</b>:</p>
            <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #ddd;border-radius:6px;overflow:hidden">
              <thead><tr style="background:#c9a84c;color:#fff">
                <th style="padding:10px 12px;text-align:left">Cliente</th>
                <th style="padding:10px 12px;text-align:left">Título</th>
                <th style="padding:10px 12px;text-align:left">Trecho</th>
                <th style="padding:10px 12px;text-align:left">Link</th>
              </tr></thead>
              <tbody>${linhas}</tbody>
            </table>
            <a href="${PORTAL_URL}" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#c9a84c;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold">Abrir Sistema</a>
          </div>`
        );
      } catch(e) { console.error('[dou email equipe]', e.message); }
    }

    res.json({ data, verificados: clientes.length, encontrados });
  } catch (e) {
    console.error('[dou GET /verificar]', e);
    res.status(500).json({ erro: e.message });
  }
});

// ── GET /api/dou/historico ────────────────────────────────────────────────────
// Lista todos os alertas já registrados
router.get('/historico', auth, async (req, res) => {
  if (req.user.role === 'cliente') return res.status(403).json({ erro: 'Acesso negado' });
  try {
    const [rows] = await db.query(`
      SELECT a.*, c.nome AS cliente_nome, c.servico
      FROM alertas_dou a
      LEFT JOIN clientes c ON c.id = a.cliente_id
      ORDER BY a.created_at DESC
      LIMIT 200
    `);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// ── DELETE /api/dou/historico/:id ─────────────────────────────────────────────
router.delete('/historico/:id', auth, async (req, res) => {
  if (req.user.role === 'cliente') return res.status(403).json({ erro: 'Acesso negado' });
  try {
    await db.query('DELETE FROM alertas_dou WHERE id=?', [parseInt(req.params.id)]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

module.exports = router;
