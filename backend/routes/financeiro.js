const router     = require('express').Router();
const db          = require('../db');
const auth        = require('../middleware/auth');
const multer       = require('multer');
const Groq          = require('groq-sdk');
const { pdfParaImagensPng } = require('../lib/pdfToImages');

router.use(auth);

const VISION_MODEL = 'qwen/qwen3.6-27b';

const uploadExtrato = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (_, file, cb) => {
    if (file.mimetype !== 'application/pdf') return cb(new Error('Apenas PDF'));
    cb(null, true);
  },
});

// ── Regras de auto-categorização por palavra-chave ──────────────────────────
const REGRAS_CATEGORIA = [
  { cat: 'Aluguel',             palavras: ['aluguel','locacao','locação','imovel','imóvel','condominio','condomínio'] },
  { cat: 'Energia Elétrica',    palavras: ['cpfl','enel','eletropaulo','energia','eletricidade','luz '] },
  { cat: 'Internet',            palavras: ['vivo','claro','tim','oi ','net ','internet','fibra','telecom','band'] },
  { cat: 'Água',                palavras: ['sabesp','saneamento','agua','água','sanepar'] },
  { cat: 'Tradução',            palavras: ['traducao','tradução','tradutor','juramentada','apostila'] },
  { cat: 'Mantimentos Escritório', palavras: ['papelaria','material','escritorio','escritório','copa','cafe','café','limpeza','suprimento'] },
  { cat: 'Serviços Contábeis',  palavras: ['contabilidade','contabil','contábil','contador','contadora'] },
  { cat: 'Impostos e Taxas',    palavras: ['darf','simples','imposto','taxa','tributo','recolhimento','fgts','inss'] },
  { cat: 'Marketing',           palavras: ['google','meta ','facebook','instagram','anuncio','anúncio','marketing','publicidade'] },
  { cat: 'Software / Sistemas', palavras: ['software','sistema','assinatura','plano','cloud','hosting','servidor'] },
  { cat: 'Pessoal / Salário',   palavras: ['salario','salário','folha','pagamento func','colaborador','pro-labore','prolabore'] },
  { cat: 'Receita Clientes',    palavras: ['pix recebido','ted recebido','deposito','depósito','transferencia recebida'] },
];

function detectarCategoria(descricao) {
  const d = descricao.toLowerCase();
  for (const r of REGRAS_CATEGORIA) {
    if (r.palavras.some(p => d.includes(p))) return r.cat;
  }
  return 'Outros';
}

// Tenta extrair só o nome da pessoa/empresa a partir da descrição crua do
// extrato (ex: "PIX RECEBIDO JOAO DA SILVA" -> "JOAO DA SILVA"). É um
// palpite best-effort — fica sempre editável na tela pra Cristiane corrigir.
const PREFIXOS_EXTRATO = [
  /^pix\s+(recebido|enviado|transferido)?\s*(de|para)?\s*/i,
  /^ted\s+(recebid[ao]|enviad[ao])?\s*(de|para)?\s*/i,
  /^doc\s+(recebid[ao]|enviad[ao])?\s*(de|para)?\s*/i,
  /^transfer[êe]ncia\s+(recebida|enviada)?\s*(de|para)?\s*/i,
  /^dep[óo]sito\s*(de)?\s*/i,
  /^pagamento\s+(de|para)?\s*/i,
  /^compra\s+(no\s+d[ée]bito|no\s+cr[ée]dito)?\s*(em|-)?\s*/i,
  /^boleto\s*(pago)?\s*(para)?\s*/i,
];
function extrairNomeDescricao(descricao) {
  let s = (descricao || '').trim();
  for (const re of PREFIXOS_EXTRATO) {
    if (re.test(s)) { s = s.replace(re, '').trim(); break; }
  }
  // Remove sufixos comuns de identificação bancária (CPF/CNPJ mascarado, código da transação)
  s = s.replace(/\s*-?\s*\d{3}\.?\*{3}\.?\*{3}-?\d{2}\s*$/, '').trim();
  s = s.replace(/\s*\d{6,}\s*$/, '').trim();
  return s || null;
}

// Alguns extratos (principalmente boleto) trazem o CNPJ do fornecedor junto
// na descrição — tenta achar e normaliza só os dígitos, pra comparar depois
// com o CNPJ cadastrado em Contas a Pagar. Retorna null se não achar nada
// no formato certo (14 dígitos, com ou sem pontuação).
function extrairCnpjDescricao(descricao) {
  const s = descricao || '';
  const m = s.match(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/);
  if (!m) return null;
  const digitos = m[0].replace(/\D/g, '');
  return digitos.length === 14 ? digitos : null;
}

// ── GET /api/financeiro/lancamentos ─────────────────────────────────────────
// ?mes=2026-04&conta=&categoria=&conciliado=
router.get('/lancamentos', async (req, res) => {
  try {
    let sql = 'SELECT * FROM lancamentos_bancarios WHERE 1=1';
    const params = [];

    if (req.query.mes) {
      sql += ' AND DATE_FORMAT(data, \'%Y-%m\') = ?';
      params.push(req.query.mes);
    }
    if (req.query.conta) {
      sql += ' AND conta = ?';
      params.push(req.query.conta);
    }
    if (req.query.categoria) {
      sql += ' AND categoria = ?';
      params.push(req.query.categoria);
    }
    if (req.query.conciliado !== undefined) {
      sql += ' AND conciliado = ?';
      params.push(req.query.conciliado === '1' ? 1 : 0);
    }
    if (req.query.tipo) {
      sql += ' AND tipo = ?';
      params.push(req.query.tipo);
    }

    sql += ' ORDER BY data DESC, id DESC';

    const [rows] = await db.query(sql, params);

    // Totais
    const debitos  = rows.filter(r => r.tipo === 'debito').reduce((s, r) => s + parseFloat(r.valor), 0);
    const creditos = rows.filter(r => r.tipo === 'credito').reduce((s, r) => s + parseFloat(r.valor), 0);

    res.json({ lancamentos: rows, totais: { debitos, creditos, saldo: creditos - debitos } });
  } catch (e) {
    console.error('[financeiro GET /lancamentos]', e);
    res.status(500).json({ erro: e.message });
  }
});

// ── GET /api/financeiro/categorias ────────────────────────────────────────
// Categorias já usadas em algum lançamento — pra sugerir no autocomplete e
// permitir que a equipe crie categorias novas livremente (o campo é texto
// livre, não uma lista fechada).
router.get('/categorias', async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT DISTINCT categoria FROM lancamentos_bancarios WHERE categoria IS NOT NULL AND categoria <> '' ORDER BY categoria"
    );
    res.json({ categorias: rows.map(r => r.categoria) });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// ── POST /api/financeiro/lancamentos ────────────────────────────────────────
// Lança um ou múltiplos registros (array ou objeto único)
router.post('/lancamentos', async (req, res) => {
  try {
    const lista = Array.isArray(req.body) ? req.body : [req.body];

    const inseridos = [];
    for (const item of lista) {
      const { data, descricao, valor, tipo, categoria, conta, conciliado, obs, nome } = item;

      if (!data || !descricao || valor === undefined) {
        return res.status(400).json({ erro: 'data, descricao e valor são obrigatórios' });
      }

      const cat = categoria || detectarCategoria(descricao);
      const [r] = await db.query(
        `INSERT INTO lancamentos_bancarios (data, descricao, valor, tipo, categoria, conta, conciliado, obs, criado_por, nome)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [
          data,
          descricao.trim(),
          parseFloat(valor),
          tipo === 'credito' ? 'credito' : 'debito',
          cat,
          conta || null,
          conciliado ? 1 : 0,
          obs || null,
          req.user.nome,
          nome || null,
        ]
      );
      const [[novo]] = await db.query('SELECT * FROM lancamentos_bancarios WHERE id = ?', [r.insertId]);
      inseridos.push(novo);
    }

    res.status(201).json(inseridos.length === 1 ? inseridos[0] : inseridos);
  } catch (e) {
    console.error('[financeiro POST /lancamentos]', e);
    res.status(500).json({ erro: e.message });
  }
});

// ── PATCH /api/financeiro/lancamentos/:id ───────────────────────────────────
router.patch('/lancamentos/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { data, descricao, valor, tipo, categoria, conta, conciliado, obs, nome } = req.body;

    await db.query(
      `UPDATE lancamentos_bancarios
       SET data=COALESCE(?,data), descricao=COALESCE(?,descricao), valor=COALESCE(?,valor),
           tipo=COALESCE(?,tipo), categoria=COALESCE(?,categoria), conta=COALESCE(?,conta),
           conciliado=COALESCE(?,conciliado), obs=COALESCE(?,obs), nome=COALESCE(?,nome)
       WHERE id=?`,
      [data||null, descricao||null, valor!==undefined?parseFloat(valor):null,
       tipo||null, categoria||null, conta||null,
       conciliado!==undefined?(conciliado?1:0):null, obs||null, nome||null, id]
    );

    const [[up]] = await db.query('SELECT * FROM lancamentos_bancarios WHERE id = ?', [id]);
    if (!up) return res.status(404).json({ erro: 'Lançamento não encontrado' });
    res.json(up);
  } catch (e) {
    console.error('[financeiro PATCH /lancamentos/:id]', e);
    res.status(500).json({ erro: e.message });
  }
});

// ── DELETE /api/financeiro/lancamentos/:id ───────────────────────────────────
router.delete('/lancamentos/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [r] = await db.query('DELETE FROM lancamentos_bancarios WHERE id = ?', [id]);
    if (r.affectedRows === 0) return res.status(404).json({ erro: 'Lançamento não encontrado' });
    res.json({ ok: true });
  } catch (e) {
    console.error('[financeiro DELETE /lancamentos/:id]', e);
    res.status(500).json({ erro: e.message });
  }
});

// Tipos que geram um registro espelhado em tabela própria (despesas/prolabore
// alimentam abas dedicadas do sistema). Transferência entre contas, empréstimo
// e receita são só uma etiqueta no próprio lançamento — servem pra tirar esses
// valores das somas de despesa/receita real dos relatórios, sem precisar de
// uma tabela/aba própria pra cada um.
const TIPOS_CLASSIFICACAO_COM_TABELA = ['despesa', 'prolabore'];
const TIPOS_CLASSIFICACAO_VALIDOS = ['despesa', 'prolabore', 'transferencia', 'emprestimo', 'receita'];

// ── POST /api/financeiro/lancamentos/:id/classificar ──────────────────────────
// Cristiane usa isso pra dizer o que um lançamento bancário realmente é —
// despesa/pró-labore criam o registro correspondente em despesas/prolabore;
// transferência entre contas/empréstimo/receita só marcam o lançamento (não
// são despesa nem receita operacional de verdade, ou já são óbvios pelo tipo
// credito/debito, mas ficam identificados pra não aparecer como "sem
// classificar" e não entrar nas médias de despesa dos relatórios).
router.post('/lancamentos/:id/classificar', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { tipo, categoria, forma_pgto, nome_socio, cargo, obs } = req.body;
    if (!TIPOS_CLASSIFICACAO_VALIDOS.includes(tipo)) {
      return res.status(400).json({ erro: `tipo deve ser um de: ${TIPOS_CLASSIFICACAO_VALIDOS.join(', ')}` });
    }

    const [[lanc]] = await db.query('SELECT * FROM lancamentos_bancarios WHERE id = ?', [id]);
    if (!lanc) return res.status(404).json({ erro: 'Lançamento não encontrado' });
    if (lanc.classificado_como) {
      return res.status(409).json({ erro: `Já classificado como ${lanc.classificado_como}` });
    }

    let refId = null;
    if (tipo === 'despesa') {
      const [r] = await db.query(
        `INSERT INTO despesas (data, categoria, descricao, valor, forma_pgto, obs, lancado_por)
         VALUES (?,?,?,?,?,?,?)`,
        [lanc.data, categoria || lanc.categoria || 'Outros', lanc.nome || lanc.descricao,
         lanc.valor, forma_pgto || 'PIX', obs || `Classificado a partir do lançamento #${lanc.id}`, req.user.nome]
      );
      refId = r.insertId;
    } else if (tipo === 'prolabore') {
      const mes = String(lanc.data).slice(0, 7);
      const [r] = await db.query(
        `INSERT INTO prolabore (mes, nome, cargo, valor, data_pgto, obs, lancado_por)
         VALUES (?,?,?,?,?,?,?)`,
        [mes, nome_socio || lanc.nome || 'Não informado', cargo || null, lanc.valor, lanc.data,
         obs || `Classificado a partir do lançamento #${lanc.id}`, req.user.nome]
      );
      refId = r.insertId;
    }
    // transferencia / emprestimo / receita: só marca o lançamento, sem tabela própria

    await db.query(
      'UPDATE lancamentos_bancarios SET classificado_como=?, classificado_ref_id=? WHERE id=?',
      [tipo, refId, id]
    );
    const [[atualizado]] = await db.query('SELECT * FROM lancamentos_bancarios WHERE id = ?', [id]);
    res.json({ ok: true, lancamento: atualizado, ref_id: refId });
  } catch (e) {
    console.error('[financeiro POST /lancamentos/:id/classificar]', e);
    res.status(500).json({ erro: e.message });
  }
});

// ── DELETE /api/financeiro/lancamentos/:id/classificar ────────────────────────
// Desfaz a classificação: apaga o despesa/prolabore criado (se houver) e limpa o vínculo.
router.delete('/lancamentos/:id/classificar', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [[lanc]] = await db.query('SELECT * FROM lancamentos_bancarios WHERE id = ?', [id]);
    if (!lanc) return res.status(404).json({ erro: 'Lançamento não encontrado' });
    if (!lanc.classificado_como) return res.status(400).json({ erro: 'Este lançamento não está classificado' });

    if (TIPOS_CLASSIFICACAO_COM_TABELA.includes(lanc.classificado_como) && lanc.classificado_ref_id) {
      const tabela = lanc.classificado_como === 'despesa' ? 'despesas' : 'prolabore';
      await db.query(`DELETE FROM ${tabela} WHERE id = ?`, [lanc.classificado_ref_id]);
    }
    await db.query(
      'UPDATE lancamentos_bancarios SET classificado_como=NULL, classificado_ref_id=NULL WHERE id=?',
      [id]
    );
    const [[atualizado]] = await db.query('SELECT * FROM lancamentos_bancarios WHERE id = ?', [id]);
    res.json({ ok: true, lancamento: atualizado });
  } catch (e) {
    console.error('[financeiro DELETE /lancamentos/:id/classificar]', e);
    res.status(500).json({ erro: e.message });
  }
});

// ── GET /api/financeiro/resumo ───────────────────────────────────────────────
// Resumo por categoria do mês
router.get('/resumo', async (req, res) => {
  try {
    const mes = req.query.mes || new Date().toISOString().slice(0, 7);

    const [porCategoria] = await db.query(`
      SELECT categoria, tipo, SUM(valor) AS total, COUNT(*) AS qtd
      FROM lancamentos_bancarios
      WHERE DATE_FORMAT(data,'%Y-%m') = ?
      GROUP BY categoria, tipo
      ORDER BY total DESC`, [mes]);

    const [porConta] = await db.query(`
      SELECT conta, tipo, SUM(valor) AS total
      FROM lancamentos_bancarios
      WHERE DATE_FORMAT(data,'%Y-%m') = ?
      GROUP BY conta, tipo`, [mes]);

    const [[totais]] = await db.query(`
      SELECT
        SUM(CASE WHEN tipo='debito'  THEN valor ELSE 0 END) AS debitos,
        SUM(CASE WHEN tipo='credito' THEN valor ELSE 0 END) AS creditos
      FROM lancamentos_bancarios
      WHERE DATE_FORMAT(data,'%Y-%m') = ?`, [mes]);

    res.json({
      mes,
      por_categoria: porCategoria,
      por_conta:     porConta,
      totais: {
        debitos:  parseFloat(totais.debitos  || 0),
        creditos: parseFloat(totais.creditos || 0),
        saldo:    parseFloat((totais.creditos || 0) - (totais.debitos || 0)),
      },
    });
  } catch (e) {
    console.error('[financeiro GET /resumo]', e);
    res.status(500).json({ erro: e.message });
  }
});

// ── GET /api/financeiro/fluxo-caixa ───────────────────────────────────────────
// Projeção simples de fluxo de caixa: entradas previstas (parcelas em aberto,
// dado real) vs saídas estimadas (média das despesas dos últimos 3 meses,
// já que não existe um cadastro de despesas fixas/recorrentes no sistema —
// é uma estimativa, não um valor conhecido, e a resposta deixa isso claro).
router.get('/fluxo-caixa', async (req, res) => {
  try {
    const [parcelasAbertas] = await db.query(
      `SELECT p.valor, p.vencimento, p.cliente_id, c.nome AS cliente_nome
       FROM parcelas p JOIN clientes c ON c.id = p.cliente_id
       WHERE p.paga = 0 AND p.vencimento IS NOT NULL`
    );
    // Contas a pagar em aberto = saída CONHECIDA (não estimativa), soma à parte
    // da média histórica — cobre o que já está agendado de verdade.
    const [contasPagarAbertas] = await db.query(
      `SELECT valor, vencimento FROM contas_pagar WHERE paga = 0`
    );

    const [[mediaDespesas]] = await db.query(`
      SELECT SUM(valor) AS total, COUNT(DISTINCT DATE_FORMAT(data,'%Y-%m')) AS meses
      FROM despesas
      WHERE data >= DATE_SUB(CURDATE(), INTERVAL 3 MONTH)`
    );
    const mesesBase = Math.max(parseInt(mediaDespesas.meses) || 0, 1);
    const saidaMensalMedia = parseFloat(mediaDespesas.total || 0) / mesesBase;

    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const dias = (v) => Math.floor((new Date(String(v).slice(0,10) + 'T00:00:00') - hoje) / 864e5);

    const buckets = {
      vencidas: { label: 'Vencidas (ainda não pagas)', valor: 0, qtd: 0, saida_conhecida: 0, qtd_contas_pagar: 0 },
      d30:      { label: 'Próximos 30 dias',           valor: 0, qtd: 0, saida_estimada: saidaMensalMedia, saida_conhecida: 0, qtd_contas_pagar: 0 },
      d60:      { label: '31 a 60 dias',                valor: 0, qtd: 0, saida_estimada: saidaMensalMedia, saida_conhecida: 0, qtd_contas_pagar: 0 },
      d90:      { label: '61 a 90 dias',                valor: 0, qtd: 0, saida_estimada: saidaMensalMedia, saida_conhecida: 0, qtd_contas_pagar: 0 },
      depois:   { label: 'Depois de 90 dias',           valor: 0, qtd: 0, saida_conhecida: 0, qtd_contas_pagar: 0 },
    };
    for (const p of parcelasAbertas) {
      const d = dias(p.vencimento);
      const chave = d < 0 ? 'vencidas' : d <= 30 ? 'd30' : d <= 60 ? 'd60' : d <= 90 ? 'd90' : 'depois';
      buckets[chave].valor += parseFloat(p.valor);
      buckets[chave].qtd += 1;
    }
    for (const cp of contasPagarAbertas) {
      const d = dias(cp.vencimento);
      const chave = d < 0 ? 'vencidas' : d <= 30 ? 'd30' : d <= 60 ? 'd60' : d <= 90 ? 'd90' : 'depois';
      buckets[chave].saida_conhecida += parseFloat(cp.valor);
      buckets[chave].qtd_contas_pagar += 1;
    }

    res.json({
      periodos: Object.values(buckets),
      saida_mensal_media: saidaMensalMedia,
      meses_base_media: mesesBase,
    });
  } catch (e) {
    console.error('[financeiro GET /fluxo-caixa]', e);
    res.status(500).json({ erro: e.message });
  }
});

// ── POST /api/financeiro/importar-extrato ────────────────────────────────────
// Recebe texto do extrato bancário e faz o parse automático
router.post('/importar-extrato', async (req, res) => {
  try {
    const { texto, conta } = req.body;
    if (!texto) return res.status(400).json({ erro: 'Texto do extrato é obrigatório' });

    // Parse linha a linha — suporta formatos comuns de extrato brasileiro
    // Formato esperado: DD/MM/YYYY DESCRIÇÃO VALOR (positivo=crédito, negativo=débito)
    // ou: DD/MM/YYYY DESCRIÇÃO -VALOR / +VALOR
    const linhas = texto.split('\n').map(l => l.trim()).filter(l => l.length > 5);
    const lancamentos = [];

    const reData = /(\d{2})[\/\-](\d{2})[\/\-](\d{2,4})/;
    // Aceita valor COM separador de milhar (1.500,00) ou SEM (1500,00) —
    // captura o sinal, um dígito inicial e tudo até a última vírgula/ponto
    // seguida de exatamente 2 dígitos (centavos).
    const reValor = /([+-]?\s*\d[\d.,]*[.,]\d{2})/;

    for (const linha of linhas) {
      const mData = linha.match(reData);
      if (!mData) continue;

      // Normaliza data
      let [, dd, mm, aaaa] = mData;
      if (aaaa.length === 2) aaaa = '20' + aaaa;
      const data = `${aaaa}-${mm}-${dd}`;

      // Extrai valor — pega o último número da linha
      const todosValores = [...linha.matchAll(new RegExp(reValor.source, 'g'))];
      if (!todosValores.length) continue;
      const valorStr = todosValores[todosValores.length - 1][1].replace(/\s/g, '');

      // Normaliza BR: separador decimal é a ÚLTIMA vírgula/ponto da string;
      // tudo antes disso é parte inteira (removendo eventuais separadores
      // de milhar), com ou sem eles no texto original.
      const negativo = valorStr.startsWith('-');
      const semSinal = valorStr.replace(/^[+-]/, '');
      const posSep = Math.max(semSinal.lastIndexOf(','), semSinal.lastIndexOf('.'));
      const parteInteira = semSinal.slice(0, posSep).replace(/[.,]/g, '') || '0';
      const parteDecimal = semSinal.slice(posSep + 1);
      const valorNum = parseFloat(`${parteInteira}.${parteDecimal}`) * (negativo ? -1 : 1);
      if (isNaN(valorNum)) continue;

      // Descrição = linha sem data e sem valor
      let desc = linha
        .replace(mData[0], '')
        .replace(todosValores[todosValores.length - 1][1], '')
        .replace(/[+-]\s*$/, '')
        .trim()
        .replace(/\s+/g, ' ');

      if (!desc) desc = 'Lançamento importado';

      const tipo = valorNum < 0 ? 'debito' : 'credito';
      const valor = Math.abs(valorNum);
      const categoria = detectarCategoria(desc);
      const nome = extrairNomeDescricao(desc);
      const cnpj = extrairCnpjDescricao(desc);

      lancamentos.push({ data, descricao: desc, valor, tipo, categoria, conta: conta || null, nome, cnpj });
    }

    if (!lancamentos.length) {
      return res.status(422).json({
        erro: 'Nenhum lançamento reconhecido. Verifique o formato do extrato.',
        dica: 'Formato esperado por linha: DD/MM/AAAA DESCRIÇÃO VALOR (ex: 10/04/2026 ALUGUEL SALA -1500,00)',
      });
    }

    // Insere todos no banco
    const inseridos = [];
    for (const l of lancamentos) {
      const [r] = await db.query(
        `INSERT INTO lancamentos_bancarios (data, descricao, valor, tipo, categoria, conta, conciliado, criado_por, nome, cnpj_detectado)
         VALUES (?,?,?,?,?,?,0,?,?,?)`,
        [l.data, l.descricao, l.valor, l.tipo, l.categoria, l.conta, req.user.nome, l.nome, l.cnpj]
      );
      inseridos.push({ ...l, id: r.insertId });
    }

    res.status(201).json({
      ok: true,
      total_importado: inseridos.length,
      lancamentos: inseridos,
    });
  } catch (e) {
    console.error('[financeiro POST /importar-extrato]', e);
    res.status(500).json({ erro: e.message });
  }
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Extrai lançamentos de um lote de páginas (1 página por vez — cada página já
// consome quase todo o limite de tokens/minuto do tier gratuito da Groq)
async function extrairLancamentosDeLote(client, paginasPng, offset) {
  const content = [{
    type: 'text',
    text: 'Este é um extrato bancário brasileiro (imagens das páginas de um PDF). Extraia TODOS os lançamentos '
      + '(movimentações) que aparecem nessas imagens. Para cada lançamento: "data" (YYYY-MM-DD), "descricao" '
      + '(histórico exatamente como aparece), "valor" (número absoluto, sempre positivo, sem sinal), e "tipo" '
      + '("credito" para entrada/depósito, "debito" para saída/pagamento/compra). Não inclua saldo inicial, saldo '
      + 'final ou linhas que não sejam movimentações reais. Retorne todos os lançamentos, mesmo que sejam muitos. '
      + 'Responda APENAS com um objeto JSON no formato: {"lancamentos": [{"data":"...", "descricao":"...", "valor":0, "tipo":"..."}]}',
  }];
  paginasPng.forEach((buf, i) => {
    content.push({ type: 'text', text: `Página ${offset + i + 1}:` });
    content.push({ type: 'image_url', image_url: { url: 'data:image/png;base64,' + buf.toString('base64') } });
  });

  const chamar = () => client.chat.completions.create({
    model: VISION_MODEL,
    messages: [{ role: 'user', content }],
    response_format: { type: 'json_object' },
    reasoning_effort: 'none',
    temperature: 0,
    // max_tokens é reservado no orçamento de tokens/minuto (TPM) da Groq no
    // momento do request, não só no uso real — um valor folgado (ex: 4000)
    // sozinho já consumia quase todo o limite de 8000 TPM, sobrando espaço
    // pra praticamente nenhuma outra página na mesma janela de 1 minuto.
    // 1200 é folgado o bastante pra até ~20 lançamentos numa única página.
    max_tokens: 1200,
  });

  let completion;
  let tentativa = 0;
  for (;;) {
    try {
      completion = await chamar();
      break;
    } catch (e) {
      tentativa++;
      // 413/429 = limite de tokens da Groq (por minuto ou por dia) — espera
      // exatamente o tempo que a Groq pede (header retry-after) e tenta de
      // novo, até 3 tentativas no total.
      if ((e.status === 413 || e.status === 429) && tentativa < 3) {
        const retryAfterHeader = typeof e.headers?.get === 'function' ? e.headers.get('retry-after') : e.headers?.['retry-after'];
        const retryAfterSeg = Number(retryAfterHeader);
        const esperaMs = (Number.isFinite(retryAfterSeg) && retryAfterSeg > 0 ? Math.min(retryAfterSeg, 90) + 2 : 20) * 1000;
        await sleep(esperaMs);
      } else {
        throw e;
      }
    }
  }

  let texto = (completion.choices[0]?.message?.content || '').trim();
  texto = texto.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  try {
    const parsed = JSON.parse(texto);
    return Array.isArray(parsed.lancamentos) ? parsed.lancamentos : [];
  } catch {
    return [];
  }
}

// ── POST /api/financeiro/importar-extrato-pdf ─────────────────────────────────
// Recebe o PDF do extrato bancário, converte as páginas em imagem e usa a
// Groq (visão, gratuita) pra ler e separar os lançamentos.
router.post('/importar-extrato-pdf', uploadExtrato.single('extrato'), async (req, res) => {
  if (!req.file) return res.status(400).json({ erro: 'PDF do extrato é obrigatório' });
  if (!process.env.GROQ_API_KEY) return res.status(500).json({ erro: 'GROQ_API_KEY não configurada' });

  try {
    const conta = req.body.conta || null;
    const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const paginas = await pdfParaImagensPng(req.file.buffer, 20);
    if (!paginas.length) {
      return res.status(422).json({ erro: 'Não foi possível ler as páginas do PDF' });
    }

    // 1 página por request — uma página sozinha já usa boa parte do limite de
    // tokens/minuto do tier gratuito da Groq
    const LOTE = 1;
    let extraidos = [];
    const paginasComErro = [];
    for (let i = 0; i < paginas.length; i += LOTE) {
      const lote = paginas.slice(i, i + LOTE);
      try {
        const doLote = await extrairLancamentosDeLote(client, lote, i);
        extraidos = extraidos.concat(doLote);
      } catch (e) {
        // Não perde as páginas que já deram certo por causa de UMA página
        // que falhou (ex: estourou de novo o limite da Groq no meio do PDF)
        console.error(`[financeiro] Falha ao processar página ${i + 1} do extrato:`, e.message);
        paginasComErro.push(i + 1);
      }
      if (i + LOTE < paginas.length) await sleep(5000); // espaça as chamadas pra não estourar o TPM
    }

    if (!extraidos.length) {
      return res.status(422).json({
        erro: paginasComErro.length
          ? `Não foi possível ler nenhuma página (limite de uso da IA atingido). Tente novamente em alguns minutos.`
          : 'Nenhum lançamento reconhecido nesse PDF',
      });
    }

    const inseridos = [];
    for (const l of extraidos) {
      const valorNum = Number(l.valor);
      if (!l.data || !isFinite(valorNum)) continue;
      const desc = (l.descricao || 'Lançamento importado').trim();
      const categoria = detectarCategoria(desc);
      const nome = extrairNomeDescricao(desc);
      const cnpj = extrairCnpjDescricao(desc);
      const tipo = l.tipo === 'credito' ? 'credito' : 'debito';

      const [r] = await db.query(
        `INSERT INTO lancamentos_bancarios (data, descricao, valor, tipo, categoria, conta, conciliado, criado_por, nome, cnpj_detectado)
         VALUES (?,?,?,?,?,?,0,?,?,?)`,
        [l.data, desc, Math.abs(valorNum), tipo, categoria, conta, req.user.nome, nome, cnpj]
      );
      inseridos.push({ id: r.insertId, data: l.data, descricao: desc, valor: Math.abs(valorNum), tipo, categoria, conta, nome, cnpj });
    }

    if (!inseridos.length) {
      return res.status(422).json({ erro: 'Nenhum lançamento válido encontrado no PDF' });
    }

    res.status(201).json({
      ok: true,
      total_importado: inseridos.length,
      lancamentos: inseridos,
      paginas_com_erro: paginasComErro.length ? paginasComErro : undefined,
    });
  } catch (e) {
    console.error('[financeiro POST /importar-extrato-pdf]', e);
    res.status(500).json({ erro: e.message });
  }
});

// Estreita uma lista de candidatos (parcela OU conta a pagar) usando CNPJ
// exato (mais confiável) e, se não bastar, nome do fornecedor/cliente
// contido na descrição/nome do lançamento — só entra em ação quando o
// valor+data já deixaram mais de um candidato em aberto.
function estreitarPorNomeOuCnpj(candidatos, lancamento, campoCnpj, campoNome) {
  if (candidatos.length <= 1) return candidatos;
  if (campoCnpj && lancamento.cnpj_detectado) {
    const porCnpj = candidatos.filter(c => c[campoCnpj] && c[campoCnpj].replace(/\D/g,'') === lancamento.cnpj_detectado);
    if (porCnpj.length === 1) return porCnpj;
  }
  const textoLanc = `${lancamento.nome || ''} ${lancamento.descricao || ''}`.toLowerCase();
  const porNome = candidatos.filter(c => {
    const nome = (c[campoNome] || '').toLowerCase().trim();
    return nome && nome.length >= 4 && textoLanc.includes(nome);
  });
  return porNome.length === 1 ? porNome : candidatos;
}

// ── POST /api/financeiro/conciliar-automatico ─────────────────────────────────
// Casa lançamentos bancários (crédito → parcelas de cliente em aberto; débito
// → contas a pagar em aberto) por valor (±R$1) e data de vencimento (±10
// dias), tentando identificar o fornecedor/cliente exato por CNPJ ou nome
// quando há mais de um candidato. Só dá baixa automática quando sobra
// exatamente um candidato — caso contrário retorna pra revisão manual.
router.post('/conciliar-automatico', async (req, res) => {
  try {
    let conciliados = 0;
    const provaveis = [];

    // Créditos → parcelas de cliente
    const [creditos] = await db.query(
      `SELECT * FROM lancamentos_bancarios WHERE tipo = 'credito' AND conciliado = 0 AND parcela_id IS NULL`
    );
    for (const l of creditos) {
      const [candidatosRaw] = await db.query(
        `SELECT p.*, c.nome AS cliente_nome
         FROM parcelas p JOIN clientes c ON c.id = p.cliente_id
         WHERE p.paga = 0 AND ABS(p.valor - ?) <= 1 AND ABS(DATEDIFF(p.vencimento, ?)) <= 10`,
        [l.valor, l.data]
      );
      const candidatos = estreitarPorNomeOuCnpj(candidatosRaw, l, null, 'cliente_nome');

      if (candidatos.length === 1) {
        const p = candidatos[0];
        await db.query('UPDATE parcelas SET paga = 1, data_pgto = ? WHERE id = ?', [l.data, p.id]);
        await db.query('UPDATE lancamentos_bancarios SET conciliado = 1, parcela_id = ? WHERE id = ?', [p.id, l.id]);
        conciliados++;
      } else if (candidatos.length > 1) {
        provaveis.push({ tipo: 'parcela', lancamento: l, candidatos });
      }
    }

    // Débitos → contas a pagar
    const [debitos] = await db.query(
      `SELECT * FROM lancamentos_bancarios WHERE tipo = 'debito' AND conciliado = 0 AND conta_pagar_id IS NULL`
    );
    for (const l of debitos) {
      const [candidatosRaw] = await db.query(
        `SELECT * FROM contas_pagar
         WHERE paga = 0 AND ABS(valor - ?) <= 1 AND ABS(DATEDIFF(vencimento, ?)) <= 10`,
        [l.valor, l.data]
      );
      const candidatos = estreitarPorNomeOuCnpj(candidatosRaw, l, 'fornecedor_cnpj', 'fornecedor_nome');

      if (candidatos.length === 1) {
        const cp = candidatos[0];
        await db.query('UPDATE contas_pagar SET paga = 1, data_pgto = ? WHERE id = ?', [l.data, cp.id]);
        await db.query('UPDATE lancamentos_bancarios SET conciliado = 1, conta_pagar_id = ? WHERE id = ?', [cp.id, l.id]);
        conciliados++;
      } else if (candidatos.length > 1) {
        provaveis.push({ tipo: 'conta_pagar', lancamento: l, candidatos });
      }
    }

    res.json({ ok: true, conciliados, revisar: provaveis, total_analisados: creditos.length + debitos.length });
  } catch (e) {
    console.error('[financeiro POST /conciliar-automatico]', e);
    res.status(500).json({ erro: e.message });
  }
});

// ── POST /api/financeiro/conciliar-manual ─────────────────────────────────────
// Confirma manualmente o casamento de um lançamento com uma parcela ou conta a
// pagar específica (usado na revisão dos "prováveis" quando havia mais de um candidato)
router.post('/conciliar-manual', async (req, res) => {
  try {
    const { lancamento_id, parcela_id, conta_pagar_id } = req.body;
    if (!lancamento_id || (!parcela_id && !conta_pagar_id)) {
      return res.status(400).json({ erro: 'lancamento_id e (parcela_id ou conta_pagar_id) são obrigatórios' });
    }
    const [[l]] = await db.query('SELECT data FROM lancamentos_bancarios WHERE id = ?', [lancamento_id]);
    if (!l) return res.status(404).json({ erro: 'Lançamento não encontrado' });

    if (parcela_id) {
      await db.query('UPDATE parcelas SET paga = 1, data_pgto = ? WHERE id = ?', [l.data, parcela_id]);
      await db.query('UPDATE lancamentos_bancarios SET conciliado = 1, parcela_id = ? WHERE id = ?', [parcela_id, lancamento_id]);
    } else {
      await db.query('UPDATE contas_pagar SET paga = 1, data_pgto = ? WHERE id = ?', [l.data, conta_pagar_id]);
      await db.query('UPDATE lancamentos_bancarios SET conciliado = 1, conta_pagar_id = ? WHERE id = ?', [conta_pagar_id, lancamento_id]);
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// ════════════════════════════════════════════════════════════════
// CONTAS A PAGAR
// ════════════════════════════════════════════════════════════════

router.get('/contas-pagar', async (req, res) => {
  try {
    let sql = 'SELECT * FROM contas_pagar WHERE 1=1';
    const params = [];
    if (req.query.mes) { sql += " AND DATE_FORMAT(vencimento,'%Y-%m')=?"; params.push(req.query.mes); }
    if (req.query.paga !== undefined) { sql += ' AND paga=?'; params.push(req.query.paga === '1' ? 1 : 0); }
    sql += ' ORDER BY paga ASC, vencimento ASC, id DESC';
    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

router.post('/contas-pagar', async (req, res) => {
  try {
    const { fornecedor_nome, fornecedor_cnpj, descricao, categoria, valor, vencimento, forma_pgto, obs } = req.body;
    if (!fornecedor_nome || valor === undefined || !vencimento) {
      return res.status(400).json({ erro: 'fornecedor_nome, valor e vencimento são obrigatórios' });
    }
    const [r] = await db.query(
      `INSERT INTO contas_pagar (fornecedor_nome, fornecedor_cnpj, descricao, categoria, valor, vencimento, forma_pgto, obs, lancado_por)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [fornecedor_nome, fornecedor_cnpj || null, descricao || null, categoria || 'Outros',
       parseFloat(valor), vencimento, forma_pgto || 'PIX', obs || null, req.user.nome]
    );
    const [[nova]] = await db.query('SELECT * FROM contas_pagar WHERE id=?', [r.insertId]);
    res.status(201).json(nova);
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// Totalmente editável — qualquer campo pode ser atualizado, inclusive depois de paga
router.patch('/contas-pagar/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { fornecedor_nome, fornecedor_cnpj, descricao, categoria, valor, vencimento, forma_pgto, obs, paga, data_pgto } = req.body;
    await db.query(
      `UPDATE contas_pagar SET
        fornecedor_nome=COALESCE(?,fornecedor_nome), fornecedor_cnpj=COALESCE(?,fornecedor_cnpj),
        descricao=COALESCE(?,descricao), categoria=COALESCE(?,categoria),
        valor=COALESCE(?,valor), vencimento=COALESCE(?,vencimento),
        forma_pgto=COALESCE(?,forma_pgto), obs=COALESCE(?,obs),
        paga=COALESCE(?,paga), data_pgto=COALESCE(?,data_pgto)
       WHERE id=?`,
      [fornecedor_nome || null, fornecedor_cnpj || null, descricao || null, categoria || null,
       valor !== undefined ? parseFloat(valor) : null, vencimento || null,
       forma_pgto || null, obs || null,
       paga !== undefined ? (paga ? 1 : 0) : null, data_pgto || null, id]
    );
    const [[atualizada]] = await db.query('SELECT * FROM contas_pagar WHERE id=?', [id]);
    if (!atualizada) return res.status(404).json({ erro: 'Conta a pagar não encontrada' });
    res.json(atualizada);
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// Atalho pra marcar como paga sem precisar mandar todos os campos
router.post('/contas-pagar/:id/pagar', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const data_pgto = req.body.data_pgto || new Date().toISOString().slice(0, 10);
    await db.query('UPDATE contas_pagar SET paga=1, data_pgto=? WHERE id=?', [data_pgto, id]);
    const [[atualizada]] = await db.query('SELECT * FROM contas_pagar WHERE id=?', [id]);
    if (!atualizada) return res.status(404).json({ erro: 'Conta a pagar não encontrada' });
    res.json(atualizada);
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

router.delete('/contas-pagar/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    // Desvincula qualquer lançamento que apontava pra essa conta antes de apagar
    await db.query('UPDATE lancamentos_bancarios SET conciliado=0, conta_pagar_id=NULL WHERE conta_pagar_id=?', [id]);
    const [r] = await db.query('DELETE FROM contas_pagar WHERE id=?', [id]);
    if (r.affectedRows === 0) return res.status(404).json({ erro: 'Conta a pagar não encontrada' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// ════════════════════════════════════════════════════════════════
// DESPESAS
// ════════════════════════════════════════════════════════════════

router.get('/despesas', async (req, res) => {
  try {
    let sql = 'SELECT * FROM despesas WHERE 1=1';
    const params = [];
    if (req.query.mes) { sql += ' AND DATE_FORMAT(data,\'%Y-%m\')=?'; params.push(req.query.mes); }
    sql += ' ORDER BY data DESC, id DESC';
    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

router.post('/despesas', async (req, res) => {
  try {
    const { data, categoria, descricao, valor, forma_pgto, obs } = req.body;
    if (!data || !descricao || valor === undefined) return res.status(400).json({ erro: 'data, descricao e valor obrigatórios' });
    const [r] = await db.query(
      'INSERT INTO despesas (data,categoria,descricao,valor,forma_pgto,obs,lancado_por) VALUES (?,?,?,?,?,?,?)',
      [data, categoria||'Outros', descricao.trim(), parseFloat(valor), forma_pgto||'PIX', obs||null, req.user.nome]
    );
    const [[novo]] = await db.query('SELECT * FROM despesas WHERE id=?', [r.insertId]);
    res.status(201).json(novo);
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

router.delete('/despesas/:id', async (req, res) => {
  try {
    const [r] = await db.query('DELETE FROM despesas WHERE id=?', [parseInt(req.params.id)]);
    if (!r.affectedRows) return res.status(404).json({ erro: 'Não encontrado' });
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

// ════════════════════════════════════════════════════════════════
// PRÓ-LABORE
// ════════════════════════════════════════════════════════════════

router.get('/prolabore', async (req, res) => {
  try {
    let sql = 'SELECT * FROM prolabore WHERE 1=1';
    const params = [];
    if (req.query.mes) { sql += ' AND mes=?'; params.push(req.query.mes); }
    sql += ' ORDER BY mes DESC, id DESC';
    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

router.post('/prolabore', async (req, res) => {
  try {
    const { mes, nome, cargo, valor, data_pgto, obs } = req.body;
    if (!mes || !nome || valor === undefined) return res.status(400).json({ erro: 'mes, nome e valor obrigatórios' });
    const [r] = await db.query(
      'INSERT INTO prolabore (mes,nome,cargo,valor,data_pgto,obs,lancado_por) VALUES (?,?,?,?,?,?,?)',
      [mes, nome.trim(), cargo||null, parseFloat(valor), data_pgto||null, obs||null, req.user.nome]
    );
    const [[novo]] = await db.query('SELECT * FROM prolabore WHERE id=?', [r.insertId]);
    res.status(201).json(novo);
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

router.delete('/prolabore/:id', async (req, res) => {
  try {
    const [r] = await db.query('DELETE FROM prolabore WHERE id=?', [parseInt(req.params.id)]);
    if (!r.affectedRows) return res.status(404).json({ erro: 'Não encontrado' });
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

// ════════════════════════════════════════════════════════════════
// NOTAS INTERNAS DE CLIENTES
// ════════════════════════════════════════════════════════════════

router.get('/notas/:clienteId', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM notas_clientes WHERE cliente_id=? ORDER BY created_at DESC',
      [parseInt(req.params.clienteId)]
    );
    res.json(rows);
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

router.post('/notas', async (req, res) => {
  try {
    const { cliente_id, texto } = req.body;
    if (!cliente_id || !texto) return res.status(400).json({ erro: 'cliente_id e texto obrigatórios' });
    const [r] = await db.query(
      'INSERT INTO notas_clientes (cliente_id,texto,autor) VALUES (?,?,?)',
      [parseInt(cliente_id), texto.trim(), req.user.nome]
    );
    const [[novo]] = await db.query('SELECT * FROM notas_clientes WHERE id=?', [r.insertId]);
    res.status(201).json(novo);
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

router.delete('/notas/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM notas_clientes WHERE id=?', [parseInt(req.params.id)]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

// ════════════════════════════════════════════════════════════════
// RELATÓRIO MENSAL INTEGRADO (DRE)
// ════════════════════════════════════════════════════════════════

router.get('/relatorio-mensal', async (req, res) => {
  try {
    const mes = req.query.mes || new Date().toISOString().slice(0, 7);

    // 1. Receitas de clientes (parcelas pagas no mês)
    const [[recClientes]] = await db.query(`
      SELECT
        COALESCE(SUM(valor),0) AS total,
        COUNT(*) AS qtd
      FROM parcelas
      WHERE paga=1 AND DATE_FORMAT(data_pgto,'%Y-%m')=?`, [mes]);

    // Receitas por cliente (top)
    const [recPorCliente] = await db.query(`
      SELECT c.nome, SUM(p.valor) AS total
      FROM parcelas p
      LEFT JOIN clientes c ON p.cliente_id=c.id
      WHERE p.paga=1 AND DATE_FORMAT(p.data_pgto,'%Y-%m')=?
      GROUP BY p.cliente_id ORDER BY total DESC LIMIT 10`, [mes]);

    // 2. Entradas bancárias (conciliação)
    const [[entBancarias]] = await db.query(`
      SELECT COALESCE(SUM(valor),0) AS total
      FROM lancamentos_bancarios
      WHERE tipo='credito' AND DATE_FORMAT(data,'%Y-%m')=?`, [mes]);

    // 3. Despesas operacionais
    const [despMes] = await db.query(
      'SELECT * FROM despesas WHERE DATE_FORMAT(data,\'%Y-%m\')=? ORDER BY data ASC', [mes]);
    const totalDespesas = despMes.reduce((s,d)=>s+parseFloat(d.valor),0);

    // Despesas por categoria
    const despPorCat = {};
    despMes.forEach(d => { despPorCat[d.categoria]=(despPorCat[d.categoria]||0)+parseFloat(d.valor); });

    // 4. Saídas bancárias (conciliação)
    const [[saidBancarias]] = await db.query(`
      SELECT COALESCE(SUM(valor),0) AS total
      FROM lancamentos_bancarios
      WHERE tipo='debito' AND DATE_FORMAT(data,'%Y-%m')=?`, [mes]);

    // Saídas por categoria (banco)
    const [saidPorCat] = await db.query(`
      SELECT categoria, SUM(valor) AS total
      FROM lancamentos_bancarios
      WHERE tipo='debito' AND DATE_FORMAT(data,'%Y-%m')=?
      GROUP BY categoria ORDER BY total DESC`, [mes]);

    // 5. Pró-labore
    const [proMes] = await db.query(
      'SELECT * FROM prolabore WHERE mes=? ORDER BY nome ASC', [mes]);
    const totalProlabore = proMes.reduce((s,p)=>s+parseFloat(p.valor),0);

    // 6. Novos contratos fechados no mês
    const [[novosContratos]] = await db.query(`
      SELECT COUNT(*) AS qtd, COALESCE(SUM(valor),0) AS total
      FROM clientes
      WHERE DATE_FORMAT(created_at,'%Y-%m')=? AND arquivado=0`, [mes]);

    // 7. Mês anterior para comparação
    const mesDate = new Date(mes + '-01');
    mesDate.setMonth(mesDate.getMonth() - 1);
    const mesAntStr = `${mesDate.getFullYear()}-${String(mesDate.getMonth()+1).padStart(2,'0')}`;

    const [[recAnt]] = await db.query(`
      SELECT COALESCE(SUM(valor),0) AS total FROM parcelas
      WHERE paga=1 AND DATE_FORMAT(data_pgto,'%Y-%m')=?`, [mesAntStr]);

    // DRE
    const receitaBruta  = parseFloat(recClientes.total);
    const custosOp      = totalDespesas;
    const retiradas     = totalProlabore;
    const resultadoLiq  = receitaBruta - custosOp - retiradas;
    const varReceita    = recAnt.total > 0 ? ((receitaBruta - parseFloat(recAnt.total)) / parseFloat(recAnt.total) * 100) : null;

    res.json({
      mes,
      dre: {
        receita_bruta:    receitaBruta,
        custos_operacionais: custosOp,
        pro_labore:       retiradas,
        resultado_liquido: resultadoLiq,
        margem_pct:       receitaBruta > 0 ? (resultadoLiq/receitaBruta*100).toFixed(1) : 0,
      },
      receitas: {
        parcelas_pagas:    parseFloat(recClientes.total),
        qtd_parcelas:      recClientes.qtd,
        entradas_bancarias: parseFloat(entBancarias.total),
        por_cliente:       recPorCliente,
      },
      despesas: {
        total:           totalDespesas,
        saidas_bancarias: parseFloat(saidBancarias.total),
        por_categoria:   despPorCat,
        saidas_banco_cat: saidPorCat,
        lista:           despMes,
      },
      prolabore: {
        total: retiradas,
        lista: proMes,
      },
      novos_contratos: {
        qtd:   novosContratos.qtd,
        total: parseFloat(novosContratos.total),
      },
      comparativo: {
        mes_anterior:     mesAntStr,
        receita_anterior: parseFloat(recAnt.total),
        variacao_pct:     varReceita,
      },
    });
  } catch(e) {
    console.error('[financeiro GET /relatorio-mensal]', e);
    res.status(500).json({ erro: e.message });
  }
});

module.exports = router;

