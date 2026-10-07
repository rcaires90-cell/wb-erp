// Parser tolerante de extrato OFX (SGML 1.x sem fechamento de tag, ou XML
// 2.x com fechamento) — não usa nenhuma lib externa, só regex. Cobre o que
// os bancos brasileiros exportam na prática: um <STMTTRN> por movimentação,
// com DTPOSTED (data), TRNAMT (valor com sinal), FITID (id único do banco) e
// MEMO/NAME (descrição).

function campo(bloco, tag) {
  const m = bloco.match(new RegExp(`<${tag}>\\s*([^\\r\\n<]*)`, 'i'));
  return m ? m[1].trim() : null;
}

function parseOFX(texto) {
  if (!texto) return [];

  let blocos = texto.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi);
  if (!blocos || !blocos.length) {
    // OFX 1.x (SGML) pode não fechar <STMTTRN> — corta cada bloco no próximo
    // <STMTTRN> (ou fim do texto).
    const partes = texto.split(/<STMTTRN>/i).slice(1);
    blocos = partes.map(p => '<STMTTRN>' + p);
  }

  const transacoes = [];
  for (const bloco of blocos) {
    const dtPosted = campo(bloco, 'DTPOSTED');
    const trnAmt = campo(bloco, 'TRNAMT');
    if (!dtPosted || dtPosted.length < 8 || !trnAmt) continue;

    const data = `${dtPosted.slice(0, 4)}-${dtPosted.slice(4, 6)}-${dtPosted.slice(6, 8)}`;
    const valorNum = parseFloat(trnAmt.replace(',', '.'));
    if (!isFinite(valorNum) || valorNum === 0) continue;

    const memo = campo(bloco, 'MEMO');
    const name = campo(bloco, 'NAME');
    // NAME e MEMO às vezes trazem informação diferente e complementar (ex:
    // NAME="PIX RECEBIDO", MEMO="JOAO DA SILVA") — concatena os dois em vez
    // de descartar um deles, pra descrição bater com o extrato de verdade.
    let descricao;
    if (name && memo && name !== memo) descricao = `${name} - ${memo}`;
    else descricao = name || memo || 'Lançamento OFX';
    descricao = descricao.trim().replace(/\s+/g, ' ');
    const fitid = campo(bloco, 'FITID');

    transacoes.push({
      data,
      valor: Math.abs(valorNum),
      tipo: valorNum < 0 ? 'debito' : 'credito',
      descricao,
      // Nome do extrato, exatamente como o banco mandou no campo NAME do OFX
      // — não passa por nenhuma heurística de limpeza (diferente do import
      // por texto/PDF, aqui o campo já vem estruturado pelo banco).
      nome: name || null,
      fitid: fitid || null,
    });
  }
  return transacoes;
}

module.exports = { parseOFX };
