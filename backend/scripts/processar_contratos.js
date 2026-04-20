/**
 * processar_contratos.js
 * Registra novos clientes e cria parcelas para todos os contratos
 * Usa DB direto para poder definir paga=1 em parcelas já vencidas
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const db = require('../db');

const HOJE = '2026-04-15';

function isPaga(vencimento) {
  return vencimento <= HOJE ? 1 : 0;
}

async function inserirCliente(dados) {
  // Checa se já existe pelo nome exato
  const [ex] = await db.query('SELECT id, nome FROM clientes WHERE nome = ? AND arquivado = 0', [dados.nome]);
  if (ex.length) {
    console.log(`  ⚠️  Já existe: ${dados.nome} (id=${ex[0].id})`);
    return ex[0].id;
  }
  const [r] = await db.query(
    `INSERT INTO clientes (nome, pais, cpf, rnm, servico, status, valor, responsavel, data_cadastro, prioridade)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [
      dados.nome,
      dados.pais || null,
      dados.cpf || null,
      dados.rnm || null,
      dados.servico || 'Naturalização Brasileira',
      dados.status || 'Em andamento',
      dados.valor || 0,
      dados.responsavel || 'Renato Caires',
      dados.data_cadastro || new Date().toLocaleDateString('pt-BR'),
      dados.prioridade || 'normal',
    ]
  );
  console.log(`  ✅ Criado: ${dados.nome} (id=${r.insertId})`);
  return r.insertId;
}

async function p(cliente_id, descricao, valor, vencimento, forma_pgto = 'PIX') {
  const paga = isPaga(vencimento);
  await db.query(
    `INSERT INTO parcelas (cliente_id, descricao, valor, vencimento, forma_pgto, paga, data_pgto)
     VALUES (?,?,?,?,?,?,?)`,
    [cliente_id, descricao, valor, vencimento, forma_pgto, paga, paga ? vencimento : null]
  );
  console.log(`    📄 ${descricao.padEnd(45)} R$${String(valor).padStart(8)} ${vencimento} [${paga ? 'PAGA   ' : 'PENDENTE'}]`);
}

async function main() {
  console.log('🚀 Iniciando processamento de contratos...\n');

  // ═══════════════════════════════════════════════════════
  // STEP 1 — REGISTRAR NOVOS CLIENTES
  // ═══════════════════════════════════════════════════════
  console.log('═══ STEP 1: NOVOS CLIENTES ═══\n');

  const IDS = {};

  IDS.ASNEL    = await inserirCliente({ nome:'ASNEL ALCINDOR',   pais:'Haiti', cpf:'702.659.052-90', servico:'Sol. Naturalização Brasileira', valor:1050, data_cadastro:'30/01/2024' });
  IDS.EVELINE  = await inserirCliente({ nome:'EVELINE EMMANUEL', pais:'Haiti', cpf:'800.504.479-80', servico:'Sol. Naturalização Brasileira', valor:1050, data_cadastro:'30/01/2024' });
  IDS.BOUBACAR = await inserirCliente({ nome:'BOUBACAR DIALLO',  pais:'Senegal', cpf:'013.439.769-01', servico:'Sol. Naturalização Brasileira', valor:1500, data_cadastro:'03/09/2024' });
  IDS.HERVE    = await inserirCliente({ nome:'HERVE ATSINGA',    pais:'Camarões', cpf:'031.508.281-04', rnm:'B027242-Q', servico:'Naturalização Brasileira', valor:2490, data_cadastro:'06/04/2026' });
  IDS.JOSIENNE = await inserirCliente({ nome:'JOSIENNE JOSEPH',  pais:'Haiti', cpf:'702.537.782-12', servico:'Sol. Naturalização Brasileira', valor:1100, data_cadastro:'12/02/2024' });
  IDS.KEDSON   = await inserirCliente({ nome:'KEDSON PHILIPPE',  pais:'Haiti', cpf:'700.218.832-11', servico:'Sol. Naturalização Brasileira', valor:1750, data_cadastro:'01/02/2024' });
  IDS.KENDY    = await inserirCliente({ nome:'KENDY JEAN PIERRE',  pais:'Haiti', cpf:'800.196.479-56', rnm:'G333187-Z', servico:'Naturalização Brasileira', valor:1700, data_cadastro:'05/06/2025' });
  IDS.BERLINE  = await inserirCliente({ nome:'BERLINE MATHURIN', pais:'Haiti', cpf:'800.196.489-28', rnm:'G333202-S', servico:'Naturalização Brasileira', valor:1700, data_cadastro:'05/06/2025' });
  IDS.KESNEL   = await inserirCliente({ nome:'KESNEL CHARLES',   pais:'Haiti', cpf:'709.039.952-47', rnm:'F749028-0', servico:'Naturalização Brasileira (Provisória)', valor:1100, data_cadastro:'31/01/2025' });
  IDS.NESY     = await inserirCliente({ nome:'NESY VALON',       pais:'Haiti', cpf:'053.170.929-10', servico:'Naturalização Brasileira', valor:2830, data_cadastro:'20/05/2025' });
  IDS.OLET     = await inserirCliente({ nome:'OLET KENOL',       pais:'Haiti', rnm:'G256674-6', servico:'Naturalização Brasileira', valor:1600, data_cadastro:'12/12/2024' });

  // ═══════════════════════════════════════════════════════
  // STEP 2 — PARCELAS CLIENTES JÁ EXISTENTES (ids 7–29)
  // ═══════════════════════════════════════════════════════
  console.log('\n═══ STEP 2: PARCELAS CLIENTES EXISTENTES ═══');

  // 7 JEAN CLAUDY DESIRE (casal — metade do contrato R$4.000)
  console.log('\n[id=7] JEAN CLAUDY DESIRE');
  await p(7, 'Entrada — Naturalização',            500,   '2025-10-11');
  await p(7, '1ª parcela — Naturalização',          300,   '2025-12-10');
  await p(7, '2ª parcela — Naturalização',          300,   '2026-01-10');
  await p(7, '3ª parcela — Naturalização',          300,   '2026-02-10');
  await p(7, '4ª parcela — Naturalização',          300,   '2026-03-10');
  await p(7, '5ª parcela (última) — Naturalização', 300,   '2026-04-10');

  // 8 ESTHER DORCE (casal)
  console.log('\n[id=8] ESTHER DORCE');
  await p(8, 'Entrada — Naturalização',            500,   '2025-10-11');
  await p(8, '1ª parcela — Naturalização',          300,   '2025-12-10');
  await p(8, '2ª parcela — Naturalização',          300,   '2026-01-10');
  await p(8, '3ª parcela — Naturalização',          300,   '2026-02-10');
  await p(8, '4ª parcela — Naturalização',          300,   '2026-03-10');
  await p(8, '5ª parcela (última) — Naturalização', 300,   '2026-04-10');

  // 9 DIEUFAIT DURANE
  console.log('\n[id=9] DIEUFAIT DURANE');
  await p(9, 'Entrada — Naturalização',             300,    '2025-08-18');
  await p(9, 'Taxa adicional — Naturalização',      199.50, '2025-08-30');
  await p(9, '1ª parcela — Naturalização',          499.50, '2025-09-30');
  await p(9, '2ª parcela — Naturalização',          499.50, '2025-10-10');
  await p(9, '3ª parcela — Naturalização',          499.50, '2025-11-10');
  await p(9, '4ª parcela (última) — Naturalização', 499.50, '2025-12-10');

  // 10 MARIE CLAIRONIE BENJAMIN BRISSEAULT
  console.log('\n[id=10] MARIE CLAIRONIE BENJAMIN');
  await p(10, 'Entrada — Naturalização',             499.50, '2025-06-15');
  await p(10, '1ª parcela — Naturalização',          499.50, '2025-07-15');
  await p(10, '2ª parcela — Naturalização',          499.50, '2025-08-30');
  await p(10, '3ª parcela — Naturalização',          499.50, '2025-09-20');
  await p(10, '4ª parcela (última) — Naturalização', 499.50, '2025-11-20');

  // 11 MARIA KITOKO SIMPI
  console.log('\n[id=11] MARIA KITOKO SIMPI');
  await p(11, 'Entrada — Naturalização',             499.50, '2025-07-15');
  await p(11, '1ª parcela — Naturalização',          499.50, '2025-08-20');
  await p(11, '2ª parcela — Naturalização',          499.50, '2025-09-20');
  await p(11, '3ª parcela — Naturalização',          499.50, '2025-10-20');
  await p(11, '4ª parcela (última) — Naturalização', 499.50, '2025-11-20');

  // 12 GILBERT DOSSOUS
  console.log('\n[id=12] GILBERT DOSSOUS');
  await p(12, 'Entrada — Naturalização',             900,    '2025-04-23');
  await p(12, '1ª parcela — Naturalização',          566.67, '2025-08-20');
  await p(12, '2ª parcela — Naturalização',          566.67, '2025-09-20');
  await p(12, '3ª parcela (última) — Naturalização', 566.66, '2025-10-20');

  // 13 EMANIUS LAVENTURE
  console.log('\n[id=13] EMANIUS LAVENTURE');
  await p(13, 'Entrada — Naturalização',             500,    '2025-04-17');
  await p(13, '1ª parcela — Naturalização',          500,    '2025-04-30');
  await p(13, '2ª parcela — Naturalização',          649.50, '2025-05-20');
  await p(13, '3ª parcela (última) — Naturalização', 649.50, '2025-06-04');

  // 14 FALONNE FEUILLE
  console.log('\n[id=14] FALONNE FEUILLE');
  await p(14, 'Entrada — Naturalização',             900,  '2025-02-01');
  await p(14, '1ª parcela — Naturalização',          550,  '2025-02-28');
  await p(14, '2ª parcela (última) — Naturalização', 550,  '2025-03-30');

  // 15 FEDEL FEVRIER
  console.log('\n[id=15] FEDEL FEVRIER');
  await p(15, '1ª parcela — Naturalização',          500,  '2024-12-27');
  await p(15, '2ª parcela — Naturalização',          500,  '2025-01-27');
  await p(15, '3ª parcela — Naturalização',          500,  '2025-02-27');
  await p(15, '4ª parcela (última) — Naturalização', 500,  '2025-03-27');

  // 16 WILFRID ISRAEL
  console.log('\n[id=16] WILFRID ISRAEL');
  await p(16, '1ª parcela — Naturalização',          700,  '2024-12-23');
  await p(16, '2ª parcela — Naturalização',          325,  '2025-01-23');
  await p(16, '3ª parcela — Naturalização',          325,  '2025-02-23');
  await p(16, '4ª parcela — Naturalização',          325,  '2025-03-23');
  await p(16, '5ª parcela (última) — Naturalização', 325,  '2025-04-23');

  // 17 LAMY GUILLAUME (casal — metade do contrato R$3.500)
  console.log('\n[id=17] LAMY GUILLAUME');
  await p(17, 'Entrada — Sol. Naturalização',            750,    '2024-04-08');
  await p(17, '1ª parcela — Sol. Naturalização',          333.50, '2024-05-10');
  await p(17, '2ª parcela — Sol. Naturalização',          333.50, '2024-06-10');
  await p(17, '3ª parcela (última) — Sol. Naturalização', 333.00, '2024-07-10');

  // 18 RONIDE JEAN GILLES (casal)
  console.log('\n[id=18] RONIDE JEAN GILLES');
  await p(18, 'Entrada — Sol. Naturalização',            750,    '2024-04-08');
  await p(18, '1ª parcela — Sol. Naturalização',          333.50, '2024-05-10');
  await p(18, '2ª parcela — Sol. Naturalização',          333.50, '2024-06-10');
  await p(18, '3ª parcela (última) — Sol. Naturalização', 333.00, '2024-07-10');

  // 19 RALPH EZECHIEL BENJAMIN (resp. financeiro: RAPHAEL BENJAMIN)
  console.log('\n[id=19] RALPH EZECHIEL BENJAMIN');
  await p(19, 'Entrada — Naturalização',             400,  '2026-01-02');
  await p(19, '2ª parcela (última) — Naturalização', 400,  '2026-02-02');

  // 20 JAGUIN SOIRIN (casal — metade do contrato R$4.000)
  console.log('\n[id=20] JAGUIN SOIRIN');
  await p(20, 'Entrada — Sol. Naturalização',            1000,   '2025-08-18');
  await p(20, '1ª parcela — Sol. Naturalização',          166.67, '2025-09-25');
  await p(20, '2ª parcela — Sol. Naturalização',          166.67, '2025-10-25');
  await p(20, '3ª parcela — Sol. Naturalização',          166.67, '2025-11-25');
  await p(20, '4ª parcela — Sol. Naturalização',          166.67, '2025-12-25');
  await p(20, '5ª parcela — Sol. Naturalização',          166.67, '2026-01-25');
  await p(20, '6ª parcela (última) — Sol. Naturalização', 166.65, '2026-02-25');

  // 21 SHERLINE PIERRE (casal)
  console.log('\n[id=21] SHERLINE PIERRE');
  await p(21, 'Entrada — Sol. Naturalização',            1000,   '2025-08-18');
  await p(21, '1ª parcela — Sol. Naturalização',          166.67, '2025-09-25');
  await p(21, '2ª parcela — Sol. Naturalização',          166.67, '2025-10-25');
  await p(21, '3ª parcela — Sol. Naturalização',          166.67, '2025-11-25');
  await p(21, '4ª parcela — Sol. Naturalização',          166.67, '2025-12-25');
  await p(21, '5ª parcela — Sol. Naturalização',          166.67, '2026-01-25');
  await p(21, '6ª parcela (última) — Sol. Naturalização', 166.65, '2026-02-25');

  // 22 ERIC KANKAM BOADU
  console.log('\n[id=22] ERIC KANKAM BOADU');
  await p(22, 'Entrada — Naturalização',             500,  '2025-10-03');
  await p(22, '1ª parcela — Naturalização',          500,  '2025-11-10');
  await p(22, '2ª parcela — Naturalização',          500,  '2025-12-10');
  await p(22, '3ª parcela — Naturalização',          500,  '2026-01-10');
  await p(22, '4ª parcela (última) — Naturalização', 500,  '2026-02-10');

  // 23 FRIDSON ETIENNE
  console.log('\n[id=23] FRIDSON ETIENNE');
  await p(23, 'Entrada — Sol. Naturalização',            500,  '2024-03-20');
  await p(23, '1ª parcela — Sol. Naturalização',          300,  '2024-04-20');
  await p(23, '2ª parcela (última) — Sol. Naturalização', 300,  '2024-05-20');

  // 24 ERI CONDORI ESTRADES
  console.log('\n[id=24] ERI CONDORI ESTRADES');
  await p(24, 'Entrada — Naturalização',             800,    '2025-05-17');
  await p(24, '1ª parcela — Naturalização',          499.66, '2025-06-17');
  await p(24, '2ª parcela — Naturalização',          499.66, '2025-07-17');
  await p(24, '3ª parcela (última) — Naturalização', 499.66, '2025-08-17');

  // 25 SYLVESTRE PIERRE
  console.log('\n[id=25] SYLVESTRE PIERRE');
  await p(25, 'Entrada — Naturalização',             900,  '2025-01-31');
  await p(25, '1ª parcela — Naturalização',          650,  '2025-02-28');
  await p(25, '2ª parcela — Naturalização',          650,  '2025-03-31');
  await p(25, '3ª parcela (última) — Naturalização', 650,  '2025-04-30');

  // 26 JEAN THONY ETIENNE
  console.log('\n[id=26] JEAN THONY ETIENNE');
  await p(26, '1ª parcela — Naturalização',          500,  '2024-12-21');
  await p(26, '2ª parcela — Naturalização',          500,  '2025-01-21');
  await p(26, '3ª parcela — Naturalização',          500,  '2025-02-21');
  await p(26, '4ª parcela (última) — Naturalização', 500,  '2025-03-21');

  // 27 KERVENS LADOUCEUR
  console.log('\n[id=27] KERVENS LADOUCEUR');
  await p(27, '1ª parcela — Naturalização',          400,  '2024-12-20');
  await p(27, '2ª parcela — Naturalização',          400,  '2025-01-20');
  await p(27, '3ª parcela — Naturalização',          400,  '2025-02-20');
  await p(27, '4ª parcela — Naturalização',          400,  '2025-03-20');
  await p(27, '5ª parcela (última) — Naturalização', 400,  '2025-04-20');

  // 28 WILGUERE KENOL (casal — metade do contrato R$2.200)
  console.log('\n[id=28] WILGUERE KENOL');
  await p(28, 'Entrada — Sol. Naturalização',            250,    '2024-02-12');
  await p(28, '2ª parcela — Sol. Naturalização',          283.34, '2024-02-19');
  await p(28, '3ª parcela — Sol. Naturalização',          283.34, '2024-03-19');
  await p(28, '4ª parcela (última) — Sol. Naturalização', 283.33, '2024-04-19');

  // 29 BENJAMIN CHIJINDU OKOYE
  console.log('\n[id=29] BENJAMIN CHIJINDU OKOYE');
  await p(29, 'Entrada — Naturalização',             800,  '2025-12-17');
  await p(29, '1ª parcela — Naturalização',          600,  '2026-01-17');
  await p(29, '2ª parcela (última) — Naturalização', 600,  '2026-02-20');

  // ═══════════════════════════════════════════════════════
  // STEP 3 — PARCELAS NOVOS CLIENTES
  // ═══════════════════════════════════════════════════════
  console.log('\n═══ STEP 3: PARCELAS NOVOS CLIENTES ═══');

  // ASNEL ALCINDOR (casal — metade R$2.100)
  console.log(`\n[id=${IDS.ASNEL}] ASNEL ALCINDOR`);
  await p(IDS.ASNEL, 'Entrada — Sol. Naturalização',            600,    '2024-01-30');
  await p(IDS.ASNEL, '2ª parcela — Sol. Naturalização',          233.33, '2024-02-28');
  await p(IDS.ASNEL, '3ª parcela — Sol. Naturalização',          233.33, '2024-03-28');
  await p(IDS.ASNEL, '4ª parcela (última) — Sol. Naturalização', 233.33, '2024-04-28');

  // EVELINE EMMANUEL (casal)
  console.log(`\n[id=${IDS.EVELINE}] EVELINE EMMANUEL`);
  await p(IDS.EVELINE, 'Entrada — Sol. Naturalização',            600,    '2024-01-30');
  await p(IDS.EVELINE, '2ª parcela — Sol. Naturalização',          233.33, '2024-02-28');
  await p(IDS.EVELINE, '3ª parcela — Sol. Naturalização',          233.33, '2024-03-28');
  await p(IDS.EVELINE, '4ª parcela (última) — Sol. Naturalização', 233.33, '2024-04-28');

  // BOUBACAR DIALLO
  console.log(`\n[id=${IDS.BOUBACAR}] BOUBACAR DIALLO`);
  await p(IDS.BOUBACAR, 'Entrada — Sol. Naturalização',            500,  '2024-09-03');
  await p(IDS.BOUBACAR, '2ª parcela — Sol. Naturalização',          500,  '2024-10-10');
  await p(IDS.BOUBACAR, '3ª parcela (última) — Sol. Naturalização', 500,  '2024-11-10');

  // HERVE ATSINGA
  console.log(`\n[id=${IDS.HERVE}] HERVE ATSINGA`);
  await p(IDS.HERVE, 'Entrada — Naturalização',             500,  '2026-04-06');
  await p(IDS.HERVE, '1ª parcela — Naturalização',          490,  '2026-05-07');
  await p(IDS.HERVE, '2ª parcela — Naturalização',          500,  '2026-06-07');
  await p(IDS.HERVE, '3ª parcela — Naturalização',          500,  '2026-07-07');
  await p(IDS.HERVE, '4ª parcela (última) — Naturalização', 500,  '2026-08-07');

  // JOSIENNE JOSEPH (casal com WILGUERE KENOL id=28)
  console.log(`\n[id=${IDS.JOSIENNE}] JOSIENNE JOSEPH`);
  await p(IDS.JOSIENNE, 'Entrada — Sol. Naturalização',            250,    '2024-02-12');
  await p(IDS.JOSIENNE, '2ª parcela — Sol. Naturalização',          283.34, '2024-02-19');
  await p(IDS.JOSIENNE, '3ª parcela — Sol. Naturalização',          283.34, '2024-03-19');
  await p(IDS.JOSIENNE, '4ª parcela (última) — Sol. Naturalização', 283.33, '2024-04-19');

  // KEDSON PHILIPPE
  console.log(`\n[id=${IDS.KEDSON}] KEDSON PHILIPPE`);
  await p(IDS.KEDSON, 'Entrada — Sol. Naturalização',            500,  '2024-02-01');
  await p(IDS.KEDSON, '2ª parcela — Sol. Naturalização',          250,  '2024-02-16');
  await p(IDS.KEDSON, '3ª parcela — Sol. Naturalização',          500,  '2024-03-03');
  await p(IDS.KEDSON, '4ª parcela (última) — Sol. Naturalização', 500,  '2024-04-03');

  // KENDY JEAN PIERRE (casal — metade R$3.400 ÷ 2 = R$1.700)
  console.log(`\n[id=${IDS.KENDY}] KENDY JEAN PIERRE`);
  await p(IDS.KENDY, 'Entrada — Naturalização',             700,  '2025-05-06');
  await p(IDS.KENDY, '1ª parcela — Naturalização',          250,  '2025-07-05');
  await p(IDS.KENDY, '2ª parcela — Naturalização',          250,  '2025-08-20');
  await p(IDS.KENDY, '3ª parcela — Naturalização',          250,  '2025-09-08');
  await p(IDS.KENDY, '4ª parcela (última) — Naturalização', 250,  '2025-10-10');

  // BERLINE MATHURIN (casal)
  console.log(`\n[id=${IDS.BERLINE}] BERLINE MATHURIN`);
  await p(IDS.BERLINE, 'Entrada — Naturalização',             700,  '2025-05-06');
  await p(IDS.BERLINE, '1ª parcela — Naturalização',          250,  '2025-07-05');
  await p(IDS.BERLINE, '2ª parcela — Naturalização',          250,  '2025-08-20');
  await p(IDS.BERLINE, '3ª parcela — Naturalização',          250,  '2025-09-08');
  await p(IDS.BERLINE, '4ª parcela (última) — Naturalização', 250,  '2025-10-10');

  // KESNEL CHARLES
  console.log(`\n[id=${IDS.KESNEL}] KESNEL CHARLES`);
  await p(IDS.KESNEL, 'Entrada — Naturalização (Provisória)',            400,  '2025-01-31');
  await p(IDS.KESNEL, '2ª parcela — Naturalização (Provisória)',          300,  '2025-02-28');
  await p(IDS.KESNEL, '3ª parcela (última) — Naturalização (Provisória)', 300,  '2025-03-30');

  // NESY VALON
  console.log(`\n[id=${IDS.NESY}] NESY VALON`);
  await p(IDS.NESY, 'Entrada — Naturalização',             1000, '2025-05-20');
  await p(IDS.NESY, '1ª parcela — Naturalização',          610,  '2025-06-20');
  await p(IDS.NESY, '2ª parcela — Naturalização',          610,  '2025-07-20');
  await p(IDS.NESY, '3ª parcela (última) — Naturalização', 610,  '2025-08-20');

  // OLET KENOL
  console.log(`\n[id=${IDS.OLET}] OLET KENOL`);
  await p(IDS.OLET, 'Entrada — Naturalização',             800,  '2024-12-12');
  await p(IDS.OLET, '2ª parcela (última) — Naturalização', 800,  '2025-01-12');

  // ═══════════════════════════════════════════════════════
  console.log('\n\n✅ Processamento concluído!');

  // Resumo
  const [[{ total_clientes }]] = await db.query('SELECT COUNT(*) AS total_clientes FROM clientes WHERE arquivado = 0');
  const [[{ total_parcelas }]] = await db.query('SELECT COUNT(*) AS total_parcelas FROM parcelas');
  console.log(`📊 Total clientes ativos: ${total_clientes}`);
  console.log(`📊 Total parcelas:        ${total_parcelas}`);

  process.exit(0);
}

main().catch(e => {
  console.error('\n❌ Erro fatal:', e.message);
  process.exit(1);
});
