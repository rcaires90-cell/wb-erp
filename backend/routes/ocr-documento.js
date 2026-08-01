const router          = require('express').Router();
const multer           = require('multer');
const auth             = require('../middleware/auth');
const Groq              = require('groq-sdk');
const { pdfParaImagensPng } = require('../lib/pdfToImages');

router.use(auth);

const VISION_MODEL = 'qwen/qwen3.6-27b';

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 15 * 1024 * 1024 }, // 15 MB
  fileFilter: (_, file, cb) => {
    if (!file.mimetype.startsWith('image/') && file.mimetype !== 'application/pdf') {
      return cb(new Error('Apenas imagens ou PDF'));
    }
    cb(null, true);
  },
});

const PROMPT = `Você é um sistema de OCR especializado em documentos de imigração e contratos brasileiros.
Analise esta(s) imagem(ns) — pode ser passaporte, RNM, CRNM, visto, carteira de identidade, OU um contrato de
prestação de serviços (nesse caso os dados costumam estar na "qualificação das partes", ex: "NOME, nacionalidade,
portador do CPF nº X, RNM nº Y, residente e domiciliado em Z") — e extraia os dados.

Se for um contrato, procure também a cláusula de pagamento (geralmente "CLÁUSULA 2 — DO PAGAMENTO" ou similar),
que costuma trazer o valor total, a forma de pagamento (PIX/Boleto/Cartão/Transferência/Dinheiro) e o
detalhamento de cada parcela com valor e data de vencimento (ex: "1ª parcela de R$520,00 na data de 26/05/2026").
Extraia CADA parcela individualmente, na ordem em que aparecem.

Retorne APENAS um objeto JSON válido, sem texto adicional, markdown ou formatação:
{
  "tipo_doc": "passaporte" | "rnm" | "visto" | "identidade" | "contrato" | "outro",
  "nome": "nome completo da pessoa (do cliente/contratado, não do contratante WB Assessoria), em maiúsculas normais",
  "numero_doc": "número exato do documento (RNM/passaporte/identidade), se houver",
  "cpf": "CPF no formato 000.000.000-00, ou null se não houver",
  "endereco_logradouro": "nome da rua/avenida/alameda SEM o número, ex: 'Rua Tupaciguar', ou null",
  "endereco_numero": "apenas o número do imóvel, ex: '161', ou null",
  "endereco_complemento": "complemento (apto, bloco, casa, sala etc), ou null",
  "endereco_bairro": "bairro, ou null",
  "endereco_cidade": "cidade, ou null",
  "endereco_uf": "sigla do estado com 2 letras maiúsculas, ex: 'SP', ou null",
  "endereco_cep": "CEP no formato 00000-000, ou null",
  "data_nascimento": "YYYY-MM-DD ou null se ilegível",
  "data_validade": "YYYY-MM-DD ou null se ilegível",
  "nacionalidade": "país de origem por extenso em português, ex: Haiti, Venezuela, Angola",
  "genero": "M" ou "F" ou null,
  "valor_total": número (ex: 2600.00) com o valor total do contrato, ou null se não for contrato ou não tiver valor,
  "forma_pagamento": "PIX" | "Boleto" | "Cartão" | "Transferência" | "Dinheiro" | null,
  "parcelas": [ { "numero": 1, "valor": 520.00, "vencimento": "2026-05-26" } ] — uma entrada por parcela encontrada na cláusula de pagamento, ou [] se não houver parcelamento
}

Se um campo não estiver visível, ilegível ou não existir no documento, use null.
Datas devem estar em formato YYYY-MM-DD. Converta formatos DD/MM/YYYY, MM/YY ou similares.
IMPORTANTE: nunca junte o endereço inteiro em um só campo — separe SEMPRE rua, número, complemento, bairro,
cidade, UF e CEP cada um no seu próprio campo (endereco_logradouro, endereco_numero, etc), mesmo que no
documento original apareçam juntos numa única linha de texto.`;

// Blindagem: normaliza data para YYYY-MM-DD mesmo se a IA devolver DD/MM/YYYY
// ou DD-MM-YYYY (evita gravar data inválida por causa de má formatação)
function normalizarData(str) {
  if (!str || typeof str !== 'string') return str;
  const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return str;
  const br = str.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return str;
}

function normalizarDatasDados(dados) {
  if (dados.data_nascimento) dados.data_nascimento = normalizarData(dados.data_nascimento);
  if (dados.data_validade)   dados.data_validade   = normalizarData(dados.data_validade);
  if (Array.isArray(dados.parcelas)) {
    dados.parcelas.forEach(p => { if (p.vencimento) p.vencimento = normalizarData(p.vencimento); });
  }
  return dados;
}

router.post('/', upload.single('imagem'), async (req, res) => {
  if (!req.file) return res.status(400).json({ erro: 'Arquivo obrigatório (imagem ou PDF)' });
  if (!process.env.GROQ_API_KEY) return res.status(500).json({ erro: 'GROQ_API_KEY não configurada' });

  try {
    const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const isPdf = req.file.mimetype === 'application/pdf';
    const paginas = isPdf
      ? (await pdfParaImagensPng(req.file.buffer, 3)).map(buf => ({ buf, mime: 'image/png' }))
      : [{ buf: req.file.buffer, mime: req.file.mimetype }];

    const content = [{ type: 'text', text: PROMPT }];
    for (const { buf, mime } of paginas) {
      content.push({
        type: 'image_url',
        image_url: { url: `data:${mime};base64,${buf.toString('base64')}` },
      });
    }

    const completion = await client.chat.completions.create({
      model: VISION_MODEL,
      messages: [{ role: 'user', content }],
      response_format: { type: 'json_object' },
      reasoning_effort: 'none',
      temperature: 0,
      max_tokens: 2048,
    });

    let texto = (completion.choices[0]?.message?.content || '').trim();
    texto = texto.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

    let dados;
    try {
      dados = JSON.parse(texto);
    } catch {
      return res.status(422).json({ erro: 'IA não conseguiu extrair dados estruturados', raw: texto });
    }
    dados = normalizarDatasDados(dados);

    res.json({ ok: true, dados });
  } catch (e) {
    console.error('[ocr-documento]', e.message);
    res.status(500).json({ erro: e.message });
  }
});

module.exports = router;
