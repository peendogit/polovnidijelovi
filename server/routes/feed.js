// Automatski uvoz za otpade (npr. iz programa otpada): zaglavlje  X-Api-Key: pd_...
// POST /api/feed/parts      { items: [ {ext_id, title, model_id | make+model, year, price, images:[url], ...} ] }
// POST /api/feed/vehicles   { items: [ {ext_id, model_id | make+model, year, fuel, engine, images:[url], ...} ] }
// POST /api/feed/remove     { kind: 'parts'|'vehicles', ext_ids: [...] }   -> prodato / rastavljeno
import { app } from '../router.js';
import { get, run, tx } from '../db.js';
import { HttpError, bad, str, int, num, bool, imgList, normalize, rateLimit } from '../lib.js';

function feedUser(req) {
  const key = req.headers['x-api-key'];
  const u = key && get("SELECT * FROM users WHERE api_key=? AND blocked=0 AND type='otpad'", String(key));
  if (!u) throw new HttpError(401, 'Neispravan API ključ');
  rateLimit('feed:' + u.id, 120, 3600e3);
  return u;
}

// model po id-u (isti id-evi kao u programu otpada) ili po nazivu marke/modela + godištu
function resolveModel(it) {
  if (it.model_id) {
    const m = get('SELECT id, make_id FROM car_model WHERE id=?', String(it.model_id));
    if (m) return m;
  }
  const make = it.make && get('SELECT id FROM car_make WHERE name=? COLLATE NOCASE', String(it.make).replace(/^VW$/i, 'Volkswagen').replace(/^Mercedes$/i, 'Mercedes-Benz'));
  if (!make) return null;
  if (it.model) {
    const y = int(it.year);
    const m = get(`SELECT id, make_id FROM car_model WHERE make_id=? AND name=? COLLATE NOCASE
      ${y ? "AND (date_from IS NULL OR substr(date_from,1,4)<=?) AND (date_to IS NULL OR substr(date_to,1,4)>=?)" : ''}
      ORDER BY restyling DESC, date_from DESC LIMIT 1`, make.id, String(it.model), ...(y ? [String(y), String(y)] : []));
    if (m) return m;
  }
  return { id: null, make_id: make.id };
}

function upsert(table, u, ext, d) {
  const ex = get(`SELECT id FROM ${table} WHERE user_id=? AND ext_id=?`, u.id, ext);
  if (ex) {
    run(`UPDATE ${table} SET ${Object.keys(d).map(k => k + '=?').join(',')}, status='active', updated_at=datetime('now') WHERE id=?`, ...Object.values(d), ex.id);
    return ex.id;
  }
  const keys = Object.keys(d);
  return Number(run(`INSERT INTO ${table} (user_id, ext_id, ${keys.join(',')}) VALUES (?,?,${keys.map(() => '?').join(',')})`, u.id, ext, ...Object.values(d)).lastInsertRowid);
}

app.post('/api/feed/vehicles', ({ req, body }) => {
  const u = feedUser(req);
  const items = Array.isArray(body.items) ? body.items.slice(0, 500) : [];
  let ok = 0; const errors = [];
  tx(() => {
    for (const it of items) {
      const ext = str(it.ext_id, 60);
      if (!ext) { errors.push({ it, error: 'nema ext_id' }); continue; }
      const m = resolveModel(it);
      const d = {
        make_id: m?.make_id || null, model_id: m?.id || null, model_text: m?.id ? null : str([it.make, it.model].filter(Boolean).join(' '), 80),
        year: int(it.year), fuel: str(it.fuel, 30), engine: str(it.engine, 40), engine_code: str(it.engine_code, 20), power_kw: int(it.power_kw),
        gearbox: str(it.gearbox, 30), drive: ['prednji', 'zadnji', '4x4'].includes(it.drive) ? it.drive : null, body: str(it.body, 30), color: str(it.color, 30), mileage: int(it.mileage), description: str(it.description, 4000),
        city: str(it.city, 60) || u.city, images: imgList(it.images),
      };
      d.search = normalize([it.make, it.model, d.engine, d.engine_code, d.description].join(' '));
      upsert('vehicles', u, ext, d); ok++;
    }
  });
  return { ok, errors: errors.slice(0, 20) };
}, { limit: 8e6 });

app.post('/api/feed/parts', ({ req, body }) => {
  const u = feedUser(req);
  const items = Array.isArray(body.items) ? body.items.slice(0, 500) : [];
  let ok = 0; const errors = [];
  tx(() => {
    for (const it of items) {
      const ext = str(it.ext_id, 60), title = str(it.title, 120);
      if (!ext || !title) { errors.push({ ext_id: ext, error: 'nema ext_id ili naziva' }); continue; }
      const m = resolveModel(it);
      const veh = it.vehicle_ext_id ? get('SELECT id FROM vehicles WHERE user_id=? AND ext_id=?', u.id, String(it.vehicle_ext_id)) : null;
      const d = {
        title, make_id: m?.make_id || null, model_id: m?.id || null, model_text: m?.id ? null : str([it.make, it.model].filter(Boolean).join(' '), 80),
        year: int(it.year), fuel: str(it.fuel, 30), engine: str(it.engine, 40), part_no: str(it.part_no, 60), side: str(it.side, 30),
        condition: ['polovno', 'novo', 'oštećeno'].includes(it.condition) ? it.condition : 'polovno',
        price: num(it.price), negotiable: bool(it.negotiable), description: str(it.description, 4000),
        city: str(it.city, 60) || u.city, images: imgList(it.images), vehicle_id: veh?.id || null,
      };
      d.search = normalize([title, d.part_no, d.engine, d.description, it.make, it.model].join(' '));
      upsert('parts', u, ext, d); ok++;
    }
  });
  return { ok, errors: errors.slice(0, 20) };
}, { limit: 8e6 });

app.post('/api/feed/remove', ({ req, body }) => {
  const u = feedUser(req);
  const table = body.kind === 'vehicles' ? 'vehicles' : 'parts';
  const status = table === 'vehicles' ? 'done' : 'sold';
  const ids = Array.isArray(body.ext_ids) ? body.ext_ids.slice(0, 2000) : [];
  if (!ids.length) throw bad('Nema ext_ids');
  let n = 0;
  tx(() => { for (const e of ids) n += Number(run(`UPDATE ${table} SET status=? WHERE user_id=? AND ext_id=?`, status, u.id, String(e)).changes); });
  return { ok: n };
});
