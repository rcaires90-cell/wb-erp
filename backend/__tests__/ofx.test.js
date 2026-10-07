const { parseOFX } = require('../lib/ofx');

const OFX_COM_FECHAMENTO = `
<OFX>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20261001120000[-3:BRT]
<TRNAMT>1400.00
<FITID>20261001001
<NAME>JOAO DA SILVA
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20261005090000[-3:BRT]
<TRNAMT>-250.00
<FITID>20261005001
<MEMO>PAGAMENTO CERTIDAO
</STMTTRN>
</BANKTRANLIST>
</OFX>`;

// OFX 1.x (SGML) sem fechamento de </STMTTRN>
const OFX_SEM_FECHAMENTO = `
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20261002000000
<TRNAMT>500.00
<FITID>abc123
<NAME>MARIA SOUZA
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20261003000000
<TRNAMT>-100.00
<FITID>abc124
<MEMO>TAXA BANCARIA
</BANKTRANLIST>`;

describe('parseOFX', () => {
  test('extrai transações de OFX com tags fechadas', () => {
    const t = parseOFX(OFX_COM_FECHAMENTO);
    expect(t).toHaveLength(2);
    expect(t[0]).toEqual({ data: '2026-10-01', valor: 1400, tipo: 'credito', descricao: 'JOAO DA SILVA', fitid: '20261001001' });
    expect(t[1]).toEqual({ data: '2026-10-05', valor: 250, tipo: 'debito', descricao: 'PAGAMENTO CERTIDAO', fitid: '20261005001' });
  });

  test('extrai transações de OFX SGML sem fechamento de tag', () => {
    const t = parseOFX(OFX_SEM_FECHAMENTO);
    expect(t).toHaveLength(2);
    expect(t[0].tipo).toBe('credito');
    expect(t[0].valor).toBe(500);
    expect(t[1].tipo).toBe('debito');
    expect(t[1].valor).toBe(100);
  });

  test('prefere MEMO sobre NAME quando ambos existem', () => {
    const t = parseOFX(`<STMTTRN><DTPOSTED>20261001</DTPOSTED><TRNAMT>10.00</TRNAMT><NAME>FULANO</NAME><MEMO>DESCRICAO REAL</MEMO></STMTTRN>`);
    expect(t[0].descricao).toBe('DESCRICAO REAL');
  });

  test('ignora bloco sem data ou sem valor', () => {
    const t = parseOFX(`<STMTTRN><FITID>x</FITID><NAME>SEM DATA NEM VALOR</NAME></STMTTRN>`);
    expect(t).toHaveLength(0);
  });

  test('ignora valor zero', () => {
    const t = parseOFX(`<STMTTRN><DTPOSTED>20261001</DTPOSTED><TRNAMT>0.00</TRNAMT></STMTTRN>`);
    expect(t).toHaveLength(0);
  });

  test('string vazia ou nula não quebra', () => {
    expect(parseOFX('')).toEqual([]);
    expect(parseOFX(null)).toEqual([]);
  });
});
