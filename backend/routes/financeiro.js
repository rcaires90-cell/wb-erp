const router = require('express').Router();
const db     = require('../db');
const auth   = require('../middleware/auth');

router.use(auth);

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

// ── GET /api/financeiro/lancamentos ─────────────────────────────────────────
// ?mes=2026-04&conta=&categoria=&conciliado=
router.get('/lancamentos', async (req, res) => {
  if (req.user.role === 'cliente') return res.status(403).json({ erro: 'Acesso negado' });
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

// ── POST /api/financeiro/lancamentos ────────────────────────────────────────
// Lança um ou múltiplos registros (array ou objeto único)
router.post('/lancamentos', async (req, res) => {
  if (req.user.role === 'cliente') return res.status(403).json({ erro: 'Acesso negado' });
  try {
    const lista = Array.isArray(req.body) ? req.body : [req.body];

    const inseridos = [];
    for (const item of lista) {
      const { data, descricao, valor, tipo, categoria, conta, conciliado, obs } = item;

      if (!data || !descricao || valor === undefined) {
        return res.status(400).json({ erro: 'data, descricao e valor são obrigatórios' });
      }

      const cat = categoria || detectarCategoria(descricao);
      const [r] = await db.query(
        `INSERT INTO lancamentos_bancarios (data, descricao, valor, tipo, categoria, conta, conciliado, obs, criado_por)
         VALUES (?,?,?,?,?,?,?,?,?)`,
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
  if (req.user.role === 'cliente') return res.status(403).json({ erro: 'Acesso negado' });
  try {
    const id = parseInt(req.params.id);
    const { data, descricao, valor, tipo, categoria, conta, conciliado, obs } = req.body;

    await db.query(
      `UPDATE lancamentos_bancarios
       SET data=COALESCE(?,data), descricao=COALESCE(?,descricao), valor=COALESCE(?,valor),
           tipo=COALESCE(?,tipo), categoria=COALESCE(?,categoria), conta=COALESCE(?,conta),
           conciliado=COALESCE(?,conciliado), obs=COALESCE(?,obs)
       WHERE id=?`,
      [data||null, descricao||null, valor!==undefined?parseFloat(valor):null,
       tipo||null, categoria||null, conta||null,
       conciliado!==undefined?(conciliado?1:0):null, obs||null, id]
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
  if (req.user.role === 'cliente') return res.status(403).json({ erro: 'Acesso negado' });
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

// ── GET /api/financeiro/resumo ───────────────────────────────────────────────
// Resumo por categoria do mês
router.get('/resumo', async (req, res) => {
  if (req.user.role === 'cliente') return res.status(403).json({ erro: 'Acesso negado' });
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

// ── POST /api/financeiro/importar-extrato ────────────────────────────────────
// Recebe texto do extrato bancário e faz o parse automático
router.post('/importar-extrato', async (req, res) => {
  if (req.user.role === 'cliente') return res.status(403).json({ erro: 'Acesso negado' });
  try {
    const { texto, conta } = req.body;
    if (!texto) return res.status(400).json({ erro: 'Texto do extrato é obrigatório' });

    // Parse linha a linha — suporta formatos comuns de extrato brasileiro
    // Formato esperado: DD/MM/YYYY DESCRIÇÃO VALOR (positivo=crédito, negativo=débito)
    // ou: DD/MM/YYYY DESCRIÇÃO -VALOR / +VALOR
    const linhas = texto.split('\n').map(l => l.trim()).filter(l => l.length > 5);
    const lancamentos = [];

    const reData = /(\d{2})[\/\-](\d{2})[\/\-](\d{2,4})/;
    const reValor = /([+-]?\s*\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2}))/;

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

      // Normaliza separadores BR: 1.234,56 → 1234.56
      const valorNum = parseFloat(
        valorStr.replace(/\./g, '').replace(',', '.')
      );
      if (isNaN(valorNum)) continue;

      // Descrição = linha sem data e sem valor
      let desc = linha
        .replace(mData[0], '')
        .replace(todosValores[todosValores.length - 1][1], '')
        .replace(/[+-]\s*$/, '')
        .trim()
        .replace(/\s+/g, ' ');

      if (!desc) desc = 'Lançamento importado';

      const tipo = valorNum < 0 ? 'debito' : valorStr.startsWith('-') ? 'debito' : 'credito';
      const valor = Math.abs(valorNum);
      const categoria = detectarCategoria(desc);

      lancamentos.push({ data, descricao: desc, valor, tipo, categoria, conta: conta || null });
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
        `INSERT INTO lancamentos_bancarios (data, descricao, valor, tipo, categoria, conta, conciliado, criado_por)
         VALUES (?,?,?,?,?,?,0,?)`,
        [l.data, l.descricao, l.valor, l.tipo, l.categoria, l.conta, req.user.nome]
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


// ════════════════════════════════════════════════════════════════
// DESPESAS
// ════════════════════════════════════════════════════════════════

router.get('/despesas', async (req, res) => {
  if (req.user.role === 'cliente') return res.status(403).json({ erro: 'Acesso negado' });
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
  if (req.user.role === 'cliente') return res.status(403).json({ erro: 'Acesso negado' });
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
  if (req.user.role === 'cliente') return res.status(403).json({ erro: 'Acesso negado' });
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
  if (req.user.role === 'cliente') return res.status(403).json({ erro: 'Acesso negado' });
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
  if (req.user.role === 'cliente') return res.status(403).json({ erro: 'Acesso negado' });
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
  if (req.user.role === 'cliente') return res.status(403).json({ erro: 'Acesso negado' });
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
  if (req.user.role === 'cliente') return res.status(403).json({ erro: 'Acesso negado' });
  try {
    const [rows] = await db.query(
      'SELECT * FROM notas_clientes WHERE cliente_id=? ORDER BY created_at DESC',
      [parseInt(req.params.clienteId)]
    );
    res.json(rows);
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

router.post('/notas', async (req, res) => {
  if (req.user.role === 'cliente') return res.status(403).json({ erro: 'Acesso negado' });
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
  if (req.user.role === 'cliente') return res.status(403).json({ erro: 'Acesso negado' });
  try {
    await db.query('DELETE FROM notas_clientes WHERE id=?', [parseInt(req.params.id)]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

// ════════════════════════════════════════════════════════════════
// RELATÓRIO MENSAL INTEGRADO (DRE)
// ════════════════════════════════════════════════════════════════

router.get('/relatorio-mensal', async (req, res) => {
  if (req.user.role === 'cliente') return res.status(403).json({ erro: 'Acesso negado' });
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

