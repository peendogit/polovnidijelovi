// Vozila za dijelove (otpadi rastavljaju)
import { app } from '../router.js';
import { get, run, all } from '../db.js';
import { COLORS, upper, gearsInt, bad, notFound, str, int, imgList, modelById, normalize, searchWords, rateLimit, FUELS } from '../lib.js';
import { vehicleFilter, MODEL_JOIN, MODEL_COLS, sellerOf, fmtVehicleRow, pageArgs, countAndList } from './common.js';
import { listParts, own } from './parts.js';

const COLS = `v.id, v.year, v.fuel, v.engine, v.engine_code, v.power_kw, v.gearbox, v.gearbox_code, v.gears, v.drive, v.body, v.color, v.color_code, v.city, v.images, v.status, v.created_at, v.user_id,
  v.make_id, v.model_id, v.model_text, v.mileage, u.name seller_name, u.type seller_type, u.verified seller_verified, u.phone seller_phone, ${MODEL_COLS},
  (SELECT COUNT(*) FROM parts p WHERE p.vehicle_id=v.id AND p.status='active') parts_count`;
const FROM = `FROM vehicles v JOIN users u ON u.id=v.user_id AND u.blocked=0 ${MODEL_JOIN('v')}`;

export function listVehicles(q, extraW = [], extraA = []) {
  const [w, a] = vehicleFilter(q, 'v');
  w.unshift("v.status='active'");
  w.push(...extraW); a.push(...extraA);
  if (q.fuel) { w.push('v.fuel=?'); a.push(q.fuel); }
  if (q.city) { w.push('v.city=?'); a.push(q.city); }
  if (q.color) { w.push('v.color=?'); a.push(String(q.color)); }
  if (q.seller) { w.push('v.user_id=?'); a.push(int(q.seller)); }
  if (q.from) { w.push('v.year>=?'); a.push(int(q.from)); }
  if (q.to) { w.push('v.year<=?'); a.push(int(q.to)); }
  if (q.body) { w.push('v.body=?'); a.push(String(q.body)); }
  if (q.drive) { w.push('v.drive=?'); a.push(String(q.drive)); }
  if (q.gearbox === 'automatik') w.push("(v.gearbox LIKE 'automatik%' OR v.gearbox='DSG')");
  else if (q.gearbox === 'manuelni') w.push("v.gearbox LIKE 'manuelni%'");
  if (q.engine) { w.push('v.engine LIKE ?'); a.push(String(q.engine).slice(0, 4) + '%'); }
  for (const word of searchWords(q.q)) { w.push('v.search LIKE ?'); a.push(`%${word}%`); }
  const order = q.sort === 'godiste' ? 'v.year DESC' : q.sort === 'godiste-' ? 'v.year ASC' : 'v.id DESC';
  const { limit, offset, page } = pageArgs(q);
  const r = countAndList(FROM, w, a, order, limit, offset, COLS);
  return { total: r.total, page, limit, items: r.items.map(fmtVehicleRow) };
}

app.get('/api/vehicles', ({ query }) => listVehicles(query));

app.get('/api/vehicles/:id', ({ params, user }) => {
  const v = get(`SELECT v.*, ${MODEL_COLS} FROM vehicles v ${MODEL_JOIN('v')} WHERE v.id=?`, int(params.id));
  const mine = v && user && (v.user_id === user.id || user.is_admin);
  if (!v || (v.status === 'hidden' && !mine)) throw notFound('Vozilo ne postoji ili je uklonjeno');
  if (!mine) run('UPDATE vehicles SET views=views+1 WHERE id=?', v.id);
  const out = fmtVehicleRow(v);
  delete out.search;
  out.seller = sellerOf(v.user_id);
  out.mine = !!mine;
  out.parts = listParts({ vehicle: v.id, limit: 60 }).items;
  out.fav = user ? !!get("SELECT 1 x FROM favorites WHERE user_id=? AND kind='vehicle' AND item_id=?", user.id, v.id) : false;
  out.same_model = v.model_id ? listVehicles({ gen: v.model_id, limit: 6 }, ['v.id<>?'], [v.id]).items : [];
  return out;
});

function readVehicle(body, owner) {
  let make_id = str(body.make_id, 60);
  const m = modelById(str(body.model_id, 60));
  if (body.model_id && !m) throw bad('Nepoznat model');
  if (m) make_id = m.make_id;
  if (!m && !str(body.model_text)) throw bad('Izaberi marku, model i generaciju');
  const year = int(body.year);
  if (year && (year < 1950 || year > new Date().getFullYear() + 1)) throw bad('Provjeri godište');
  const d = {
    make_id, model_id: m ? m.id : null, model_text: str(body.model_text, 80), year,
    fuel: FUELS.includes(body.fuel) ? body.fuel : null, engine: str(body.engine, 40), engine_code: upper(body.engine_code, 20), gearbox_code: upper(body.gearbox_code, 20), gears: gearsInt(body.gears),
    power_kw: int(body.power_kw), gearbox: str(body.gearbox, 30), drive: ['prednji', 'zadnji', '4x4'].includes(body.drive) ? body.drive : null, body: str(body.body, 30), color: COLORS.includes(body.color) ? body.color : null, color_code: upper(body.color_code, 20),
    mileage: int(body.mileage), description: str(body.description, 4000), city: owner.city || null,
    images: imgList(body.images),
  };
  const mk = make_id ? get('SELECT name FROM car_make WHERE id=?', make_id) : null;
  d.search = normalize([mk?.name, m?.name, m?.generation_name, d.model_text, d.engine, d.engine_code, d.gearbox_code, d.color_code, d.description].join(' '));
  return d;
}

app.post('/api/vehicles', ({ user, body }) => {
  rateLimit('post:' + user.id, 300, 3600e3);
  const d = readVehicle(body, user);
  const keys = Object.keys(d);
  const r = run(`INSERT INTO vehicles (user_id, ${keys.join(',')}) VALUES (?, ${keys.map(() => '?').join(',')})`, user.id, ...Object.values(d));
  return { id: Number(r.lastInsertRowid) };
}, { auth: true });

app.put('/api/vehicles/:id', ({ user, body, params }) => {
  const v = own('vehicles', params.id, user);
  const d = readVehicle(body, get('SELECT * FROM users WHERE id=?', v.user_id));
  run(`UPDATE vehicles SET ${Object.keys(d).map(k => k + '=?').join(',')}, updated_at=datetime('now') WHERE id=?`, ...Object.values(d), v.id);
  return { id: v.id };
}, { auth: true });

app.post('/api/vehicles/:id/status', ({ user, body, params }) => {
  const v = own('vehicles', params.id, user);
  if (!['active', 'done', 'hidden'].includes(body.status)) throw bad('Nepoznat status');
  run("UPDATE vehicles SET status=?, updated_at=datetime('now') WHERE id=?", body.status, v.id);
  return { ok: true };
}, { auth: true });

app.del('/api/vehicles/:id', ({ user, params }) => {
  const v = own('vehicles', params.id, user);
  run('DELETE FROM vehicles WHERE id=?', v.id);
  return { ok: true };
}, { auth: true });

app.get('/api/my/vehicles', ({ user, query }) => {
  const w = ['v.user_id=?']; const a = [user.id];
  if (query.status) { w.push('v.status=?'); a.push(query.status); }
  const { limit, offset, page } = pageArgs(query, 60);
  const r = countAndList(`FROM vehicles v JOIN users u ON u.id=v.user_id ${MODEL_JOIN('v')}`, w, a, 'v.id DESC', limit, offset, COLS + ', v.views');
  return { total: r.total, page, limit, items: r.items.map(fmtVehicleRow) };
}, { auth: true });

// Početna: najnovije
app.get('/api/home', () => ({
  parts: listParts({ limit: 8 }).items,
  vehicles: listVehicles({ limit: 6 }).items,
  requests: all(`SELECT r.id, r.part, r.year, r.city, r.created_at, r.model_text, ${MODEL_COLS},
      (SELECT COUNT(*) FROM offers o WHERE o.request_id=r.id) offers
    FROM requests r ${MODEL_JOIN('r')} WHERE r.status='open' ORDER BY r.id DESC LIMIT 5`).map(fmtVehicleRow),
}));

