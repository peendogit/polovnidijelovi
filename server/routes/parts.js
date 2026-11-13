// Oglasi za dijelove
import { app } from '../router.js';
import { all, get, run } from '../db.js';
import { bad, notFound, forbidden, str, int, num, bool, imgList, modelById, vehicleName, normalize, searchWords, rateLimit } from '../lib.js';
import { vehicleFilter, MODEL_JOIN, MODEL_COLS, sellerOf, fmtVehicleRow, pageArgs, countAndList } from './common.js';

const COLS = `p.id, p.title, p.price, p.negotiable, p.condition, p.city, p.images, p.year, p.engine, p.fuel, p.side, p.part_no, p.status,
  p.created_at, p.user_id, p.vehicle_id, p.make_id, p.model_id, p.model_text, u.name seller_name, u.type seller_type, u.verified seller_verified, ${MODEL_COLS}`;
const FROM = `FROM parts p JOIN users u ON u.id=p.user_id AND u.blocked=0 ${MODEL_JOIN('p')}`;

export function listParts(q, extraWhere = [], extraArgs = []) {
  const [w, a] = vehicleFilter(q, 'p');
  w.unshift("p.status='active'");
  w.push(...extraWhere); a.push(...extraArgs);
  for (const word of searchWords(q.q)) { w.push('p.search LIKE ?'); a.push(`%${word}%`); }
  if (q.city) { w.push('p.city=?'); a.push(q.city); }
  if (q.seller) { w.push('p.user_id=?'); a.push(int(q.seller)); }
  if (q.vehicle) { w.push('p.vehicle_id=?'); a.push(int(q.vehicle)); }
  if (q.year) { w.push('(p.year IS NULL OR p.year=?)'); a.push(int(q.year)); }
  if (q.condition) { w.push('p.condition=?'); a.push(q.condition); }
  if (q.max) { w.push('p.price<=?'); a.push(num(q.max)); }
  if (q.images) w.push("p.images<>'[]'");
  const order = q.sort === 'cijena' ? 'p.price IS NULL, p.price ASC' : q.sort === 'cijena-' ? 'p.price DESC' : 'p.id DESC';
  const { limit, offset, page } = pageArgs(q);
  const r = countAndList(FROM, w, a, order, limit, offset, COLS);
  return { total: r.total, page, limit, items: r.items.map(fmtVehicleRow) };
}

app.get('/api/parts', ({ query }) => listParts(query));

app.get('/api/parts/:id', ({ params, user }) => {
  const p = get(`SELECT p.*, ${MODEL_COLS} FROM parts p ${MODEL_JOIN('p')} WHERE p.id=?`, int(params.id));
  const mine = p && user && (p.user_id === user.id || user.is_admin);
  if (!p || (p.status === 'hidden' && !mine)) throw notFound('Oglas ne postoji ili je uklonjen');
  if (!mine) run('UPDATE parts SET views=views+1 WHERE id=?', p.id);
  const seller = sellerOf(p.user_id);
  if (!seller) throw notFound();
  const out = fmtVehicleRow(p);
  delete out.search;
  out.seller = seller;
  out.mine = !!mine;
  out.vehicle_ad = p.vehicle_id ? get("SELECT id, year, engine, images FROM vehicles WHERE id=? AND status<>'hidden'", p.vehicle_id) : null;
  out.fav = user ? !!get("SELECT 1 x FROM favorites WHERE user_id=? AND kind='part' AND item_id=?", user.id, p.id) : false;
  // slični: isti model, drugi oglasi
  out.similar = p.model_id
    ? listParts({ gen: p.model_id, limit: 6 }, ['p.id<>?'], [p.id]).items
    : [];
  return out;
});

function readPart(body, user) {
  const title = str(body.title, 120);
  if (!title) throw bad('Upiši naziv dijela');
  let make_id = str(body.make_id, 60), model_id = str(body.model_id, 60);
  const m = modelById(model_id);
  if (model_id && !m) throw bad('Nepoznat model');
  if (m) make_id = m.make_id;
  if (!make_id && !str(body.model_text)) throw bad('Izaberi marku i model vozila');
  const price = num(body.price);
  if (price !== null && (price < 0 || price > 1e6)) throw bad('Provjeri cijenu');
  let vehicle_id = int(body.vehicle_id);
  if (vehicle_id && !get('SELECT 1 x FROM vehicles WHERE id=? AND user_id=?', vehicle_id, user.id)) vehicle_id = null;
  const d = {
    title, make_id, model_id: m ? m.id : null, model_text: str(body.model_text, 80), year: int(body.year),
    fuel: str(body.fuel, 30), engine: str(body.engine, 40), part_no: str(body.part_no, 60), side: str(body.side, 30),
    condition: ['polovno', 'novo', 'oštećeno'].includes(body.condition) ? body.condition : 'polovno',
    price, negotiable: bool(body.negotiable), description: str(body.description, 4000), city: str(body.city, 60) || user.city,
    images: imgList(body.images), vehicle_id,
  };
  const mk = make_id ? get('SELECT name FROM car_make WHERE id=?', make_id) : null;
  d.search = normalize([title, d.part_no, d.engine, d.description, mk?.name, m ? vehicleName({ make_name: '', model_name: m.name, generation_name: m.generation_name }) : d.model_text].join(' '));
  return d;
}

app.post('/api/parts', ({ user, body }) => {
  rateLimit('post:' + user.id, 300, 3600e3);
  const d = readPart(body, user);
  const keys = Object.keys(d);
  const r = run(`INSERT INTO parts (user_id, ${keys.join(',')}) VALUES (?, ${keys.map(() => '?').join(',')})`, user.id, ...Object.values(d));
  return { id: Number(r.lastInsertRowid) };
}, { auth: true });

function own(table, id, user) {
  const row = get(`SELECT * FROM ${table} WHERE id=?`, int(id));
  if (!row) throw notFound();
  if (row.user_id !== user.id && !user.is_admin) throw forbidden();
  return row;
}

app.put('/api/parts/:id', ({ user, body, params }) => {
  const p = own('parts', params.id, user);
  const d = readPart(body, user);
  run(`UPDATE parts SET ${Object.keys(d).map(k => k + '=?').join(',')}, updated_at=datetime('now') WHERE id=?`, ...Object.values(d), p.id);
  return { id: p.id };
}, { auth: true });

app.post('/api/parts/:id/status', ({ user, body, params }) => {
  const p = own('parts', params.id, user);
  if (!['active', 'sold', 'hidden'].includes(body.status)) throw bad('Nepoznat status');
  run("UPDATE parts SET status=?, updated_at=datetime('now') WHERE id=?", body.status, p.id);
  return { ok: true };
}, { auth: true });

app.del('/api/parts/:id', ({ user, params }) => {
  const p = own('parts', params.id, user);
  run('DELETE FROM parts WHERE id=?', p.id);
  return { ok: true };
}, { auth: true });

app.get('/api/my/parts', ({ user, query }) => {
  const w = ['p.user_id=?']; const a = [user.id];
  if (query.status) { w.push('p.status=?'); a.push(query.status); }
  for (const word of searchWords(query.q)) { w.push('p.search LIKE ?'); a.push(`%${word}%`); }
  const { limit, offset, page } = pageArgs(query, 30);
  const r = countAndList(`FROM parts p JOIN users u ON u.id=p.user_id ${MODEL_JOIN('p')}`, w, a, 'p.id DESC', limit, offset, COLS + ', p.views');
  return { total: r.total, page, limit, items: r.items.map(fmtVehicleRow) };
}, { auth: true });

app.post('/api/favorites', ({ user, body }) => {
  const kind = body.kind === 'vehicle' ? 'vehicle' : 'part';
  const id = int(body.id);
  if (get('SELECT 1 x FROM favorites WHERE user_id=? AND kind=? AND item_id=?', user.id, kind, id)) {
    run('DELETE FROM favorites WHERE user_id=? AND kind=? AND item_id=?', user.id, kind, id);
    return { fav: false };
  }
  run('INSERT INTO favorites (user_id, kind, item_id) VALUES (?,?,?)', user.id, kind, id);
  return { fav: true };
}, { auth: true });

app.get('/api/favorites', ({ user }) => {
  const ids = all("SELECT item_id FROM favorites WHERE user_id=? AND kind='part' ORDER BY created_at DESC", user.id).map(r => r.item_id);
  const vids = all("SELECT item_id FROM favorites WHERE user_id=? AND kind='vehicle' ORDER BY created_at DESC", user.id).map(r => r.item_id);
  const parts = ids.length ? all(`SELECT ${COLS} ${FROM} WHERE p.id IN (${ids.map(() => '?').join(',')})`, ...ids).map(fmtVehicleRow) : [];
  const vehicles = vids.length ? all(`SELECT v.*, u.name seller_name, ${MODEL_COLS} FROM vehicles v JOIN users u ON u.id=v.user_id ${MODEL_JOIN('v')} WHERE v.id IN (${vids.map(() => '?').join(',')})`, ...vids).map(fmtVehicleRow) : [];
  return { parts, vehicles };
}, { auth: true });

app.post('/api/reports', ({ user, body, ip }) => {
  rateLimit('rep:' + ip, 10, 3600e3);
  run('INSERT INTO reports (kind, item_id, user_id, reason) VALUES (?,?,?,?)',
    body.kind === 'vehicle' ? 'vehicle' : body.kind === 'user' ? 'user' : 'part', int(body.id), user?.id, str(body.reason, 500));
  return { ok: true };
});

export { own };
