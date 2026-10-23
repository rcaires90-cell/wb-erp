describe('googleCalendar sem configuração', () => {
  beforeEach(() => { jest.resetModules(); delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON; delete process.env.GOOGLE_CALENDAR_ID; });

  test('fica desligado e não faz nada (sistema funciona sem Google)', async () => {
    const g = require('../lib/googleCalendar');
    expect(g.ativo()).toBe(false);
    await expect(g.salvarEvento({ data: '2026-10-26', hora: '10:00' })).resolves.toBeNull();
    await expect(g.removerEvento('abc')).resolves.toBeUndefined();
    await expect(g.periodosOcupados('2026-10-26', '2026-10-27')).resolves.toEqual([]);
  });

  test('JSON inválido não derruba, só desliga', () => {
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = '{quebrado';
    process.env.GOOGLE_CALENDAR_ID = 'x@group.calendar.google.com';
    jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(require('../lib/googleCalendar').ativo()).toBe(false);
  });

  test('com credenciais válidas fica ativo', () => {
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({ client_email: 'wb@proj.iam.gserviceaccount.com', private_key: '-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n' });
    process.env.GOOGLE_CALENDAR_ID = 'agenda@wb.com';
    expect(require('../lib/googleCalendar').ativo()).toBe(true);
  });
});

describe('montarEvento', () => {
  const g = require('../lib/googleCalendar');

  test('horário de Brasília, duração e status no título', () => {
    const ev = g.montarEvento({ data: '2026-10-26', hora: '17:45', nome: 'Maria Lopez', tipo: 'Consulta inicial', status: 'pendente', tel: '+55 11 9', link: 'https://x/agendamento.html?token=t' }, 30);
    expect(ev.start.dateTime).toBe('2026-10-26T17:45:00-03:00');
    expect(ev.end.dateTime).toBe('2026-10-26T18:15:00-03:00');
    expect(ev.summary).toBe('⏳ Consulta inicial — Maria Lopez');
    expect(ev.description).toContain('WhatsApp: +55 11 9');
    expect(ev.description).toContain('aguardando confirmação');
  });

  test('confirmado muda ícone/cor; atravessa meia-noite certo', () => {
    const ev = g.montarEvento({ data: '2026-10-26', hora: '23:30', nome: 'X', status: 'confirmado' }, 60);
    expect(ev.summary.startsWith('✅')).toBe(true);
    expect(ev.colorId).toBe('10');
    expect(ev.end.dateTime).toBe('2026-10-27T00:30:00-03:00');
  });
});
