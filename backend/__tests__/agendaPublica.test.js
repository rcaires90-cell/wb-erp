const {
  lerConfig, agoraSP, horariosDoDia, gerarDisponibilidade, horarioDisponivel, fmtDataBR, escHtml,
} = require('../lib/agendaPublica');

// 2026-10-23 é sexta-feira
const SEXTA_8H = { data: '2026-10-23', hora: '08:00' };

describe('lerConfig', () => {
  test('sem config usa o padrão (seg-sex 9-18, 30min, almoço 12-13)', () => {
    const c = lerConfig({});
    expect(c.ativa).toBe(true);
    expect(c.dias).toEqual([1, 2, 3, 4, 5]);
    expect(c.intervalo).toBe(30);
    expect(c.pausa).toEqual([720, 780]);
  });
  test('valores inválidos caem no padrão em vez de quebrar', () => {
    const c = lerConfig({ agenda_inicio: '25:00', agenda_intervalo: 'abc', agenda_dias: 'x', agenda_dias_frente: '999' });
    expect(c.inicio).toBe('09:00');
    expect(c.intervalo).toBe(30);
    expect(c.dias).toEqual([1, 2, 3, 4, 5]);
    expect(c.diasFrente).toBe(14);
  });
  test('almoço vazio = sem pausa; desativada', () => {
    const c = lerConfig({ agenda_pausa: '', agenda_publica_ativa: '0' });
    expect(c.pausa).toBeNull();
    expect(c.ativa).toBe(false);
  });
});

describe('horariosDoDia', () => {
  test('pula o almoço e não passa do fim', () => {
    const h = horariosDoDia(lerConfig({ agenda_inicio: '09:00', agenda_fim: '14:00', agenda_intervalo: '60' }));
    expect(h).toEqual(['09:00', '10:00', '11:00', '13:00']);
  });
  test('horário que invade o almoço também sai', () => {
    const h = horariosDoDia(lerConfig({ agenda_inicio: '11:00', agenda_fim: '14:00', agenda_intervalo: '45' }));
    // 11:00-11:45 ok, 11:45-12:30 invade, 12:30 invade, 13:15-14:00 ok
    expect(h).toEqual(['11:00', '13:15']);
  });
});

describe('gerarDisponibilidade', () => {
  const conf = lerConfig({ agenda_dias_frente: '3', agenda_antecedencia_horas: '2' });

  test('só dias úteis, respeitando a antecedência mínima no dia de hoje', () => {
    const dias = gerarDisponibilidade(conf, new Set(), { data: '2026-10-23', hora: '15:10' });
    // sexta (hoje) a partir de 17:10 → 17:30; sáb/dom fora; segunda inteira
    expect(dias.map(d => d.data)).toEqual(['2026-10-23', '2026-10-26']);
    expect(dias[0].horarios).toEqual(['17:30']);
    expect(dias[1].horarios[0]).toBe('09:00');
  });

  test('horário ocupado some; dia lotado some', () => {
    const conf1 = lerConfig({ agenda_dias: '5', agenda_dias_frente: '1', agenda_inicio: '09:00', agenda_fim: '10:00', agenda_antecedencia_horas: '0' });
    const ocupados = new Set(['2026-10-23 09:00']);
    expect(gerarDisponibilidade(conf1, ocupados, SEXTA_8H)).toEqual([{ data: '2026-10-23', horarios: ['09:30'] }]);
    ocupados.add('2026-10-23 09:30');
    expect(gerarDisponibilidade(conf1, ocupados, SEXTA_8H)).toEqual([]);
  });

  test('agenda desativada não mostra nada', () => {
    expect(gerarDisponibilidade(lerConfig({ agenda_publica_ativa: '0' }), new Set(), SEXTA_8H)).toEqual([]);
  });
});

describe('horarioDisponivel', () => {
  const conf = lerConfig({});
  test('aceita horário livre válido', () => {
    expect(horarioDisponivel(conf, '2026-10-26', '10:00', new Set(), SEXTA_8H)).toBe(true);
  });
  test('recusa ocupado, fim de semana, fora da grade, formato inválido', () => {
    expect(horarioDisponivel(conf, '2026-10-26', '10:00', new Set(['2026-10-26 10:00']), SEXTA_8H)).toBe(false);
    expect(horarioDisponivel(conf, '2026-10-24', '10:00', new Set(), SEXTA_8H)).toBe(false);
    expect(horarioDisponivel(conf, '2026-10-26', '10:15', new Set(), SEXTA_8H)).toBe(false);
    expect(horarioDisponivel(conf, '2026-10-26', '12:00', new Set(), SEXTA_8H)).toBe(false);
    expect(horarioDisponivel(conf, "2026-10-26'; DROP", '10:00', new Set(), SEXTA_8H)).toBe(false);
    expect(horarioDisponivel(conf, '2026-10-26', undefined, new Set(), SEXTA_8H)).toBe(false);
  });
  test('recusa data no passado e além do limite de dias', () => {
    expect(horarioDisponivel(conf, '2026-10-22', '10:00', new Set(), SEXTA_8H)).toBe(false);
    expect(horarioDisponivel(conf, '2026-12-01', '10:00', new Set(), SEXTA_8H)).toBe(false);
  });
});

test('agoraSP converte UTC para horário de Brasília', () => {
  expect(agoraSP(new Date('2026-10-23T02:30:00Z'))).toEqual({ data: '2026-10-22', hora: '23:30' });
});

test('fmtDataBR e escHtml', () => {
  expect(fmtDataBR('2026-10-26')).toBe('Segunda-feira, 26 de outubro');
  expect(escHtml('<b>"x"</b>')).toBe('&lt;b&gt;&quot;x&quot;&lt;/b&gt;');
});

describe('sábado com horário a confirmar', () => {
  const { diaAConfirmarDisponivel } = require('../lib/agendaPublica');
  const conf = lerConfig({ agenda_inicio: '09:30', agenda_fim: '19:00', agenda_sabado_a_confirmar: '1', agenda_dias_frente: '8' });

  test('seg-sex 09:30 até o último horário que termina às 19:00', () => {
    const h = horariosDoDia(conf);
    expect(h[0]).toBe('09:30');
    expect(h[h.length - 1]).toBe('18:30');
    expect(h).not.toContain('12:00');
  });

  test('sábado aparece sem horários e marcado como a confirmar; domingo não aparece', () => {
    const dias = gerarDisponibilidade(conf, new Set(), SEXTA_8H);
    const sab = dias.find(d => d.data === '2026-10-24');
    expect(sab).toEqual({ data: '2026-10-24', horarios: [], aConfirmar: true });
    expect(dias.find(d => d.data === '2026-10-25')).toBeUndefined();
  });

  test('sábado aceita pedido de dia, mas não horário específico', () => {
    expect(diaAConfirmarDisponivel(conf, '2026-10-24', SEXTA_8H)).toBe(true);
    expect(diaAConfirmarDisponivel(conf, '2026-10-26', SEXTA_8H)).toBe(false); // segunda tem horários normais
    expect(horarioDisponivel(conf, '2026-10-24', '10:00', new Set(), SEXTA_8H)).toBe(false);
  });

  test('desligado: sábado não aparece', () => {
    const c = lerConfig({ agenda_sabado_a_confirmar: '0' });
    expect(gerarDisponibilidade(c, new Set(), SEXTA_8H).some(d => d.aConfirmar)).toBe(false);
  });
});
