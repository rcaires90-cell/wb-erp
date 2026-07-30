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
  "endereco": "endereço completo como aparece no texto (rua, número, bairro, cidade, UF, CEP), ou null se não houver",
  "data_nascimento": "YYYY-MM-DD ou null se ilegível",
  "data_validade": "YYYY-MM-DD ou null se ilegível",
  "nacionalidade": "país de origem por extenso em português, ex: Haiti, Venezuela, Angola",
  "genero": "M" ou "F" ou null,
  "valor_total": número (ex: 2600.00) com o valor total do contrato, ou null se não for contrato ou não tiver valor,
  "forma_pagamento": "PIX" | "Boleto" | "Cartão" | "Transferência" | "Dinheiro" | null,
  "parcelas": [ { "numero": 1, "valor": 520.00, "vencimento": "2026-05-26" } ] — uma entrada por parcela encontrada na cláusula de pagamento, ou [] se não houver parcelamento
}

Se um campo não estiver visível, ilegível ou não existir no documento, use null.
Datas devem estar em formato YYYY-MM-DD. Converta formatos DD/MM/YYYY, MM/YY ou similares.`;

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

    res.json({ ok: true, dados });
  } catch (e) {
    console.error('[ocr-documento]', e.message);
    res.status(500).json({ erro: e.message });
  }
});

module.exports = router;
