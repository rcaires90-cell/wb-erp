const router    = require('express').Router();
const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const db        = require('../db');

// Rate limit agressivo só no login: 10 tentativas por IP a cada 15 minutos
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true, // não conta tentativas bem-sucedidas
  message: { erro: 'Muitas tentativas de login. Aguarde 15 minutos e tente novamente.' },
});

// ── POST /api/auth/login ──────────────────────────
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, senha, tipo } = req.body;

    if (!email || !senha || !tipo) {
      return res.status(400).json({ erro: 'email, senha e tipo são obrigatórios' });
    }
    if (!['staff', 'cliente'].includes(tipo)) {
      return res.status(400).json({ erro: 'tipo deve ser "staff" ou "cliente"' });
    }

    // ── LOGIN STAFF ──────────────────────────────
    if (tipo === 'staff') {
      const [rows] = await db.query(
        'SELECT * FROM users WHERE email = ? AND ativo = 1 LIMIT 1',
        [email.toLowerCase().trim()]
      );

      // Mesma mensagem para usuário não encontrado e senha errada (evita enumeração)
      if (!rows.length) {
        return res.status(401).json({ erro: 'Credenciais inválidas' });
      }

      const user = rows[0];
      const ok = await bcrypt.compare(senha, user.senha_hash);
      if (!ok) return res.status(401).json({ erro: 'Credenciais inválidas' });

      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role, nome: user.nome },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES || '8h' }
      );

      return res.json({
        ok: true,
        token,
        user: {
          id:     user.id,
          nome:   user.nome,
          email:  user.email,
          role:   user.role,
          cargo:  user.cargo,
          avatar: user.avatar,
        },
      });
    }

    // ── LOGIN CLIENTE ─────────────────────────────
    if (tipo === 'cliente') {
      const [rows] = await db.query(
        `SELECT id, nome, email, tel, servico, status,
                portal_login, portal_senha
         FROM clientes
         WHERE portal_login = ? AND arquivado = 0
         LIMIT 1`,
        [email.trim()]
      );

      if (!rows.length) {
        return res.status(401).json({ erro: 'Dados incorretos' });
      }

      const cli = rows[0];
      let senhaOk = false;

      if (!cli.portal_senha) {
        // sem senha cadastrada — bloqueia
        return res.status(401).json({ erro: 'Dados incorretos' });
      }

      if (cli.portal_senha.startsWith('$2')) {
        // bcrypt (padrão atual)
        senhaOk = await bcrypt.compare(senha, cli.portal_senha);
      } else if (cli.portal_senha.startsWith('wb$')) {
        // hash legado do sistema antigo
        let h = 0;
        for (let i = 0; i < senha.length; i++) {
          h = ((h << 5) - h) + senha.charCodeAt(i);
          h |= 0;
        }
        const expected =
          'wb$' +
          Math.abs(h).toString(36) +
          Buffer.from(senha.split('').reverse().join('')).toString('base64').replace(/=/g, '').slice(0, 12);
        senhaOk = expected === cli.portal_senha;

        // Migração automática: atualiza para bcrypt na próxima vez que o cliente logar
        if (senhaOk) {
          const novoHash = await bcrypt.hash(senha, 10);
          await db.query('UPDATE clientes SET portal_senha = ? WHERE id = ?', [novoHash, cli.id]);
        }
      } else {
        // texto puro (legado muito antigo) — compara diretamente
        senhaOk = senha === cli.portal_senha;

        // Migração automática para bcrypt
        if (senhaOk) {
          const novoHash = await bcrypt.hash(senha, 10);
          await db.query('UPDATE clientes SET portal_senha = ? WHERE id = ?', [novoHash, cli.id]);
        }
      }

      if (!senhaOk) return res.status(401).json({ erro: 'Dados incorretos' });

      const token = jwt.sign(
        { id: cli.id, email: cli.email, role: 'cliente', nome: cli.nome, clienteId: cli.id },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES || '8h' }
      );

      const avatar = cli.nome
        .split(' ')
        .filter(Boolean)
        .map(w => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();

      return res.json({
        ok: true,
        token,
        user: {
          id:        cli.id,
          nome:      cli.nome,
          email:     cli.email,
          role:      'cliente',
          cargo:     'Cliente',
          avatar,
          clienteId: cli.id,
        },
      });
    }
  } catch (err) {
    console.error('[auth POST /login]', err);
    res.status(500).json({ erro: 'Erro ao autenticar' });
  }
});

// ── GET /api/auth/me ──────────────────────────────
router.get('/me', require('../middleware/auth'), (req, res) => {
  res.json({ ok: true, user: req.user });
});

module.exports = router;
