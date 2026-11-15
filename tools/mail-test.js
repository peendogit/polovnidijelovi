// Proba slanja emaila:  node --no-warnings tools/mail-test.js tvoj@email.com
import '../server/env.js';
const to = process.argv[2];
if (!to) { console.log('Upiši email: node --no-warnings tools/mail-test.js tvoj@email.com'); process.exit(1); }
const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM } = process.env;
console.log('SMTP_HOST:', SMTP_HOST || '(nema)', '| SMTP_PORT:', SMTP_PORT || '(nema)', '| SMTP_USER:', SMTP_USER || '(nema)', '| SMTP_PASS:', SMTP_PASS ? 'upisan (' + SMTP_PASS.length + ' znakova)' : '(nema)', '| MAIL_FROM:', MAIL_FROM || '(nema)');
if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) { console.log('Fali nešto od SMTP_HOST / SMTP_USER / SMTP_PASS u .env'); process.exit(1); }
const nodemailer = (await import('nodemailer')).default;
const port = Number(SMTP_PORT || 587);
const t = nodemailer.createTransport({ host: SMTP_HOST, port, secure: port === 465, auth: { user: SMTP_USER, pass: SMTP_PASS } });
try {
  await t.verify();
  console.log('✅ Prijava na SMTP server uspjela.');
  const r = await t.sendMail({ from: MAIL_FROM || SMTP_USER, to, subject: 'Proba — polovnidijelovi.com', text: 'Ako vidiš ovaj email, slanje radi. 👍' });
  console.log('✅ Email poslan na', to, '—', r.response);
  console.log('Ako ne stigne za par minuta, pogledaj Spam/Neželjeno.');
} catch (e) {
  console.log('❌ Greška:', e.message);
  if (/auth|535|credentials/i.test(e.message)) console.log('→ Pogrešan SMTP_USER ili SMTP_PASS (u Brevo: SMTP & API → SMTP → login i SMTP ključ).');
  if (/sender|from|not.*valid|unauthori[sz]ed/i.test(e.message)) console.log('→ Adresa u MAIL_FROM nije potvrđena u Brevo (Senders, domains → domen mora biti Authenticated).');
}
