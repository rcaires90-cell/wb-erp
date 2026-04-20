// Importa os clientes do backup JSON para o MySQL
// Roda com: node importar-clientes.js WB_Backup_19-03-2026.json

require('dotenv').config({ path: './backend/.env' });
const mysql = require('mysql2/promise');
const fs    = require('fs');
const path  = require('path');

async function main() {
  const arquivo = process.argv[2];
  if (!arquivo) {
    console.error('❌ Uso: node importar-clientes.js <arquivo.json>');
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(path.resolve(arquivo), 'utf-8'));
  const clientes = data.clientes || [];
  console.log(`📦 ${clientes.length} clientes encontrados no backup`);

  const db = await mysql.createConnection({
    host: process.env.DB_HOST, port: process.env.DB_PORT,
    database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASS,
    charset: 'utf8mb4',
  });

  let ok = 0, erros = 0;

  for (const c of clientes) {
    try {
      const dados_json = JSON.stringify({
        parcelasLivres: c.parcelasLivres || [],
        docsPendentes:  c.docsPendentes  || [],
        arquivos:       c.arquivos       || [],
        timeline:       c.timeline       || [],
        antecedente:    c.antecedente    || {},
        dataNascimento: c.dataNascimento || '',
        obsInterna:     c.obsInterna     || '',
        proximoPasso:   c.proximoPasso   || '',
      });

      await db.query(
        `INSERT IGNORE INTO clientes
          (nome, email, tel, cpf, rnm, pais, endereco, servico, status, etapa,
           total_etapas, responsavel, valor, pago, data_cadastro, protocolo,
           portal_login, portal_senha, prioridade, drive_folder_url, dados_json)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          c.nome, c.email||null, c.tel||null, c.cpf||null, c.rnm||null,
          c.pais||null, c.endereco||null, c.servico||'Naturalização Brasileira',
          c.status||'Pendente Documentação', c.etapa||0, c.totalEtapas||8,
          c.responsavel||'Renato Caires', parseFloat(c.valor)||0, c.pago?1:0,
          c.dataCadastro||null, c.protocolo||null,
          c.portalLogin||c.email||null, c.portalSenha||null,
          c.prioridade||'normal', c.driveFolderUrl||null, dados_json
        ]
      );

      // Importa parcelas do cliente
      if (c.parcelasLivres?.length) {
        const [[inserted]] = await db.query(
          'SELECT id FROM clientes WHERE email = ? OR (nome = ? AND pais = ?) LIMIT 1',
          [c.email||'', c.nome, c.pais||'']
        );
        if (inserted) {
          for (const p of c.parcelasLivres) {
            await db.query(
              'INSERT IGNORE INTO parcelas (cliente_id, descricao, valor, vencimento, forma_pgto, paga, data_pgto) VALUES (?,?,?,?,?,?,?)',
              [inserted.id, p.desc||p.descricao||'Parcela', parseFloat(p.valor)||0,
               p.vencISO||p.vencimento||null, p.forma||'PIX', p.paga?1:0, p.dataPgtoISO||null]
            );
          }
        }
      }

      ok++;
      process.stdout.write(`\r✅ ${ok}/${clientes.length} importados...`);
    } catch (err) {
      erros++;
      console.error(`\n❌ Erro em ${c.nome}: ${err.message}`);
    }
  }

  await db.end();
  console.log(`\n\n✅ Importação concluída: ${ok} sucesso, ${erros} erros`);
}

main().catch(console.error);
