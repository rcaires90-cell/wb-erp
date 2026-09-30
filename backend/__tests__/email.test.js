jest.mock('https');
const https = require('https');
const { sendEmail } = require('../lib/email');

function mockHttpsSuccess(responseBody) {
  https.request.mockImplementation((options, callback) => {
    const res = {
      statusCode: 200,
      on: (event, handler) => {
        if (event === 'data') handler(Buffer.from(JSON.stringify(responseBody)));
        if (event === 'end') handler();
      },
    };
    callback(res);
    return { on: jest.fn(), write: jest.fn(), end: jest.fn() };
  });
}

describe('sendEmail', () => {
  const OLD_KEY = process.env.RESEND_API_KEY;
  beforeEach(() => {
    https.request.mockClear();
    process.env.RESEND_API_KEY = 'fake-key';
  });
  afterAll(() => { process.env.RESEND_API_KEY = OLD_KEY; });

  test('sem anexo: payload não tem campo attachments', async () => {
    mockHttpsSuccess({ id: 'x' });
    await sendEmail('a@b.com', 'Assunto', '<p>oi</p>');

    const reqWriteArg = https.request.mock.results[0].value.write.mock.calls[0][0];
    const payload = JSON.parse(reqWriteArg);
    expect(payload.attachments).toBeUndefined();
    expect(payload.to).toBe('a@b.com');
  });

  test('com anexo em texto puro: converte pra base64 automaticamente', async () => {
    mockHttpsSuccess({ id: 'x' });
    const conteudoOriginal = JSON.stringify({ ok: true, valor: 'çã é' });

    await sendEmail('a@b.com', 'Assunto', '<p>oi</p>', [
      { filename: 'backup.json', content: conteudoOriginal },
    ]);

    const reqWriteArg = https.request.mock.results[0].value.write.mock.calls[0][0];
    const payload = JSON.parse(reqWriteArg);
    expect(payload.attachments).toHaveLength(1);
    expect(payload.attachments[0].filename).toBe('backup.json');
    const decodificado = Buffer.from(payload.attachments[0].content, 'base64').toString('utf-8');
    expect(decodificado).toBe(conteudoOriginal);
  });

  test('sem RESEND_API_KEY configurado: não tenta chamar a API', async () => {
    process.env.RESEND_API_KEY = '';
    await sendEmail('a@b.com', 'Assunto', '<p>oi</p>');
    expect(https.request).not.toHaveBeenCalled();
  });
});
