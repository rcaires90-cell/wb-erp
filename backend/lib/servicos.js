// Serviços da WB e preço de referência — fonte única (leads, pedidos de
// clientes, formulários). Os nomes são os valores gravados no banco.
const VALORES_SERVICO = {
  'Naturalização Brasileira':                                       2790,
  'Naturalização Provisória (crianças/adolescentes)':               1790,
  'Autorização de Residência (CPLP / Reunião Familiar / Mercosul)': 1250,
  'Renovação de Autorização de Residência':                          650,
  'Agendamento de Autorização de Residência':                        200,
  'Visto Americano de Turismo':                                     1600,
};

// Motivos do pedido de quem já é cliente (id → texto pra equipe)
const MOTIVOS_CLIENTE = {
  andamento:    'Andamento do processo',
  documentos:   'Enviar documentos',
  pagamento:    'Pagamento',
  novo_servico: 'Quero contratar outro serviço',
  outro:        'Outro assunto',
};

module.exports = { VALORES_SERVICO, MOTIVOS_CLIENTE };
