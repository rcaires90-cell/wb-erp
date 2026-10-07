// Regras de negócio dos "custos de cliente" — separado do parcelamento do
// contrato (ver project_wb_erp.md, pedido do usuário em 2026-10-07). Um
// custo tem duas pernas independentes (recebido do cliente / realizado pela
// empresa) e um ciclo de vida que só avança sozinho até "realizado"; a
// classificação final do saldo (crédito do cliente vs excedente da empresa)
// é sempre uma decisão manual, nunca automática.

const STATUS_AUTOMATICOS = ['pendente', 'recebido', 'realizado'];
const STATUS_FINAIS_MANUAIS = ['credito_cliente', 'excedente_empresa', 'cancelado'];
const STATUS_VALIDOS = [...STATUS_AUTOMATICOS, ...STATUS_FINAIS_MANUAIS];

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// Avança o status derivado dos valores (pendente → recebido → realizado).
// Nunca mexe num status que já foi fixado manualmente (classificado ou
// cancelado) — essas três são terminais.
function avancarStatusLifecycle(custo) {
  if (STATUS_FINAIS_MANUAIS.includes(custo.status)) return custo.status;
  const recebido = parseFloat(custo.valor_recebido) || 0;
  const realizado = parseFloat(custo.valor_realizado) || 0;
  if (realizado > 0) return 'realizado';
  if (recebido > 0) return 'recebido';
  return 'pendente';
}

// Saldo positivo = sobrou dinheiro do cliente (precisa virar crédito ou
// excedente); saldo negativo = a empresa realizou mais do que recebeu (não
// existe "excedente" possível, é só um registro de quanto a empresa cobriu
// a mais — não é classificável, só informativo).
function saldoCusto(custo) {
  return round2((parseFloat(custo.valor_recebido) || 0) - (parseFloat(custo.valor_realizado) || 0));
}

// Um custo só pode ser classificado (crédito do cliente / excedente da
// empresa) depois de realizado e com saldo positivo de sobra — classificar
// antes disso não faz sentido (ainda pode mudar).
function podeClassificarSaldo(custo) {
  return custo.status === 'realizado' && saldoCusto(custo) > 0;
}

const DESTINOS_SPLIT_VALIDOS = ['parcela', 'custo_recebimento', 'custo_realizacao', 'conta_pagar'];
// Um lançamento de crédito (entrada) só pode ser dividido entre contrato e
// recebimento de custo; um de débito (saída), entre conta a pagar e
// realização de custo — nunca mistura os dois lados.
const DESTINOS_POR_TIPO = {
  credito: ['parcela', 'custo_recebimento'],
  debito: ['conta_pagar', 'custo_realizacao'],
};

// Valida a divisão de um lançamento bancário em N partes: cada parte precisa
// ter um destino válido e valor positivo, e a soma das partes tem que bater
// com o valor original do lançamento (tolerância de 1 centavo por causa de
// arredondamento) — garante que a divisão nunca "perde" nem "inventa" dinheiro.
function validarPartesDivisao(valorTotal, partes, tipoLancamento) {
  if (!Array.isArray(partes) || partes.length < 2) {
    return { ok: false, erro: 'Informe ao menos 2 partes para dividir o lançamento' };
  }
  const destinosPermitidos = DESTINOS_POR_TIPO[tipoLancamento] || DESTINOS_SPLIT_VALIDOS;
  for (const p of partes) {
    if (!destinosPermitidos.includes(p.destino)) {
      return { ok: false, erro: `destino inválido para lançamento ${tipoLancamento || ''}: ${p.destino}` };
    }
    if (!p.destino_id) {
      return { ok: false, erro: 'destino_id é obrigatório em cada parte' };
    }
    if (!(parseFloat(p.valor) > 0)) {
      return { ok: false, erro: 'valor de cada parte precisa ser maior que zero' };
    }
  }
  const soma = round2(partes.reduce((s, p) => s + parseFloat(p.valor), 0));
  if (Math.abs(soma - round2(parseFloat(valorTotal))) > 0.01) {
    return { ok: false, erro: `a soma das partes (${soma}) precisa bater com o valor do lançamento (${round2(valorTotal)})` };
  }
  return { ok: true };
}

module.exports = {
  STATUS_VALIDOS,
  STATUS_AUTOMATICOS,
  STATUS_FINAIS_MANUAIS,
  DESTINOS_SPLIT_VALIDOS,
  DESTINOS_POR_TIPO,
  round2,
  avancarStatusLifecycle,
  saldoCusto,
  podeClassificarSaldo,
  validarPartesDivisao,
};
