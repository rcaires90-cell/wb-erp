const puppeteer = require('puppeteer');

// Em produção (Railway/Nixpacks) usamos o Chromium do sistema (pacote Nix,
// já vem com as libs certas) em vez do binário que o Puppeteer baixaria
// sozinho — evita problemas de build (extração) e libs faltando em runtime.
// Em dev local, se não achar nada no PATH, cai no Chromium baixado pelo
// próprio Puppeteer (comportamento padrão).
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
    browserPromise = puppeteer.launch({
      headless: true,
      executablePath: resolveExecutablePath(),
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }
  return browserPromise;
}

async function htmlParaPdfBase64(html) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const buffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', bottom: '20mm', left: '18mm', right: '18mm' },
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
function dadosParaTemplate(cliente) {
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
    valor:       cliente.valor ? `R$ ${parseFloat(cliente.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '',
    data:        new Date().toLocaleDateString('pt-BR'),
  };
}

module.exports = { htmlParaPdfBase64, mesclarTemplate, dadosParaTemplate };
