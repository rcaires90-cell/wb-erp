const router  = require('express').Router();
const auth    = require('../middleware/auth');
const db      = require('../db');
const { GoogleGenerativeAI } = require('@google/generative-ai');

router.use(auth);

// ── SYSTEM PROMPT INSTITUCIONAL ───────────────────────────────────────────────
const SYSTEM_PROMPT = `
Você é o assistente inteligente da **WB Assessoria Migratória**, um escritório especializado em
imigração e naturalização brasileira, localizado no Brasil.

## Sobre o escritório

- **Razão social:** WB Assessoria Migratória
- **Responsável principal:** Renato Caires (CEO / advogado responsável)
- **Colaboradora:** Cristiane (atendimento e operações)
- **Especialidade:** Assessoria migratória — regularização de imigrantes no Brasil e
  obtenção de vistos para Portugal.

## Serviços oferecidos

1. **Naturalização Brasileira** — processo completo junto à Polícia Federal e MJSP.
   - Duração média: 12 a 24 meses.
   - Etapas: Pré-Protocolo → PF (Anexo de Docs) → PF (Análise) → PF (Biometria)
     → MJSP (Análise Final) → Publicação no DOU → Conclusão.

2. **Autorização de Residência — CPLP**
   - Para cidadãos de países da Comunidade dos Países de Língua Portuguesa.
   - Processo junto à Polícia Federal.
   - Etapas: Análise de Elegibilidade → Coleta de Documentos → Protocolo MigranteWeb
     → Agendamento na PF → Atendimento na PF → Emissão → Conclusão.

3. **Autorização de Residência — Reagrupamento Familiar**
   - Para familiares de residentes legais no Brasil.
   - Mesmo fluxo da CPLP junto à PF.

4. **Visto de Procura de Trabalho — Portugal**
   - Para clientes que desejam buscar emprego em Portugal.
   - Etapas: Análise de Elegibilidade → Coleta de Documentos → Agendamento no Consulado
     → Atendimento Consular → Análise Consular → Emissão do Visto → Conclusão.

5. **Regularização Migratória** — outros casos de regularização.

## Documentos exigidos (Naturalização)

RNM/RNE, CPF, Comprovante de Endereço, Passaporte, Comprovante dos últimos 4 anos no país,
Antecedente Criminal apostilado (com validade), Certificado de Língua Portuguesa,
Certidão de Prova Presencial.

## Como o escritório se comunica com os clientes

- **Tom:** profissional, mas próximo e humano. Nunca frio ou burocrático.
- **Idioma:** sempre Português Brasileiro.
- **WhatsApp:** principal canal de comunicação com os clientes.
- Renato trata os clientes pelo primeiro nome, demonstra empatia e explica cada
  etapa com clareza — porque muitos clientes estão em situação de vulnerabilidade
  e precisam de segurança.
- Mensagens de cobrança de parcelas: sempre educadas, nunca ameaçadoras.
  Reforçam o compromisso do escritório em ajudar e pedem cooperação.
- Mensagens de andamento do processo: objetivas, com a etapa atual, próximo passo
  e previsão quando possível.

## Sobre pagamentos

- Contratos têm entrada + parcelas mensais.
- Casais têm contratos separados (cada um paga metade do valor total).
- Parcelas vencidas: abordagem amigável, oferecer renegociação se necessário.

## Curso de Proficiência em Língua Portuguesa

- Plataforma: VirtuaLead (https://www.virtualead.com.br/sistema/login/rocha)
- Necessário para a Naturalização Brasileira.
- Mensagens para clientes devem incentivá-los a completar o curso com urgência,
  explicando que o certificado bloqueia o processo se não obtido.

## Regras absolutas

- Nunca invente datas, prazos ou informações que não foram fornecidas.
- Se não tiver dados suficientes, peça mais informações.
- Nunca prometa aprovação — o processo depende dos órgãos governamentais.
- Mantenha o tom da WB: próximo, profissional, empático.
- Respostas em Português Brasileiro sempre.
`.trim();

// ── MODOS DO AGENTE ───────────────────────────────────────────────────────────
const MODOS = {

  // Gera mensagem WhatsApp personalizada para o cliente
  mensagem_whatsapp: {
    desc: 'Gera mensagem WhatsApp personalizada',
    prompt: (ctx) => `
Gere uma mensagem de WhatsApp para o cliente abaixo. A mensagem deve ser natural,
usar o primeiro nome do cliente, e o tom característico da WB Assessoria.

**Dados do cliente:**
${JSON.stringify(ctx.cliente, null, 2)}

**Motivo / instrução:**
${ctx.instrucao || 'Atualização geral do processo'}

Retorne APENAS o texto da mensagem, pronto para copiar e enviar. Sem explicações adicionais.
`,
  },

  // Gera mensagem de cobrança de parcela vencida
  cobranca: {
    desc: 'Gera mensagem de cobrança amigável',
    prompt: (ctx) => `
Gere uma mensagem de cobrança amigável no WhatsApp para o cliente abaixo.
A parcela está vencida. O tom deve ser educado, empático, sem ameaças.
Relembre o compromisso da WB em ajudar e peça cooperação.

**Dados do cliente:**
Nome: ${ctx.cliente?.nome || '—'}
Serviço: ${ctx.cliente?.servico || '—'}
Valor da parcela: R$ ${ctx.parcela?.valor || '—'}
Vencimento: ${ctx.parcela?.vencimento || '—'}
Dias em atraso: ${ctx.parcela?.dias_atraso || '—'}

Retorne APENAS o texto da mensagem.
`,
  },

  // Gera mensagem sobre o Curso de Proficiência
  curso_proficiencia: {
    desc: 'Gera mensagem sobre o Curso de Proficiência',
    prompt: (ctx) => `
Gere uma mensagem de WhatsApp para incentivar o cliente a fazer o Curso de
Proficiência em Língua Portuguesa na plataforma VirtuaLead.

**Dados do cliente:**
Nome: ${ctx.cliente?.nome || '—'}
Serviço: ${ctx.cliente?.servico || 'Naturalização Brasileira'}
Etapa atual: ${ctx.cliente?.etapa_label || '—'}

Explique de forma clara e motivadora:
1. Por que o certificado é obrigatório
2. Que o curso está disponível na plataforma
3. Que sem o certificado o processo trava
4. Incentive a agir agora

Retorne APENAS o texto da mensagem WhatsApp.
`,
  },

  // Explica o status atual do processo para um colaborador
  resumo_processo: {
    desc: 'Resume o processo de um cliente para a equipe',
    prompt: (ctx) => `
Com base nos dados abaixo, faça um resumo claro e objetivo do status do processo
deste cliente para uso interno da equipe WB.

**Dados do cliente:**
${JSON.stringify(ctx.cliente, null, 2)}

**Parcelas:**
${JSON.stringify(ctx.parcelas, null, 2)}

Inclua:
- Etapa atual e próximo passo
- Situação financeira (pago / em aberto)
- Pendências identificadas
- Recomendação de ação imediata

Seja objetivo, use bullet points.
`,
  },

  // Mensagem em Crioulo Haitiano
  crioulo: {
    desc: 'Gera mensagem em Crioulo Haitiano (Kreyòl Ayisyen)',
    prompt: (ctx) => `
Gere uma mensagem de WhatsApp em **Crioulo Haitiano (Kreyòl Ayisyen)** para o cliente abaixo.
O tom deve ser profissional mas próximo. Use o primeiro nome do cliente.

**Dados do cliente:**
Nome: ${ctx.cliente?.nome || '—'}
Serviço: ${ctx.cliente?.servico || '—'}
País: ${ctx.cliente?.pais || 'Haiti'}

**Motivo / instrução:**
${ctx.instrucao || 'Atualização geral do processo'}

Retorne APENAS o texto da mensagem em Crioulo Haitiano, pronto para enviar.
`,
  },

  // Resumo do escritório para o cliente (portal)
  status_cliente: {
    desc: 'Gera resumo do processo para enviar ao cliente',
    prompt: (ctx) => `
Gere uma mensagem clara e tranquilizadora para o cliente, explicando em que etapa
está o processo dele. Use linguagem simples, sem jargão jurídico.

**Dados do cliente:**
Nome: ${ctx.cliente?.nome || '—'}
Serviço: ${ctx.cliente?.servico || '—'}
Status: ${ctx.cliente?.status || '—'}
Etapa: ${ctx.cliente?.etapa || 0} de ${ctx.cliente?.total_etapas || 8}

**Instrução adicional:**
${ctx.instrucao || 'Informe o status atual de forma clara'}

Retorne APENAS o texto da mensagem em Português Brasileiro.
`,
  },

  // Chat livre com contexto do cliente
  chat: {
    desc: 'Chat livre com contexto do escritório',
    prompt: (ctx) => ctx.mensagem || 'Olá, como posso ajudar?',
  },
};

// ── POST /api/agente ──────────────────────────────────────────────────────────
// Body: { modo, cliente_id?, instrucao?, mensagem?, parcela? }
router.post('/', async (req, res) => {
  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({ erro: 'GEMINI_API_KEY não configurada no .env' });
  }

  const { modo = 'chat', cliente_id, instrucao, mensagem, parcela } = req.body;

  if (!MODOS[modo]) {
    return res.status(400).json({
      erro: `Modo inválido. Opções: ${Object.keys(MODOS).join(', ')}`,
    });
  }

  try {
    // Carrega dados do cliente se informado
    let cliente = null;
    let parcelas = [];

    if (cliente_id) {
      const [[c]] = await db.query('SELECT * FROM clientes WHERE id=?', [parseInt(cliente_id)]);
      cliente = c || null;

      if (cliente) {
        const [ps] = await db.query(
          'SELECT * FROM parcelas WHERE cliente_id=? ORDER BY vencimento ASC',
          [parseInt(cliente_id)]
        );
        parcelas = ps;
      }
    }

    const ctx = { cliente, parcelas, instrucao, mensagem, parcela };
    const userPrompt = MODOS[modo].prompt(ctx);

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: SYSTEM_PROMPT,
    });

    const result = await model.generateContent(userPrompt);
    const texto  = result.response.text();

    res.json({
      ok:          true,
      modo,
      texto,
      cliente_id:  cliente_id || null,
      cliente_nome: cliente?.nome || null,
    });

  } catch (e) {
    console.error('[agente POST]', e.message);
    res.status(500).json({ erro: e.message });
  }
});

// ── GET /api/agente/modos ─────────────────────────────────────────────────────
router.get('/modos', (_req, res) => {
  res.json(Object.entries(MODOS).map(([id, m]) => ({ id, desc: m.desc })));
});

module.exports = router;
