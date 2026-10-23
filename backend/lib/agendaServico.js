// Parte da agenda pública que fala com o banco e manda e-mail — usada pela
// landing page (leads.js), pela página de confirmação (agendamentos.js) e
// pelo lembrete diário (server.js).
const { lerConfig, agoraSP, somaDias, horarioDisponivel, novoToken, escHtml, fmtDataBR } = require('./agendaPublica');
const { sendEmail } = require('./email');

const PORTAL_URL   = 'https://sistema.wbassessoriamigratoria.com.br';
const EQUIPE_EMAIL = process.env.EQUIPE_EMAIL || 'wbassessoria.contato@gmail.com';
const WHATSAPP     = '5511914258886';

const linkAgendamento = (token) => `${PORTAL_URL}/agendamento.html?token=${token}`;

async function carregarConfig(db) {
  const [rows] = await db.query("SELECT chave, valor FROM config_sistema WHERE chave LIKE 'agenda\\_%'");
  const cfg = {};
  rows.forEach(r => { cfg[r.chave] = r.valor; });
  return lerConfig(cfg);
}

// Horários já tomados (qualquer agendamento não cancelado, inclusive os
// marcados pela equipe) — 1 atendimento por horário.
async function carregarOcupados(db, conf, excetoId = null) {
  const hoje = agoraSP().data;
  const [rows] = await db.query(
    `SELECT DATE_FORMAT(data, '%Y-%m-%d') AS d, hora FROM agendamentos
     WHERE data BETWEEN ? AND ? AND (status IS NULL OR status <> 'cancelado') AND id <> ?`,
    [hoje, somaDias(hoje, conf.diasFrente), excetoId || 0]
  );
  return new Set(rows.map(r => `${r.d} ${String(r.hora || '').slice(0, 5)}`));
}

async function verificarHorario(db, data, hora, excetoId = null) {
  const conf = await carregarConfig(db);
  const ocupados = await carregarOcupados(db, conf, excetoId);
  return horarioDisponivel(conf, data, hora, ocupados);
}

function blocoDataHora(data, hora, tipo) {
  return `<div style="background:#fff;border-left:4px solid #c9a84c;padding:16px;border-radius:0 8px 8px 0;margin:16px 0">
    <div style="font-size:0.9rem;color:#666">Data</div>
    <div style="font-weight:700;font-size:1.1rem;color:#333">${escHtml(fmtDataBR(data))}</div>
    <div style="font-size:0.9rem;color:#666;margin-top:8px">Horário</div>
    <div style="font-weight:700;font-size:1.1rem;color:#333">${escHtml(hora)}</div>
    ${tipo ? `<div style="font-size:0.9rem;color:#666;margin-top:8px">Tipo</div><div style="font-weight:600;color:#333">${escHtml(tipo)}</div>` : ''}
  </div>`;
}

function botoesConfirmacao(token) {
  const url = linkAgendamento(token);
  return `<p style="margin:20px 0 8px">
      <a href="${url}&acao=confirmar" style="background:#16a34a;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:700;display:inline-block;margin:0 6px 8px 0">✅ Confirmar presença</a>
      <a href="${url}" style="background:#fff;color:#555;border:1px solid #ccc;padding:11px 18px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;margin:0 0 8px">Reagendar ou cancelar</a>
    </p>`;
}

function rodape() {
  return `<p style="color:#888;font-size:13px;margin-top:18px">Dúvidas? Fale conosco pelo WhatsApp: <a href="https://wa.me/${WHATSAPP}" style="color:#c9a84c">(11) 91425-8886</a></p>`;
}

// E-mail logo depois de marcar pela landing page: pede pra confirmar.
async function enviarPedidoConfirmacao(ag) {
  if (!ag.email) return;
  await sendEmail(ag.email, '📅 Confirme seu atendimento — WB Assessoria',
    `<div style="font-family:Arial,sans-serif;max-width:520px;padding:24px;background:#f9f9f9;border-radius:8px">
      <h2 style="color:#c9a84c;margin-top:0">WB Assessoria Migratória</h2>
      <p>Olá, <b>${escHtml(ag.nome)}</b>! Recebemos seu pedido de atendimento para:</p>
      ${blocoDataHora(ag.data, ag.hora, ag.tipo)}
      <p>Clique abaixo para <b>confirmar sua presença</b>. Se não puder nesse horário, é só reagendar.</p>
      ${botoesConfirmacao(ag.token)}
      ${rodape()}
    </div>`);
}

// Aviso interno pra equipe quando alguém marca/confirma/cancela pela internet.
async function avisarEquipe(assunto, ag, extra = '') {
  await sendEmail(EQUIPE_EMAIL, assunto,
    `<div style="font-family:Arial,sans-serif;max-width:600px;padding:24px;background:#f9f9f9;border-radius:8px">
      <h2 style="color:#c9a84c;margin-top:0">WB Assessoria — Agenda</h2>
      <p><b>${escHtml(ag.nome)}</b>${extra}</p>
      ${blocoDataHora(ag.data, ag.hora, ag.tipo)}
      <div style="background:#fff;border:1px solid #ddd;border-radius:6px;padding:14px;margin:14px 0">
        <div><b>WhatsApp:</b> ${escHtml(ag.tel || '—')}</div>
        <div><b>E-mail:</b> ${escHtml(ag.email || '—')}</div>
        ${ag.obs ? `<div><b>Obs:</b> ${escHtml(ag.obs)}</div>` : ''}
      </div>
      <p><a href="${PORTAL_URL}" style="background:#c9a84c;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:700">Abrir a Agenda</a></p>
    </div>`);
}

module.exports = {
  PORTAL_URL, EQUIPE_EMAIL, WHATSAPP, linkAgendamento, novoToken,
  carregarConfig, carregarOcupados, verificarHorario,
  blocoDataHora, botoesConfirmacao, rodape, enviarPedidoConfirmacao, avisarEquipe,
};
