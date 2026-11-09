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
