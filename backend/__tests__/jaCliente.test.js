jest.mock('../lib/email', () => ({ sendEmail: jest.fn(async () => ({})) }));
const mockQuery = jest.fn();
jest.mock('../db', () => ({ query: (...a) => mockQuery(...a), on: jest.fn() }));

const agenda = require('../lib/agendaServico');
const { sendEmail } = require('../lib/email');

const CLIENTES = [
  { id: 7, nome: 'Rene Julien', email: 'Rene@Example.com', tel: '(11) 98765-4321', arquivado: 0 },
  { id: 9, nome: 'Esther Dorce', email: '', tel: '+55 11 91111-2222', arquivado: 0 },
];

describe('casarCliente — acha no cadastro', () => {
  test('pelo e-mail, sem diferenciar maiúsculas', () => {
    expect(agenda.casarCliente(CLIENTES, { email: ' rene@example.com ' }).id).toBe(7);
  });
  test('pelo telefone, com ou sem +55/formatação', () => {
    expect(agenda.casarCliente(CLIENTES, { tel: '11911112222' }).id).toBe(9);
    expect(agenda.casarCliente(CLIENTES, { tel: '+55 (11) 98765-4321' }).id).toBe(7);
  });
  test('não acha → null (telefone curto não casa por acaso)', () => {
    expect(agenda.casarCliente(CLIENTES, { email: 'x@y.com', tel: '123' })).toBeNull();
  });
});

describe('agendarCliente — pedido de quem já é cliente', () => {
  beforeEach(() => { mockQuery.mockReset(); sendEmail.mockClear(); });

  test('sem horário: não cria agendamento, só avisa a equipe', async () => {
    mockQuery.mockResolvedValueOnce([CLIENTES]); // busca no cadastro
    const r = await agenda.agendarCliente({ query: mockQuery }, { nome: 'Rene', email: 'rene@example.com', tel: '', assunto: 'andamento', agendamento: null, idioma: 'pt' });
    expect(r).toEqual({ agendado: false, cliente_encontrado: true });
    expect(mockQuery.mock.calls.some(c => /INSERT INTO agendamentos/.test(c[0]))).toBe(false);
    expect(sendEmail.mock.calls[0][1]).toMatch(/Cliente pediu contato/);
    expect(sendEmail.mock.calls[0][2]).toMatch(/cliente #7/);
  });

  test('não achado no cadastro: aviso pra equipe conferir', async () => {
    mockQuery.mockResolvedValueOnce([CLIENTES]);
    await agenda.agendarCliente({ query: mockQuery }, { nome: 'Fulano', email: 'novo@x.com', tel: '', agendamento: null });
    expect(sendEmail.mock.calls[0][2]).toMatch(/não encontrado no cadastro/);
  });
});

describe('leads x clientes — tirar da prospecção quem já era cliente', () => {
  const { classificarLead, reconciliarLeads } = require('../lib/leadsClientes');
  const CLI = [{ id: 7, nome: 'Rene', email: 'rene@x.com', tel: '11987654321', created_at: '2026-05-01T10:00:00Z' }];

  test('cadastro de cliente ANTES do lead → já era cliente (sai da prospecção)', () => {
    expect(classificarLead({ email: 'RENE@x.com', created_at: '2026-10-20T10:00:00Z' }, CLI))
      .toMatchObject({ cliente_id: 7, ja_era_cliente: 1 });
  });
  test('cadastro DEPOIS do lead → o lead virou cliente (fica no Pipeline como venda)', () => {
    expect(classificarLead({ tel: '+55 11 98765-4321', created_at: '2026-04-01T10:00:00Z' }, CLI))
      .toMatchObject({ cliente_id: 7, ja_era_cliente: 0 });
  });
  test('sem cadastro → continua lead normal', () => {
    expect(classificarLead({ email: 'outro@x.com', tel: '11900000000', created_at: '2026-10-20' }, CLI)).toBeNull();
  });

  test('reconciliar só mexe em leads sem vínculo e não apaga nada', async () => {
    const q = jest.fn(async (sql) => {
      if (/FROM clientes/.test(sql)) return [CLI];
      if (/FROM leads WHERE cliente_id IS NULL/.test(sql)) return [[
        { id: 1, email: 'rene@x.com', created_at: '2026-10-20T10:00:00Z' },
        { id: 2, email: 'rene@x.com', created_at: '2026-04-01T10:00:00Z' },
        { id: 3, email: 'ninguem@x.com', created_at: '2026-10-20T10:00:00Z' },
      ]];
      return [{ affectedRows: 1 }];
    });
    const r = await reconciliarLeads({ query: q });
    expect(r).toEqual({ analisados: 3, ja_eram_clientes: 1, viraram_clientes: 1 });
    const sqls = q.mock.calls.map(c => c[0]);
    expect(sqls.some(s => /DELETE/i.test(s))).toBe(false);
    expect(q.mock.calls.filter(c => /UPDATE leads/.test(c[0])).map(c => c[1])).toEqual([[7, 1, 1], [7, 0, 2]]);
  });
});
