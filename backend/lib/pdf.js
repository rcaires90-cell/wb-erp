// Puppeteer recente é distribuído como ESM — require() direto quebra em
// runtimes mais antigos (ex: Node 18 do Railway) com ERR_REQUIRE_ESM.
// import() dinâmico funciona em qualquer versão do Node, ESM ou CJS.
let puppeteerModulePromise = null;
function loadPuppeteer() {
  if (!puppeteerModulePromise) {
    puppeteerModulePromise = import('puppeteer').then(m => m.default || m);
  }
  return puppeteerModulePromise;
}

// Em produção (Railway/Nixpacks) usamos o Chromium do sistema (instalado
// via apt, já com as libs certas) em vez do binário que o Puppeteer
// baixaria sozinho — evita problemas de build (extração) e libs faltando
// em runtime. Em dev local, se não achar nada no PATH, cai no Chromium
// baixado pelo próprio Puppeteer (comportamento padrão).
function resolveExecutablePath() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
  try {
    const { execSync } = require('child_process');
    const out = execSync('which chromium || which chromium-browser || which google-chrome', { shell: '/bin/sh' })
      .toString().trim().split('\n')[0];
    return out || undefined;
  } catch {
    return undefined;
  }
}

let browserPromise = null;
function getBrowser() {
  if (!browserPromise) {
    browserPromise = loadPuppeteer().then(puppeteer => puppeteer.launch({
      headless: true,
      executablePath: resolveExecutablePath(),
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    }));
  }
  return browserPromise;
}

// Rodapé fixo repetido em toda página do PDF (endereço/telefone do escritório).
// Puppeteer exige que o footerTemplate seja HTML autocontido (sem CSS externo).
const RODAPE_PADRAO = `
  <div style="width:100%;font-size:8px;color:#777;text-align:center;font-family:Arial,sans-serif;padding-top:3px">
    Av. Amador Bueno da Veiga, 1970 – Sala 19 · Penha – São Paulo · Telefone: (11) 91425-8886
  </div>`;

async function htmlParaPdfBase64(html, opcoes = {}) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const comRodape = opcoes.rodape !== false;
    const buffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', bottom: comRodape ? '24mm' : '20mm', left: '18mm', right: '18mm' },
      displayHeaderFooter: comRodape,
      headerTemplate: '<span></span>',
      footerTemplate: opcoes.footerTemplate || RODAPE_PADRAO,
    });
    return buffer.toString('base64');
  } finally {
    await page.close();
  }
}

// Substitui placeholders {{campo}} pelos valores em `dados`
function mesclarTemplate(html, dados) {
  return html.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, campo) => {
    const v = dados[campo];
    return v !== undefined && v !== null ? String(v) : '';
  });
}

// Monta o objeto de placeholders disponíveis a partir de um registro de cliente
// e (opcionalmente) das parcelas já cadastradas pra ele no Financeiro.
function dadosParaTemplate(cliente, parcelas = []) {
  const fmtMoeda = v => `R$ ${parseFloat(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  const fmtData  = d => d ? new Date(d).toLocaleDateString('pt-BR') : '';

  const parcelasLista = parcelas.length
    ? '<ul style="margin:0;padding-left:18px">' + parcelas.map((p, i) => {
        const partes = [p.descricao || `Parcela ${i + 1}`, fmtMoeda(p.valor)];
        if (p.vencimento) partes.push('vencimento em ' + fmtData(p.vencimento));
        if (p.forma_pgto) partes.push(p.forma_pgto);
        return `<li>${partes.join(' — ')}</li>`;
      }).join('') + '</ul>'
    : 'A definir conforme acordo de pagamento entre as partes.';

  return {
    nome:        cliente.nome || '',
    cpf:         cliente.cpf || '',
    rnm:         cliente.rnm || '',
    pais:        cliente.pais || '',
    endereco:    cliente.endereco || '',
    servico:     cliente.servico || '',
    tel:         cliente.tel || '',
    email:       cliente.email || '',
    responsavel: cliente.responsavel || '',
    protocolo:   cliente.protocolo || '',
    valor:       cliente.valor ? fmtMoeda(cliente.valor) : '',
    data:        new Date().toLocaleDateString('pt-BR'),
    parcelas_lista: parcelasLista,
  };
}

module.exports = { htmlParaPdfBase64, mesclarTemplate, dadosParaTemplate };
