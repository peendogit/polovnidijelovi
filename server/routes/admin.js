// Administracija: korisnici, provjereni otpadi, prijave, novi modeli
import crypto from 'node:crypto';
import { app } from '../router.js';
import { all, get, run } from '../db.js';
import { bad, notFound, str, int, bool, genLabel, hashPassword } from '../lib.js';
import { clearCatalogCache } from './catalog.js';
import { normPhone } from './inquiries.js';

const A = { auth: true, admin: true };

app.get('/api/admin/stats', () => ({
  users: get('SELECT COUNT(*) c FROM users').c,
  otpadi: get("SELECT COUNT(*) c FROM users WHERE type='otpad'").c,
  parts: get("SELECT COUNT(*) c FROM parts WHERE status='active'").c,
  vehicles: get("SELECT COUNT(*) c FROM vehicles WHERE status='active'").c,
  requests: get("SELECT COUNT(*) c FROM requests WHERE status='open'").c,
  offers: get('SELECT COUNT(*) c FROM offers').c,
  inquiries: get("SELECT COUNT(*) c FROM inquiries WHERE created_at > datetime('now','-30 days')").c,
  spam_blocked: get('SELECT COUNT(*) c FROM blocklist').c,
  new_users_7d: get("SELECT COUNT(*) c FROM users WHERE created_at > datetime('now','-7 days')").c,
  reports: get("SELECT COUNT(*) c FROM reports WHERE status='new'").c,
  suggestions: get("SELECT COUNT(*) c FROM model_suggestions WHERE status='new'").c,
}), A);

app.get('/api/admin/users', ({ query }) => {
  const w = []; const a = [];
  if (query.q) { w.push('(name LIKE ? OR email LIKE ? OR phone LIKE ?)'); a.push(`%${query.q}%`, `%${query.q}%`, `%${query.q}%`); }
  if (query.type) { w.push('type=?'); a.push(query.type); }
  return all(`SELECT id, type, name, email, phone, city, verified, is_admin, blocked, created_at, last_login,
      (SELECT COUNT(*) FROM parts p WHERE p.user_id=users.id) parts,
      (SELECT COUNT(*) FROM vehicles v WHERE v.user_id=users.id) vehicles
    FROM users ${w.length ? 'WHERE ' + w.join(' AND ') : ''} ORDER BY id DESC LIMIT 300`, ...a);
}, A);

app.post('/api/admin/users/:id', ({ params, body, user }) => {
  const u = get('SELECT * FROM users WHERE id=?', int(params.id));
  if (!u) throw notFound();
  const set = {};
  for (const k of ['verified', 'blocked', 'is_admin']) if (body[k] !== undefined) set[k] = bool(body[k]);
  if (body.type) set.type = body.type === 'otpad' ? 'otpad' : 'privatno';
  if (u.id === user.id && (set.blocked || set.is_admin === 0)) throw bad('Ne možeš to sebi');
  if (Object.keys(set).length) run(`UPDATE users SET ${Object.keys(set).map(k => k + '=?').join(',')} WHERE id=?`, ...Object.values(set), u.id);
  return { ok: true };
}, A);

// Admin postavi novu lozinku korisniku (kad zaboravi)
app.post('/api/admin/users/:id/password', ({ params }) => {
  const pw = crypto.randomBytes(6).toString('hex');
  run('UPDATE users SET pass_hash=? WHERE id=?', hashPassword(pw), int(params.id));
  return { password: pw };
}, A);

app.get('/api/admin/reports', () => all(`SELECT r.*, u.name user_name FROM reports r LEFT JOIN users u ON u.id=r.user_id
  WHERE r.status='new' ORDER BY r.id DESC LIMIT 200`), A);
app.post('/api/admin/reports/:id', ({ params }) => { run("UPDATE reports SET status='done' WHERE id=?", int(params.id)); return { ok: true }; }, A);

// ---------- modeli ----------
app.get('/api/admin/suggestions', () => all(`SELECT s.*, k.name make_name, u.name user_name FROM model_suggestions s
  LEFT JOIN car_make k ON k.id=s.make_id LEFT JOIN users u ON u.id=s.user_id WHERE s.status='new' ORDER BY s.id DESC`), A);

app.post('/api/admin/suggestions/:id', ({ params, body }) => {
  run('UPDATE model_suggestions SET status=? WHERE id=?', body.status === 'done' ? 'done' : 'rejected', int(params.id));
  return { ok: true };
}, A);

app.post('/api/admin/makes', ({ body }) => {
  const name = str(body.name, 60);
  if (!name) throw bad('Upiši naziv marke');
  if (get('SELECT 1 x FROM car_make WHERE name=? COLLATE NOCASE', name)) throw bad('Marka već postoji');
  const id = crypto.randomUUID();
  run('INSERT INTO car_make (id, name, popular) VALUES (?,?,?)', id, name, bool(body.popular));
  clearCatalogCache();
  return { id };
}, A);

// Novi model / generacija / facelift
app.post('/api/admin/models', ({ body }) => {
  const make_id = str(body.make_id, 60);
  if (!get('SELECT 1 x FROM car_make WHERE id=?', make_id)) throw bad('Izaberi marku');
  const name = str(body.name, 80);
  if (!name) throw bad('Upiši naziv modela (npr. Golf 8)');
  const from = int(body.from), to = int(body.to);
  if (!from) throw bad('Upiši godinu od');
  const facelift = int(body.facelift) || 0;
  const id = crypto.randomUUID();
  run(`INSERT INTO car_model (id, make_id, name, generation_name, restyling, restyling_second, date_from, date_to)
    VALUES (?,?,?,?,?,?,?,?)`, id, make_id, name, str(body.generation_name, 30), facelift >= 1 ? 1 : 0, facelift >= 2 ? 1 : 0,
  `${from}-01`, to ? `${to}-12` : null);
  if (body.suggestion_id) run("UPDATE model_suggestions SET status='done' WHERE id=?", int(body.suggestion_id));
  clearCatalogCache();
  return { id, label: genLabel(get('SELECT * FROM car_model WHERE id=?', id)) };
}, A);

app.put('/api/admin/models/:id', ({ params, body }) => {
  const m = get('SELECT * FROM car_model WHERE id=?', params.id);
  if (!m) throw notFound();
  const from = int(body.from), to = int(body.to);
  run('UPDATE car_model SET name=?, generation_name=?, date_from=?, date_to=?, active=? WHERE id=?',
    str(body.name, 80) || m.name, str(body.generation_name, 30), from ? `${from}-01` : m.date_from, to ? `${to}-12` : null,
    body.active === undefined ? m.active : bool(body.active), m.id);
  clearCatalogCache();
  return { ok: true };
}, A);

// ---------- spam: blokirani brojevi i IP adrese ----------
app.get('/api/admin/blocklist', () => ({
  blocked: all('SELECT * FROM blocklist ORDER BY created_at DESC LIMIT 500'),
  // brojevi koje je neko označio kao spam, a još nisu blokirani
  reported: all(`SELECT phone_norm, MAX(phone) phone, MAX(name) name, COUNT(DISTINCT to_user_id) reporters, COUNT(*) msgs, MAX(created_at) last
    FROM inquiries WHERE spam=1 AND phone_norm NOT IN (SELECT value FROM blocklist WHERE kind='phone')
    GROUP BY phone_norm ORDER BY last DESC LIMIT 100`),
  // najaktivniji pošiljaoci u zadnja 24 sata
  busiest: all(`SELECT phone_norm, MAX(phone) phone, MAX(name) name, COUNT(*) msgs, COUNT(DISTINCT ip) ips FROM inquiries
    WHERE created_at > datetime('now','-1 day') GROUP BY phone_norm HAVING msgs >= 5 ORDER BY msgs DESC LIMIT 30`),
}), A);

app.post('/api/admin/blocklist', ({ body }) => {
  const kind = body.kind === 'ip' ? 'ip' : 'phone';
  let value = str(body.value, 60);
  if (!value) throw bad('Upiši broj ili IP');
  if (kind === 'phone') value = normPhone(value);
  run('INSERT OR IGNORE INTO blocklist (value, kind, reason) VALUES (?,?,?)', value, kind, str(body.reason, 200) || 'ručno');
  run("UPDATE inquiries SET spam=1 WHERE phone_norm=? AND created_at > datetime('now','-7 days')", value);
  return { ok: true };
}, A);

app.del('/api/admin/blocklist/:value', ({ params }) => {
  run('DELETE FROM blocklist WHERE value=?', params.value);
  return { ok: true };
}, A);
