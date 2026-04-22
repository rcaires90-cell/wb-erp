const router = require('express').Router();
const db     = require('../db');
const auth   = require('../middleware/auth');

router.use(auth);

function toCSV(cols, rows) {
  const header = cols.join(';');
  const lines  = rows.map(r =>
    cols.map(c => {
      const v = r[c] ?? '';
      const s = String(v).replace(/"/g, '""');
      return s.includes(';') || s.includes('\n') ? `"${s}"` : s;
    }).join(';')
  );
  return '\uFEFF' + [header, ...lines].join('\r\n'); // BOM para Excel
}

// GET /api/exportar/clientes.csv
router.get('/clientes.csv', async (req, res) => {
  const [rows] = await db.query(
    `SELECT nome,email,tel,cpf,rnm,pais,endereco,servico,status,responsavel,
            valor,pago,data_cadastro,protocolo,prioridade,arquivado
     FROM clientes WHERE arquivado=0 ORDER BY nome ASC`
  );
  const cols = ['nome','email','tel','cpf','rnm','pais','endereco','servico',
                'status','responsavel','valor','pago','data_cadastro','protocolo','prioridade'];
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="clientes.csv"');
  res.send(toCSV(cols, rows));
});

// GET /api/exportar/parcelas.csv?mes=YYYY-MM
router.get('/parcelas.csv', async (req, res) => {
  let sql = `SELECT c.nome AS cliente, p.descricao, p.valor, p.vencimento,
               p.paga, p.data_pgto, p.forma_pgto
             FROM parcelas p
             LEFT JOIN clientes c ON p.cliente_id=c.id WHERE 1=1`;
  const params = [];
  if (req.query.mes) {
    sql += ` AND DATE_FORMAT(p.vencimento,'%Y-%m')=?`;
    params.push(req.query.mes);
  }
  sql += ' ORDER BY p.vencimento ASC';
  const [rows] = await db.query(sql, params);
  const cols = ['cliente','descricao','valor','vencimento','paga','data_pgto','forma_pgto'];
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="parcelas.csv"');
  res.send(toCSV(cols, rows));
});

// GET /api/exportar/financeiro.csv?mes=YYYY-MM
router.get('/financeiro.csv', async (req, res) => {
  const mes = req.query.mes || new Date().toISOString().slice(0,7);
  const [desp] = await db.query(
    `SELECT 'Despesa' AS tipo, data, categoria, descricao, valor FROM despesas
     WHERE DATE_FORMAT(data,'%Y-%m')=? ORDER BY data ASC`, [mes]);
  const [prol] = await db.query(
    `SELECT 'Pró-labore' AS tipo, data_pgto AS data, nome AS categoria, obs AS descricao, valor
     FROM prolabore WHERE mes=? ORDER BY data_pgto ASC`, [mes]);
  const [parc] = await db.query(
    `SELECT 'Receita' AS tipo, data_pgto AS data, 'Parcela' AS categoria,
             CONCAT(c.nome,' - ',p.descricao) AS descricao, p.valor
     FROM parcelas p LEFT JOIN clientes c ON p.cliente_id=c.id
     WHERE p.paga=1 AND DATE_FORMAT(p.data_pgto,'%Y-%m')=? ORDER BY p.data_pgto ASC`, [mes]);
  const rows = [...parc, ...desp, ...prol];
  const cols = ['tipo','data','categoria','descricao','valor'];
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="financeiro-${mes}.csv"`);
  res.send(toCSV(cols, rows));
});

// GET /api/exportar/backup.json  — exporta todas as tabelas principais (só CEO)
router.get('/backup.json', async (req, res) => {
  if (req.user.role !== 'ceo') return res.status(403).json({ erro: 'Acesso negado' });
  try {
    const tabelas = ['clientes','parcelas','agendamentos','despesas','prolabore',
                     'leads','mensagens_portal','documentos_portal','metas_mensais'];
    const backup = { gerado_em: new Date().toISOString(), tabelas: {} };
    for (const t of tabelas) {
      try {
        const [rows] = await db.query(`SELECT * FROM \`${t}\``);
        backup.tabelas[t] = rows;
      } catch { backup.tabelas[t] = []; }
    }
    const data = new Date().toISOString().slice(0,10);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="wb-erp-backup-${data}.json"`);
    res.send(JSON.stringify(backup, null, 2));
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

module.exports = router;
