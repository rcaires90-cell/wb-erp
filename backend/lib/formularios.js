// Roteiro de perguntas-chave por serviço — usado tanto no formulário
// interno (colaborador preenche durante a conversa) quanto no formulário
// público (link enviado direto pro cliente responder). Fonte única de
// verdade: front-end interno e página pública buscam isso via
// GET /api/leads/formularios em vez de duplicar o conteúdo.
const FORMULARIOS_CONFIG = {
  naturalizacao: {
    servico: 'Naturalização Brasileira',
    titulo: 'Naturalização Brasileira',
    icon: '🇧🇷',
    intro: 'Perguntas-chave pra qualificar o cliente e já deixar tudo pronto pro Pipeline de Leads.',
    secoes: [
      { titulo: '01 · Dados Pessoais', perguntas: [
        { id: 'nacionalidade', label: 'Nacionalidade / país de origem',  tipo: 'text' },
        { id: 'tempo_brasil',  label: 'Há quanto tempo mora no Brasil?', tipo: 'text' },
        { id: 'rnm_tipo',      label: 'Tipo de RNM que possui',          tipo: 'select', opcoes: ['Permanente', 'Temporário', 'Ainda não tem'] },
      ] },
      { titulo: '02 · Situação Migratória e Elegibilidade', perguntas: [
        { id: 'vinculo_brasileiro', label: 'É casado(a) ou tem filho(a) brasileiro(a)?', tipo: 'select', opcoes: ['Sim', 'Não'] },
        { id: 'antecedentes',       label: 'Possui certidão de antecedentes criminais (Brasil e país de origem)?', tipo: 'select', opcoes: ['Sim, os dois', 'Só do Brasil', 'Nenhum ainda'] },
        { id: 'portugues',          label: 'Fala, lê e escreve português com fluência?', tipo: 'select', opcoes: ['Sim', 'Parcialmente', 'Não'] },
        { id: 'pendencias',         label: 'Tem alguma pendência com Receita Federal ou Polícia Federal?', tipo: 'text' },
      ] },
      { titulo: '03 · Próximos Passos', perguntas: [
        { id: 'urgencia', label: 'Quando pretende iniciar o processo?', tipo: 'text' },
      ] },
    ],
  },
  residencia: {
    servico: 'Autorização de Residência (CPLP / Reunião Familiar / Mercosul)',
    titulo: 'Autorização de Residência',
    icon: '🪪',
    intro: 'Perguntas-chave pra qualificar o cliente e já deixar tudo pronto pro Pipeline de Leads.',
    secoes: [
      { titulo: '01 · Dados Pessoais', perguntas: [
        { id: 'nacionalidade', label: 'Nacionalidade / país de origem', tipo: 'text' },
        { id: 'passaporte',    label: 'Possui passaporte válido?',      tipo: 'select', opcoes: ['Sim', 'Não', 'Está vencendo'] },
        { id: 'situacao',      label: 'Já está no Brasil ou vai entrar?', tipo: 'select', opcoes: ['Já está no Brasil', 'Ainda vai entrar'] },
      ] },
      { titulo: '02 · Base Legal e Vínculo', perguntas: [
        { id: 'base_legal',       label: 'Qual a base legal pretendida?', tipo: 'select', opcoes: ['CPLP', 'Reunião Familiar', 'Mercosul', 'Não sei — preciso de orientação'] },
        { id: 'vinculo_familiar', label: 'Tem vínculo familiar com brasileiro(a)? (cônjuge, filho, pai/mãe)', tipo: 'text' },
        { id: 'rnm_anterior',     label: 'É primeira solicitação ou renovação de RNM?', tipo: 'select', opcoes: ['Primeira solicitação', 'Renovação'] },
      ] },
      { titulo: '03 · Localização e Prazo', perguntas: [
        { id: 'localizacao', label: 'Cidade/Estado onde pretende residir', tipo: 'text' },
        { id: 'urgencia',    label: 'Prazo/urgência desejada', tipo: 'text' },
      ] },
    ],
  },
  visto_eua: {
    servico: 'Visto Americano de Turismo',
    titulo: 'Visto EUA (Turismo/Negócios B1/B2)',
    icon: '🇺🇸',
    intro: 'Baseado na Ficha de Informações — Visto Americano usada pela WB. As respostas serão usadas no DS-160 e na entrevista, preencha com atenção.',
    secoes: [
      { titulo: '01 · Dados Pessoais e do Passaporte', perguntas: [
        { id: 'nome_passaporte',      label: 'Nome completo exatamente como consta no passaporte', tipo: 'text' },
        { id: 'data_nascimento',      label: 'Data de nascimento',            tipo: 'date' },
        { id: 'local_nascimento',     label: 'Cidade / Estado de nascimento', tipo: 'text' },
        { id: 'passaporte_num',       label: 'Número do passaporte',          tipo: 'text' },
        { id: 'passaporte_emissao',   label: 'Data de emissão',               tipo: 'date' },
        { id: 'passaporte_venc',      label: 'Data de vencimento',            tipo: 'date' },
        { id: 'nome_pai',             label: 'Nome completo do pai',          tipo: 'text' },
        { id: 'nome_mae',             label: 'Nome completo da mãe',          tipo: 'text' },
        { id: 'visto_negado',         label: 'Já teve visto negado?',         tipo: 'select', opcoes: ['Não', 'Sim'] },
        { id: 'visto_negado_detalhe', label: 'Se sim: qual país e motivo',    tipo: 'text' },
        { id: 'mudou_nome',           label: 'Mudou de nome alguma vez?',     tipo: 'select', opcoes: ['Não', 'Sim'] },
        { id: 'nome_anterior',        label: 'Se sim: nome anterior',         tipo: 'text' },
      ] },
      { titulo: '02 · Meios de Contato', perguntas: [
        { id: 'tel_celular',     label: 'Telefone celular',     tipo: 'text' },
        { id: 'tel_comercial',   label: 'Telefone comercial',   tipo: 'text' },
        { id: 'tel_residencial', label: 'Telefone residencial', tipo: 'text' },
        { id: 'redes_sociais',   label: 'Redes sociais (Instagram, Facebook, X, LinkedIn...)', tipo: 'text' },
      ] },
      { titulo: '03 · Endereços', perguntas: [
        { id: 'endereco_brasil', label: 'Endereço completo no Brasil (rua, número, complemento, bairro, cidade, estado e CEP)', tipo: 'textarea' },
        { id: 'endereco_eua',    label: 'Endereço onde pretende ficar nos EUA (hotel ou casa de familiar)', tipo: 'textarea' },
      ] },
      { titulo: '04 · Família e Estado Civil', perguntas: [
        { id: 'estado_civil',          label: 'Estado civil', tipo: 'select', opcoes: ['Solteiro(a)', 'Casado(a)', 'União estável', 'Divorciado(a)', 'Viúvo(a)'] },
        { id: 'conjuge_nome',          label: 'Nome completo do cônjuge', tipo: 'text' },
        { id: 'conjuge_nacionalidade', label: 'Nacionalidade do cônjuge', tipo: 'text' },
        { id: 'conjuge_nascimento',    label: 'Data de nascimento do cônjuge', tipo: 'date' },
        { id: 'conjuge_cidade_nasc',   label: 'Cidade de nascimento do cônjuge', tipo: 'text' },
        { id: 'parentes_eua',          label: 'Possui parentes nos EUA?', tipo: 'select', opcoes: ['Não', 'Sim'] },
        { id: 'parentes_eua_detalhe',  label: 'Se sim: nome e grau de parentesco', tipo: 'text' },
      ] },
      { titulo: '05 · Trabalho ou Escola', perguntas: [
        { id: 'empresa_escola',   label: 'Nome da empresa ou escola', tipo: 'text' },
        { id: 'empresa_endereco', label: 'Endereço', tipo: 'text' },
        { id: 'empresa_telefone', label: 'Telefone', tipo: 'text' },
        { id: 'cargo',            label: 'Cargo ou função', tipo: 'text' },
        { id: 'renda_mensal',     label: 'Renda mensal', tipo: 'text' },
        { id: 'tempo_emprego',    label: 'Tempo no emprego atual', tipo: 'text' },
        { id: 'emprego_anterior', label: 'Emprego anterior — só se tiver menos de 5 anos no atual (empresa, cargo e período)', tipo: 'textarea' },
      ] },
      { titulo: '06 · Formação Acadêmica e Idiomas', perguntas: [
        { id: 'graduacao',     label: 'Graduação (curso e instituição)', tipo: 'text' },
        { id: 'pos_graduacao', label: 'MBA / Pós-graduação, se houver', tipo: 'text' },
        { id: 'idiomas',       label: 'Idiomas além do português', tipo: 'text' },
      ] },
      { titulo: '07 · Viagens e Saúde', perguntas: [
        { id: 'viagens_5anos',        label: 'Viagens internacionais nos últimos 5 anos, fora os EUA — quais países', tipo: 'textarea' },
        { id: 'doenca_risco',         label: 'Doença contagiosa de risco à saúde pública (ex: tuberculose)?', tipo: 'select', opcoes: ['Não', 'Sim'] },
        { id: 'doenca_risco_detalhe', label: 'Se sim: qual doença', tipo: 'text' },
      ] },
    ],
  },
};

module.exports = { FORMULARIOS_CONFIG };
