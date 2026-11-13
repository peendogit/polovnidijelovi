// Upiti: "Pitaj za dio" (vozilo / dio / prodavac) i "Pitaj sve otpade" za jedan model
import { app } from '../router.js';
import { all, get, run, tx } from '../db.js';
import { bad, notFound, str, int, rateLimit, vehicleName } from '../lib.js';
import { MODEL_JOIN, MODEL_COLS } from './common.js';

// ---------- zaštita od spama ----------
// telefon u jednom obliku: 065123456 / +38765123456 / 0038765123456 -> 38765123456
export const normPhone = p => {
  let s = String(p || '').replace(/[^\d+]/g, '');
  if (s.startsWith('+')) s = s.slice(1); else if (s.startsWith('00')) s = s.slice(2); else if (s.startsWith('0')) s = '387' + s.slice(1);
  return s;
};
const SPAM_REPORTS_TO_BLOCK = 2; // toliko različitih prodavaca označi "spam" -> broj se blokira

function guard(user, body, ip) {
  // 1) skriveno polje koje ljudi ne vide (popunjavaju ga samo robotski programi)
  if (body.website) return { drop: true };
  // 2) prebrzo popunjeno (manje od 3 sekunde od otvaranja prozora)
  const t = Number(body.t || 0);
  if (!user && t && Date.now() - t < 3000) throw bad('Sačekaj sekundu pa pošalji ponovo.');
  const name = user?.name || str(body.name, 80);
  const phone = user?.phone || (str(body.phone, 30) || '').replace(/[^\d+]/g, '');
  if (!name || name.length < 2) throw bad('Upiši ime');
  const np = normPhone(phone);
  if (np.length < 8 || np.length > 15) throw bad('Upiši ispravan broj telefona da ti se prodavac može javiti');
  const message = str(body.message, 1500);
  if (!message || message.length < 3) throw bad('Napiši poruku (koji dio te zanima)');
  // 3) blokirani broj ili IP
  if (get("SELECT 1 x FROM blocklist WHERE (kind='phone' AND value=?) OR (kind='ip' AND value=?)", np, ip)) {
    throw bad('Slanje upita sa ovog broja nije moguće.');
  }
  if (!user || !user.email_verified) {
    // 4) gosti ne mogu slati linkove (najčešći spam)
    if (/(https?:\/\/|www\.|\.(com|net|org|ru|xyz|top|info|online|site)\b)/i.test(message)) throw bad('Linkovi u poruci nisu dozvoljeni.');
    // 5) najviše 10 upita dnevno sa jednog broja
    const today = get(`SELECT COUNT(*) c FROM inquiries WHERE phone_norm=? AND created_at > datetime('now','-1 day')`, np).c;
    if (today >= 10) throw bad('Sa ovog broja je danas poslano previše upita. Pokušaj sutra ili se registruj.');
  }
  // 6) ista poruka sa istog broja u zadnja 24 sata
  if (get(`SELECT 1 x FROM inquiries WHERE phone_norm=? AND message=? AND created_at > datetime('now','-1 day') LIMIT 1`, np, message)) {
    throw bad('Ovaj upit si već poslao. Prodavac će ti se javiti.');
  }
  return { name, phone, np, message };
}

app.post('/api/inquiries', ({ user, body, ip }) => {
  rateLimit('inq:' + (user?.id || ip), user ? 60 : 10, 3600e3);
  const g = guard(user, body, ip);
  if (g.drop) return { ok: true };
  const { name, phone, np, message } = g;
  let to = null, vehicle_id = null, part_id = null;
  if (body.vehicle_id) {
    const v = get("SELECT id, user_id FROM vehicles WHERE id=? AND status<>'hidden'", int(body.vehicle_id));
    if (!v) throw notFound('Vozilo ne postoji');
    to = v.user_id; vehicle_id = v.id;
  } else if (body.part_id) {
    const p = get("SELECT id, user_id FROM parts WHERE id=? AND status<>'hidden'", int(body.part_id));
    if (!p) throw notFound('Oglas ne postoji');
    to = p.user_id; part_id = p.id;
  } else if (body.to) {
    const u = get('SELECT id FROM users WHERE id=? AND blocked=0', int(body.to));
    if (!u) throw notFound('Prodavac ne postoji');
    to = u.id;
  } else throw bad('Kome šalješ upit?');
  if (user && to === user.id) throw bad('To je tvoj oglas');
  run('INSERT INTO inquiries (to_user_id, from_user_id, name, phone, phone_norm, vehicle_id, part_id, message, ip) VALUES (?,?,?,?,?,?,?,?,?)',
    to, user?.id, name, phone, np, vehicle_id, part_id, message, ip);
  return { ok: true };
});

// Jedan upit svim otpadima koji imaju vozilo tog modela
app.post('/api/inquiries/broadcast', ({ user, body, ip }) => {
  rateLimit('bc:' + (user?.id || ip), user ? 10 : 3, 3600e3);
  const g = guard(user, body, ip);
  if (g.drop) return { ok: true, sent: 1 };
  const { name, phone, np, message } = g;
  const w = ["v.status='active'"]; const a = [];
  if (body.gen) { w.push('v.model_id=?'); a.push(str(body.gen, 60)); }
  else if (body.make && body.model) { w.push('v.model_id IN (SELECT id FROM car_model WHERE make_id=? AND name=?)'); a.push(str(body.make, 60), str(body.model, 80)); }
  else throw bad('Izaberi model');
  // svakom otpadu jedan upit, vezan za jedno njegovo vozilo tog modela
  const targets = all(`SELECT v.user_id, MIN(v.id) vehicle_id FROM vehicles v JOIN users u ON u.id=v.user_id AND u.blocked=0
    WHERE ${w.join(' AND ')} ${user ? 'AND v.user_id<>?' : ''} GROUP BY v.user_id LIMIT 100`, ...a, ...(user ? [user.id] : []));
  if (!targets.length) {
    const own = user && get(`SELECT 1 x FROM vehicles v WHERE ${w.join(' AND ')} AND v.user_id=?`, ...a, user.id);
    throw bad(own ? 'Jedino vozilo ovog modela na sajtu je tvoje — nema drugih otpada kojima bi se poslao upit.'
      : 'Trenutno nijedan otpad nema ovaj model. Objavi „Tražim dio“ pa će ti se javiti kad ga dobiju.');
  }
  tx(() => {
    for (const t of targets) {
      run('INSERT INTO inquiries (to_user_id, from_user_id, name, phone, phone_norm, vehicle_id, message, ip) VALUES (?,?,?,?,?,?,?,?)',
        t.user_id, user?.id, name, phone, np, t.vehicle_id, message, ip);
    }
  });
  return { ok: true, sent: targets.length };
});

app.get('/api/my/inquiries', ({ user }) => {
  const rows = all(`SELECT i.*, p.title part_title, v.year v_year, ${MODEL_COLS}
    FROM inquiries i
    LEFT JOIN parts p ON p.id=i.part_id
    LEFT JOIN vehicles v ON v.id=COALESCE(i.vehicle_id, p.vehicle_id)
    ${MODEL_JOIN('v')}
    WHERE i.to_user_id=? AND i.spam=0 ORDER BY i.id DESC LIMIT 200`, user.id);
  run('UPDATE inquiries SET seen=1 WHERE to_user_id=? AND seen=0', user.id);
  for (const r of rows) { delete r.ip; delete r.phone_norm; }
  return rows.map(r => ({ ...r, vehicle: r.make_name ? vehicleName(r) + (r.v_year ? ` (${r.v_year})` : '') : null }));
}, { auth: true });

app.del('/api/my/inquiries/:id', ({ user, params }) => {
  run('DELETE FROM inquiries WHERE id=? AND to_user_id=?', int(params.id), user.id);
  return { ok: true };
}, { auth: true });

// Prodavac označi upit kao spam: upit nestaje; kad više prodavaca označi isti broj, broj se blokira
app.post('/api/my/inquiries/:id/spam', ({ user, params }) => {
  const i = get('SELECT * FROM inquiries WHERE id=? AND to_user_id=?', int(params.id), user.id);
  if (!i) throw notFound();
  run('UPDATE inquiries SET spam=1, seen=1 WHERE id=?', i.id);
  const np = i.phone_norm || normPhone(i.phone);
  // isti broj, isti prodavac: sakrij i ostale upite
  run('UPDATE inquiries SET spam=1, seen=1 WHERE to_user_id=? AND phone_norm=?', user.id, np);
  const reporters = get("SELECT COUNT(DISTINCT to_user_id) c FROM inquiries WHERE phone_norm=? AND spam=1 AND created_at > datetime('now','-60 days')", np).c;
  let blocked = false;
  if (reporters >= SPAM_REPORTS_TO_BLOCK || user.is_admin) {
    run("INSERT OR IGNORE INTO blocklist (value, kind, reason) VALUES (?, 'phone', ?)", np, `spam — prijavilo ${reporters} prodavaca`);
    blocked = true;
  }
  return { ok: true, blocked };
}, { auth: true });
