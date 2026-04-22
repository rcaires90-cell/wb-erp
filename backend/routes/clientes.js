const router       = require('express').Router();
const db           = require('../db');
const auth         = require('../middleware/auth');
const bcrypt       = require('bcryptjs');
const { sendEmail } = require('../lib/email');

async function notificarEtapa(cliente, novaEtapa) {
  if (!cliente.email) return;
  try {
    await sendEmail(
      cliente.email,
      '✅ Atualização no seu processo — WB Assessoria',
      `<div style="font-family:Arial,sans-serif;max-width:500px;padding:24px;background:#f9f9f9;border-radius:8px">
        <h2 style="color:#c9a84c">WB Assessoria Migratória</h2>
        <p>Olá, <b>${cliente.nome}</b>!</p>
        <p>Seu processo de <b>${cliente.servico}</b> foi atualizado para: <b>${novaEtapa}</b>.</p>
        <p>Acesse seu portal para acompanhar.</p>
        <a href="https://wb-erp-production.up.railway.app" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#c9a84c;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold">Acessar Portal</a>
      </div>`
    );
  } catch(e) { console.error('[email] ERRO notificarEtapa:', e.message); }
}

router.use(auth);

// ── GET /api/clientes ─────────────────────────────
// Query params: ?busca=&status=&responsavel=&page=1&limit=50&arquivados=0
router.get('/', async (req, res) => {
  try {
    // Cliente só vê os próprios dados
    if (req.user.role === 'cliente') {
      const [rows] = await db.query(
        'SELECT * FROM clientes WHERE id = ? AND arquivado = 0',
        [req.user.clienteId]
      );
      return res.json(rows);
    }

    const page       = Math.max(1, parseInt(req.query.page)  || 1);
    const limit      = Math.min(500, Math.max(1, parseInt(req.query.limit) || 50));
    const offset     = (page - 1) * limit;
    const arquivados = req.query.arquivados === '1' ? 1 : 0;

    let sql = 'SELECT * FROM clientes WHERE arquivado = ?';
    const params = [arquivados];

    // Busca por nome, email ou CPF
    if (req.query.busca) {
      const termo = `%${req.query.busca}%`;
      sql += ' AND (nome LIKE ? OR email LIKE ? OR cpf LIKE ? OR protocolo LIKE ?)';
      params.push(termo, termo, termo, termo);
    }

    if (req.query.status) {
      sql += ' AND status = ?';
      params.push(req.query.status);
    }

    if (req.query.responsavel) {
      sql += ' AND responsavel = ?';
      params.push(req.query.responsavel);
    }

    if (req.query.servico) {
      sql += ' AND servico = ?';
      params.push(req.query.servico);
    }

    if (req.query.prioridade) {
      sql += ' AND prioridade = ?';
      params.push(req.query.prioridade);
    }

    // Conta total para paginação
    const [[{ total }]] = await db.query(
      sql.replace('SELECT *', 'SELECT COUNT(*) AS total'),
      params
    );

    sql += ` ORDER BY nome ASC LIMIT ${limit} OFFSET ${offset}`;
    const [rows] = await db.query(sql, params);

    res.json({
      dados: rows,
      paginacao: {
        total,
        pagina:      page,
        limite:      limit,
        total_paginas: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('[clientes GET]', err);
    res.status(500).json({ erro: err.message });
  }
});

// ── GET /api/clientes/:id ─────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ erro: 'ID inválido' });

    if (req.user.role === 'cliente' && req.user.clienteId !== id) {
      return res.status(403).json({ erro: 'Acesso negado' });
    }

    const [rows] = await db.query('SELECT * FROM clientes WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ erro: 'Cliente não encontrado' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[clientes GET/:id]', err);
    res.status(500).json({ erro: err.message });
  }
});

// ── POST /api/clientes ────────────────────────────
router.post('/', async (req, res) => {
  if (req.user.role === 'cliente') return res.status(403).json({ erro: 'Acesso negado' });
  try {
    const {
      nome, email, tel, cpf, rnm, pais, endereco, servico, status,
      etapa, total_etapas, responsavel, valor, pago, data_cadastro,
      protocolo, portal_login, portal_senha, prioridade, drive_folder_url, dados_json,
    } = req.body;

    if (!nome || !nome.trim()) {
      return res.status(400).json({ erro: 'Nome é obrigatório' });
    }

    // Verifica CPF duplicado
    if (cpf) {
      const cpfClean = cpf.replace(/\D/g, '');
      if (cpfClean.length > 0) {
        const [dup] = await db.query(
          "SELECT id, nome FROM clientes WHERE REPLACE(REPLACE(cpf,'.',''),'-','') = ? AND arquivado = 0",
          [cpfClean]
        );
        if (dup.length) {
          return res.status(409).json({
            erro: `CPF já cadastrado para ${dup[0].nome}`,
            duplicata: dup[0],
          });
        }
      }
    }

    // Hash da senha se fornecida
    let senhaHash = null;
    if (portal_senha) {
      if (portal_senha.startsWith('wb$') || portal_senha.startsWith('$2')) {
        senhaHash = portal_senha; // mantém hash existente
      } else {
        senhaHash = await bcrypt.hash(portal_senha, 10);
      }
    }

    const [result] = await db.query(
      `INSERT INTO clientes
        (nome, email, tel, cpf, rnm, pais, endereco, servico, status, etapa, total_etapas,
         responsavel, valor, pago, data_cadastro, protocolo, portal_login, portal_senha,
         prioridade, drive_folder_url, dados_json)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        nome.trim(),
        email   || null,
        tel     || null,
        cpf     || null,
        rnm     || null,
        pais    || null,
        endereco || null,
        servico  || 'Naturalização Brasileira',
        status   || 'Pendente Documentação',
        etapa        !== undefined ? parseInt(etapa)        : 0,
        total_etapas !== undefined ? parseInt(total_etapas) : 8,
        responsavel  || 'Renato Caires',
        parseFloat(valor) || 0,
        pago ? 1 : 0,
        data_cadastro || new Date().toLocaleDateString('pt-BR'),
        protocolo         || null,
        portal_login      || email || null,
        senhaHash,
        prioridade        || 'normal',
        drive_folder_url  || null,
        dados_json ? JSON.stringify(dados_json) : '{}',
      ]
    );

    const [novo] = await db.query('SELECT * FROM clientes WHERE id = ?', [result.insertId]);
    res.status(201).json(novo[0]);
  } catch (err) {
    console.error('[clientes POST]', err);
    res.status(500).json({ erro: err.message });
  }
});

// ── PATCH /api/clientes/:id ───────────────────────
router.patch('/:id', async (req, res) => {
  if (req.user.role === 'cliente') return res.status(403).json({ erro: 'Acesso negado' });
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ erro: 'ID inválido' });

    const fields = { ...req.body };

    // Hash nova senha se fornecida em texto puro
    if (
      fields.portal_senha &&
      !fields.portal_senha.startsWith('wb$') &&
      !fields.portal_senha.startsWith('$2')
    ) {
      fields.portal_senha = await bcrypt.hash(fields.portal_senha, 10);
    }

    // Serializa dados_json se objeto
    if (fields.dados_json && typeof fields.dados_json === 'object') {
      fields.dados_json = JSON.stringify(fields.dados_json);
    }

    const ALLOWED = [
      'nome', 'email', 'tel', 'cpf', 'rnm', 'pais', 'endereco', 'servico', 'status',
      'etapa', 'total_etapas', 'responsavel', 'valor', 'pago', 'protocolo',
      'portal_login', 'portal_senha', 'prioridade', 'drive_folder_url',
      'drive_folder_id', 'dados_json', 'foto', 'arquivado',
      'processo_fase', 'processo_protocolo', 'processo_data_inicio',
      'proficiencia_status', 'proficiencia_obs', 'gov_login', 'gov_senha',
      'doc_rnm', 'doc_passaporte', 'doc_certidao', 'doc_comprovante',
    ];

    const setClauses = [];
    const params = [];
    for (const key of ALLOWED) {
      if (key in fields) {
        setClauses.push(`${key} = ?`);
        params.push(fields[key]);
      }
    }

    if (!setClauses.length) {
      return res.status(400).json({ erro: 'Nenhum campo válido para atualizar' });
    }

    const [[antes]] = await db.query('SELECT etapa, processo_fase, email, nome, servico FROM clientes WHERE id=?', [id]);
    params.push(id);
    await db.query(
      `UPDATE clientes SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );

    const [updated] = await db.query('SELECT * FROM clientes WHERE id = ?', [id]);
    if (!updated.length) return res.status(404).json({ erro: 'Cliente não encontrado' });

    if ('etapa' in fields && parseInt(fields.etapa) !== parseInt(antes?.etapa)) {
      notificarEtapa(antes, parseInt(fields.etapa) + 1);
    } else if ('processo_fase' in fields && fields.processo_fase !== antes?.processo_fase) {
      notificarEtapa(antes, fields.processo_fase);
    }

    res.json(updated[0]);
  } catch (err) {
    console.error('[clientes PATCH]', err);
    res.status(500).json({ erro: err.message });
  }
});

// ── DELETE /api/clientes/:id (soft delete) ────────
router.delete('/:id', async (req, res) => {
  if (req.user.role === 'cliente') return res.status(403).json({ erro: 'Acesso negado' });
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ erro: 'ID inválido' });

    const [result] = await db.query(
      'UPDATE clientes SET arquivado = 1, updated_at = NOW() WHERE id = ? AND arquivado = 0',
      [id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ erro: 'Cliente não encontrado ou já arquivado' });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('[clientes DELETE]', err);
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;
