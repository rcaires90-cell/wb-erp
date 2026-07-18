/**
 * Backup único das tabelas do Portal do Cliente antes da remoção.
 * Uso: node scripts/backup_portal_data.js
 * Gera backups/wb-portal-backup-<data>.json na raiz do projeto.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const path = require('path');
const fs   = require('fs');
const db   = require('../db');

async function main() {
  const BACKUP_DIR = path.join(__dirname, '../../backups');
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const data = { gerado_em: new Date().toISOString(), tabelas: {} };

  for (const tabela of ['mensagens_portal', 'documentos_portal']) {
    try {
      const [rows] = await db.query(`SELECT * FROM \`${tabela}\``);
      data.tabelas[tabela] = rows;
      console.log(`✅ ${tabela}: ${rows.length} registro(s)`);
    } catch (e) {
      console.warn(`⚠️  ${tabela}: ${e.message}`);
      data.tabelas[tabela] = [];
    }
  }

  const ts       = new Date().toISOString().slice(0, 10);
  const fileName = `wb-portal-backup-${ts}.json`;
  const filePath = path.join(BACKUP_DIR, fileName);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');

  console.log(`\n📦 Backup salvo em: ${filePath}`);
  process.exit(0);
}

main().catch(e => {
  console.error('❌ Erro no backup:', e.message);
  process.exit(1);
});
