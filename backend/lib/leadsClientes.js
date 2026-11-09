// Separa do Pipeline (prospecção) os leads de quem JÁ ERA cliente da WB.
//
// Regra: o lead casa com um cadastro de cliente (e-mail, ou últimos 9 dígitos
// do telefone) e esse cadastro já existia ANTES do lead → "já era cliente"
// (ex.: cliente preencheu a landing de novo). Se o cadastro é posterior ao
// lead, foi o lead que VIROU cliente — continua no Pipeline como venda.
// Nada é apagado: só preenche leads.cliente_id / leads.ja_era_cliente.
const { casarCliente } = require('./agendaServico');

const ms = (d) => (d ? new Date(d).getTime() : NaN);

function classificarLead(lead, clientes) {
  const c = casarCliente(clientes, { email: lead.email, tel: lead.tel });
  if (!c) return null;
  const jaEra = Number.isFinite(ms(c.created_at)) && Number.isFinite(ms(lead.created_at))
    && ms(c.created_at) < ms(lead.created_at);
  return { cliente_id: c.id, ja_era_cliente: jaEra ? 1 : 0, cliente_nome: c.nome };
}

async function carregarClientes(db) {
  const [rows] = await db.query('SELECT id, nome, email, tel, arquivado, created_at FROM clientes ORDER BY arquivado ASC, id DESC');
  return rows;
}

// Revisa os leads ainda não vinculados (idempotente — quem já tem cliente_id,
// inclusive os que a equipe marcou à mão, não é mexido).
async function reconciliarLeads(db) {
  const clientes = await carregarClientes(db);
  const [leads] = await db.query('SELECT id, email, tel, created_at FROM leads WHERE cliente_id IS NULL');
  let jaEram = 0, viraram = 0;
  for (const l of leads) {
    const r = classificarLead(l, clientes);
    if (!r) continue;
    await db.query('UPDATE leads SET cliente_id = ?, ja_era_cliente = ? WHERE id = ?', [r.cliente_id, r.ja_era_cliente, l.id]);
    if (r.ja_era_cliente) jaEram++; else viraram++;
  }
  return { analisados: leads.length, ja_eram_clientes: jaEram, viraram_clientes: viraram };
}

// Classifica um lead recém-criado. Devolve o resultado (ou null) pra rota
// poder avisar a equipe.
async function vincularLead(db, leadId) {
  const [[l]] = await db.query('SELECT id, email, tel, created_at FROM leads WHERE id = ?', [leadId]);
  if (!l) return null;
  const r = classificarLead(l, await carregarClientes(db));
  if (r) await db.query('UPDATE leads SET cliente_id = ?, ja_era_cliente = ? WHERE id = ?', [r.cliente_id, r.ja_era_cliente, l.id]);
  return r;
}

module.exports = { classificarLead, reconciliarLeads, vincularLead };
