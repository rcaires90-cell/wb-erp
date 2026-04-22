const https = require('https');

async function sendEmail(to, subject, html) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) { console.warn('[email] RESEND_API_KEY não configurado'); return; }

  const from = process.env.RESEND_FROM || 'WB Assessoria <onboarding@resend.dev>';

  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ from, to, subject, html });
    const req = https.request({
      hostname: 'api.resend.com',
      path: '/emails',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { data = JSON.parse(data); } catch {}
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log('[email] enviado para', to, '| id:', data?.id);
          resolve(data);
        } else {
          console.error('[email] erro Resend', res.statusCode, data);
          reject(new Error(`Resend ${res.statusCode}: ${JSON.stringify(data)}`));
        }
      });
    });
    req.on('error', (e) => { console.error('[email] erro conexão:', e.message); reject(e); });
    req.write(body);
    req.end();
  });
}

module.exports = { sendEmail };
