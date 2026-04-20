const router = require('express').Router();
const auth   = require('../middleware/auth');

router.use(auth);

// Agentes permitidos (whitelist de segurança)
const AGENTES_PERMITIDOS = new Set([
  'notificacao',
  'relatorio',
  'documento',
  'whatsapp',
  'email',
  'status',
]);

// ── POST /api/n8n/:agente ─────────────────────────
router.post('/:agente', async (req, res) => {
  if (req.user.role === 'cliente') return res.status(403).json({ erro: 'Acesso negado' });

  const N8N_BASE = process.env.N8N_BASE;
  if (!N8N_BASE) return res.status(503).json({ erro: 'N8N não configurado' });

  const { agente } = req.params;

  // Valida agente contra whitelist
  if (!AGENTES_PERMITIDOS.has(agente)) {
    return res.status(400).json({
      erro: `Agente inválido. Permitidos: ${[...AGENTES_PERMITIDOS].join(', ')}`,
    });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000); // 20s

    const response = await fetch(`${N8N_BASE}/webhook/wb-${agente}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...req.body,
        _user: {
          id:    req.user.id,
          nome:  req.user.nome,
          email: req.user.email,
          role:  req.user.role,
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const data = await response.json();
    res.status(response.ok ? 200 : response.status).json(data);
  } catch (e) {
    console.error(`[n8n POST /${agente}]`, e.message);
    if (e.name === 'AbortError') {
      return res.status(504).json({ erro: 'N8N: timeout — automação demorou mais de 20s' });
    }
    res.status(500).json({ erro: 'N8N: ' + e.message });
  }
});

module.exports = router;
