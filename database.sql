-- ══════════════════════════════════════════════════
-- WB ASSESSORIA MIGRATÓRIA — MySQL Schema v5.0
-- Execute no MySQL Workbench ou linha de comando:
--   mysql -u root -p < database.sql
-- ══════════════════════════════════════════════════

CREATE DATABASE IF NOT EXISTS wb_erp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE wb_erp;

-- ── CLIENTES ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS clientes (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  nome            VARCHAR(200) NOT NULL,
  email           VARCHAR(200),
  tel             VARCHAR(30),
  cpf             VARCHAR(20),
  rnm             VARCHAR(30),
  pais            VARCHAR(100) DEFAULT 'Haiti',
  endereco        TEXT,
  servico         VARCHAR(200) DEFAULT 'Naturalização Brasileira',
  status          VARCHAR(100) DEFAULT 'Pendente Documentação',
  etapa           INT DEFAULT 0,
  total_etapas    INT DEFAULT 8,
  responsavel     VARCHAR(200) DEFAULT 'Renato Caires',
  valor           DECIMAL(10,2) DEFAULT 0.00,
  pago            TINYINT(1) DEFAULT 0,
  data_cadastro   VARCHAR(20),
  protocolo       VARCHAR(100),
  prioridade      VARCHAR(20) DEFAULT 'normal',
  portal_login    VARCHAR(200),
  portal_senha    VARCHAR(300),
  drive_folder_id VARCHAR(200),
  drive_folder_url TEXT,
  foto            TEXT,
  arquivado       TINYINT(1) DEFAULT 0,
  dados_json      JSON,
  -- Processo
  processo_fase          VARCHAR(100),
  processo_protocolo     VARCHAR(200),
  processo_data_inicio   DATE,
  proficiencia_status    VARCHAR(50) DEFAULT 'pendente',
  proficiencia_obs       TEXT,
  gov_login              VARCHAR(200),
  gov_senha              VARCHAR(200),
  -- Checklist de documentos
  doc_rnm                TINYINT(1) DEFAULT 0,
  doc_cpf                TINYINT(1) DEFAULT 0,
  doc_comprovante_end    TINYINT(1) DEFAULT 0,
  doc_passaporte         TINYINT(1) DEFAULT 0,
  doc_comprovante_4anos  TINYINT(1) DEFAULT 0,
  doc_antecedente        TINYINT(1) DEFAULT 0,
  doc_antecedente_val    DATE,
  doc_lingua             TINYINT(1) DEFAULT 0,
  doc_prova_presencial   TINYINT(1) DEFAULT 0,
  doc_senha_gov          TINYINT(1) DEFAULT 0,
  doc_cert_nascimento    TINYINT(1) DEFAULT 0,
  doc_cert_casamento     TINYINT(1) DEFAULT 0,
  doc_carteira_trabalho  TINYINT(1) DEFAULT 0,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email    (email),
  INDEX idx_status   (status),
  INDEX idx_arquivado(arquivado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── PARCELAS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS parcelas (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  cliente_id  INT NOT NULL,
  descricao   VARCHAR(300),
  valor       DECIMAL(10,2) DEFAULT 0.00,
  vencimento  DATE,
  paga        TINYINT(1) DEFAULT 0,
  forma_pgto  VARCHAR(50) DEFAULT 'PIX',
  data_pgto   DATE,
  obs         TEXT,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE,
  INDEX idx_cliente (cliente_id),
  INDEX idx_venc    (vencimento),
  INDEX idx_paga    (paga)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── AGENDAMENTOS ──────────────────────────────────
CREATE TABLE IF NOT EXISTS agendamentos (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  cliente_id    INT,
  cliente_nome  VARCHAR(200),
  data          DATE,
  hora          VARCHAR(10),
  tipo          VARCHAR(100) DEFAULT 'Reunião',
  colaborador   VARCHAR(200),
  obs           TEXT,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL,
  INDEX idx_data (data)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── PRINTS DO GOV ─────────────────────────────────
CREATE TABLE IF NOT EXISTS prints_processo (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  cliente_id  INT NOT NULL,
  descricao   VARCHAR(300),
  autor       VARCHAR(200),
  autor_role  VARCHAR(100),
  base64      MEDIUMTEXT,
  drive_url   TEXT,
  data        VARCHAR(20),
  hora        VARCHAR(10),
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE,
  INDEX idx_cliente (cliente_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── USUÁRIOS (staff) ──────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  nome        VARCHAR(200) NOT NULL,
  email       VARCHAR(200) UNIQUE NOT NULL,
  senha_hash  VARCHAR(300) NOT NULL,
  role        VARCHAR(50) DEFAULT 'colaborador',
  cargo       VARCHAR(200),
  ativo       TINYINT(1) DEFAULT 1,
  avatar      VARCHAR(10),
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── INSERIR USUÁRIOS PADRÃO ────────────────────────
-- Senhas são: 986469804Re. e Caires2612!
-- (hash bcrypt gerado com saltRounds=10)
INSERT IGNORE INTO users (nome, email, senha_hash, role, cargo, avatar) VALUES
  ('Renato Caires', 'wbassessoria.contato@gmail.com',
   '$2a$10$placeholder_renato_hash_aqui_trocar', 'ceo', 'Diretor / CEO', 'RC'),
  ('Cristiane Caires', 'caires2612@gmail.com',
   '$2a$10$placeholder_cristiane_hash_aqui_trocar', 'ceo', 'Diretora', 'CC');

-- !! IMPORTANTE: Após criar o banco, rode o script gerar-senhas.js
-- para gerar os hashes corretos das senhas acima !!

-- ── COLUNAS EXTRAS (adicionadas via migration no servidor) ───────────────────
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS processo_fase          VARCHAR(100)  DEFAULT NULL;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS processo_protocolo     VARCHAR(200)  DEFAULT NULL;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS processo_data_inicio   DATE          DEFAULT NULL;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS proficiencia_status    VARCHAR(50)   DEFAULT 'pendente';
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS proficiencia_obs       TEXT          DEFAULT NULL;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS gov_login              VARCHAR(200)  DEFAULT NULL;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS gov_senha              VARCHAR(200)  DEFAULT NULL;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS doc_rnm                TINYINT(1)    DEFAULT 0;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS doc_cpf                TINYINT(1)    DEFAULT 0;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS doc_comprovante_end    TINYINT(1)    DEFAULT 0;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS doc_passaporte         TINYINT(1)    DEFAULT 0;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS doc_comprovante_4anos  TINYINT(1)    DEFAULT 0;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS doc_antecedente        TINYINT(1)    DEFAULT 0;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS doc_antecedente_val    DATE          DEFAULT NULL;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS doc_lingua             TINYINT(1)    DEFAULT 0;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS doc_prova_presencial   TINYINT(1)    DEFAULT 0;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS doc_senha_gov          TINYINT(1)    DEFAULT 0;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS doc_cert_nascimento    TINYINT(1)    DEFAULT 0;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS doc_cert_casamento     TINYINT(1)    DEFAULT 0;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS doc_carteira_trabalho  TINYINT(1)    DEFAULT 0;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS doc_requerimento       TINYINT(1)    DEFAULT 0;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS doc_agendamento_pf     TINYINT(1)    DEFAULT 0;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS doc_taxas_gov          TINYINT(1)    DEFAULT 0;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS doc_biometria          TINYINT(1)    DEFAULT 0;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS doc_rnm_req            TINYINT(1)    DEFAULT 0;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS doc_ds160              TINYINT(1)    DEFAULT 0;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS doc_foto_americana     TINYINT(1)    DEFAULT 0;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS doc_taxa_mrv           TINYINT(1)    DEFAULT 0;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS doc_comprovante_renda  TINYINT(1)    DEFAULT 0;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS doc_extrato_bancario   TINYINT(1)    DEFAULT 0;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS doc_vinculo_brasil     TINYINT(1)    DEFAULT 0;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS data_nascimento        DATE          DEFAULT NULL;

-- ── HISTÓRICO DE FASES ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS historico_fases (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  cliente_id   INT          NOT NULL,
  fase_id      VARCHAR(50)  NOT NULL,
  fase_label   VARCHAR(100) NOT NULL,
  usuario_nome VARCHAR(100) DEFAULT NULL,
  created_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_cliente (cliente_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── NOTAS INTERNAS ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notas_clientes (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  cliente_id INT NOT NULL,
  texto      TEXT NOT NULL,
  autor      VARCHAR(200),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_cliente (cliente_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── MENSAGENS PORTAL ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mensagens_portal (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  cliente_id INT NOT NULL,
  remetente  VARCHAR(20) NOT NULL,
  texto      TEXT NOT NULL,
  lida       TINYINT(1) DEFAULT 0,
  criado_em  DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_cliente (cliente_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── DOCUMENTOS PORTAL ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documentos_portal (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  cliente_id INT NOT NULL,
  nome       VARCHAR(300),
  tipo       VARCHAR(100),
  url        TEXT,
  status     VARCHAR(50) DEFAULT 'enviado',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_cliente (cliente_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── LEADS ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leads (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  nome       VARCHAR(200) NOT NULL,
  email      VARCHAR(200),
  tel        VARCHAR(50),
  servico    VARCHAR(200),
  status     VARCHAR(50) DEFAULT 'novo',
  obs        TEXT,
  origem     VARCHAR(100),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── DESPESAS ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS despesas (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  data       DATE,
  categoria  VARCHAR(100),
  descricao  VARCHAR(300),
  valor      DECIMAL(10,2) DEFAULT 0.00,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── PRÓ-LABORE ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prolabore (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  mes        VARCHAR(7) NOT NULL,
  nome       VARCHAR(200),
  cargo      VARCHAR(200),
  valor      DECIMAL(10,2) DEFAULT 0.00,
  data_pgto  DATE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── LANÇAMENTOS BANCÁRIOS ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lancamentos_bancarios (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  data       DATE,
  tipo       VARCHAR(20),
  descricao  VARCHAR(300),
  valor      DECIMAL(10,2) DEFAULT 0.00,
  categoria  VARCHAR(100),
  conciliado TINYINT(1) DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── METAS MENSAIS ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS metas_mensais (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  mes             VARCHAR(7) UNIQUE NOT NULL,
  meta_receita    DECIMAL(10,2) DEFAULT 0.00,
  meta_contratos  INT DEFAULT 0,
  obs             TEXT,
  criado_por      VARCHAR(200),
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
