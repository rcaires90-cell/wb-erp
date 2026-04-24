/**
 * WB ERP — Robô de Mensagens Próprio
 * Sem dependência de APIs externas. Gratuito, rápido, sempre disponível.
 * Templates inteligentes com variações para não parecer mensagem automática.
 */
const router = require('express').Router();
const db     = require('../db');
const auth   = require('../middleware/auth');

router.use(auth);

// ── UTILITÁRIOS ───────────────────────────────────────────────────────────────
const primeiro = (nome = '') => nome.trim().split(' ')[0];
const fmt      = v => `R$ ${(parseFloat(v)||0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
const aleatorio = arr => arr[Math.floor(Math.random() * arr.length)];

const SAUDACOES = ['Olá', 'Oi', 'Bom dia', 'Boa tarde'];
const DESPEDIDAS = [
  'Qualquer dúvida estamos à disposição! 🙏',
  'Conte conosco sempre! 💪',
  'Estamos aqui para ajudar no que precisar! 😊',
  'A WB segue firme ao seu lado! 🤝',
];
const ASSINATURA = '\n\n— *WB Assessoria Migratória*\n📞 Renato Caires';

// ── TEMPLATES ─────────────────────────────────────────────────────────────────

function tplBoasVindas(c) {
  const nome = primeiro(c.nome);
  const msgs = [
    `${aleatorio(SAUDACOES)}, *${nome}*! 👋\n\nSeja bem-vindo(a) à *WB Assessoria Migratória*! É uma honra tê-lo(a) conosco.\n\nEstamos aqui para cuidar de todo o processo de *${c.servico || 'regularização migratória'}* com dedicação e transparência.\n\nEm breve entraremos em contato para orientá-lo(a) sobre os próximos passos. Qualquer dúvida, pode chamar aqui! 😊`,
    `${aleatorio(SAUDACOES)}, *${nome}*! 🎉\n\nBem-vindo(a) à família WB! Estamos muito felizes em poder acompanhar o seu processo.\n\nNosso compromisso é com a *sua tranquilidade* em cada etapa. Fique à vontade para tirar qualquer dúvida conosco.\n\nVamos juntos! 🤝`,
  ];
  return aleatorio(msgs) + ASSINATURA;
}

function tplCobranca(c, parcela = {}) {
  const nome      = primeiro(c.nome);
  const valor     = parcela.valor     ? fmt(parcela.valor)       : 'uma parcela em aberto';
  const diasAtraso = parcela.dias_atraso ? parseInt(parcela.dias_atraso) : null;
  const venc      = parcela.vencimento
    ? new Date(parcela.vencimento + 'T12:00').toLocaleDateString('pt-BR')
    : null;

  const urgencia = diasAtraso && diasAtraso > 30
    ? `Notamos que essa parcela já está há *${diasAtraso} dias* em atraso. `
    : '';

  const msgs = [
    `${aleatorio(SAUDACOES)}, *${nome}*! 😊\n\nPassando para um lembrete carinhoso sobre ${valor}${venc ? `, com vencimento em ${venc}` : ''}, referente ao seu processo de *${c.servico || 'assessoria'}*.\n\n${urgencia}Sabemos que o dia a dia é corrido! Quando puder regularizar, é só nos avisar para podermos continuar seu processo com prioridade. 🙏\n\n${aleatorio(DESPEDIDAS)}`,
    `${aleatorio(SAUDACOES)}, *${nome}*!\n\nTudo bem? Gostaríamos de lembrar que há ${valor} pendente${venc ? ` com vencimento em *${venc}*` : ''} no seu processo.\n\n${urgencia}Caso tenha alguma dificuldade no momento, entre em contato — podemos conversar sobre alternativas. O importante é mantermos tudo em dia para o andamento do seu processo! 💛\n\n${aleatorio(DESPEDIDAS)}`,
    `${aleatorio(SAUDACOES)}, *${nome}*! 👋\n\nVim dar um toque sobre o pagamento de ${valor}${venc ? ` que venceu em ${venc}` : ''}.\n\n${urgencia}Pode realizar via PIX ou transferência — assim que confirmar, me avisa que dou baixa imediatamente! ✅\n\n${aleatorio(DESPEDIDAS)}`,
  ];
  return aleatorio(msgs) + ASSINATURA;
}

function tplCursoProficiencia(c) {
  const nome = primeiro(c.nome);
  const msgs = [
    `${aleatorio(SAUDACOES)}, *${nome}*! 🎓\n\nQueria falar sobre uma etapa muito importante do seu processo de Naturalização: o *Certificado de Língua Portuguesa*.\n\nEsse certificado é *obrigatório* — sem ele, o processo não pode avançar mesmo que todos os outros documentos estejam ok. 📋\n\nA boa notícia é que você pode fazer o curso online, no seu ritmo!\n\n🔗 *Acesse:* https://www.virtualead.com.br/sistema/login/rocha\n\nQualquer dúvida sobre como fazer o cadastro, é só me chamar! 😊\n\n${aleatorio(DESPEDIDAS)}`,
    `${aleatorio(SAUDACOES)}, *${nome}*! 👋\n\nPassando para avisar sobre o *Curso de Proficiência em Língua Portuguesa* — uma etapa que não pode ser pulada na Naturalização Brasileira.\n\nO certificado precisa estar em mãos para protocolarmos seu processo. Quanto antes você fizer, mais rápido avançamos! 🚀\n\n📌 *Link do curso:* https://www.virtualead.com.br/sistema/login/rocha\n\nSe tiver qualquer dificuldade para acessar, me avisa! ${aleatorio(DESPEDIDAS)}`,
  ];
  return aleatorio(msgs) + ASSINATURA;
}

function tplStatusProcesso(c) {
  const nome = primeiro(c.nome);
  return `Olá, *${nome}*!\n\nSeguimos firmes no acompanhamento do seu processo, e queremos reforçar que você está no caminho certo rumo à sua conquista.\n\nRealizamos a verificação da fase atual e, até o momento, ele permanece na mesma etapa, sem novas movimentações no sistema.\n\nSeguimos acompanhando de forma contínua e atenta. Assim que houver qualquer atualização, entraremos em contato imediatamente.\n\nVamos seguir confiantes — cada etapa nos aproxima ainda mais da sua conquista. 🤝🇧🇷\n\n⚠️ *Alerta importante:*\nCaso receba algum e-mail da Polícia Federal:\n\n1️⃣ Encaminhe imediatamente para:\nwbassessoria.contato@gmail.com\n\n2️⃣ Nos avise também pelo WhatsApp.\n\nDessa forma, conseguimos acompanhar com mais agilidade e orientar você corretamente.\n\n*Equipe WB Assessoria Migratória* 🇧🇷`;
}

function tplDocumentosPendentes(c, docs = []) {
  const nome = primeiro(c.nome);
  const lista = docs.length
    ? docs.map(d => `  • ${d}`).join('\n')
    : '  • Verificar com a equipe';

  return `${aleatorio(SAUDACOES)}, *${nome}*! 📋\n\nPrecisamos de alguns documentos para continuar com o seu processo:\n\n${lista}\n\nAssim que puder providenciar, pode trazer pessoalmente ou enviar foto aqui mesmo pelo WhatsApp! 📸\n\n${aleatorio(DESPEDIDAS)}` + ASSINATURA;
}

function tplAgendamento(c, data, hora, local = 'nosso escritório') {
  const nome = primeiro(c.nome);
  return `${aleatorio(SAUDACOES)}, *${nome}*! 📅\n\nSeu atendimento foi agendado:\n\n📆 *Data:* ${data}\n🕐 *Hora:* ${hora}\n📍 *Local:* ${local}\n\nPor favor, lembre-se de trazer seus documentos originais.\n\nQualquer imprevisto, me avisa com antecedência! ${aleatorio(DESPEDIDAS)}` + ASSINATURA;
}

function tplParabelns(c) {
  const nome = primeiro(c.nome);
  const msgs = [
    `🎂 *Feliz Aniversário, ${nome}!*\n\nNeste dia especial, toda a equipe da *WB Assessoria* deseja a você muita saúde, paz e que todos os seus sonhos se realizem!\n\nÉ uma honra fazer parte da sua história. 🥂\n\n${aleatorio(DESPEDIDAS)}`,
    `🎉 *Parabéns, ${nome}!*\n\nEm nome de toda a equipe WB, desejamos um feliz aniversário com muito sucesso, saúde e alegria!\n\nObrigado por confiar no nosso trabalho! 💛` + ASSINATURA,
  ];
  return aleatorio(msgs) + ASSINATURA;
}

function tplConclusao(c) {
  const nome = primeiro(c.nome);
  return `🎊 *Parabéns, ${nome}!*\n\nTemos uma ótima notícia: *o seu processo foi concluído com sucesso!* 🇧🇷\n\nFoi uma honra acompanhar cada etapa desta jornada com você. Este é um momento histórico na sua vida e estamos muito felizes em ter feito parte dele!\n\nSe precisar de qualquer assessoria futura, pode contar conosco. 🤝\n\nMuito obrigado pela confiança!\n\n*Equipe WB Assessoria Migratória*` + ASSINATURA;
}

function tplCrioulo(c, instrucao = '') {
  const nome = primeiro(c.nome);
  // Templates em Crioulo Haitiano para as situações mais comuns
  const msgs = {
    cobranca: `Bonjou, *${nome}*! 👋\n\nNou vle raple ou ke gen yon peman ki annatant nan dosye ou a.\n\nKi lè ou kapab regle sa? Kontakte nou pou nou ka jwenn yon solisyon ansanm! 🙏\n\n— *WB Assessoria Migratória*`,
    status:   `Bonjou, *${nome}*! 😊\n\nNou vle ba ou nouvèl sou dosye ou a.\n\n📋 *Estati aktyèl:* ${c.status || 'Anpwogre'}\n\nNou ap travay di pou dosye ou a. Mèsi pou konfyans ou! 💛\n\n— *WB Assessoria Migratória*`,
    geral:    `Bonjou, *${nome}*! 👋\n\nNou vle pran kontak avèk ou konsènan dosye ou a nan *WB Assessoria Migratória*.\n\n${instrucao || 'Tanpri kontakte nou pou plis enfòmasyon.'}\n\nMèsi anpil! 🙏\n\n— *WB Assessoria Migratória*`,
  };
  const tipo = instrucao.toLowerCase().includes('cobr') || instrucao.toLowerCase().includes('peman') ? 'cobranca'
    : instrucao.toLowerCase().includes('status') || instrucao.toLowerCase().includes('dosye') ? 'status'
    : 'geral';
  return msgs[tipo];
}

function tplMensagemGeral(c, instrucao = '') {
  const nome = primeiro(c.nome);
  return `${aleatorio(SAUDACOES)}, *${nome}*! 😊\n\n${instrucao || `Passando para entrar em contato sobre o seu processo de *${c.servico || 'assessoria'}* aqui na WB.`}\n\n${aleatorio(DESPEDIDAS)}` + ASSINATURA;
}

// ── MODOS DISPONÍVEIS ─────────────────────────────────────────────────────────
const MODOS = {
  boas_vindas:          { desc: 'Mensagem de boas-vindas ao novo cliente' },
  cobranca:             { desc: 'Lembrete de parcela vencida (amigável)' },
  curso_proficiencia:   { desc: 'Incentiva o cliente a fazer o curso de língua' },
  status_processo:      { desc: 'Atualização do andamento do processo' },
  documentos_pendentes: { desc: 'Solicita documentos faltantes' },
  agendamento:          { desc: 'Confirmação de agendamento' },
  parabens:             { desc: 'Mensagem de aniversário' },
  conclusao:            { desc: 'Processo concluído com sucesso' },
  crioulo:              { desc: 'Mensagem em Crioulo Haitiano' },
  mensagem_geral:       { desc: 'Mensagem personalizada com instrução livre' },
};

// ── GET /api/robo/modos ───────────────────────────────────────────────────────
router.get('/modos', (_req, res) => {
  res.json(Object.entries(MODOS).map(([id, m]) => ({ id, desc: m.desc })));
});

// ── POST /api/robo ────────────────────────────────────────────────────────────
// Body: { modo, cliente_id?, instrucao?, docs?, data?, hora?, local?, parcela? }
router.post('/', async (req, res) => {
  const { modo = 'mensagem_geral', cliente_id, instrucao, docs, data, hora, local, parcela } = req.body;

  if (!MODOS[modo]) {
    return res.status(400).json({
      erro: `Modo inválido. Opções: ${Object.keys(MODOS).join(', ')}`,
    });
  }

  try {
    // Carrega cliente se informado
    let cliente = {};
    if (cliente_id) {
      const [[c]] = await db.query('SELECT * FROM clientes WHERE id=?', [parseInt(cliente_id)]);
      if (c) cliente = c;
    }

    let texto = '';

    switch (modo) {
      case 'boas_vindas':          texto = tplBoasVindas(cliente); break;
      case 'cobranca':             texto = tplCobranca(cliente, parcela || {}); break;
      case 'curso_proficiencia':   texto = tplCursoProficiencia(cliente); break;
      case 'status_processo':      texto = tplStatusProcesso(cliente, instrucao); break;
      case 'documentos_pendentes': texto = tplDocumentosPendentes(cliente, docs || []); break;
      case 'agendamento':          texto = tplAgendamento(cliente, data || '—', hora || '—', local); break;
      case 'parabens':             texto = tplParabelns(cliente); break;
      case 'conclusao':            texto = tplConclusao(cliente); break;
      case 'crioulo':              texto = tplCrioulo(cliente, instrucao || ''); break;
      case 'mensagem_geral':       texto = tplMensagemGeral(cliente, instrucao || ''); break;
      default:                     texto = tplMensagemGeral(cliente, instrucao || '');
    }

    res.json({
      ok:           true,
      modo,
      texto,
      cliente_id:   cliente_id || null,
      cliente_nome: cliente?.nome || null,
    });

  } catch (e) {
    console.error('[robo POST]', e.message);
    res.status(500).json({ erro: e.message });
  }
});

module.exports = router;
