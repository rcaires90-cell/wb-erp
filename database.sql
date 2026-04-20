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
