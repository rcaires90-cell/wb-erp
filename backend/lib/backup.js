// Backup dos dados de negócio (não é dump de schema) — usado pelo cron
// semanal e pelo botão manual "Rodar backup agora" em Configurações.
// Fica de fora de propósito: documentos_cliente (PDFs em base64, pesado
// demais pra anexo de e-mail) e usuarios (hash de senha — não precisa
// circular por e-mail toda semana).
const TABELAS_BACKUP = [
  'clientes', 'parcelas', 'agendamentos', 'leads', 'notas_clientes',
  'contas_pagar', 'lancamentos_bancarios', 'despesas', 'prolabore',
  'metas_mensais', 'controle_documentos', 'tarefas_cliente',
];

async function gerarBackupDados(db) {
  const backup = { gerado_em: new Date().toISOString(), tabelas: {} };
  for (const t of TABELAS_BACKUP) {
    const [rows] = await db.query(`SELECT * FROM \`${t}\``);
    backup.tabelas[t] = rows;
  }
  return backup;
}

function resumoBackup(backup) {
  return TABELAS_BACKUP.map(t => `${t}: ${backup.tabelas[t]?.length ?? 0} registro(s)`);
}

async function rodarBackupSemanal(db, { sendEmail, equipeEmail }) {
  const backup = await gerarBackupDados(db);
  const json = JSON.stringify(backup);
  const data = new Date().toISOString().slice(0, 10);
  const resumo = resumoBackup(backup);

  await sendEmail(
    equipeEmail,
    `💾 Backup Semanal WB ERP — ${data}`,
    `<div style="font-family:Arial;max-width:500px;padding:24px;background:#f9f9f9;border-radius:8px">
      <h2 style="color:#c9a84c">Backup Semanal — WB ERP</h2>
      <p>Backup gerado em <b>${new Date().toLocaleString('pt-BR')}</b>.</p>
      <ul>${resumo.map(l => `<li>${l}</li>`).join('')}</ul>
      <p style="color:#888;font-size:0.85rem">Anexo: wb-backup-${data}.json (não abrir e editar — é só pra restauração de emergência).</p>
    </div>`,
    [{ filename: `wb-backup-${data}.json`, content: json }]
  );

  return { data, resumo, tamanhoBytes: json.length };
}

module.exports = { TABELAS_BACKUP, gerarBackupDados, resumoBackup, rodarBackupSemanal };
