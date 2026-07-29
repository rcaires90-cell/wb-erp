const router  = require('express').Router();
const multer  = require('multer');
const auth    = require('../middleware/auth');
const { GoogleGenerativeAI } = require('@google/generative-ai');

router.use(auth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Apenas imagens'));
    cb(null, true);
  },
});

const PROMPT = `Você é um sistema de OCR especializado em documentos de imigração e contratos brasileiros.
Analise esta imagem — pode ser passaporte, RNM, CRNM, visto, carteira de identidade, OU um contrato de
prestação de serviços (nesse caso os dados costumam estar na "qualificação das partes", ex: "NOME, nacionalidade,
portador do CPF nº X, RNM nº Y, residente e domiciliado em Z") — e extraia os dados em JSON puro.

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
  "genero": "M" ou "F" ou null
}

Se um campo não estiver visível, ilegível ou não existir no documento, use null.
Datas devem estar em formato YYYY-MM-DD. Converta formatos DD/MM/YYYY, MM/YY ou similares.`;

router.post('/', upload.single('imagem'), async (req, res) => {
  if (!req.file) return res.status(400).json({ erro: 'Imagem obrigatória' });
  if (!process.env.GEMINI_API_KEY) return res.status(500).json({ erro: 'GEMINI_API_KEY não configurada' });

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const imagePart = {
      inlineData: {
        data: req.file.buffer.toString('base64'),
        mimeType: req.file.mimetype,
      },
    };

    const result = await model.generateContent([PROMPT, imagePart]);
    let texto = result.response.text().trim();

    // Remove markdown fences if present
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
