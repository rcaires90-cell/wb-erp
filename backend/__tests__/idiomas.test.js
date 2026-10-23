jest.mock('../db', () => ({ query: jest.fn(async () => [[]]), on: jest.fn() }));
jest.mock('../lib/email', () => ({ sendEmail: jest.fn(async () => ({})) }));

const { FORMULARIOS_CONFIG } = require('../lib/formularios');
const { FORMULARIOS_I18N, OPCOES, comTraducoes } = require('../lib/formulariosI18n');

describe('traduções dos formulários', () => {
  test('toda pergunta, seção e opção tem tradução em es/en/fr', () => {
    const faltando = [];
    for (const [k, cfg] of Object.entries(FORMULARIOS_CONFIG)) {
      const tr = FORMULARIOS_I18N[k];
      if (!tr) { faltando.push(k); continue; }
      if (tr.secoes.length !== cfg.secoes.length) faltando.push(`${k}: seções`);
      for (const lang of ['es', 'en', 'fr']) if (!tr.titulo[lang]) faltando.push(`${k}.titulo.${lang}`);
      cfg.secoes.forEach(sec => sec.perguntas.forEach(p => {
        for (const lang of ['es', 'en', 'fr']) if (!tr.perguntas[p.id]?.[lang]) faltando.push(`${k}.${p.id}.${lang}`);
        (p.opcoes || []).forEach(o => { if (!OPCOES[o]) faltando.push(`opção "${o}"`); });
      }));
    }
    expect(faltando).toEqual([]);
  });

  test('respostas continuam com pergunta/opção em português; tradução vem em t', () => {
    const c = comTraducoes(FORMULARIOS_CONFIG);
    const p = c.naturalizacao.secoes[0].perguntas.find(x => x.id === 'rnm_tipo');
    expect(p.label).toBe('Tipo de RNM que possui');
    expect(p.opcoes).toEqual(['Permanente', 'Temporário', 'Ainda não tem']);
    expect(p.t.en.label).toBe('Type of RNM you have');
    expect(p.t.fr.opcoes[2]).toBe("Je n'en ai pas encore");
  });

  test('naturalização tem a seção do checklist de documentos, sem pedir senha', () => {
    const sec = FORMULARIOS_CONFIG.naturalizacao.secoes.find(s => s.titulo.includes('Documentos'));
    expect(sec.perguntas.length).toBe(12);
    const tudo = JSON.stringify(FORMULARIOS_CONFIG.naturalizacao).toLowerCase();
    expect(tudo).not.toMatch(/senha/);
  });
});

describe('e-mails ao cliente no idioma escolhido', () => {
  const { sendEmail } = require('../lib/email');
  const agenda = require('../lib/agendaServico');

  test('idioma inválido cai para português', () => {
    expect(agenda.idiomaOk('xx')).toBe('pt');
    expect(agenda.idiomaOk('fr')).toBe('fr');
  });

  test('pedido de confirmação em espanhol, com link na mesma língua', async () => {
    sendEmail.mockClear();
    await agenda.enviarPedidoConfirmacao({ nome: 'Ana', email: 'a@x.com', data: '2026-10-26', hora: '10:00', tipo: 'Consulta inicial', token: 'a'.repeat(48), idioma: 'es' });
    const [para, assunto, html] = sendEmail.mock.calls[0];
    expect(para).toBe('a@x.com');
    expect(assunto).toMatch(/Confirme su cita/);
    expect(html).toMatch(/Lunes, 26 de octubre/);
    expect(html).toMatch(/Consulta inicial/);
    expect(html).toMatch(/lang=es&acao=confirmar/);
  });

  test('sábado sem horário em inglês não manda botão de confirmar', async () => {
    sendEmail.mockClear();
    await agenda.enviarPedidoConfirmacao({ nome: 'Bob', email: 'b@x.com', data: '2026-10-31', hora: null, tipo: 'Consulta inicial', token: 'b'.repeat(48), idioma: 'en' });
    const [, assunto, html] = sendEmail.mock.calls[0];
    expect(assunto).toMatch(/We received/);
    expect(html).toMatch(/To be confirmed by our team/);
    expect(html).not.toMatch(/acao=confirmar/);
  });
});
