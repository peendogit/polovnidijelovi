// Upiti: "Pitaj za dio" (vozilo / dio / prodavac) i "Pitaj sve otpade" za jedan model
import { app } from '../router.js';
import { all, get, run, tx } from '../db.js';
import { bad, notFound, str, int, rateLimit, vehicleName } from '../lib.js';
import { MODEL_JOIN, MODEL_COLS } from './common.js';

function sender(user, body) {
  const name = user?.name || str(body.name, 80);
  const phone = user?.phone || (str(body.phone, 30) || '').replace(/[^\d+]/g, '');
  if (!name) throw bad('Upiši ime');
  if (!phone || phone.length < 6) throw bad('Upiši broj telefona da ti se prodavac može javiti');
  return { name, phone };
}

app.post('/api/inquiries', ({ user, body, ip }) => {
  rateLimit('inq:' + (user?.id || ip), user ? 60 : 15, 3600e3);
  const message = str(body.message, 1500);
  if (!message) throw bad('Napiši poruku (koji dio te zanima)');
  const { name, phone } = sender(user, body);
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
  run('INSERT INTO inquiries (to_user_id, from_user_id, name, phone, vehicle_id, part_id, message) VALUES (?,?,?,?,?,?,?)',
    to, user?.id, name, phone, vehicle_id, part_id, message);
  return { ok: true };
});

// Jedan upit svim otpadima koji imaju vozilo tog modela
app.post('/api/inquiries/broadcast', ({ user, body, ip }) => {
  rateLimit('bc:' + (user?.id || ip), user ? 10 : 3, 3600e3);
  const message = str(body.message, 1500);
  if (!message) throw bad('Napiši koji dio tražiš');
  const { name, phone } = sender(user, body);
  const w = ["v.status='active'"]; const a = [];
  if (body.gen) { w.push('v.model_id=?'); a.push(str(body.gen, 60)); }
  else if (body.make && body.model) { w.push('v.model_id IN (SELECT id FROM car_model WHERE make_id=? AND name=?)'); a.push(str(body.make, 60), str(body.model, 80)); }
  else throw bad('Izaberi model');
  // svakom otpadu jedan upit, vezan za jedno njegovo vozilo tog modela
  const targets = all(`SELECT v.user_id, MIN(v.id) vehicle_id FROM vehicles v JOIN users u ON u.id=v.user_id AND u.blocked=0
    WHERE ${w.join(' AND ')} ${user ? 'AND v.user_id<>?' : ''} GROUP BY v.user_id LIMIT 100`, ...a, ...(user ? [user.id] : []));
  if (!targets.length) throw bad('Trenutno nijedan otpad nema ovaj model. Objavi „Tražim dio“ pa će ti se javiti kad ga dobiju.');
  tx(() => {
    for (const t of targets) {
      run('INSERT INTO inquiries (to_user_id, from_user_id, name, phone, vehicle_id, message) VALUES (?,?,?,?,?,?)',
        t.user_id, user?.id, name, phone, t.vehicle_id, message);
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
    WHERE i.to_user_id=? ORDER BY i.id DESC LIMIT 200`, user.id);
  run('UPDATE inquiries SET seen=1 WHERE to_user_id=? AND seen=0', user.id);
  return rows.map(r => ({ ...r, vehicle: r.make_name ? vehicleName(r) + (r.v_year ? ` (${r.v_year})` : '') : null }));
}, { auth: true });

app.del('/api/my/inquiries/:id', ({ user, params }) => {
  run('DELETE FROM inquiries WHERE id=? AND to_user_id=?', int(params.id), user.id);
  return { ok: true };
}, { auth: true });
