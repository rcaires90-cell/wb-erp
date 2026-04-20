const router = require('express').Router();
const db     = require('../db');
const auth   = require('../middleware/auth');

router.use(auth);

// GET /api/metas?mes=YYYY-MM
router.get('/', async (req, res) => {
  try {
    const mes = req.query.mes || new Date().toISOString().slice(0,7);
    const [[meta]] = await db.query('SELECT * FROM metas_mensais WHERE mes=?', [mes]);
    if (!meta) return res.json({ mes, meta_receita: 0, meta_contratos: 0, obs: null });
    res.json(meta);
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

// POST /api/metas (upsert)
router.post('/', async (req, res) => {
  try {
    const { mes, meta_receita, meta_contratos, obs } = req.body;
    if (!mes) return res.status(400).json({ erro: 'Mês obrigatório' });
    await db.query(
      `INSERT INTO metas_mensais (mes,meta_receita,meta_contratos,obs,criado_por)
       VALUES (?,?,?,?,?)
       ON DUPLICATE KEY UPDATE meta_receita=VALUES(meta_receita),
         meta_contratos=VALUES(meta_contratos), obs=VALUES(obs)`,
      [mes, parseFloat(meta_receita)||0, parseInt(meta_contratos)||0, obs||null, req.user.nome]
    );
    const [[upd]] = await db.query('SELECT * FROM metas_mensais WHERE mes=?', [mes]);
    res.json(upd);
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

module.exports = router;
