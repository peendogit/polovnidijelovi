// Slanje emailova (Gmail ili bilo koji SMTP). Podešava se u .env:
//   SMTP_HOST=smtp.gmail.com  SMTP_PORT=465  SMTP_USER=tvoj@gmail.com  SMTP_PASS=lozinka-za-aplikaciju
//   MAIL_FROM="polovnidijelovi.com <tvoj@gmail.com>"   SITE_URL=https://polovnidijelovi.com
// Ako SMTP nije podešen, sajt radi i dalje, samo bez potvrde emaila (linkovi se ispisuju u log).
let transport = null;
const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
  try {
    const nodemailer = (await import('nodemailer')).default;
    const port = Number(SMTP_PORT || 465);
    transport = nodemailer.createTransport({ host: SMTP_HOST, port, secure: port === 465, auth: { user: SMTP_USER, pass: SMTP_PASS } });
  } catch (e) {
    console.error('Email nije podešen (fali paket nodemailer — pokreni npm install):', e.message);
  }
}
export const mailEnabled = () => !!transport;
export const SITE_URL = (process.env.SITE_URL || 'https://polovnidijelovi.com').replace(/\/+$/, '');
const FROM = process.env.MAIL_FROM || `polovnidijelovi.com <${SMTP_USER || 'no-reply@polovnidijelovi.com'}>`;

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function layout(title, text, button, link) {
  return `<!doctype html><html><body style="margin:0;background:#F3F3F1;font-family:Arial,sans-serif;color:#1B1E22">
<div style="max-width:520px;margin:0 auto;padding:24px 16px">
<div style="background:#1B1E22;color:#fff;padding:16px 20px;border-radius:10px 10px 0 0;font-size:20px;font-weight:bold">polovni<span style="color:#F5B301">dijelovi</span>.com</div>
<div style="background:#fff;padding:24px 20px;border-radius:0 0 10px 10px">
<h1 style="font-size:22px;margin:0 0 12px">${esc(title)}</h1>
<p style="font-size:16px;line-height:1.5;margin:0 0 20px">${esc(text)}</p>
<a href="${esc(link)}" style="display:inline-block;background:#F5B301;color:#1B1E22;text-decoration:none;font-weight:bold;padding:14px 22px;border-radius:8px;font-size:16px">${esc(button)}</a>
<p style="font-size:13px;color:#5A616B;margin:20px 0 0">Ako dugme ne radi, otvori ovaj link:<br><a href="${esc(link)}" style="color:#5A616B;word-break:break-all">${esc(link)}</a></p>
<p style="font-size:13px;color:#5A616B;margin:16px 0 0">Ako ti nisi tražio ovaj email, samo ga zanemari.</p>
</div></div></body></html>`;
}

export async function sendMail(to, subject, title, text, button, link) {
  if (!transport) { console.log(`[email nije podešen] ${to}: ${subject} -> ${link}`); return false; }
  try {
    await transport.sendMail({ from: FROM, to, subject, text: `${text}\n\n${link}\n\nAko ti nisi tražio ovaj email, samo ga zanemari.`, html: layout(title, text, button, link) });
    return true;
  } catch (e) {
    console.error('Slanje emaila nije uspjelo:', to, e.message);
    return false;
  }
}
