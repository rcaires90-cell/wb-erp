require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const rateLimit = require('express-rate-limit');
const path      = require('path');

const app = express();

// ── LOGGING DE REQUISIÇÕES ────────────────────────
app.use((req, res, next) => {
  const inicio = Date.now();
  res.on('finish', () => {
    const ms      = Date.now() - inicio;
    const status  = res.statusCode;
    const cor     = status >= 500 ? '❌' : status >= 400 ? '⚠️ ' : '✅';
    const usuario = req.user ? `[${req.user.email}]` : '';
    console.log(`${cor} ${req.method} ${req.path} ${status} ${ms}ms ${usuario}`);
  });
  next();
});

// ── CORS ──────────────────────────────────────────
app.use(cors({
  origin: true,
  methods:        ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials:    true,
}));

app.use(express.json({ limit: '10mb' })); // 10mb para suportar base64 de imagens
app.use(express.urlencoded({ extended: true }));

// ── RATE LIMITING GERAL ───────────────────────────
const limiterGeral = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 500,
  standardHeaders: true,
  legacyHeaders:   false,
  message: { erro: 'Muitas requisições. Tente novamente em 15 minutos.' },
});
app.use('/api/', limiterGeral);

// ── ROTAS ─────────────────────────────────────────
app.use('/api/auth',         require('./routes/auth'));
app.use('/api/clientes',     require('./routes/clientes'));
app.use('/api/parcelas',     require('./routes/parcelas'));
app.use('/api/agendamentos', require('./routes/agendamentos'));
app.use('/api/prints',       require('./routes/prints'));
app.use('/api/dashboard',    require('./routes/dashboard'));
app.use('/api/n8n',          require('./routes/n8n'));
app.use('/api/financeiro',   require('./routes/financeiro'));
app.use('/api/agente',      require('./routes/agente'));
app.use('/api/robo',        require('./routes/robo'));
app.use('/api/leads',       require('./routes/leads'));
app.use('/api/exportar',    require('./routes/exportar'));
app.use('/api/metas',       require('./routes/metas'));

// ── HEALTH CHECK ──────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    ok:      true,
    versao:  '5.1',
    env:     process.env.NODE_ENV || 'development',
    uptime:  Math.floor(process.uptime()) + 's',
    horario: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
  });
});

// ── SERVIR FRONTEND ──
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// ── ERRO 404 ──────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ erro: `Rota não encontrada: ${req.method} ${req.path}` });
});

// ── ERRO GLOBAL ───────────────────────────────────
app.use((err, _req, res, _next) => {
  // Erro de CORS
  if (err.message && err.message.startsWith('CORS bloqueado')) {
    return res.status(403).json({ erro: err.message });
  }
  console.error('❌ Erro não tratado:', err);
  res.status(500).json({ erro: err.message || 'Erro interno do servidor' });
});

// ── INICIAR ───────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n🚀 WB ERP Backend v5.1 — http://localhost:${PORT}`);
  console.log(`📊 Ambiente : ${process.env.NODE_ENV || 'development'}`);
  console.log(`🗄️  Banco    : ${process.env.DB_NAME}@${process.env.DB_HOST}`);
  console.log(`🌐 CORS     : all origins\n`);
});
