// Integração com o Google Agenda da empresa via conta de serviço (service
// account). Sem dependência extra: o JWT é assinado com o crypto do Node.
//
// Variáveis de ambiente (Railway):
//   GOOGLE_SERVICE_ACCOUNT_JSON — conteúdo inteiro do arquivo .json da chave
//   GOOGLE_CALENDAR_ID          — e-mail/ID da agenda da empresa
// A agenda precisa estar compartilhada com o e-mail da conta de serviço com
// a permissão "Fazer alterações nos eventos".
// Sem as variáveis, tudo aqui vira no-op — o sistema funciona igual sem Google.
const crypto = require('crypto');
const https  = require('https');

const TZ = 'America/Sao_Paulo';
const OFFSET = '-03:00'; // Brasil sem horário de verão desde 2019

let _cred = undefined;
function credenciais() {
  if (_cred !== undefined) return _cred;
  _cred = null;
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (raw && process.env.GOOGLE_CALENDAR_ID) {
    try {
      const j = JSON.parse(raw);
      if (j.client_email && j.private_key) _cred = { email: j.client_email, key: j.private_key.replace(/\\n/g, '\n') };
    } catch (e) { console.error('[google] GOOGLE_SERVICE_ACCOUNT_JSON inválido:', e.message); }
  }
  return _cred;
}
const ativo = () => !!credenciais();

const b64url = (b) => Buffer.from(b).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

function req(method, host, path, { headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const data = body == null ? null : (typeof body === 'string' ? body : JSON.stringify(body));
    const r = https.request({ method, host, path, headers: {
      ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      ...(typeof body === 'string' ? {} : { 'Content-Type': 'application/json' }),
      ...headers,
    } }, (res) => {
      let out = '';
      res.on('data', c => out += c);
      res.on('end', () => {
        let j = null; try { j = out ? JSON.parse(out) : null; } catch {}
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(j);
        else { const e = new Error(`Google ${res.statusCode}: ${j?.error?.message || j?.error_description || out.slice(0, 200)}`); e.status = res.statusCode; reject(e); }
      });
    });
    r.on('error', reject);
    r.setTimeout(10000, () => r.destroy(new Error('Google: timeout')));
    if (data) r.write(data);
    r.end();
  });
}

let _token = null, _tokenExp = 0;
async function accessToken() {
  if (_token && Date.now() < _tokenExp - 60000) return _token;
  const c = credenciais();
  const agora = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(JSON.stringify({
    iss: c.email, scope: 'https://www.googleapis.com/auth/calendar',
    aud: 'https://oauth2.googleapis.com/token', iat: agora, exp: agora + 3600,
  }));
  const assinatura = b64url(crypto.sign('RSA-SHA256', Buffer.from(`${header}.${claim}`), c.key));
  const j = await req('POST', 'oauth2.googleapis.com', '/token', {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${header}.${claim}.${assinatura}`,
  });
  _token = j.access_token; _tokenExp = Date.now() + (j.expires_in || 3600) * 1000;
  return _token;
}

const calPath = (sufixo = '') => `/calendar/v3/calendars/${encodeURIComponent(process.env.GOOGLE_CALENDAR_ID)}${sufixo}`;
async function api(method, sufixo, body) {
  const t = await accessToken();
  return req(method, 'www.googleapis.com', calPath(sufixo), { headers: { Authorization: `Bearer ${t}` }, body });
}

const isoSP = (data, hora) => `${data}T${String(hora).slice(0, 5)}:00${OFFSET}`;
function fimISO(data, hora, minutos) {
  const d = new Date(isoSP(data, hora));
  d.setMinutes(d.getMinutes() + minutos);
  const s = d.toLocaleString('sv-SE', { timeZone: TZ });
  return `${s.slice(0, 10)}T${s.slice(11, 19)}${OFFSET}`;
}

// ag: { data, hora, nome, tipo, status, tel, email, obs, origem, link }
function montarEvento(ag, duracaoMin) {
  const pend = ag.status === 'pendente';
  const linhas = [
    ag.tipo && `Tipo: ${ag.tipo}`,
    `Status: ${pend ? 'aguardando confirmação' : 'confirmado'}`,
    ag.tel && `WhatsApp: ${ag.tel}`,
    ag.email && `E-mail: ${ag.email}`,
    ag.obs && `Obs: ${ag.obs}`,
    ag.origem && `Origem: ${ag.origem}`,
    ag.link && `Link do cliente: ${ag.link}`,
    '', 'Criado pelo sistema WB Assessoria.',
  ].filter(v => v !== null && v !== undefined && v !== false);
  return {
    summary: `${pend ? '⏳ ' : '✅ '}${ag.tipo || 'Atendimento'} — ${ag.nome || 'Cliente'}`,
    description: linhas.join('\n'),
    start: { dateTime: isoSP(ag.data, ag.hora), timeZone: TZ },
    end:   { dateTime: fimISO(ag.data, ag.hora, duracaoMin), timeZone: TZ },
    colorId: pend ? '5' : '10', // amarelo = pendente, verde = confirmado
  };
}

// Cria ou atualiza o evento; devolve o id do evento (ou null se sem Google).
async function salvarEvento(ag, eventId, duracaoMin = 30) {
  if (!ativo()) return null;
  const ev = montarEvento(ag, duracaoMin);
  if (eventId) {
    try { return (await api('PATCH', `/events/${encodeURIComponent(eventId)}`, ev)).id; }
    catch (e) { if (e.status !== 404 && e.status !== 410) throw e; } // apagado no Google → recria
  }
  return (await api('POST', '/events', ev)).id;
}

async function removerEvento(eventId) {
  if (!ativo() || !eventId) return;
  try { await api('DELETE', `/events/${encodeURIComponent(eventId)}`); }
  catch (e) { if (e.status !== 404 && e.status !== 410) throw e; }
}

// Períodos ocupados no Google entre duas datas (YYYY-MM-DD), em ms epoch.
// Cache curto pra não chamar o Google a cada visita na landing page.
let _fbCache = { chave: '', ate: 0, dados: [] };
async function periodosOcupados(dataIni, dataFim) {
  if (!ativo()) return [];
  const chave = `${dataIni}|${dataFim}`;
  if (_fbCache.chave === chave && Date.now() < _fbCache.ate) return _fbCache.dados;
  const t = await accessToken();
  const j = await req('POST', 'www.googleapis.com', '/calendar/v3/freeBusy', {
    headers: { Authorization: `Bearer ${t}` },
    body: { timeMin: `${dataIni}T00:00:00${OFFSET}`, timeMax: `${dataFim}T23:59:59${OFFSET}`, timeZone: TZ,
            items: [{ id: process.env.GOOGLE_CALENDAR_ID }] },
  });
  const cal = j?.calendars?.[process.env.GOOGLE_CALENDAR_ID];
  if (cal?.errors?.length) throw new Error('Google freeBusy: ' + cal.errors.map(e => e.reason).join(','));
  const dados = (cal?.busy || []).map(b => [Date.parse(b.start), Date.parse(b.end)]);
  _fbCache = { chave, ate: Date.now() + 60000, dados };
  return dados;
}
const limparCacheOcupados = () => { _fbCache.ate = 0; };

module.exports = { ativo, salvarEvento, removerEvento, periodosOcupados, limparCacheOcupados, montarEvento, isoSP, fimISO };
