const router = require('express').Router();
const db     = require('../db');
const auth   = require('../middleware/auth');

router.use(auth);

// ── GET /api/dashboard/stats ──────────────────────
router.get('/stats', async (req, res) => {
  try {
    const [[clientes]] = await db.query(`
      SELECT
        COUNT(*)                                          AS total,
        SUM(status = 'Em andamento')                     AS ativos,
        SUM(status = 'Concluído')                        AS concluidos,
        SUM(status = 'Pendente Documentação')            AS pendentes,
        SUM(valor)                                        AS receita_total
      FROM clientes
      WHERE arquivado = 0`);

    const [[financeiro]] = await db.query(`
      SELECT
        COALESCE(SUM(CASE WHEN paga = 1 THEN valor ELSE 0 END), 0)  AS recebido,
        COALESCE(SUM(CASE WHEN paga = 0 THEN valor ELSE 0 END), 0)  AS pendente,
        SUM(CASE WHEN paga = 0 AND vencimento < CURDATE() THEN 1 ELSE 0 END) AS vencidas
      FROM parcelas`);

    const hoje = new Date().toISOString().split('T')[0];
    const [[agHoje]] = await db.query(
      'SELECT COUNT(*) AS total FROM agendamentos WHERE data = ?',
      [hoje]
    );

    // Próximos agendamentos (7 dias)
    const [proximosAg] = await db.query(`
      SELECT * FROM agendamentos
      WHERE data >= CURDATE() AND data <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)
      ORDER BY data ASC, hora ASC
      LIMIT 10`);

    // Parcelas vencidas (top 10)
    const [parcelasVencidas] = await db.query(`
      SELECT p.*, c.nome AS cliente_nome
      FROM parcelas p
      LEFT JOIN clientes c ON p.cliente_id = c.id
      WHERE p.paga = 0 AND p.vencimento < CURDATE()
      ORDER BY p.vencimento ASC
      LIMIT 10`);

    // Receita últimos 6 meses
    const [grafico] = await db.query(`
      SELECT
        DATE_FORMAT(data_pgto, '%Y-%m') AS mes,
        SUM(valor)                       AS total
      FROM parcelas
      WHERE paga = 1 AND data_pgto >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
      GROUP BY mes
      ORDER BY mes ASC`);

    // Clientes recentes (últimos 10 cadastrados)
    const [clientesRecentes] = await db.query(`
      SELECT id, nome, servico, status, responsavel, created_at
      FROM clientes
      WHERE arquivado = 0
      ORDER BY id DESC
      LIMIT 10`);

    res.json({
      clientes,
      financeiro,
      agenda_hoje: agHoje.total,
      proximos_agendamentos: proximosAg,
      parcelas_vencidas: parcelasVencidas,
      grafico,
      clientes_recentes: clientesRecentes,
    });
  } catch (e) {
    console.error('[dashboard GET /stats]', e);
    res.status(500).json({ erro: e.message });
  }
});

// ── GET /api/dashboard/clientes-parados ───────────
// Clientes ativos sem mudança de fase há mais de N dias (config: dias_cliente_parado)
router.get('/clientes-parados', async (req, res) => {
  try {
    const [[cfg]] = await db.query("SELECT valor FROM config_sistema WHERE chave = 'dias_cliente_parado'");
    const limiar = parseInt(cfg?.valor) || 50;

    const [rows] = await db.query(`
      SELECT c.id, c.nome, c.servico, c.processo_fase, c.responsavel,
             COALESCE(hf.ultima_mudanca, c.processo_data_inicio, c.created_at) AS referencia,
             DATEDIFF(CURDATE(), COALESCE(hf.ultima_mudanca, c.processo_data_inicio, c.created_at)) AS dias_parado
      FROM clientes c
      LEFT JOIN (
        SELECT cliente_id, MAX(created_at) AS ultima_mudanca
        FROM historico_fases
        WHERE fase_id != 'status_change'
        GROUP BY cliente_id
      ) hf ON hf.cliente_id = c.id
      WHERE c.arquivado = 0
        AND c.status NOT IN ('Concluído', 'Cancelado')
      HAVING dias_parado >= ?
      ORDER BY dias_parado DESC
    `, [limiar]);

    res.json({ limiar, clientes: rows });
  } catch (e) {
    console.error('[dashboard GET /clientes-parados]', e);
    res.status(500).json({ erro: e.message });
  }
});

// ── GET /api/dashboard/parcelas-alerta ────────────
// Parcelas vencendo nos próximos 5 dias ou já atrasadas (alerta interno pra equipe)
router.get('/parcelas-alerta', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT p.id, p.descricao, p.valor, p.vencimento, c.id AS cliente_id, c.nome AS cliente_nome,
             DATEDIFF(p.vencimento, CURDATE()) AS dias_para_vencer
      FROM parcelas p
      JOIN clientes c ON c.id = p.cliente_id
      WHERE p.paga = 0
        AND c.arquivado = 0
        AND p.vencimento <= DATE_ADD(CURDATE(), INTERVAL 5 DAY)
      ORDER BY p.vencimento ASC
    `);
    res.json({
      atrasadas: rows.filter(r => r.dias_para_vencer < 0),
      a_vencer:  rows.filter(r => r.dias_para_vencer >= 0),
    });
  } catch (e) {
    console.error('[dashboard GET /parcelas-alerta]', e);
    res.status(500).json({ erro: e.message });
  }
});

// ── GET /api/dashboard/financeiro ────────────────
// Resumo financeiro por responsável / período
router.get('/financeiro', async (req, res) => {
  try {
    const { mes } = req.query; // ex: '2026-04'

    let where = 'paga = 1';
    const params = [];
    if (mes) {
      where += ' AND DATE_FORMAT(data_pgto, \'%Y-%m\') = ?';
      params.push(mes);
    }

    const [por_forma] = await db.query(`
      SELECT forma_pgto, COUNT(*) AS qtd, SUM(valor) AS total
      FROM parcelas
      WHERE ${where}
      GROUP BY forma_pgto
      ORDER BY total DESC`, params);

    const [por_mes] = await db.query(`
      SELECT DATE_FORMAT(data_pgto, '%Y-%m') AS mes, COUNT(*) AS qtd, SUM(valor) AS total
      FROM parcelas
      WHERE paga = 1 AND data_pgto >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
      GROUP BY mes
      ORDER BY mes ASC`);

    res.json({ por_forma, por_mes });
  } catch (e) {
    console.error('[dashboard GET /financeiro]', e);
    res.status(500).json({ erro: e.message });
  }
});

module.exports = router;
