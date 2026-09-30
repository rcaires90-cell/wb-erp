// Regra de negócio única pro alerta de antecedente criminal vencido/vencendo.
// Usada tanto no backend (cron diário de e-mail, verificarAntecedenteCron em
// server.js) quanto no frontend (toast de login, notificacoesLogin em
// index.html) — arquivo único pra nunca mais divergir entre as duas cópias
// (ver project_wb_erp.md, entrada de 2026-09-30, pro histórico dos
// refinamentos que motivaram essa extração).
//
// UMD simples: funciona tanto via require() no Node quanto via <script src>
// no browser (sem bundler, define window.WBAntecedente).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.WBAntecedente = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {

  // "Protocolado" é detectado pela fase do processo ter avançado além de
  // pré-protocolo — o campo processo_protocolo (número literal) raramente é
  // preenchido na prática, então não serve como sinal confiável (checado
  // contra dado real de produção em 2026-09-30: só 9 de 36 processos
  // avançados tinham o campo preenchido).
  function protocolado(cliente) {
    return !!(cliente.processo_fase && cliente.processo_fase !== 'pre_protocolo');
  }

  // Só não alerta quando o documento JÁ foi legalizado E o processo já foi
  // protocolado — nesse caso o antecedente já valeu pro protocolo, vencer
  // depois não é mais problema. Protocolado sem legalizar (ou legalizado sem
  // protocolar) continua sendo uma pendência real.
  function legalizadoEProtocolado(cliente) {
    return !!cliente.doc_antecedente && protocolado(cliente);
  }

  function diasAte(val, hoje) {
    if (!val) return null;
    hoje = hoje || new Date();
    const alvo = new Date(String(val).slice(0, 10) + 'T12:00');
    return Math.ceil((alvo - hoje) / 864e5);
  }

  function deveAlertar(cliente, opts) {
    opts = opts || {};
    const janela = opts.janelaDias != null ? opts.janelaDias : 30;
    if (cliente.arquivado) return false;
    if (!cliente.doc_antecedente_val) return false;
    const dias = diasAte(cliente.doc_antecedente_val, opts.hoje);
    if (dias === null || dias > janela) return false;
    return !legalizadoEProtocolado(cliente);
  }

  return { protocolado, legalizadoEProtocolado, diasAte, deveAlertar };
}));
