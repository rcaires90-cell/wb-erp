const {
  avancarStatusLifecycle, saldoCusto, podeClassificarSaldo, validarPartesDivisao, round2,
} = require('../lib/custos');

function custo(overrides) {
  return { status: 'pendente', valor_recebido: 0, valor_realizado: 0, ...overrides };
}

describe('avancarStatusLifecycle', () => {
  test('pendente quando nada foi recebido', () => {
    expect(avancarStatusLifecycle(custo())).toBe('pendente');
  });
  test('recebido quando só tem valor_recebido', () => {
    expect(avancarStatusLifecycle(custo({ valor_recebido: 400 }))).toBe('recebido');
  });
  test('realizado quando já tem valor_realizado', () => {
    expect(avancarStatusLifecycle(custo({ valor_recebido: 400, valor_realizado: 250 }))).toBe('realizado');
  });
  test('realizado mesmo sem recebido (empresa adiantou o custo)', () => {
    expect(avancarStatusLifecycle(custo({ valor_recebido: 0, valor_realizado: 250 }))).toBe('realizado');
  });
  test('nunca mexe em status finais manuais (credito_cliente/excedente_empresa/cancelado)', () => {
    expect(avancarStatusLifecycle(custo({ status: 'credito_cliente', valor_recebido: 400, valor_realizado: 250 }))).toBe('credito_cliente');
    expect(avancarStatusLifecycle(custo({ status: 'excedente_empresa' }))).toBe('excedente_empresa');
    expect(avancarStatusLifecycle(custo({ status: 'cancelado' }))).toBe('cancelado');
  });
});

describe('saldoCusto', () => {
  test('exemplo do pedido: 400 recebido - 250 realizado = 150', () => {
    expect(saldoCusto(custo({ valor_recebido: 400, valor_realizado: 250 }))).toBe(150);
  });
  test('saldo negativo quando empresa realizou mais do que recebeu', () => {
    expect(saldoCusto(custo({ valor_recebido: 400, valor_realizado: 450 }))).toBe(-50);
  });
  test('zero quando bate exatamente', () => {
    expect(saldoCusto(custo({ valor_recebido: 250, valor_realizado: 250 }))).toBe(0);
  });
});

describe('podeClassificarSaldo', () => {
  test('só pode classificar quando realizado E saldo positivo', () => {
    expect(podeClassificarSaldo(custo({ status: 'realizado', valor_recebido: 400, valor_realizado: 250 }))).toBe(true);
  });
  test('não pode classificar em pendente/recebido', () => {
    expect(podeClassificarSaldo(custo({ status: 'pendente' }))).toBe(false);
    expect(podeClassificarSaldo(custo({ status: 'recebido', valor_recebido: 400 }))).toBe(false);
  });
  test('não pode classificar com saldo zero ou negativo', () => {
    expect(podeClassificarSaldo(custo({ status: 'realizado', valor_recebido: 250, valor_realizado: 250 }))).toBe(false);
    expect(podeClassificarSaldo(custo({ status: 'realizado', valor_recebido: 400, valor_realizado: 450 }))).toBe(false);
  });
});

describe('validarPartesDivisao — exemplo central do pedido: R$1400 = R$1000 parcela + R$400 custo', () => {
  test('aceita divisão cuja soma bate exatamente', () => {
    const r = validarPartesDivisao(1400, [
      { destino: 'parcela', destino_id: 1, valor: 1000 },
      { destino: 'custo_recebimento', destino_id: 2, valor: 400 },
    ]);
    expect(r.ok).toBe(true);
  });
  test('rejeita quando a soma não bate', () => {
    const r = validarPartesDivisao(1400, [
      { destino: 'parcela', destino_id: 1, valor: 1000 },
      { destino: 'custo_recebimento', destino_id: 2, valor: 300 },
    ]);
    expect(r.ok).toBe(false);
    expect(r.erro).toMatch(/soma/);
  });
  test('rejeita destino inválido', () => {
    const r = validarPartesDivisao(100, [
      { destino: 'conta_corrente', destino_id: 1, valor: 50 },
      { destino: 'parcela', destino_id: 2, valor: 50 },
    ]);
    expect(r.ok).toBe(false);
    expect(r.erro).toMatch(/destino inválido/);
  });
  test('rejeita valor zero ou negativo numa parte', () => {
    const r = validarPartesDivisao(100, [
      { destino: 'parcela', destino_id: 1, valor: 100 },
      { destino: 'custo_recebimento', destino_id: 2, valor: 0 },
    ]);
    expect(r.ok).toBe(false);
  });
  test('rejeita menos de 2 partes', () => {
    const r = validarPartesDivisao(100, [{ destino: 'parcela', destino_id: 1, valor: 100 }]);
    expect(r.ok).toBe(false);
  });
  test('rejeita custo_realizacao num lançamento de crédito (entrada não pode "realizar" um custo)', () => {
    const r = validarPartesDivisao(1400, [
      { destino: 'parcela', destino_id: 1, valor: 1000 },
      { destino: 'custo_realizacao', destino_id: 2, valor: 400 },
    ], 'credito');
    expect(r.ok).toBe(false);
    expect(r.erro).toMatch(/destino inválido/);
  });
  test('rejeita parcela num lançamento de débito (saída não paga parcela de cliente)', () => {
    const r = validarPartesDivisao(250, [
      { destino: 'parcela', destino_id: 1, valor: 150 },
      { destino: 'conta_pagar', destino_id: 2, valor: 100 },
    ], 'debito');
    expect(r.ok).toBe(false);
  });
  test('tolera diferença de arredondamento de 1 centavo', () => {
    const r = validarPartesDivisao(100, [
      { destino: 'parcela', destino_id: 1, valor: 33.33 },
      { destino: 'custo_recebimento', destino_id: 2, valor: 33.33 },
      { destino: 'custo_recebimento', destino_id: 3, valor: 33.34 },
    ]);
    expect(r.ok).toBe(true);
  });
});

describe('round2', () => {
  test('arredonda corretamente evitando erro de ponto flutuante', () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
  });
});
