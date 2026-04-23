const router = require('express').Router();
const db     = require('../db');
const auth   = require('../middleware/auth');
const { sendEmail } = require('../lib/email');

const EQUIPE_EMAIL = process.env.EQUIPE_EMAIL || 'wbassessoria.contato@gmail.com';
const PORTAL_URL   = 'https://wb-erp-production.up.railway.app';

function fmtData(v) {
  if (!v) return '—';
  return new Date(String(v).slice(0, 10) + 'T12:00').toLocaleDateString('pt-BR');
}

// ── POST /api/notificar/agendamentos ─────────────────────────────────────────
// Envia lembrete ao cliente (amanhã) + resumo do dia para a equipe
router.post('/agendamentos', auth, async (req, res) => {
  if (req.user.role === 'cliente') return res.status(403).json({ erro: 'Acesso negado' });
  try {
    const hoje   = new Date();
    const amanha = new Date(hoje); amanha.setDate(amanha.getDate() + 1);
    const dataAmanha = amanha.toISOString().slice(0, 10);
    const dataHoje   = hoje.toISOString().slice(0, 10);

    // Agendamentos de amanhã com email do cliente
    const [agAmanha] = await db.query(`
      SELECT a.*, c.email, c.nome AS cli_nome
      FROM agendamentos a
      LEFT JOIN clientes c ON c.id = a.cliente_id
      WHERE a.data = ?
      ORDER BY a.hora ASC
    `, [dataAmanha]);

    // Agendamentos de hoje para o resumo da equipe
    const [agHoje] = await db.query(`
      SELECT a.*, c.nome AS cli_nome
      FROM agendamentos a
      LEFT JOIN clientes c ON c.id = a.cliente_id
      WHERE a.data = ?
      ORDER BY a.hora ASC
    `, [dataHoje]);

    let enviadosClientes = 0;

    // Lembrete individual para cada cliente com agendamento amanhã
    for (const ag of agAmanha) {
      const email = ag.email;
      const nome  = ag.cli_nome || ag.cliente_nome || 'Cliente';
      if (!email) continue;
      try {
        await sendEmail(
          email,
          `📅 Lembrete: seu atendimento é amanhã — WB Assessoria`,
          `<div style="font-family:Arial,sans-serif;max-width:500px;padding:24px;background:#f9f9f9;border-radius:8px">
            <h2 style="color:#c9a84c">WB Assessoria Migratória</h2>
            <p>Olá, <b>${nome}</b>!</p>
            <p>Lembramos que você tem um atendimento agendado para <b>amanhã</b>:</p>
            <div style="background:#fff;border:1px solid #ddd;border-radius:6px;padding:14px;margin:14px 0">
              <div style="font-size:1rem;font-weight:700;color:#c9a84c">📅 ${fmtData(ag.data)} às ${ag.hora || '—'}</div>
              <div style="margin-top:6px"><b>Tipo:</b> ${ag.tipo || 'Reunião'}</div>
              ${ag.obs ? `<div style="margin-top:4px;color:#666;font-size:0.9rem">${ag.obs}</div>` : ''}
            </div>
            <p>Por favor, lembre-se de trazer seus documentos, se necessário.</p>
            <p>Qualquer dúvida, entre em contato pelo WhatsApp.</p>
            <a href="${PORTAL_URL}?portal=cliente" style="display:inline-block;margin-top:12px;padding:12px 24px;background:#c9a84c;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold">Acessar Portal</a>
            <p style="margin-top:20px;color:#999;font-size:0.8rem">Equipe WB Assessoria Migratória 🇧🇷</p>
          </div>`
        );
        enviadosClientes++;
      } catch {}
    }

    // Resumo do dia para a equipe (agendamentos de hoje)
    if (agHoje.length > 0) {
      const linhas = agHoje.map(ag =>
        `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:700;color:#c9a84c">${ag.hora || '—'}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee">${ag.cli_nome || ag.cliente_nome || '—'}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee">${ag.tipo || 'Reunião'}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;color:#666;font-size:0.85em">${ag.obs || ''}</td>
        </tr>`
      ).join('');

      try {
        await sendEmail(
          EQUIPE_EMAIL,
          `📋 Agenda de hoje — ${fmtData(dataHoje)} (${agHoje.length} atendimento${agHoje.length > 1 ? 's' : ''})`,
          `<div style="font-family:Arial,sans-serif;max-width:600px;padding:24px;background:#f9f9f9;border-radius:8px">
            <h2 style="color:#c9a84c">WB Assessoria — Agenda do Dia</h2>
            <p><b>${fmtData(dataHoje)}</b> — ${agHoje.length} atendimento(s) agendado(s)</p>
            <table style="width:100%;border-collapse:collapse;background:#fff;border-radius:6px;overflow:hidden;border:1px solid #ddd">
              <thead>
                <tr style="background:#c9a84c;color:#fff">
                  <th style="padding:10px 12px;text-align:left">Hora</th>
                  <th style="padding:10px 12px;text-align:left">Cliente</th>
                  <th style="padding:10px 12px;text-align:left">Tipo</th>
                  <th style="padding:10px 12px;text-align:left">Obs</th>
                </tr>
              </thead>
              <tbody>${linhas}</tbody>
            </table>
            <a href="${PORTAL_URL}" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#c9a84c;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold">Abrir Sistema</a>
          </div>`
        );
      } catch {}
    }

    res.json({ ok: true, enviados_clientes: enviadosClientes, agendamentos_hoje: agHoje.length, agendamentos_amanha: agAmanha.length });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// ── POST /api/notificar/parcelas ──────────────────────────────────────────────
// Envia lembrete de parcelas vencendo nos próximos 3 dias
router.post('/parcelas', auth, async (req, res) => {
  if (req.user.role === 'cliente') return res.status(403).json({ erro: 'Acesso negado' });
  try {
    const [parcelas] = await db.query(`
      SELECT p.id, p.descricao, p.valor, p.vencimento,
             c.nome, c.email
      FROM parcelas p
      JOIN clientes c ON c.id = p.cliente_id
      WHERE p.paga = 0
        AND c.email IS NOT NULL AND c.email != ''
        AND p.vencimento BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 3 DAY)
        AND c.arquivado = 0
    `);

    if (!parcelas.length) return res.json({ ok: true, enviados: 0 });

    let enviados = 0;
    for (const p of parcelas) {
      const diff   = Math.ceil((new Date(String(p.vencimento).slice(0,10)+'T12:00') - new Date()) / 864e5);
      const quando = diff <= 0 ? 'HOJE' : `em ${diff} dia(s)`;
      const dtFmt  = fmtData(p.vencimento);
      try {
        await sendEmail(
          p.email,
          `⚠️ Parcela vence ${quando} — WB Assessoria`,
          `<div style="font-family:Arial,sans-serif;max-width:500px;padding:24px;background:#f9f9f9;border-radius:8px">
            <h2 style="color:#c9a84c">WB Assessoria Migratória</h2>
            <p>Olá, <b>${p.nome}</b>!</p>
            <p>Você tem uma parcela com vencimento <b>${quando}</b>:</p>
            <div style="background:#fff;border:1px solid #ddd;border-radius:6px;padding:14px;margin:14px 0">
              <div><b>${p.descricao || 'Parcela'}</b></div>
              <div style="font-size:1.2rem;font-weight:700;color:#c9a84c;margin-top:4px">R$ ${(parseFloat(p.valor)||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</div>
              <div style="font-size:0.85rem;color:#666;margin-top:4px">Vencimento: ${dtFmt}</div>
            </div>
            <p><b>Chave PIX:</b> wbassessoria.contato@gmail.com</p>
            <a href="${PORTAL_URL}?portal=cliente" style="display:inline-block;margin-top:12px;padding:12px 24px;background:#c9a84c;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold">Acessar Portal</a>
          </div>`
        );
        enviados++;
      } catch {}
    }
    res.json({ ok: true, enviados, total: parcelas.length });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// ── POST /api/notificar/tudo ──────────────────────────────────────────────────
// Dispara todas as notificações de uma vez (usado pelo cron do Railway)
router.post('/tudo', auth, async (req, res) => {
  if (req.user.role === 'cliente') return res.status(403).json({ erro: 'Acesso negado' });
  try {
    const [r1, r2] = await Promise.allSettled([
      fetch(`${PORTAL_URL}/api/notificar/agendamentos`, { method:'POST', headers:{ 'Authorization': req.headers.authorization, 'Content-Type':'application/json' } }),
      fetch(`${PORTAL_URL}/api/notificar/parcelas`,     { method:'POST', headers:{ 'Authorization': req.headers.authorization, 'Content-Type':'application/json' } }),
    ]);
    res.json({ ok: true, agendamentos: r1.status, parcelas: r2.status });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

module.exports = router;
