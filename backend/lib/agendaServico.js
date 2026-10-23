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

// ── Textos dos e-mails ao cliente nos 4 idiomas das páginas públicas.
// E-mails internos (pra equipe) continuam sempre em português.
const IDIOMAS_VALIDOS = ['pt', 'es', 'en', 'fr'];
const idiomaOk = (i) => (IDIOMAS_VALIDOS.includes(i) ? i : 'pt');
const NOME_IDIOMA = { pt: 'Português', es: 'Espanhol', en: 'Inglês', fr: 'Francês' };
const LOCALE = { pt: 'pt-BR', es: 'es', en: 'en-US', fr: 'fr-FR' };

const E = {
  data:        { pt: 'Data', es: 'Fecha', en: 'Date', fr: 'Date' },
  horario:     { pt: 'Horário', es: 'Horario', en: 'Time', fr: 'Heure' },
  tipo:        { pt: 'Tipo', es: 'Tipo', en: 'Type', fr: 'Type' },
  aConfirmar:  { pt: 'A confirmar pela equipe', es: 'A confirmar por el equipo', en: 'To be confirmed by our team', fr: "À confirmer par l'équipe" },
  btnConfirmar:{ pt: '✅ Confirmar presença', es: '✅ Confirmar asistencia', en: '✅ Confirm attendance', fr: '✅ Confirmer ma présence' },
  btnReagendar:{ pt: 'Reagendar ou cancelar', es: 'Reprogramar o cancelar', en: 'Reschedule or cancel', fr: 'Reprogrammer ou annuler' },
  duvidas:     { pt: 'Dúvidas? Fale conosco pelo WhatsApp:', es: '¿Dudas? Escríbanos por WhatsApp:', en: 'Questions? Chat with us on WhatsApp:', fr: 'Des questions ? Écrivez-nous sur WhatsApp :' },
  ola:         { pt: 'Olá', es: 'Hola', en: 'Hello', fr: 'Bonjour' },
  recebemos:   { pt: 'Recebemos seu pedido de atendimento para:', es: 'Recibimos su solicitud de atención para:', en: 'We received your appointment request for:', fr: 'Nous avons bien reçu votre demande de rendez-vous pour :' },
  assuntoPedido:{ pt: '📅 Recebemos seu pedido de atendimento — WB Assessoria', es: '📅 Recibimos su solicitud de atención — WB Assessoria', en: '📅 We received your appointment request — WB Assessoria', fr: '📅 Demande de rendez-vous reçue — WB Assessoria' },
  equipeDefine:{ pt: 'Nossa equipe vai entrar em contato para <b>confirmar o horário</b>. Assim que estiver definido, você recebe outro e-mail para confirmar sua presença.',
                 es: 'Nuestro equipo se pondrá en contacto para <b>confirmar el horario</b>. Cuando esté definido, recibirá otro correo para confirmar su asistencia.',
                 en: 'Our team will contact you to <b>confirm the time</b>. Once it is set, you will get another email to confirm your attendance.',
                 fr: "Notre équipe vous contactera pour <b>confirmer l'heure</b>. Une fois fixée, vous recevrez un autre e-mail pour confirmer votre présence." },
  assuntoConfirme:{ pt: '📅 Confirme seu atendimento — WB Assessoria', es: '📅 Confirme su cita — WB Assessoria', en: '📅 Please confirm your appointment — WB Assessoria', fr: '📅 Confirmez votre rendez-vous — WB Assessoria' },
  cliqueConfirmar:{ pt: 'Clique abaixo para <b>confirmar sua presença</b>. Se não puder nesse horário, é só reagendar.',
                    es: 'Haga clic abajo para <b>confirmar su asistencia</b>. Si no puede en ese horario, puede reprogramar.',
                    en: 'Click below to <b>confirm your attendance</b>. If that time does not work, you can reschedule.',
                    fr: 'Cliquez ci-dessous pour <b>confirmer votre présence</b>. Si ce créneau ne vous convient pas, vous pouvez le reprogrammer.' },
  assuntoLembrete:{ pt: '📅 Lembrete de Agendamento — WB Assessoria', es: '📅 Recordatorio de su cita — WB Assessoria', en: '📅 Appointment reminder — WB Assessoria', fr: '📅 Rappel de rendez-vous — WB Assessoria' },
  lembrete:    { pt: 'Este é um lembrete do seu agendamento de amanhã:', es: 'Este es un recordatorio de su cita de mañana:', en: 'This is a reminder of your appointment tomorrow:', fr: 'Ceci est un rappel de votre rendez-vous de demain :' },
  porFavorConfirme:{ pt: 'Por favor, <b>confirme sua presença</b>:', es: 'Por favor, <b>confirme su asistencia</b>:', en: 'Please <b>confirm your attendance</b>:', fr: 'Merci de <b>confirmer votre présence</b> :' },
  'tipo:Consulta inicial': { pt: 'Consulta inicial', es: 'Consulta inicial', en: 'Initial consultation', fr: 'Consultation initiale' },
};
const tx = (k, idioma) => E[k]?.[idiomaOk(idioma)] ?? E[k]?.pt ?? k;
const tipoTx = (tipo, idioma) => (E['tipo:' + tipo] ? tx('tipo:' + tipo, idioma) : tipo);

function fmtData(dataISO, idioma = 'pt') {
  const s = new Date(dataISO + 'T12:00:00Z').toLocaleDateString(LOCALE[idiomaOk(idioma)], { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function blocoDataHora(data, hora, tipo, idioma = 'pt') {
  return `<div style="background:#fff;border-left:4px solid #c9a84c;padding:16px;border-radius:0 8px 8px 0;margin:16px 0">
    <div style="font-size:0.9rem;color:#666">${tx('data', idioma)}</div>
    <div style="font-weight:700;font-size:1.1rem;color:#333">${escHtml(fmtData(data, idioma))}</div>
    <div style="font-size:0.9rem;color:#666;margin-top:8px">${tx('horario', idioma)}</div>
    <div style="font-weight:700;font-size:1.1rem;color:#333">${hora ? escHtml(String(hora).slice(0, 5)) : tx('aConfirmar', idioma)}</div>
    ${tipo ? `<div style="font-size:0.9rem;color:#666;margin-top:8px">${tx('tipo', idioma)}</div><div style="font-weight:600;color:#333">${escHtml(tipoTx(tipo, idioma))}</div>` : ''}
  </div>`;
}

function botoesConfirmacao(token, idioma = 'pt') {
  const url = linkAgendamento(token) + (idiomaOk(idioma) !== 'pt' ? `&lang=${idiomaOk(idioma)}` : '');
  return `<p style="margin:20px 0 8px">
      <a href="${url}&acao=confirmar" style="background:#c9a84c;color:#000;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:700;display:inline-block;margin:0 6px 8px 0">${tx('btnConfirmar', idioma)}</a>
      <a href="${url}" style="background:#fff;color:#555;border:1px solid #ccc;padding:11px 18px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;margin:0 0 8px">${tx('btnReagendar', idioma)}</a>
    </p>`;
}

function rodape(idioma = 'pt') {
  return `<p style="color:#888;font-size:13px;margin-top:18px">${tx('duvidas', idioma)} <a href="https://wa.me/${WHATSAPP}" style="color:#c9a84c">(11) 91425-8886</a></p>`;
}

// E-mail logo depois de marcar (ou quando a equipe define o horário do
// sábado): pede pra confirmar. Sai no idioma em que a pessoa preencheu.
async function enviarPedidoConfirmacao(ag) {
  if (!ag.email) return;
  const i = idiomaOk(ag.idioma);
  const topo = `<h2 style="color:#c9a84c;margin-top:0">WB Assessoria Migratória</h2>
        <p>${tx('ola', i)}, <b>${escHtml(ag.nome)}</b>! ${tx('recebemos', i)}</p>`;
  if (!ag.hora) {
    await sendEmail(ag.email, tx('assuntoPedido', i),
      `<div style="font-family:Arial,sans-serif;max-width:520px;padding:24px;background:#f9f9f9;border-radius:8px">
        ${topo}
        ${blocoDataHora(ag.data, null, ag.tipo, i)}
        <p>${tx('equipeDefine', i)}</p>
        ${rodape(i)}
      </div>`);
    return;
  }
  await sendEmail(ag.email, tx('assuntoConfirme', i),
    `<div style="font-family:Arial,sans-serif;max-width:520px;padding:24px;background:#f9f9f9;border-radius:8px">
      ${topo}
      ${blocoDataHora(ag.data, ag.hora, ag.tipo, i)}
      <p>${tx('cliqueConfirmar', i)}</p>
      ${botoesConfirmacao(ag.token, i)}
      ${rodape(i)}
    </div>`);
}

// Aviso interno pra equipe quando alguém marca/confirma/cancela pela internet.
async function avisarEquipe(assunto, ag, extra = '') {
  const i = idiomaOk(ag.idioma);
  await sendEmail(EQUIPE_EMAIL, assunto,
    `<div style="font-family:Arial,sans-serif;max-width:600px;padding:24px;background:#f9f9f9;border-radius:8px">
      <h2 style="color:#c9a84c;margin-top:0">WB Assessoria — Agenda</h2>
      <p><b>${escHtml(ag.nome)}</b>${extra}</p>
      ${blocoDataHora(ag.data, ag.hora, ag.tipo)}
      <div style="background:#fff;border:1px solid #ddd;border-radius:6px;padding:14px;margin:14px 0">
        <div><b>WhatsApp:</b> ${escHtml(ag.tel || '—')}</div>
        <div><b>E-mail:</b> ${escHtml(ag.email || '—')}</div>
        ${i !== 'pt' ? `<div><b>Idioma:</b> ${NOME_IDIOMA[i]} — responda nesse idioma</div>` : ''}
        ${ag.obs ? `<div><b>Obs:</b> ${escHtml(ag.obs)}</div>` : ''}
      </div>
      <p><a href="${PORTAL_URL}" style="background:#c9a84c;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:700">Abrir a Agenda</a></p>
    </div>`);
}

// Cria o agendamento pedido por um formulário público (landing page ou
// formulários por serviço). Devolve o pedaço da resposta JSON pra página.
// Se o horário foi ocupado no meio tempo, o lead fica salvo e a equipe liga.
async function agendarPeloFormulario(db, { agendamento, nome, email, tel, servico, leadId, origem, idioma }) {
  if (!(agendamento?.data && (agendamento?.hora || agendamento?.a_confirmar))) return {};
  const { data } = agendamento;
  // Sábado: a pessoa só escolhe o dia, a equipe define o horário depois
  const hora = agendamento.a_confirmar ? null : agendamento.hora;
  const valido = hora ? await verificarHorario(db, data, hora) : await verificarDiaAConfirmar(db, data);
  if (!valido) return { agendado: false, horario_indisponivel: true };

  const token = novoToken();
  const tipo = 'Consulta inicial';
  const i = idiomaOk(idioma);
  const [ins] = await db.query(
    `INSERT INTO agendamentos (cliente_nome, data, hora, tipo, obs, colaborador, status, token, lead_id, email, tel, origem, idioma)
     VALUES (?, ?, ?, ?, ?, NULL, 'pendente', ?, ?, ?, ?, ?, ?)`,
    [nome, data, hora, tipo, servico || null, token, leadId || null, email, tel, origem, i]
  );
  sincronizarGoogle(db, ins.insertId);
  const ag = { nome, data, hora, tipo, token, email, tel, obs: servico || null, idioma: i };
  enviarPedidoConfirmacao(ag).catch(e => console.error('[agenda] e-mail confirmação:', e.message));
  avisarEquipe(
    hora ? `📅 Novo agendamento (${origem}) — ${nome}` : `📅 Pedido para sábado (definir horário) — ${nome}`, ag,
    hora ? ` marcou um atendimento pelo(a) ${escHtml(origem)} (aguardando confirmação).`
         : ' pediu atendimento no sábado. <b>Defina o horário na Agenda do sistema</b> — a pessoa recebe o e-mail para confirmar.')
    .catch(e => console.error('[agenda] aviso equipe:', e.message));
  return { agendado: true, agendamento: { data, hora, a_confirmar: !hora } };
}

module.exports = {
  agendarPeloFormulario, idiomaOk, NOME_IDIOMA, tx,
  PORTAL_URL, EQUIPE_EMAIL, WHATSAPP, linkAgendamento, novoToken,
  carregarConfig, carregarOcupados, verificarHorario, verificarDiaAConfirmar, sincronizarGoogle,
  blocoDataHora, botoesConfirmacao, rodape, enviarPedidoConfirmacao, avisarEquipe,
};
