// Agenda pública da landing page: gera os horários livres que o visitante
// pode escolher e cuida do token de confirmação/cancelamento.
// Funções puras (sem banco) pra poder testar — as rotas passam a config
// (de config_sistema) e os horários já ocupados.
const crypto = require('crypto');

const CONFIG_PADRAO = {
  agenda_publica_ativa:      '1',
  agenda_dias:               '1,2,3,4,5',   // 0=dom … 6=sáb
  agenda_inicio:             '09:00',
  agenda_fim:                '18:00',
  agenda_intervalo:          '30',          // minutos entre horários
  agenda_pausa:              '12:00-13:00', // almoço (vazio = sem pausa)
  agenda_dias_frente:        '14',          // quantos dias pra frente aparecem
  agenda_antecedencia_horas: '2',           // não deixa marcar em cima da hora
};

const HORA_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;

const paraMin = (h) => { const [a, b] = h.split(':').map(Number); return a * 60 + b; };
const paraHora = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

// Lê as chaves agenda_* de config_sistema (objeto chave→valor), caindo no
// padrão quando algo está vazio/inválido — config errada nunca derruba a página.
function lerConfig(cfg = {}) {
  const v = (k) => (cfg[k] ?? '').toString().trim() || CONFIG_PADRAO[k];
  const hora = (k) => (HORA_RE.test(v(k)) ? v(k) : CONFIG_PADRAO[k]);
  const int = (k, min, max) => {
    const n = parseInt(v(k), 10);
    return Number.isFinite(n) && n >= min && n <= max ? n : parseInt(CONFIG_PADRAO[k], 10);
  };
  const dias = v('agenda_dias').split(',').map(s => parseInt(s, 10)).filter(n => n >= 0 && n <= 6);
  let pausa = null;
  const p = (cfg.agenda_pausa ?? CONFIG_PADRAO.agenda_pausa).toString().trim();
  const mp = p.match(/^(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})$/);
  if (mp && HORA_RE.test(mp[1]) && HORA_RE.test(mp[2])) pausa = [paraMin(mp[1]), paraMin(mp[2])];
  return {
    ativa:         v('agenda_publica_ativa') !== '0',
    dias:          dias.length ? dias : [1, 2, 3, 4, 5],
    inicio:        hora('agenda_inicio'),
    fim:           hora('agenda_fim'),
    intervalo:     int('agenda_intervalo', 10, 240),
    pausa,
    diasFrente:    int('agenda_dias_frente', 1, 60),
    antecedencia:  int('agenda_antecedencia_horas', 0, 72),
  };
}

// Data/hora atuais em São Paulo (o servidor no Railway roda em UTC).
function agoraSP(base = new Date()) {
  const s = base.toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' }); // "2026-10-23 14:05:00"
  return { data: s.slice(0, 10), hora: s.slice(11, 16) };
}

function somaDias(dataISO, n) {
  const d = new Date(dataISO + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const diaSemana = (dataISO) => new Date(dataISO + 'T12:00:00Z').getUTCDay();

function horariosDoDia(conf) {
  const out = [];
  const ini = paraMin(conf.inicio), fim = paraMin(conf.fim);
  for (let m = ini; m + conf.intervalo <= fim; m += conf.intervalo) {
    if (conf.pausa && m < conf.pausa[1] && m + conf.intervalo > conf.pausa[0]) continue;
    out.push(paraHora(m));
  }
  return out;
}

// ocupados: Set de "YYYY-MM-DD HH:MM" já marcados (não cancelados).
// Devolve [{data, horarios:[...]}] só com dias que têm algum horário livre.
function gerarDisponibilidade(conf, ocupados = new Set(), agora = agoraSP()) {
  if (!conf.ativa) return [];
  const limite = paraMin(agora.hora) + conf.antecedencia * 60; // em minutos a partir de hoje 00:00
  const base = horariosDoDia(conf);
  const dias = [];
  for (let i = 0; i <= conf.diasFrente; i++) {
    const data = somaDias(agora.data, i);
    if (!conf.dias.includes(diaSemana(data))) continue;
    const horarios = base.filter(h => {
      if (ocupados.has(`${data} ${h}`)) return false;
      return i * 1440 + paraMin(h) >= limite;
    });
    if (horarios.length) dias.push({ data, horarios });
  }
  return dias;
}

// Confere se um horário específico escolhido pelo visitante é válido e livre.
function horarioDisponivel(conf, data, hora, ocupados, agora = agoraSP()) {
  if (!DATA_RE.test(data || '') || !HORA_RE.test(hora || '')) return false;
  const dia = gerarDisponibilidade(conf, ocupados, agora).find(d => d.data === data);
  return !!dia && dia.horarios.includes(hora);
}

const novoToken = () => crypto.randomBytes(24).toString('hex');

const escHtml = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function fmtDataBR(dataISO) {
  const s = new Date(dataISO + 'T12:00:00Z').toLocaleDateString('pt-BR', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

module.exports = {
  CONFIG_PADRAO, lerConfig, agoraSP, somaDias, horariosDoDia,
  gerarDisponibilidade, horarioDisponivel, novoToken, escHtml, fmtDataBR,
};
