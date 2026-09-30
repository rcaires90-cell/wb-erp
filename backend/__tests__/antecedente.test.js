const { deveAlertar, protocolado, legalizadoEProtocolado, diasAte } = require('../public/lib/antecedente');

const HOJE = new Date('2026-09-30T12:00:00');
const em15dias  = '2026-10-15';
const em60dias  = '2026-11-29';
const vencido10 = '2026-09-20';

function cliente(overrides) {
  return {
    id: 1, nome: 'Teste', arquivado: 0,
    doc_antecedente: 0, doc_antecedente_val: em15dias, processo_fase: 'pre_protocolo',
    ...overrides,
  };
}

describe('protocolado', () => {
  test('false quando fase é pre_protocolo', () => {
    expect(protocolado(cliente({ processo_fase: 'pre_protocolo' }))).toBe(false);
  });
  test('false quando fase é nula/ausente', () => {
    expect(protocolado(cliente({ processo_fase: null }))).toBe(false);
  });
  test('true quando fase avançou além de pre_protocolo', () => {
    expect(protocolado(cliente({ processo_fase: 'pf_analise' }))).toBe(true);
  });
});

describe('legalizadoEProtocolado', () => {
  test('false se só legalizado, sem protocolar', () => {
    expect(legalizadoEProtocolado(cliente({ doc_antecedente: 1, processo_fase: 'pre_protocolo' }))).toBe(false);
  });
  test('false se só protocolado, sem legalizar', () => {
    expect(legalizadoEProtocolado(cliente({ doc_antecedente: 0, processo_fase: 'pf_analise' }))).toBe(false);
  });
  test('true só quando os dois são verdadeiros', () => {
    expect(legalizadoEProtocolado(cliente({ doc_antecedente: 1, processo_fase: 'pf_analise' }))).toBe(true);
  });
});

describe('deveAlertar (regra completa, pedido do usuário em 2026-09-30)', () => {
  test('não alerta cliente arquivado', () => {
    expect(deveAlertar(cliente({ arquivado: 1 }), { hoje: HOJE })).toBe(false);
  });
  test('não alerta sem doc_antecedente_val', () => {
    expect(deveAlertar(cliente({ doc_antecedente_val: null }), { hoje: HOJE })).toBe(false);
  });
  test('não alerta se vencimento está fora da janela de 30 dias', () => {
    expect(deveAlertar(cliente({ doc_antecedente_val: em60dias }), { hoje: HOJE, janelaDias: 30 })).toBe(false);
  });
  test('alerta se vencido, independente de fase/legalizado', () => {
    expect(deveAlertar(cliente({ doc_antecedente_val: vencido10, processo_fase: 'pre_protocolo' }), { hoje: HOJE })).toBe(true);
  });
  test('alerta em pre_protocolo mesmo se legalizado=true (não protocolado ainda)', () => {
    expect(deveAlertar(cliente({ doc_antecedente: 1, processo_fase: 'pre_protocolo' }), { hoje: HOJE })).toBe(true);
  });
  test('alerta quando protocolado mas NÃO legalizado (gap de compliance)', () => {
    expect(deveAlertar(cliente({ doc_antecedente: 0, processo_fase: 'pf_analise' }), { hoje: HOJE })).toBe(true);
  });
  test('NÃO alerta quando legalizado E protocolado (já valeu pro protocolo)', () => {
    expect(deveAlertar(cliente({ doc_antecedente: 1, processo_fase: 'pf_analise' }), { hoje: HOJE })).toBe(false);
  });
});

describe('diasAte', () => {
  test('null sem valor', () => {
    expect(diasAte(null, HOJE)).toBeNull();
  });
  test('calcula dias corretamente ignorando hora/timezone', () => {
    expect(diasAte('2026-10-15', HOJE)).toBe(15);
  });
  test('negativo para data vencida', () => {
    expect(diasAte('2026-09-20', HOJE)).toBe(-10);
  });
});
