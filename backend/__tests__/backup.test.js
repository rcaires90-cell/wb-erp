const { TABELAS_BACKUP, gerarBackupDados, resumoBackup, rodarBackupSemanal } = require('../lib/backup');

function fakeDb(rowsPorTabela) {
  return {
    query: jest.fn(async (sql) => {
      const tabela = TABELAS_BACKUP.find(t => sql.includes(t));
      return [rowsPorTabela[tabela] || []];
    }),
  };
}

describe('TABELAS_BACKUP', () => {
  test('não inclui tabelas sensíveis/pesadas (usuarios, documentos_cliente)', () => {
    expect(TABELAS_BACKUP).not.toContain('usuarios');
    expect(TABELAS_BACKUP).not.toContain('documentos_cliente');
  });
  test('inclui as tabelas de negócio principais', () => {
    expect(TABELAS_BACKUP).toEqual(expect.arrayContaining(['clientes', 'parcelas', 'contas_pagar']));
  });
});

describe('gerarBackupDados', () => {
  test('consulta cada tabela da lista exatamente uma vez', async () => {
    const db = fakeDb({ clientes: [{ id: 1 }, { id: 2 }] });
    const backup = await gerarBackupDados(db);
    expect(db.query).toHaveBeenCalledTimes(TABELAS_BACKUP.length);
    expect(backup.tabelas.clientes).toHaveLength(2);
    expect(backup.tabelas.parcelas).toEqual([]);
    expect(backup.gerado_em).toBeDefined();
  });
});

describe('resumoBackup', () => {
  test('formata contagem por tabela, 0 quando ausente', () => {
    const backup = { tabelas: { clientes: [{}, {}, {}] } };
    const linhas = resumoBackup(backup);
    expect(linhas.find(l => l.startsWith('clientes'))).toBe('clientes: 3 registro(s)');
    expect(linhas.find(l => l.startsWith('parcelas'))).toBe('parcelas: 0 registro(s)');
  });
});

describe('rodarBackupSemanal', () => {
  test('envia e-mail com anexo JSON contendo o backup gerado', async () => {
    const db = fakeDb({ clientes: [{ id: 1, nome: 'Fulano' }] });
    const sendEmail = jest.fn(async () => ({ id: 'email_123' }));

    const { resumo } = await rodarBackupSemanal(db, { sendEmail, equipeEmail: 'equipe@teste.com' });

    expect(sendEmail).toHaveBeenCalledTimes(1);
    const [to, subject, html, attachments] = sendEmail.mock.calls[0];
    expect(to).toBe('equipe@teste.com');
    expect(subject).toMatch(/Backup Semanal/);
    expect(html).toMatch(/clientes: 1 registro/);
    expect(attachments).toHaveLength(1);

    const conteudo = JSON.parse(attachments[0].content);
    expect(conteudo.tabelas.clientes[0].nome).toBe('Fulano');
    expect(resumo.find(l => l.startsWith('clientes'))).toBe('clientes: 1 registro(s)');
  });
});
