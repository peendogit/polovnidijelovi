import crypto from 'node:crypto';
import { app } from '../router.js';
import { get, run } from '../db.js';
import { bad, hashPassword, checkPassword, makeToken, sessionCookie, rateLimit, str, bool, CITIES, COLORS } from '../lib.js';

export const PUBLIC_USER = 'id, type, name, phone, viber, whatsapp, city, address, about, logo, ships, verified, created_at';

export function meOut(u) {
  if (!u) return { user: null };
  const counts = {
    inquiries: get('SELECT COUNT(*) c FROM inquiries WHERE to_user_id=? AND seen=0', u.id).c,
    offers: get('SELECT COUNT(*) c FROM offers o JOIN requests r ON r.id=o.request_id WHERE r.user_id=? AND o.seen=0', u.id).c,
    requests: u.type === 'otpad'
      ? get("SELECT COUNT(*) c FROM requests WHERE status='open' AND user_id<>? AND created_at > COALESCE(?, '1970')", u.id, u.seen_requests_at).c
      : 0,
  };
  const { pass_hash, api_key, ...user } = u;
  user.has_api_key = !!api_key;
  return { user, counts };
}

const cleanPhone = p => (str(p, 30) || '').replace(/[^\d+]/g, '');

app.post('/api/auth/register', (ctx) => {
  const { body, ip, secure } = ctx;
  rateLimit('reg:' + ip, 5, 3600e3);
  const name = str(body.name, 80);
  const email = str(body.email, 120)?.toLowerCase();
  const phone = cleanPhone(body.phone);
  const type = body.type === 'otpad' ? 'otpad' : 'privatno';
  if (!name) throw bad(type === 'otpad' ? 'Upiši naziv otpada' : 'Upiši ime');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw bad('Upiši ispravan email');
  if (!phone || phone.length < 6) throw bad('Upiši broj telefona — kupci te zovu na njega');
  if (!body.password || String(body.password).length < 6) throw bad('Lozinka mora imati bar 6 znakova');
  if (get('SELECT 1 x FROM users WHERE email=?', email)) throw bad('Taj email je već registrovan. Prijavi se.');
  const r = run(
    'INSERT INTO users (type, name, email, phone, city, address, viber, whatsapp, pass_hash) VALUES (?,?,?,?,?,?,?,?,?)',
    type, name, email, phone, str(body.city, 60), str(body.address, 150), bool(body.viber ?? 1), bool(body.whatsapp), hashPassword(body.password),
  );
  const id = Number(r.lastInsertRowid);
  // prvi korisnik postaje administrator
  if (get('SELECT COUNT(*) c FROM users').c === 1) run('UPDATE users SET is_admin=1 WHERE id=?', id);
  ctx.setCookie = sessionCookie(makeToken(id), secure);
  return meOut(get('SELECT * FROM users WHERE id=?', id));
});

app.post('/api/auth/login', (ctx) => {
  const { body, ip, secure } = ctx;
  rateLimit('login:' + ip, 10, 15 * 60e3);
  const u = get('SELECT * FROM users WHERE email=?', str(body.email, 120)?.toLowerCase());
  if (!u || !checkPassword(body.password || '', u.pass_hash)) throw bad('Pogrešan email ili lozinka');
  if (u.blocked) throw bad('Nalog je blokiran');
  run("UPDATE users SET last_login=datetime('now') WHERE id=?", u.id);
  ctx.setCookie = sessionCookie(makeToken(u.id), secure);
  return meOut(u);
});

app.post('/api/auth/logout', (ctx) => {
  ctx.setCookie = sessionCookie('', ctx.secure);
  return { ok: true };
});

app.get('/api/me', ({ user }) => meOut(user));

app.put('/api/me', ({ user, body }) => {
  const name = str(body.name, 80);
  if (!name) throw bad('Upiši ime / naziv');
  const phone = cleanPhone(body.phone);
  if (!phone || phone.length < 6) throw bad('Upiši broj telefona');
  run(
    'UPDATE users SET name=?, phone=?, city=?, address=?, about=?, viber=?, whatsapp=?, ships=?, logo=? WHERE id=?',
    name, phone, str(body.city, 60), str(body.address, 150), str(body.about, 2000), bool(body.viber), bool(body.whatsapp), bool(body.ships),
    /^\/uploads\/[\w.-]+$/.test(body.logo || '') ? body.logo : null, user.id,
  );
  return meOut(get('SELECT * FROM users WHERE id=?', user.id));
}, { auth: true });

app.post('/api/me/password', ({ user, body }) => {
  if (!checkPassword(body.old || '', user.pass_hash)) throw bad('Stara lozinka nije tačna');
  if (!body.password || String(body.password).length < 6) throw bad('Nova lozinka mora imati bar 6 znakova');
  run('UPDATE users SET pass_hash=? WHERE id=?', hashPassword(body.password), user.id);
  return { ok: true };
}, { auth: true });

// API ključ za automatsko slanje dijelova (npr. iz programa otpada)
app.post('/api/me/api-key', ({ user }) => {
  if (user.type !== 'otpad') throw bad('API ključ imaju samo otpadi');
  const key = 'pd_' + crypto.randomBytes(24).toString('hex');
  run('UPDATE users SET api_key=? WHERE id=?', key, user.id);
  return { api_key: key };
}, { auth: true });

app.get('/api/meta', () => ({
  cities: CITIES,
  colors: COLORS,
  fuels: ['dizel', 'benzin', 'benzin + plin', 'hibrid', 'električni'],
  stats: {
    parts: get("SELECT COUNT(*) c FROM parts WHERE status='active'").c,
    vehicles: get("SELECT COUNT(*) c FROM vehicles WHERE status='active'").c,
    sellers: get("SELECT COUNT(*) c FROM users WHERE type='otpad' AND blocked=0").c,
  },
}));

