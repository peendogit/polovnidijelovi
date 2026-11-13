import crypto from 'node:crypto';
import { app } from '../router.js';
import { get, run } from '../db.js';
import { sendMail, mailEnabled, SITE_URL } from '../mail.js';
import { bad, hashPassword, checkPassword, makeToken, sessionCookie, rateLimit, str, bool, CITIES, COLORS } from '../lib.js';

export const PUBLIC_USER = 'id, type, name, phone, viber, whatsapp, city, address, about, logo, ships, verified, created_at';

export function meOut(u) {
  if (!u) return { user: null };
  const counts = {
    inquiries: get('SELECT COUNT(*) c FROM inquiries WHERE to_user_id=? AND seen=0 AND spam=0', u.id).c,
    offers: get('SELECT COUNT(*) c FROM offers o JOIN requests r ON r.id=o.request_id WHERE r.user_id=? AND o.seen=0', u.id).c,
    requests: u.type === 'otpad'
      ? get("SELECT COUNT(*) c FROM requests WHERE status='open' AND user_id<>? AND created_at > COALESCE(?, '1970')", u.id, u.seen_requests_at).c
      : 0,
  };
  const { pass_hash, api_key, ...user } = u;
  user.has_api_key = !!api_key;
  user.mail_enabled = mailEnabled();
  return { user, counts };
}

// ---------- jednokratni linkovi ----------
function newToken(userId, kind, hours) {
  run('DELETE FROM tokens WHERE user_id=? AND kind=?', userId, kind);
  run('DELETE FROM tokens WHERE expires_at < ?', Date.now());
  const t = crypto.randomBytes(24).toString('base64url');
  run('INSERT INTO tokens (token, user_id, kind, expires_at) VALUES (?,?,?,?)', t, userId, kind, Date.now() + hours * 3600e3);
  return t;
}
function useToken(t, kind) {
  const row = t && get('SELECT * FROM tokens WHERE token=? AND kind=?', String(t), kind);
  if (!row || row.expires_at < Date.now()) throw bad(kind === 'verify' ? 'Link za potvrdu je istekao ili je već iskorišten. Pošalji novi iz profila.' : 'Link je istekao ili je već iskorišten. Zatraži novi.');
  run('DELETE FROM tokens WHERE token=?', row.token);
  return get('SELECT * FROM users WHERE id=?', row.user_id);
}
function sendVerify(u) {
  const t = newToken(u.id, 'verify', 72);
  return sendMail(u.email, 'Potvrdi email — polovnidijelovi.com', 'Potvrdi svoj email',
    `Zdravo ${u.name}, klikni dugme ispod da potvrdiš email. Nakon toga možeš objavljivati oglase.`, 'Potvrdi email', `${SITE_URL}/potvrdi/${t}`);
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
  if (String(body.password).length > 200) throw bad('Lozinka je preduga');
  if (get('SELECT 1 x FROM users WHERE email=?', email)) throw bad('Taj email je već registrovan. Prijavi se.');
  const r = run(
    'INSERT INTO users (type, name, email, phone, city, address, viber, whatsapp, pass_hash, email_verified) VALUES (?,?,?,?,?,?,?,?,?,?)',
    type, name, email, phone, str(body.city, 60), str(body.address, 150), bool(body.viber ?? 1), bool(body.whatsapp), hashPassword(body.password),
    mailEnabled() ? 0 : 1,
  );
  const id = Number(r.lastInsertRowid);
  // prvi korisnik postaje administrator
  if (get('SELECT COUNT(*) c FROM users').c === 1) run('UPDATE users SET is_admin=1 WHERE id=?', id);
  const nu = get('SELECT * FROM users WHERE id=?', id);
  if (!nu.email_verified) sendVerify(nu);
  ctx.setCookie = sessionCookie(makeToken(nu), secure);
  return meOut(nu);
});

app.post('/api/auth/login', (ctx) => {
  const { body, ip, secure } = ctx;
  rateLimit('login:' + ip, 10, 15 * 60e3);
  const email = str(body.email, 120)?.toLowerCase();
  rateLimit('login-acc:' + email, 15, 30 * 60e3); // i po nalogu, da se lozinka ne pogađa sa više adresa
  const u = get('SELECT * FROM users WHERE email=?', email);
  if (!u || !checkPassword(body.password || '', u.pass_hash)) throw bad('Pogrešan email ili lozinka');
  if (u.blocked) throw bad('Nalog je blokiran');
  run("UPDATE users SET last_login=datetime('now') WHERE id=?", u.id);
  ctx.setCookie = sessionCookie(makeToken(u), secure);
  return meOut(u);
});

app.post('/api/auth/logout', (ctx) => {
  ctx.setCookie = sessionCookie('', ctx.secure);
  return { ok: true };
});

app.get('/api/me', ({ user }) => meOut(user));

// ---------- potvrda emaila ----------
app.post('/api/auth/verify-send', async ({ user }) => {
  if (user.email_verified) return { ok: true, already: true };
  rateLimit('vsend:' + user.id, 4, 3600e3);
  if (!await sendVerify(user)) throw bad('Email trenutno ne može biti poslan. Pokušaj kasnije.');
  return { ok: true, email: user.email };
}, { auth: true });

app.post('/api/auth/verify', (ctx) => {
  rateLimit('verify:' + ctx.ip, 30, 3600e3);
  const u = useToken(ctx.body.token, 'verify');
  run('UPDATE users SET email_verified=1 WHERE id=?', u.id);
  const fresh = get('SELECT * FROM users WHERE id=?', u.id);
  ctx.setCookie = sessionCookie(makeToken(fresh), ctx.secure);
  return meOut(fresh);
});

// promjena emaila (npr. pogrešno upisan) — šalje novu potvrdu
app.post('/api/me/email', ({ user, body }) => {
  rateLimit('email:' + user.id, 5, 3600e3);
  if (!checkPassword(body.password || '', user.pass_hash)) throw bad('Lozinka nije tačna');
  const email = str(body.email, 120)?.toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw bad('Upiši ispravan email');
  if (get('SELECT 1 x FROM users WHERE email=? AND id<>?', email, user.id)) throw bad('Taj email koristi drugi nalog');
  run('UPDATE users SET email=?, email_verified=? WHERE id=?', email, mailEnabled() ? 0 : 1, user.id);
  const u = get('SELECT * FROM users WHERE id=?', user.id);
  if (!u.email_verified) sendVerify(u);
  return meOut(u);
}, { auth: true });

// ---------- zaboravljena lozinka ----------
app.post('/api/auth/forgot', async ({ body, ip }) => {
  rateLimit('forgot:' + ip, 5, 3600e3);
  const email = str(body.email, 120)?.toLowerCase();
  if (!email) throw bad('Upiši email');
  rateLimit('forgot-acc:' + email, 3, 3600e3);
  if (!mailEnabled()) throw bad('Slanje emaila još nije uključeno. Javi se administratoru sajta.');
  const u = get('SELECT * FROM users WHERE email=? AND blocked=0', email);
  if (u) {
    const t = newToken(u.id, 'reset', 1);
    await sendMail(u.email, 'Nova lozinka — polovnidijelovi.com', 'Postavi novu lozinku',
      `Zdravo ${u.name}, neko (vjerovatno ti) je tražio novu lozinku. Link važi 1 sat.`, 'Postavi novu lozinku', `${SITE_URL}/nova-lozinka/${t}`);
  }
  return { ok: true }; // isti odgovor i kad email ne postoji (da se ne može provjeravati ko je registrovan)
});

app.post('/api/auth/reset', (ctx) => {
  const { body, ip } = ctx;
  rateLimit('reset:' + ip, 10, 3600e3);
  if (!body.password || String(body.password).length < 6) throw bad('Lozinka mora imati bar 6 znakova');
  if (String(body.password).length > 200) throw bad('Lozinka je preduga');
  const u = useToken(body.token, 'reset');
  // link je stigao na email, pa je i email time potvrđen
  run('UPDATE users SET pass_hash=?, email_verified=1 WHERE id=?', hashPassword(body.password), u.id);
  run("DELETE FROM tokens WHERE user_id=? AND kind='reset'", u.id);
  const fresh = get('SELECT * FROM users WHERE id=?', u.id);
  ctx.setCookie = sessionCookie(makeToken(fresh), ctx.secure);
  return meOut(fresh);
});

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
  // lokacija oglasa je uvijek lokacija iz profila
  const city = str(body.city, 60);
  if (city !== user.city) {
    run('UPDATE parts SET city=? WHERE user_id=?', city, user.id);
    run('UPDATE vehicles SET city=? WHERE user_id=?', city, user.id);
  }
  return meOut(get('SELECT * FROM users WHERE id=?', user.id));
}, { auth: true });

app.post('/api/me/password', (ctx) => {
  const { user, body } = ctx;
  rateLimit('pw:' + user.id, 8, 15 * 60e3);
  if (!checkPassword(body.old || '', user.pass_hash)) throw bad('Stara lozinka nije tačna');
  if (!body.password || String(body.password).length < 6) throw bad('Nova lozinka mora imati bar 6 znakova');
  run('UPDATE users SET pass_hash=? WHERE id=?', hashPassword(body.password), user.id);
  // stare prijave (drugi uređaji) prestaju važiti; ovaj uređaj dobija novu
  ctx.setCookie = sessionCookie(makeToken(get('SELECT * FROM users WHERE id=?', user.id)), ctx.secure);
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

