const router       = require('express').Router();
const db           = require('../db');
const auth         = require('../middleware/auth');
const { sendEmail } = require('../lib/email');

function validarCPF(cpf) {
  const c = cpf.replace(/\D/g, '');
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  let s = 0, r;
  for (let i = 0; i < 9; i++) s += +c[i] * (10 - i);
  r = (s * 10) % 11; if (r >= 10) r = 0;
  if (r !== +c[9]) return false;
  s = 0;
  for (let i = 0; i < 10; i++) s += +c[i] * (11 - i);
  r = (s * 10) % 11; if (r >= 10) r = 0;
  return r === +c[10];
}

const FASE_LABELS = {
  pre_protocolo: 'Pré-Protocolo', pf_anexo: 'PF — Anexo de Docs', pf_analise: 'PF — Análise',
  pf_biometria: 'PF — Biometria', mjsp_analise: 'MJSP — Análise Final', dou_publicado: 'Publicação no DOU',
  concluido: 'Naturalização Concluída', requerimento: 'Requerimento', agendamento_pf: 'Agendamento',
  rnm_emissao: 'RNM', elegibilidade: 'Análise de Elegibilidade', ds160: 'Formulário DS-160',
  pagamento_taxas_eua: 'Pagamento das Taxas', agendamento_consulado: 'Agendamento no Consulado',
  entrevista_consulado: 'Entrevista no Consulado', visto_emitido: 'Visto Emitido',
};

async function criarTarefaAutomatica(clienteId, faseId, usuarioNome) {
  try {
    const [[prazo]] = await db.query('SELECT prazo_dias FROM fase_prazos WHERE fase_id = ?', [faseId]);
    if (!prazo) return;
    const label = FASE_LABELS[faseId] || faseId;
    await db.query(
      `INSERT INTO tarefas_cliente (cliente_id, fase_id, descricao, prazo_data)
       VALUES (?, ?, ?, DATE_ADD(CURDATE(), INTERVAL ? DAY))`,
      [clienteId, faseId, `Concluir fase: ${label}`, prazo.prazo_dias]
    );
  } catch(e) { console.error('[clientes] criarTarefaAutomatica:', e.message); }
}

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
        <p>Qualquer dúvida, fale conosco pelo WhatsApp: <a href="https://wa.me/5511914258886" style="color:#c9a84c">(11) 91425-8886</a></p>
      </div>`
    );
  } catch(e) { console.error('[email] ERRO notificarEtapa:', e.message); }
}

router.use(auth);

// ── GET /api/clientes ─────────────────────────────
// Query params: ?busca=&status=&responsavel=&page=1&limit=50&arquivados=0
router.get('/', async (req, res) => {
  try {
    const page       = Math.max(1, parseInt(req.query.page)  || 1);
    const limit      = Math.min(5000, Math.max(1, parseInt(req.query.limit) || 50));
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
  try {
    const {
      nome, email, tel, cpf, rnm, pais, endereco, servico, status,
      etapa, total_etapas, responsavel, valor, pago, data_cadastro,
      protocolo, prioridade, drive_folder_url, dados_json,
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

    const [result] = await db.query(
      `INSERT INTO clientes
        (nome, email, tel, cpf, rnm, pais, endereco, servico, status, etapa, total_etapas,
         responsavel, valor, pago, data_cadastro, protocolo,
         prioridade, drive_folder_url, dados_json)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
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
        prioridade        || 'normal',
        drive_folder_url  || null,
        dados_json ? JSON.stringify(dados_json) : '{}',
      ]
    );

    const [novo] = await db.query('SELECT * FROM clientes WHERE id = ?', [result.insertId]);

    // Gera automaticamente os documentos (contrato etc.) a partir dos modelos ativos.
    // Não bloqueia a resposta — Puppeteer pode levar alguns segundos.
    require('./documentos-cliente').gerarDocumentosCliente(result.insertId)
      .catch(e => console.error('[clientes] gerarDocumentosCliente:', e.message));

    res.status(201).json(novo[0]);
  } catch (err) {
    console.error('[clientes POST]', err);
    res.status(500).json({ erro: err.message });
  }
});

// ── PATCH /api/clientes/:id ───────────────────────
router.patch('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ erro: 'ID inválido' });

    const fields = { ...req.body };

    // Serializa dados_json se objeto
    if (fields.dados_json && typeof fields.dados_json === 'object') {
      fields.dados_json = JSON.stringify(fields.dados_json);
    }

    const ALLOWED = [
      'nome', 'email', 'tel', 'cpf', 'rnm', 'pais', 'endereco', 'servico', 'status',
      'etapa', 'total_etapas', 'responsavel', 'valor', 'pago', 'protocolo',
      'prioridade', 'drive_folder_url',
      'drive_folder_id', 'dados_json', 'foto', 'arquivado',
      'processo_fase', 'processo_protocolo', 'processo_data_inicio',
      'proficiencia_status', 'proficiencia_obs', 'gov_login', 'gov_senha',
      'doc_rnm', 'doc_cpf', 'doc_comprovante_end', 'doc_passaporte',
      'doc_comprovante_4anos', 'doc_antecedente', 'doc_antecedente_val',
      'doc_lingua', 'doc_prova_presencial', 'doc_senha_gov',
      'doc_cert_nascimento', 'doc_cert_casamento', 'doc_carteira_trabalho',
      // Autorização de Residência (CPLP / Reagrupamento)
      'doc_requerimento', 'doc_agendamento_pf', 'doc_taxas_gov', 'doc_biometria', 'doc_rnm_req',
      // Visto de Turismo (E.U.A)
      'doc_ds160', 'doc_foto_americana', 'doc_taxa_mrv',
      'doc_comprovante_renda', 'doc_extrato_bancario', 'doc_vinculo_brasil',
      'data_nascimento',
      // Validade de documentos extras
      'doc_passaporte_val', 'doc_rnm_val', 'doc_visto_val', 'data_validade_ar',
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

    const [[antes]] = await db.query('SELECT etapa, processo_fase, status, email, nome, servico FROM clientes WHERE id=?', [id]);
    params.push(id);
    await db.query(
      `UPDATE clientes SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );

    const [updated] = await db.query('SELECT * FROM clientes WHERE id = ?', [id]);
    if (!updated.length) return res.status(404).json({ erro: 'Cliente não encontrado' });

    const usuario_nome = req.user.nome || req.user.email || 'Sistema';

    if ('etapa' in fields && parseInt(fields.etapa) !== parseInt(antes?.etapa)) {
      notificarEtapa(antes, parseInt(fields.etapa) + 1);
    } else if ('processo_fase' in fields && fields.processo_fase !== antes?.processo_fase) {
      notificarEtapa(antes, fields.processo_fase);
      db.query('INSERT INTO historico_fases (cliente_id, fase_id, fase_label, usuario_nome) VALUES (?,?,?,?)',
        [id, fields.processo_fase, `Fase: ${antes.processo_fase||'início'} → ${fields.processo_fase}`, usuario_nome]).catch(()=>{});
      criarTarefaAutomatica(id, fields.processo_fase, usuario_nome);
    }

    if ('status' in fields && fields.status !== antes?.status) {
      db.query('INSERT INTO historico_fases (cliente_id, fase_id, fase_label, usuario_nome) VALUES (?,?,?,?)',
        [id, 'status_change', `Status: ${antes.status||'?'} → ${fields.status}`, usuario_nome]).catch(()=>{});
    }

    res.json(updated[0]);
  } catch (err) {
    console.error('[clientes PATCH]', err);
    res.status(500).json({ erro: err.message });
  }
});

// ── DELETE /api/clientes/:id (soft delete) ────────
router.delete('/:id', async (req, res) => {
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

// ── POST /api/clientes/:id/historico-fase ─────────
router.post('/:id/historico-fase', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { fase_id, fase_label } = req.body;
    if (!fase_id) return res.status(400).json({ erro: 'fase_id obrigatório' });
    const usuario_nome = req.user.nome || req.user.email || 'Sistema';
    await db.query(
      'INSERT INTO historico_fases (cliente_id, fase_id, fase_label, usuario_nome) VALUES (?,?,?,?)',
      [id, fase_id, fase_label || fase_id, usuario_nome]
    );
    res.json({ ok: true });
  } catch(e) {
    res.status(500).json({ erro: e.message });
  }
});

// ── GET /api/clientes/:id/historico-fase ──────────
router.get('/:id/historico-fase', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [rows] = await db.query(
      'SELECT * FROM historico_fases WHERE cliente_id = ? ORDER BY created_at DESC LIMIT 50',
      [id]
    );
    res.json(rows);
  } catch(e) {
    res.status(500).json({ erro: e.message });
  }
});

module.exports = router;
