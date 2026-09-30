// Smoke test: cada arquivo de rota deve carregar (require) sem erro e
// exportar um Express Router. node --check só valida sintaxe, não pega
// require() de módulo/caminho errado — foi assim que o bug do
// Uint8Array.toString('base64') passou despercebido por um tempo (ver
// project_wb_erp.md, 2026-08-03): "não deu erro" não é o mesmo que "funciona".
// Mocka a pool de conexão real — sem isso, require() de qualquer rota tenta
// conectar em localhost:3306 de verdade (efeito colateral de db.js) e deixa
// handles abertos no Jest.
jest.mock('../db', () => ({
  query: jest.fn(async () => [[]]),
  getConnection: jest.fn(async () => ({ query: jest.fn(), release: jest.fn() })),
  on: jest.fn(),
}));

const fs = require('fs');
const path = require('path');

const ROTAS_DIR = path.join(__dirname, '..', 'routes');
// routes/index.js é um arquivo morto (o próprio conteúdo diz "pode ser
// deletado com segurança" — refatoração de 2026-04 moveu tudo pra arquivos
// próprios). Não exporta um Router, só um comentário; excluído do smoke test.
const arquivos = fs.readdirSync(ROTAS_DIR).filter(f => f.endsWith('.js') && f !== 'index.js');

describe('routes/*.js carregam sem erro', () => {
  test.each(arquivos)('%s', (arquivo) => {
    const mod = require(path.join(ROTAS_DIR, arquivo));
    expect(mod).toBeDefined();
    expect(typeof mod).toBe('function'); // Express Router é uma função
  });
});

describe('lib/*.js carregam sem erro', () => {
  const LIB_DIR = path.join(__dirname, '..', 'lib');
  const libs = fs.readdirSync(LIB_DIR).filter(f => f.endsWith('.js'));
  test.each(libs)('%s', (arquivo) => {
    expect(() => require(path.join(LIB_DIR, arquivo))).not.toThrow();
  });
});
