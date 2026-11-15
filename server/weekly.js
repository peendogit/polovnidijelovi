// Sedmični izvještaj adminu emailom (svakog ponedjeljka ujutro).
// Usput drži Brevo SMTP ključ aktivnim (ključ se gasi ako se dugo ne koristi),
// a ako slanje ne uspije, javi na Telegram da se provjeri ključ.
import { all, get, setting, setSetting } from './db.js';
import { sendMail, mailEnabled, SITE_URL } from './mail.js';
import { telegram } from './telegram.js';
import { demand } from './demand.js';

const n = sql => get(sql).c;
export function report() {
  const w = "datetime('now','-7 days')";
  const lines = [
    `Novi korisnici: ${n(`SELECT COUNT(*) c FROM users WHERE type<>'gost' AND created_at > ${w}`)} (otpada: ${n(`SELECT COUNT(*) c FROM users WHERE type='otpad' AND created_at > ${w}`)})`,
    `Novi dijelovi: ${n(`SELECT COUNT(*) c FROM parts WHERE created_at > ${w}`)} · aktivnih ukupno: ${n("SELECT COUNT(*) c FROM parts WHERE status='active'")}`,
    `Nova vozila: ${n(`SELECT COUNT(*) c FROM vehicles WHERE created_at > ${w}`)} · aktivnih ukupno: ${n("SELECT COUNT(*) c FROM vehicles WHERE status='active'")}`,
    `"Tražim dio" zahtjeva: ${n(`SELECT COUNT(*) c FROM requests WHERE created_at > ${w}`)} · ponuda: ${n(`SELECT COUNT(*) c FROM offers WHERE created_at > ${w}`)}`,
    `Upita prodavcima: ${n(`SELECT COUNT(*) c FROM inquiries WHERE created_at > ${w} AND spam=0`)}`,
    `Pretraga dijelova: ${n(`SELECT COUNT(*) c FROM search_log WHERE created_at > ${w}`)}`,
  ];
  const d = demand(7);
  if (d.top.length) lines.push('', 'NAJTRAŽENIJE (dio — vozilo):', ...d.top.slice(0, 10).map((o, i) => `${i + 1}. ${o.part} — ${o.vehicle}: ${o.n}×${o.none ? ` (${o.none}× nije nađeno)` : ''}`));
  if (d.missing.length) lines.push('', 'TRAŽENO, A NEMA NA SAJTU:', ...d.missing.slice(0, 7).map(o => `• ${o.part}${o.vehicle ? ' — ' + o.vehicle : ''}: ${o.none}×`));
  if (d.vehicles.length) lines.push('', 'NAJTRAŽENIJA VOZILA:', ...d.vehicles.slice(0, 5).map((v, i) => `${i + 1}. ${v.vehicle}: ${v.n}×`));
  const owed = get("SELECT COALESCE(SUM(price),0) s, COUNT(*) c FROM featured_requests WHERE status='done' AND paid=0");
  const waiting = n("SELECT COUNT(*) c FROM featured_requests WHERE status='new'");
  lines.push('', `Isticanje: ${waiting} zahtjeva čeka · dug ${owed.s} KM (${owed.c})`);
  const reports = n("SELECT COUNT(*) c FROM reports WHERE status='new'");
  if (reports) lines.push(`Prijavljenih oglasa za pregled: ${reports}`);
  return lines.join('\n');
}

export async function sendWeekly(force = false) {
  if (!mailEnabled()) return false;
  const last = Number(setting('weekly_report_at', '0'));
  if (!force && Date.now() - last < 6.5 * 864e5) return false;
  const admins = all('SELECT email FROM users WHERE is_admin=1 AND blocked=0');
  let ok = false;
  for (const a of admins) ok = (await sendMail(a.email, 'Sedmični izvještaj — polovnidijelovi.com', 'Prošlih 7 dana', report(), 'Otvori administraciju', `${SITE_URL}/admin`)) || ok;
  if (ok) setSetting('weekly_report_at', String(Date.now()));
  else {
    // ne spamaj Telegram: najviše jednom dnevno
    const warned = Number(setting('mail_fail_warned', '0'));
    if (Date.now() - warned > 864e5) {
      setSetting('mail_fail_warned', String(Date.now()));
      telegram('⚠️ polovnidijelovi.com: slanje emaila NE RADI.\nVjerovatno je Brevo SMTP ključ istekao ili ugašen. Napravi novi u Brevo (SMTP & API → SMTP) i zamijeni SMTP_PASS u .env, pa pm2 restart polovnidijelovi.');
    }
  }
  return ok;
}

// provjera svakih sat; šalje ponedjeljkom poslije 7h (po našem vremenu), jednom sedmično
setInterval(() => {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Sarajevo' }));
  if (now.getDay() === 1 && now.getHours() >= 7) sendWeekly().catch(e => console.error('sedmični izvještaj', e.message));
}, 3600e3).unref();
