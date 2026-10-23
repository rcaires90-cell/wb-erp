// Parte da agenda pública que fala com o banco e manda e-mail — usada pela
// landing page (leads.js), pela página de confirmação (agendamentos.js) e
// pelo lembrete diário (server.js).
const { lerConfig, agoraSP, somaDias, horarioDisponivel, diaAConfirmarDisponivel, horariosDoDia, novoToken, escHtml, fmtDataBR } = require('./agendaPublica');
const google = require('./googleCalendar');
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
  const ocupados = new Set(rows.map(r => `${r.d} ${String(r.hora || '').slice(0, 5)}`));

  // Compromissos do Google Agenda da empresa também bloqueiam horários.
  // Se o Google falhar, a landing continua funcionando só com a agenda do sistema.
  if (google.ativo()) {
    try {
      const fim = somaDias(hoje, conf.diasFrente);
      const busy = await google.periodosOcupados(hoje, fim);
      if (busy.length) {
        const grade = horariosDoDia(conf);
        for (let i = 0; i <= conf.diasFrente; i++) {
          const d = somaDias(hoje, i);
          for (const h of grade) {
            const ini = Date.parse(google.isoSP(d, h)), f = ini + conf.intervalo * 60000;
            if (busy.some(([a, b]) => a < f && b > ini)) ocupados.add(`${d} ${h}`);
          }
        }
      }
    } catch (e) { console.error('[google] freeBusy:', e.message); }
  }
  return ocupados;
}

// Espelha um agendamento no Google Agenda (cria/atualiza, ou apaga se
// cancelado). Nunca lança erro — Google fora do ar não pode travar a agenda.
async function sincronizarGoogle(db, id) {
  if (!google.ativo()) return;
  try {
    const [[a]] = await db.query(
      `SELECT a.id, DATE_FORMAT(a.data, '%Y-%m-%d') AS data, a.hora, a.tipo, a.status, a.obs, a.origem, a.token,
              a.google_event_id, COALESCE(c.nome, a.cliente_nome) AS nome,
              COALESCE(NULLIF(c.email, ''), a.email) AS email, COALESCE(NULLIF(a.tel, ''), c.tel) AS tel
       FROM agendamentos a LEFT JOIN clientes c ON a.cliente_id = c.id WHERE a.id = ?`, [id]);
    if (!a) return;
    if (a.status === 'cancelado' || !a.hora) {
      // Sem horário (sábado a confirmar) ainda não entra no Google
      await google.removerEvento(a.google_event_id);
      if (a.google_event_id) await db.query('UPDATE agendamentos SET google_event_id = NULL WHERE id = ?', [id]);
    } else {
      const conf = await carregarConfig(db);
      const evId = await google.salvarEvento({ ...a, link: a.token ? linkAgendamento(a.token) : null }, a.google_event_id, conf.intervalo);
      if (evId && evId !== a.google_event_id) await db.query('UPDATE agendamentos SET google_event_id = ? WHERE id = ?', [evId, id]);
    }
    google.limparCacheOcupados();
  } catch (e) { console.error(`[google] sincronizar agendamento ${id}:`, e.message); }
}

async function verificarHorario(db, data, hora, excetoId = null) {
  const conf = await carregarConfig(db);
  const ocupados = await carregarOcupados(db, conf, excetoId);
  return horarioDisponivel(conf, data, hora, ocupados);
}

async function verificarDiaAConfirmar(db, data) {
  return diaAConfirmarDisponivel(await carregarConfig(db), data);
}

function blocoDataHora(data, hora, tipo) {
  return `<div style="background:#fff;border-left:4px solid #c9a84c;padding:16px;border-radius:0 8px 8px 0;margin:16px 0">
    <div style="font-size:0.9rem;color:#666">Data</div>
    <div style="font-weight:700;font-size:1.1rem;color:#333">${escHtml(fmtDataBR(data))}</div>
    <div style="font-size:0.9rem;color:#666;margin-top:8px">Horário</div>
    <div style="font-weight:700;font-size:1.1rem;color:#333">${hora ? escHtml(String(hora).slice(0, 5)) : 'A confirmar pela equipe'}</div>
    ${tipo ? `<div style="font-size:0.9rem;color:#666;margin-top:8px">Tipo</div><div style="font-weight:600;color:#333">${escHtml(tipo)}</div>` : ''}
  </div>`;
}

function botoesConfirmacao(token) {
  const url = linkAgendamento(token);
  return `<p style="margin:20px 0 8px">
      <a href="${url}&acao=confirmar" style="background:#c9a84c;color:#000;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:700;display:inline-block;margin:0 6px 8px 0">✅ Confirmar presença</a>
      <a href="${url}" style="background:#fff;color:#555;border:1px solid #ccc;padding:11px 18px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;margin:0 0 8px">Reagendar ou cancelar</a>
    </p>`;
}

function rodape() {
  return `<p style="color:#888;font-size:13px;margin-top:18px">Dúvidas? Fale conosco pelo WhatsApp: <a href="https://wa.me/${WHATSAPP}" style="color:#c9a84c">(11) 91425-8886</a></p>`;
}

// E-mail logo depois de marcar pela landing page: pede pra confirmar.
async function enviarPedidoConfirmacao(ag) {
  if (!ag.email) return;
  if (!ag.hora) {
    await sendEmail(ag.email, '📅 Recebemos seu pedido de atendimento — WB Assessoria',
      `<div style="font-family:Arial,sans-serif;max-width:520px;padding:24px;background:#f9f9f9;border-radius:8px">
        <h2 style="color:#c9a84c;margin-top:0">WB Assessoria Migratória</h2>
        <p>Olá, <b>${escHtml(ag.nome)}</b>! Recebemos seu pedido de atendimento para:</p>
        ${blocoDataHora(ag.data, null, ag.tipo)}
        <p>Nossa equipe vai entrar em contato para <b>confirmar o horário</b>. Assim que estiver definido, você recebe outro e-mail para confirmar sua presença.</p>
        ${rodape()}
      </div>`);
    return;
  }
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
  carregarConfig, carregarOcupados, verificarHorario, verificarDiaAConfirmar, sincronizarGoogle,
  blocoDataHora, botoesConfirmacao, rodape, enviarPedidoConfirmacao, avisarEquipe,
};
