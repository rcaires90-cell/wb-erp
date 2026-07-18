const puppeteer = require('puppeteer');

let browserPromise = null;
function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      headless: true,
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
