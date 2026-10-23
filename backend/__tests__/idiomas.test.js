jest.mock('../db', () => ({ query: jest.fn(async () => [[]]), on: jest.fn() }));
jest.mock('../lib/email', () => ({ sendEmail: jest.fn(async () => ({})) }));

const { FORMULARIOS_CONFIG } = require('../lib/formularios');
const { FORMULARIOS_I18N, OPCOES, comTraducoes, IDIOMAS_TRAD } = require('../lib/formulariosI18n');

describe('traduções dos formulários', () => {
  test('toda pergunta, seção, dica e opção tem tradução em es/en/fr/ht/fa', () => {
    const faltando = [];
    for (const [k, cfg] of Object.entries(FORMULARIOS_CONFIG)) {
      const tr = FORMULARIOS_I18N[k];
      if (!tr) { faltando.push(k); continue; }
      if (tr.secoes.length !== cfg.secoes.length) faltando.push(`${k}: seções`);
      for (const lang of IDIOMAS_TRAD) if (!tr.titulo[lang]) faltando.push(`${k}.titulo.${lang}`);
      cfg.secoes.forEach(sec => sec.perguntas.forEach(p => {
        for (const lang of IDIOMAS_TRAD) if (!tr.perguntas[p.id]?.[lang]) faltando.push(`${k}.${p.id}.${lang}`);
        (p.opcoes || []).forEach(o => IDIOMAS_TRAD.forEach(l => { if (!OPCOES[o]?.[l]) faltando.push(`opção "${o}" ${l}`); }));
        if (p.dica) IDIOMAS_TRAD.forEach(l => { if (!tr.perguntas[p.id]?.dica?.[l]) faltando.push(`dica ${p.id} ${l}`); });
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

describe('textos das páginas públicas (i18n-publico.js)', () => {
  const vm = require('vm');
  const carregar = (lang) => {
    const ctx = { window: {}, location: { search: '?lang=' + lang }, navigator: { language: 'pt' }, localStorage: { getItem: () => null }, URLSearchParams, Intl, Date };
    vm.runInNewContext(require('fs').readFileSync(require('path').join(__dirname, '../public/lib/i18n-publico.js'), 'utf8'), ctx);
    return ctx.window.WBI18N;
  };
  test('todo texto existe nos 6 idiomas', () => {
    const src = require('fs').readFileSync(require('path').join(__dirname, '../public/lib/i18n-publico.js'), 'utf8');
    const ctx = { window: {}, location: { search: '' }, navigator: { language: 'pt' }, localStorage: { getItem: () => null }, URLSearchParams, Intl, Date };
    // expõe a tabela interna só pro teste
    vm.runInNewContext(src.replace('window.WBI18N = {', 'window.__T = T; window.WBI18N = {'), ctx);
    const T = ctx.window.__T, falta = [];
    for (const [k, v] of Object.entries(T)) for (const l of ['pt', 'es', 'en', 'fr', 'ht', 'fa']) if (!v[l]) falta.push(k + '.' + l);
    expect(falta).toEqual([]);
  });
  test('?lang= escolhe o idioma; crioulo tem data própria; persa usa calendário gregoriano', () => {
    expect(carregar('ht').t('cfConfirmar')).toBe('✅ Konfime prezans');
    expect(carregar('ht').dataLonga('2026-10-26')).toBe('Lendi 26 oktòb');
    const fa = carregar('fa');
    expect(fa.lang).toBe('fa');
    expect(fa.dataLonga('2026-10-26')).toMatch(/اکتبر/); // outubro gregoriano, não mês persa
  });
});

describe('e-mail em persa e crioulo', () => {
  const { sendEmail } = require('../lib/email');
  const agenda = require('../lib/agendaServico');
  test('persa sai da direita pra esquerda; crioulo com data em crioulo', async () => {
    sendEmail.mockClear();
    await agenda.enviarPedidoConfirmacao({ nome: 'Ali', email: 'a@x.com', data: '2026-10-26', hora: '10:00', tipo: 'Consulta inicial', token: 'c'.repeat(48), idioma: 'fa' });
    expect(sendEmail.mock.calls[0][2]).toMatch(/dir="rtl"/);
    expect(sendEmail.mock.calls[0][2]).toMatch(/lang=fa/);
    await agenda.enviarPedidoConfirmacao({ nome: 'Jean', email: 'j@x.com', data: '2026-10-26', hora: '10:00', tipo: 'Consulta inicial', token: 'd'.repeat(48), idioma: 'ht' });
    expect(sendEmail.mock.calls[1][1]).toMatch(/Konfime randevou ou/);
    expect(sendEmail.mock.calls[1][2]).toMatch(/Lendi 26 oktòb/);
    expect(sendEmail.mock.calls[1][2]).not.toMatch(/dir="rtl"/);
  });
});
