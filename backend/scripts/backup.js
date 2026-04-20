/**
 * WB ERP — Backup Automático do Banco de Dados
 * Uso: node scripts/backup.js
 * Agendar via Windows Task Scheduler ou cron (Linux)
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { execSync } = require('child_process');
const path = require('path');
const fs   = require('fs');

const {
  DB_HOST = 'localhost',
  DB_PORT = '3306',
  DB_NAME,
  DB_USER,
  DB_PASS,
} = process.env;

if (!DB_NAME || !DB_USER) {
  console.error('❌ DB_NAME e DB_USER são obrigatórios no .env');
  process.exit(1);
}

// Pasta de destino
const BACKUP_DIR = path.join(__dirname, '../../backups');
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

// Nome do arquivo: wb_erp_2026-04-16_18-00.sql
const ts       = new Date().toISOString().replace('T', '_').slice(0, 16).replace(':', '-');
const fileName = `wb_erp_${ts}.sql`;
const filePath = path.join(BACKUP_DIR, fileName);

console.log(`\n🗄️  WB ERP — Backup iniciado`);
console.log(`📦 Destino: ${filePath}`);

try {
  // Tenta encontrar mysqldump no PATH ou em locais comuns
  const mysqldump = process.platform === 'win32'
    ? '"C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysqldump.exe"'
    : 'mysqldump';

  const cmd = `${mysqldump} -h${DB_HOST} -P${DB_PORT} -u${DB_USER} -p${DB_PASS} --single-transaction --routines --triggers ${DB_NAME} > "${filePath}"`;

  execSync(cmd, { shell: true, stdio: 'pipe' });

  const stats = fs.statSync(filePath);
  const kb    = (stats.size / 1024).toFixed(1);
  console.log(`✅ Backup concluído: ${fileName} (${kb} KB)\n`);

  // Remove backups com mais de 30 dias
  const arquivos = fs.readdirSync(BACKUP_DIR).filter(f => f.startsWith('wb_erp_') && f.endsWith('.sql'));
  const limite   = Date.now() - 30 * 24 * 60 * 60 * 1000;
  let removidos  = 0;
  arquivos.forEach(f => {
    const fp  = path.join(BACKUP_DIR, f);
    const mod = fs.statSync(fp).mtimeMs;
    if (mod < limite) { fs.unlinkSync(fp); removidos++; }
  });
  if (removidos > 0) console.log(`🗑️  ${removidos} backup(s) antigo(s) removido(s)`);

  process.exit(0);
} catch (e) {
  console.error('❌ Erro no backup:', e.message);
  console.log('\n💡 Dica: verifique se o mysqldump está instalado e no PATH.');
  process.exit(1);
}
