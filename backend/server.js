require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const rateLimit = require('express-rate-limit');
const path      = require('path');
const db        = require('./db');

async function runMigrations() {
  const alterCols = [
    "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS processo_fase        VARCHAR(100)  DEFAULT NULL",
    "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS processo_protocolo   VARCHAR(200)  DEFAULT NULL",
    "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS processo_data_inicio DATE          DEFAULT NULL",
    "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS proficiencia_status  VARCHAR(50)   DEFAULT 'pendente'",
    "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS proficiencia_obs     TEXT          DEFAULT NULL",
    "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS gov_login            VARCHAR(200)  DEFAULT NULL",
    "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS gov_senha            VARCHAR(200)  DEFAULT NULL",
    "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS doc_rnm              TINYINT(1)    DEFAULT 0",
    "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS doc_cpf              TINYINT(1)    DEFAULT 0",
    "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS doc_comprovante_end  TINYINT(1)    DEFAULT 0",
    "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS doc_passaporte       TINYINT(1)    DEFAULT 0",
    "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS doc_comprovante_4anos TINYINT(1)   DEFAULT 0",
    "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS doc_antecedente      TINYINT(1)    DEFAULT 0",
    "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS doc_antecedente_val  DATE          DEFAULT NULL",
    "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS doc_lingua           TINYINT(1)    DEFAULT 0",
    "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS doc_prova_presencial TINYINT(1)    DEFAULT 0",
    "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS doc_senha_gov        TINYINT(1)    DEFAULT 0",
    "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS doc_cert_nascimento  TINYINT(1)    DEFAULT 0",
    "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS doc_cert_casamento   TINYINT(1)    DEFAULT 0",
    "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS doc_carteira_trabalho TINYINT(1)   DEFAULT 0",
    // Autorização de Residência (CPLP / Reagrupamento)
    "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS doc_requerimento     TINYINT(1)    DEFAULT 0",
    "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS doc_agendamento_pf   TINYINT(1)    DEFAULT 0",
    "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS doc_taxas_gov        TINYINT(1)    DEFAULT 0",
    "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS doc_biometria        TINYINT(1)    DEFAULT 0",
    "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS doc_rnm_req          TINYINT(1)    DEFAULT 0",
    // Visto de Turismo (E.U.A)
    "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS doc_ds160            TINYINT(1)    DEFAULT 0",
    "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS doc_foto_americana   TINYINT(1)    DEFAULT 0",
    "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS doc_taxa_mrv         TINYINT(1)    DEFAULT 0",
    "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS doc_comprovante_renda TINYINT(1)   DEFAULT 0",
    "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS doc_extrato_bancario TINYINT(1)    DEFAULT 0",
    "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS doc_vinculo_brasil   TINYINT(1)    DEFAULT 0",
    // Aniversariantes
    "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS data_nascimento      DATE          DEFAULT NULL",
  ];
  for (const sql of alterCols) {
    try { await db.query(sql); } catch(e) { console.warn('[migration] skipped:', e.message.slice(0,80)); }
  }
  const createTables = [
    `CREATE TABLE IF NOT EXISTS historico_fases (
      id           INT AUTO_INCREMENT PRIMARY KEY,
      cliente_id   INT          NOT NULL,
      fase_id      VARCHAR(50)  NOT NULL,
      fase_label   VARCHAR(100) NOT NULL,
      usuario_nome VARCHAR(100) DEFAULT NULL,
      created_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_cliente (cliente_id)
    )`,
    `CREATE TABLE IF NOT EXISTS notas_clientes (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      cliente_id INT NOT NULL,
      texto      TEXT NOT NULL,
      autor      VARCHAR(200),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_cliente (cliente_id)
    )`,
    `CREATE TABLE IF NOT EXISTS mensagens_portal (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      cliente_id INT NOT NULL,
      remetente  VARCHAR(20) NOT NULL,
      texto      TEXT NOT NULL,
      lida       TINYINT(1) DEFAULT 0,
      criado_em  DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_cliente (cliente_id)
    )`,
    `CREATE TABLE IF NOT EXISTS documentos_portal (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      cliente_id INT NOT NULL,
      nome       VARCHAR(300),
      tipo       VARCHAR(100),
      url        TEXT,
      status     VARCHAR(50) DEFAULT 'enviado',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_cliente (cliente_id)
    )`,
    `CREATE TABLE IF NOT EXISTS leads (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      nome       VARCHAR(200) NOT NULL,
      email      VARCHAR(200),
      tel        VARCHAR(50),
      servico    VARCHAR(200),
      status     VARCHAR(50) DEFAULT 'novo',
      obs        TEXT,
      origem     VARCHAR(100),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS despesas (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      data       DATE,
      categoria  VARCHAR(100),
      descricao  VARCHAR(300),
      valor      DECIMAL(10,2) DEFAULT 0.00,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS prolabore (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      mes        VARCHAR(7) NOT NULL,
      nome       VARCHAR(200),
      cargo      VARCHAR(200),
      valor      DECIMAL(10,2) DEFAULT 0.00,
      data_pgto  DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS lancamentos_bancarios (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      data       DATE,
      tipo       VARCHAR(20),
      descricao  VARCHAR(300),
      valor      DECIMAL(10,2) DEFAULT 0.00,
      categoria  VARCHAR(100),
      conciliado TINYINT(1) DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS metas_mensais (
      id              INT AUTO_INCREMENT PRIMARY KEY,
      mes             VARCHAR(7) UNIQUE NOT NULL,
      meta_receita    DECIMAL(10,2) DEFAULT 0.00,
      meta_contratos  INT DEFAULT 0,
      obs             TEXT,
      criado_por      VARCHAR(200),
      created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
  ];
  for (const sql of createTables) {
    try { await db.query(sql); } catch(e) { console.warn('[migration] table:', e.message.slice(0,80)); }
  }
  console.log('✅ Migrations OK');
}

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
app.use('/api/portal',      require('./routes/portal'));
app.use('/api/notificar',   require('./routes/notificar'));

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
app.listen(PORT, async () => {
  console.log(`\n🚀 WB ERP Backend v5.1 — http://localhost:${PORT}`);
  console.log(`📊 Ambiente : ${process.env.NODE_ENV || 'development'}`);
  console.log(`🗄️  Banco    : ${process.env.DB_NAME}@${process.env.DB_HOST}`);
  console.log(`🌐 CORS     : all origins\n`);
  await runMigrations();
});
