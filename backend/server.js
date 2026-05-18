require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const rateLimit = require('express-rate-limit');
const path      = require('path');
const cron      = require('node-cron');
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
    // Validade de documentos extras
    "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS doc_passaporte_val   DATE          DEFAULT NULL",
    "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS doc_rnm_val          DATE          DEFAULT NULL",
    "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS doc_visto_val        DATE          DEFAULT NULL",
    "ALTER TABLE clientes ADD COLUMN IF NOT EXISTS data_validade_ar     DATE          DEFAULT NULL",
    "ALTER TABLE leads ADD COLUMN IF NOT EXISTS pais          VARCHAR(100) DEFAULT NULL",
    "ALTER TABLE leads ADD COLUMN IF NOT EXISTS rnm_tipo      VARCHAR(50)  DEFAULT NULL",
    "ALTER TABLE leads ADD COLUMN IF NOT EXISTS tempo_no_pais VARCHAR(50)  DEFAULT NULL",
    "ALTER TABLE leads ADD COLUMN IF NOT EXISTS cidade        VARCHAR(100) DEFAULT NULL",
    "ALTER TABLE leads ADD COLUMN IF NOT EXISTS estado        VARCHAR(10)  DEFAULT NULL",
    "ALTER TABLE leads ADD COLUMN IF NOT EXISTS responsavel   VARCHAR(200) DEFAULT NULL",
    "ALTER TABLE leads ADD COLUMN IF NOT EXISTS valor_estimado DECIMAL(10,2) DEFAULT 0",
    "ALTER TABLE leads ADD COLUMN IF NOT EXISTS criado_por    VARCHAR(200) DEFAULT NULL",
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
      id           INT AUTO_INCREMENT PRIMARY KEY,
      nome         VARCHAR(200) NOT NULL,
      email        VARCHAR(200),
      tel          VARCHAR(50),
      pais         VARCHAR(100),
      servico      VARCHAR(200),
      rnm_tipo     VARCHAR(50),
      tempo_no_pais VARCHAR(50),
      cidade       VARCHAR(100),
      estado       VARCHAR(10),
      status       VARCHAR(50) DEFAULT 'novo',
      obs          TEXT,
      origem       VARCHAR(100),
      responsavel  VARCHAR(200),
      valor_estimado DECIMAL(10,2) DEFAULT 0,
      criado_por   VARCHAR(200),
      created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
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
    `CREATE TABLE IF NOT EXISTS alertas_dou (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      cliente_id  INT NOT NULL,
      data_pub    VARCHAR(20),
      titulo      VARCHAR(500),
      conteudo    TEXT,
      link        TEXT,
      classPK     VARCHAR(200),
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_cliente (cliente_id),
      UNIQUE KEY uq_cliente_pk (cliente_id, classPK(100))
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
app.use('/api/dou',        require('./routes/dou'));

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

// ── SUBDOMÍNIOS ────────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  const host = req.hostname || '';
  // atendimento.wbassessoriamigratoria.com.br → landing page de leads
  if (host.startsWith('atendimento.')) {
    return res.sendFile(path.join(__dirname, 'public/leads.html'));
  }
  // portal.wbassessoriamigratoria.com.br → força tela do cliente
  if (host.startsWith('portal.') && req.path === '/' && !req.query.portal) {
    return res.redirect('/?portal=cliente');
  }
  next();
});

// ── SERVIR FRONTEND ──
app.use(express.static(path.join(__dirname, 'public')));
app.get('/leads', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public/leads.html'));
});
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

// ── CRON: Verificação diária às 8h horário de Brasília (11h UTC) ──────────────
async function verificarAntecedenteCron() {
  console.log('[cron/antecedente] Verificando antecedentes a vencer...');
  try {
    const { sendEmail } = require('./lib/email');
    const EQUIPE_EMAIL = process.env.EQUIPE_EMAIL || 'wbassessoria.contato@gmail.com';

    const [clientes] = await db.query(`
      SELECT id, nome, doc_antecedente_val
      FROM clientes
      WHERE arquivado = 0
        AND doc_antecedente_val IS NOT NULL
        AND doc_antecedente_val != ''
        AND doc_antecedente_val <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
        AND (processo_fase IS NULL OR processo_fase NOT IN (
          'pf_analise', 'pf_biometria', 'mjsp_analise', 'dou_publicado', 'concluido'
        ))
      ORDER BY doc_antecedente_val ASC
    `);

    if (!clientes.length) {
      console.log('[cron/antecedente] Nenhum antecedente a vencer nos próximos 30 dias.');
      return;
    }

    const hoje = new Date();
    const linhas = clientes.map(c => {
      const val  = new Date(String(c.doc_antecedente_val).slice(0, 10) + 'T12:00');
      const dias = Math.ceil((val - hoje) / 864e5);
      const cor  = dias <= 0 ? '#e53e3e' : dias <= 7 ? '#e53e3e' : '#d97706';
      const txt  = dias <= 0 ? `VENCIDO há ${Math.abs(dias)} dia(s)` : `vence em ${dias} dia(s)`;
      const dtFmt = val.toLocaleDateString('pt-BR');
      return `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:700">${c.nome}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee">${dtFmt}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:700;color:${cor}">${txt}</td>
      </tr>`;
    }).join('');

    await sendEmail(
      EQUIPE_EMAIL,
      `⚠️ Antecedentes criminais a vencer — ${clientes.length} cliente(s)`,
      `<div style="font-family:Arial,sans-serif;max-width:650px;padding:24px;background:#f9f9f9;border-radius:8px">
        <h2 style="color:#c9a84c">WB Assessoria Migratória</h2>
        <p>Os seguintes clientes possuem antecedente criminal <b>vencido ou a vencer nos próximos 30 dias</b>:</p>
        <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #ddd;border-radius:6px;overflow:hidden">
          <thead><tr style="background:#c9a84c;color:#fff">
            <th style="padding:10px 12px;text-align:left">Cliente</th>
            <th style="padding:10px 12px;text-align:left">Validade</th>
            <th style="padding:10px 12px;text-align:left">Situação</th>
          </tr></thead>
          <tbody>${linhas}</tbody>
        </table>
        <p style="margin-top:16px;color:#666;font-size:0.9rem">Acesse o sistema para atualizar os documentos.</p>
      </div>`
    );
    console.log(`[cron/antecedente] E-mail enviado para ${EQUIPE_EMAIL} com ${clientes.length} cliente(s).`);
  } catch (e) {
    console.error('[cron/antecedente] Erro:', e.message);
  }
}

async function lembreteAgendamentoCron() {
  const { sendEmail } = require('./lib/email');
  const amanha = new Date(); amanha.setDate(amanha.getDate() + 1);
  const amanhaISO = amanha.toISOString().slice(0, 10);
  try {
    const [ags] = await db.query(
      `SELECT a.*, c.nome AS cli_nome, c.email AS cli_email
       FROM agendamentos a
       LEFT JOIN clientes c ON a.cliente_id = c.id
       WHERE a.data = ?`, [amanhaISO]
    );
    for (const ag of ags) {
      if (!ag.cli_email) continue;
      const dtFmt = amanha.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
      await sendEmail(ag.cli_email, '📅 Lembrete de Agendamento — WB Assessoria',
        `<div style="font-family:Arial,sans-serif;max-width:500px;padding:24px;background:#f9f9f9;border-radius:8px">
          <h2 style="color:#c9a84c;margin-top:0">WB Assessoria Migratória</h2>
          <p>Olá, <b>${ag.cli_nome || ag.cliente_nome}</b>! Este é um lembrete do seu agendamento de amanhã:</p>
          <div style="background:#fff;border-left:4px solid #c9a84c;padding:16px;border-radius:0 8px 8px 0;margin:16px 0">
            <div style="font-size:0.9rem;color:#666">Data</div>
            <div style="font-weight:700;font-size:1.1rem;color:#333">${dtFmt}</div>
            <div style="font-size:0.9rem;color:#666;margin-top:8px">Horário</div>
            <div style="font-weight:700;font-size:1.1rem;color:#333">${ag.hora}</div>
            ${ag.tipo ? `<div style="font-size:0.9rem;color:#666;margin-top:8px">Tipo</div><div style="font-weight:600;color:#333">${ag.tipo}</div>` : ''}
          </div>
          <p style="color:#555;font-size:0.9rem">Dúvidas? Fale conosco: <a href="https://wa.me/5511914258886" style="color:#c9a84c">(11) 91425-8886</a></p>
        </div>`
      ).catch(e => console.error('[email] lembrete agendamento:', e.message));
    }
    if (ags.length) console.log(`[cron/lembretes] ${ags.length} lembrete(s) enviado(s) para ${amanhaISO}`);
  } catch (e) { console.error('[cron/lembretes]', e.message); }
}

async function verificarDocumentosVencendoCron() {
  const { sendEmail } = require('./lib/email');
  const EQUIPE = process.env.EQUIPE_EMAIL || 'wbassessoria.contato@gmail.com';
  try {
    const [rows] = await db.query(`
      SELECT nome, email,
        doc_passaporte_val, doc_rnm_val, doc_visto_val, data_validade_ar
      FROM clientes WHERE arquivado = 0
        AND (
          (doc_passaporte_val IS NOT NULL AND doc_passaporte_val <= DATE_ADD(CURDATE(), INTERVAL 60 DAY)) OR
          (doc_rnm_val        IS NOT NULL AND doc_rnm_val        <= DATE_ADD(CURDATE(), INTERVAL 60 DAY)) OR
          (doc_visto_val      IS NOT NULL AND doc_visto_val      <= DATE_ADD(CURDATE(), INTERVAL 60 DAY)) OR
          (data_validade_ar   IS NOT NULL AND data_validade_ar   <= DATE_ADD(CURDATE(), INTERVAL 60 DAY))
        ) ORDER BY nome ASC`);
    if (!rows.length) return;
    const hoje = new Date();
    const fmtDias = (val) => {
      if (!val) return null;
      const d = Math.ceil((new Date(String(val).slice(0,10)+'T12:00') - hoje) / 864e5);
      return d < 0 ? `<span style="color:#e53e3e">VENCIDO (${Math.abs(d)}d)</span>` : `<span style="color:#d97706">${d}d restantes</span>`;
    };
    const linhas = rows.map(c => `<tr style="border-bottom:1px solid #eee">
      <td style="padding:8px 12px;font-weight:700">${c.nome}</td>
      <td style="padding:8px 12px">${c.doc_passaporte_val ? fmtDias(c.doc_passaporte_val) : '—'}</td>
      <td style="padding:8px 12px">${c.doc_rnm_val ? fmtDias(c.doc_rnm_val) : '—'}</td>
      <td style="padding:8px 12px">${c.data_validade_ar ? fmtDias(c.data_validade_ar) : '—'}</td>
      <td style="padding:8px 12px">${c.doc_visto_val ? fmtDias(c.doc_visto_val) : '—'}</td>
    </tr>`).join('');
    await sendEmail(EQUIPE, `⚠️ Documentos a vencer — ${rows.length} cliente(s)`,
      `<div style="font-family:Arial;max-width:700px;padding:24px;background:#f9f9f9;border-radius:8px">
        <h2 style="color:#c9a84c">WB Assessoria — Documentos a Vencer</h2>
        <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #ddd;border-radius:6px">
          <thead><tr style="background:#c9a84c;color:#fff">
            <th style="padding:10px 12px;text-align:left">Cliente</th>
            <th style="padding:10px 12px">Passaporte</th>
            <th style="padding:10px 12px">RNM</th>
            <th style="padding:10px 12px">Aut. Residência</th>
            <th style="padding:10px 12px">Visto EUA</th>
          </tr></thead><tbody>${linhas}</tbody>
        </table>
      </div>`);
    console.log(`[cron/documentos] Email enviado — ${rows.length} cliente(s) com documentos vencendo`);
  } catch (e) { console.error('[cron/documentos]', e.message); }
}

async function backupSemanalCron() {
  const { sendEmail } = require('./lib/email');
  const EQUIPE = process.env.EQUIPE_EMAIL || 'wbassessoria.contato@gmail.com';
  try {
    const tabelas = ['clientes','parcelas','agendamentos','leads','notas_clientes'];
    const backup = { gerado_em: new Date().toISOString(), tabelas: {} };
    for (const t of tabelas) {
      const [rows] = await db.query(`SELECT * FROM \`${t}\``);
      backup.tabelas[t] = rows;
    }
    const json = JSON.stringify(backup);
    const data = new Date().toISOString().slice(0,10);
    await sendEmail(EQUIPE, `💾 Backup Semanal WB ERP — ${data}`,
      `<div style="font-family:Arial;max-width:500px;padding:24px;background:#f9f9f9;border-radius:8px">
        <h2 style="color:#c9a84c">Backup Semanal — WB ERP</h2>
        <p>Backup gerado em <b>${new Date().toLocaleString('pt-BR')}</b>.</p>
        <ul>${tabelas.map(t=>`<li><b>${t}</b>: ${backup.tabelas[t].length} registros</li>`).join('')}</ul>
        <p style="color:#888;font-size:0.85rem">Para backup completo, acesse o sistema: Exportar → backup.json</p>
      </div>`,
      [{ filename: `wb-backup-${data}.json`, content: json, contentType: 'application/json' }]
    ).catch(() => {
      // sendEmail pode não suportar attachments — envia sem anexo
      sendEmail(EQUIPE, `💾 Backup Semanal WB ERP — ${data}`,
        `<p>Backup gerado: ${tabelas.map(t=>`${t}: ${backup.tabelas[t].length} registros`).join(', ')}. Acesse o sistema para baixar o backup completo.</p>`);
    });
    console.log(`[cron/backup] Backup semanal enviado para ${EQUIPE}`);
  } catch (e) { console.error('[cron/backup]', e.message); }
}

async function cronDiario() {
  await verificarAntecedenteCron();
  await verificarDocumentosVencendoCron();
  await lembreteAgendamentoCron();

  // Verificação do DOU: chama o endpoint interno
  try {
    const hoje = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
    const https = require('https');
    const BASE  = process.env.RAILWAY_STATIC_URL
      ? `https://${process.env.RAILWAY_STATIC_URL}`
      : `http://localhost:${process.env.PORT || 3001}`;

    // Busca clientes de Naturalização
    const [clientes] = await db.query(
      `SELECT id, nome, email, servico, processo_protocolo FROM clientes
       WHERE arquivado = 0 AND servico LIKE '%Naturaliza%'
       ORDER BY nome ASC`
    );
    if (!clientes.length) return;

    const { sendEmail } = require('./lib/email');
    const EQUIPE_EMAIL  = process.env.EQUIPE_EMAIL || 'wbassessoria.contato@gmail.com';
    const PORTAL_URL    = 'https://wb-erp-production.up.railway.app';

    function buscarDOUInterno(termo, data) {
      const query = encodeURIComponent(termo);
      // data=null → histórico completo desde 2020
      const hojeISO = new Date().toISOString().slice(0, 10);
      const url = data
        ? `https://www.in.gov.br/consulta/-/buscar/dou?q=${query}&s=do1&exactDate=${data}&delta=20&start=0`
        : `https://www.in.gov.br/consulta/-/buscar/dou?q=${query}&s=do1&exactDate=personalizado&publishFrom=2020-01-01&publishTo=${hojeISO}&delta=20&start=0`;
      return new Promise((resolve) => {
        const req = https.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120',
            'Accept': 'text/html,application/xhtml+xml',
          },
          timeout: 30000,
        }, (res) => {
          let body = '';
          res.on('data', chunk => { body += chunk; });
          res.on('end', () => {
            try {
              const match = body.match(/"jsonArray":(\[[\s\S]*?\])(?=\s*[,}])/);
              resolve(match ? JSON.parse(match[1]) : []);
            } catch { resolve([]); }
          });
        });
        req.on('error', () => resolve([]));
        req.on('timeout', () => { req.destroy(); resolve([]); });
      });
    }

    const encontrados = [];
    for (const c of clientes) {
      // Busca somente pelo número do processo — sem fallback por nome
      if (!c.processo_protocolo || !c.processo_protocolo.trim()) continue;
      const termo = `"${c.processo_protocolo.trim()}"`;

      // Clientes sem nenhum alerta → busca histórico completo desde 2020
      // Clientes que já têm alertas → busca só o DOU de hoje
      const [[{ total }]] = await db.query(
        'SELECT COUNT(*) AS total FROM alertas_dou WHERE cliente_id=?', [c.id]
      );
      const dataConsulta = total > 0 ? hoje : null;

      let hits = [];
      try { hits = await buscarDOUInterno(termo, dataConsulta); } catch { continue; }

      for (const hit of hits) {
        if (!hit.title && !hit.content) continue;
        const [ja] = await db.query(
          'SELECT id FROM alertas_dou WHERE cliente_id=? AND classPK=?',
          [c.id, hit.classPK || hit.urlTitle || hit.title]
        );
        if (ja.length) continue;

        const link    = hit.urlTitle ? `https://www.in.gov.br/web/dou/-/${hit.urlTitle}` : null;
        const dataPub = hit.pubDate || hoje;
        await db.query(
          `INSERT INTO alertas_dou (cliente_id, data_pub, titulo, conteudo, link, classPK) VALUES (?,?,?,?,?,?)`,
          [c.id, dataPub, hit.title || '', (hit.content||'').replace(/<[^>]+>/g,'').slice(0,500), link, hit.classPK || hit.urlTitle || hit.title]
        );
        encontrados.push({ cliente_nome: c.nome, titulo: hit.title, link, trecho: (hit.content||'').replace(/<[^>]+>/g,'').slice(0,300) });
      }
    }

    if (encontrados.length > 0) {
      const linhas = encontrados.map(e => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:700;color:#c9a84c">${e.cliente_nome}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee">${e.titulo}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:0.85em;color:#555">${e.trecho}...</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee">${e.link ? `<a href="${e.link}" style="color:#c9a84c">Ver</a>` : '—'}</td>
        </tr>`).join('');
      await sendEmail(
        EQUIPE_EMAIL,
        `🗞️ Diário Oficial — ${encontrados.length} publicação(ões) encontrada(s) — ${hoje}`,
        `<div style="font-family:Arial,sans-serif;max-width:700px;padding:24px;background:#f9f9f9;border-radius:8px">
          <h2 style="color:#c9a84c">WB Assessoria Migratória</h2>
          <p>Foram encontradas <b>${encontrados.length}</b> publicação(ões) no Diário Oficial de <b>${hoje}</b>:</p>
          <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #ddd;border-radius:6px;overflow:hidden">
            <thead><tr style="background:#c9a84c;color:#fff">
              <th style="padding:10px 12px;text-align:left">Cliente</th>
              <th style="padding:10px 12px;text-align:left">Título</th>
              <th style="padding:10px 12px;text-align:left">Trecho</th>
              <th style="padding:10px 12px;text-align:left">Link</th>
            </tr></thead>
            <tbody>${linhas}</tbody>
          </table>
          <a href="${PORTAL_URL}" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#c9a84c;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold">Abrir Sistema</a>
        </div>`
      );
      console.log(`[cron/dou] ${encontrados.length} publicação(ões) encontrada(s) e e-mail enviado.`);
    } else {
      console.log('[cron/dou] Nenhuma publicação nova encontrada hoje.');
    }
  } catch (e) {
    console.error('[cron/dou] Erro:', e.message);
  }
}

// ── INICIAR ───────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, async () => {
  console.log(`\n🚀 WB ERP Backend v5.1 — http://localhost:${PORT}`);
  console.log(`📊 Ambiente : ${process.env.NODE_ENV || 'development'}`);
  console.log(`🗄️  Banco    : ${process.env.DB_NAME}@${process.env.DB_HOST}`);
  console.log(`🌐 CORS     : all origins\n`);
  await runMigrations();

  // Cron diário às 8h de Brasília (11h UTC)
  cron.schedule('0 11 * * *', () => {
    console.log('\n⏰ [cron] Rodando rotina diária — DOU + Antecedentes...');
    cronDiario().catch(e => console.error('[cron] Erro geral:', e.message));
  }, { timezone: 'America/Sao_Paulo' });
  console.log('⏰ Cron diário agendado — 08:00 Brasília (11:00 UTC)');

  // Cron semanal domingo às 9h de Brasília (12h UTC) — backup
  cron.schedule('0 12 * * 0', () => {
    console.log('\n💾 [cron] Backup semanal...');
    backupSemanalCron().catch(e => console.error('[cron/backup]', e.message));
  }, { timezone: 'America/Sao_Paulo' });
  console.log('💾 Cron de backup agendado — domingo 09:00 Brasília');
});
