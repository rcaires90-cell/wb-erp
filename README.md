# WB ERP — Sistema de Gestão Migratória v5.0

Frontend + Backend separados | MySQL | Node.js | Express | Seu próprio servidor

---

## 🏗️ ESTRUTURA

```
wb-erp/
├── backend/               ← API Node.js + Express
│   ├── server.js          ← Servidor principal
│   ├── db.js              ← Conexão MySQL
│   ├── middleware/
│   │   └── auth.js        ← JWT middleware
│   └── routes/
│       ├── auth.js        ← Login
│       ├── clientes.js    ← CRUD clientes
│       ├── parcelas.js    ← Financeiro
│       ├── agendamentos.js
│       ├── prints.js      ← Gov prints
│       ├── dashboard.js   ← Stats
│       └── n8n.js         ← Proxy N8N
├── frontend/
│   └── index.html         ← Sistema WB (arquivo do Vercel)
├── database.sql           ← Schema MySQL
├── gerar-senhas.js        ← Setup senhas bcrypt
├── importar-clientes.js   ← Importar backup JSON
└── README.md
```

---

## ⚡ INSTALAÇÃO RÁPIDA

### 1. Instalar dependências

```bash
# Node.js e MySQL precisam estar instalados

# Instalar dependências do backend
cd wb-erp/backend
npm install

# Voltar à raiz
cd ..
```

### 2. Criar banco de dados MySQL

```bash
# Abra o MySQL Workbench ou terminal:
mysql -u root -p < database.sql

# Vai criar o banco wb_erp com todas as tabelas
```

### 3. Configurar variáveis de ambiente

```bash
# Copie o arquivo de exemplo
cp backend/.env.example backend/.env

# Edite com seus dados
# Abra backend/.env no VS Code e preencha:
# DB_HOST, DB_USER, DB_PASS, JWT_SECRET, N8N_BASE (opcional)
```

### 4. Gerar senhas de acesso

```bash
# Na raiz do projeto:
node gerar-senhas.js
# Vai gerar hash bcrypt para Renato e Cristiane no banco
```

### 5. Importar clientes do backup

```bash
# Coloque o arquivo WB_Backup_*.json na pasta raiz
node importar-clientes.js WB_Backup_19-03-2026.json
```

### 6. Rodar o sistema

```bash
# Backend (terminal 1):
cd backend
npm run dev
# → Rodando em http://localhost:3001

# Frontend (terminal 2):
# Abra o frontend/index.html diretamente no browser
# OU use Live Server no VS Code (recomendado)
```

---

## 🌐 ENDPOINTS DA API

| Método | Rota | Descrição |
|--------|------|-----------|
| POST   | /api/auth/login | Login staff ou cliente |
| GET    | /api/auth/me | Dados do usuário logado |
| GET    | /api/clientes | Lista clientes |
| POST   | /api/clientes | Cadastrar cliente |
| PATCH  | /api/clientes/:id | Editar cliente |
| DELETE | /api/clientes/:id | Arquivar cliente |
| GET    | /api/parcelas | Listar parcelas |
| POST   | /api/parcelas | Nova parcela |
| PATCH  | /api/parcelas/:id | Editar parcela |
| DELETE | /api/parcelas/:id | Excluir parcela |
| GET    | /api/agendamentos | Listar agendamentos |
| POST   | /api/agendamentos | Novo agendamento |
| DELETE | /api/agendamentos/:id | Excluir agendamento |
| GET    | /api/prints | Listar prints |
| POST   | /api/prints | Adicionar print |
| DELETE | /api/prints/:id | Excluir print |
| GET    | /api/dashboard/stats | KPIs e gráfico |
| POST   | /api/n8n/:agente | Proxy para N8N |
| GET    | /api/health | Health check |

---

## 🚀 PRODUÇÃO (VPS ou hospedagem)

### Build e deploy:

```bash
# Backend — instalar PM2 para manter rodando
npm install -g pm2
cd backend
pm2 start server.js --name wb-erp-backend
pm2 save
pm2 startup

# Frontend — pode ser servido pelo próprio backend
# (coloque o index.html em frontend/dist/)
# ou use Nginx como servidor web

# Nginx config básico:
# server {
#   listen 80;
#   server_name seudominio.com.br;
#   
#   location /api {
#     proxy_pass http://localhost:3001;
#   }
#   
#   location / {
#     root /var/www/wb-erp/frontend;
#     try_files $uri /index.html;
#   }
# }
```

---

## 🔒 SEGURANÇA

- ✅ Senhas com bcrypt (salt rounds 10)
- ✅ JWT com expiração configurável
- ✅ Rate limiting (500 req/15min)
- ✅ CORS configurável por domínio
- ✅ Soft delete (clientes nunca apagados)
- ✅ Isolamento por role (cliente só vê próprios dados)
- ✅ SQL injection impossível (prepared statements)

---

## 🆚 Supabase vs MySQL Local

| | Supabase (atual) | MySQL Local |
|--|--|--|
| Custo | Grátis até 500MB | Seu servidor |
| Controle | Limitado | Total |
| Velocidade | Depende do plano | Local = rápido |
| Backup | Automático | Configure você |
| Portabilidade | Preso no Supabase | Qualquer servidor |

---

WB Assessoria Migratória · v5.0 · 2026
