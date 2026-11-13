// Automatski uvoz za otpade (npr. iz programa otpada): zaglavlje  X-Api-Key: pd_...
// POST /api/feed/parts      { items: [ {ext_id, title, model_id | make+model, year, price, images:[url], ...} ] }
// POST /api/feed/vehicles   { items: [ {ext_id, model_id | make+model, year, fuel, engine, images:[url], ...} ] }
// POST /api/feed/remove     { kind: 'parts'|'vehicles', ext_ids: [...] }   -> prodato / rastavljeno
// POST /api/feed/active     { kind: 'parts'|'vehicles', ext_ids: [...sve što je trenutno na stanju] } -> ostalo se skida
// POST /api/feed/image      { full: dataURL, thumb?: dataURL }  -> { url }  (slika se čuva na ovom sajtu)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { app } from '../router.js';
import { get, run, all, tx, UPLOAD_DIR } from '../db.js';
import { COLORS, upper, gearsInt, HttpError, bad, str, int, num, bool, imgList, normalize, rateLimit } from '../lib.js';

function feedUser(req) {
  const key = req.headers['x-api-key'];
  const u = key && get("SELECT * FROM users WHERE api_key=? AND blocked=0 AND type='otpad'", String(key));
  if (!u) throw new HttpError(401, 'Neispravan API ključ');
  rateLimit('feed:' + u.id, 20000, 3600e3);
  return u;
}

const MAKE_ALIAS = { vw: 'Volkswagen', mercedes: 'Mercedes-Benz', 'mercedes benz': 'Mercedes-Benz', skoda: 'Škoda', citroen: 'Citroën' };
// model po id-u (isti id-evi kao u programu otpada) ili po nazivu marke/modela + godištu / rasponu godina generacije
function resolveModel(it) {
  if (it.model_id) {
    let m = get('SELECT id, make_id, merged_into FROM car_model WHERE id=?', String(it.model_id));
    if (m?.merged_into) m = get('SELECT id, make_id FROM car_model WHERE id=?', m.merged_into) || m;
    if (m) return { id: m.id, make_id: m.make_id };
  }
  const mkName = String(it.make || '').trim();
  const make = mkName && get('SELECT id FROM car_make WHERE name=? COLLATE NOCASE', MAKE_ALIAS[mkName.toLowerCase()] || mkName);
  if (!make) return null;
  const model = String(it.model || '').trim().toLowerCase().replace(/^pasat\b/, 'passat');
  if (model) {
    // kandidati: tačan naziv, naziv + oznaka generacije ("Sportage NQ5"), ili naziv na početku
    const cands = all(`SELECT id, make_id, name, generation_name, restyling, restyling_second, date_from, date_to FROM car_model WHERE make_id=? AND active=1`, make.id)
      .filter(m => {
        const n = m.name.toLowerCase(), ng = (m.name + ' ' + (m.generation_name || '')).trim().toLowerCase();
        return n === model || ng === model || model.startsWith(n + ' ');
      });
    if (cands.length) {
      const y = int(it.year);
      // raspon generacije iz teksta vozila, npr. "Golf 7 (17-20)"
      const rg = /\((\d{2})\s*-\s*(\d{2})?\)/.exec(String(it.vehicle || it.years || ''));
      const full = yy => (yy == null ? null : (Number(yy) > 40 ? 1900 : 2000) + Number(yy));
      const from = rg ? full(rg[1]) : null, to = rg && rg[2] ? full(rg[2]) : null;
      const yr = d => (d ? Number(String(d).slice(0, 4)) : null);
      const nameScore = m => {
        const n = m.name.toLowerCase(), ng = (m.name + ' ' + (m.generation_name || '')).trim().toLowerCase();
        return ng === model ? 2 : n === model ? 1 : 0;
      };
      let pick = null;
      // 1) tačan početak generacije iz programa
      if (from) pick = cands.filter(m => yr(m.date_from) === from).sort((a, b) => nameScore(b) - nameScore(a) || (to && yr(b.date_to) === to) - (to && yr(a.date_to) === to))[0];
      // 2) godište unutar raspona generacije (samo generacije sa poznatim godinama)
      if (!pick && y) {
        const inYear = cands.filter(m => m.date_from && yr(m.date_from) <= y && (!m.date_to || yr(m.date_to) >= y));
        // ako godište pada na prelaz (npr. 2017 = kraj stare i početak facelift), uzmi noviju
        pick = inYear.sort((a, b) => nameScore(b) - nameScore(a) || String(b.date_from).localeCompare(String(a.date_from)))[0];
      }
      // 3) model ima samo jednu generaciju — nema dileme
      if (!pick && cands.length === 1) pick = cands[0];
      // 4) naziv sa oznakom generacije ("Sportage NQ5") jednoznačno određuje generaciju
      if (!pick) { const ex = cands.filter(m => nameScore(m) === 2); if (ex.length === 1) pick = ex[0]; }
      if (pick) return { id: pick.id, make_id: make.id };
      // ne znamo tačnu generaciju: ostaje marka + naziv modela (pretraga po modelu ga i dalje nalazi)
      return { id: null, make_id: make.id, name: cands[0].name };
    }
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
        make_id: m?.make_id || null, model_id: m?.id || null, model_text: m?.id ? null : str(m?.name || it.model || it.make, 80),
        year: int(it.year), fuel: str(it.fuel, 30), engine: str(it.engine, 40), engine_code: upper(it.engine_code, 20), gearbox_code: upper(it.gearbox_code, 20), gears: gearsInt(it.gears), power_kw: int(it.power_kw),
        gearbox: str(it.gearbox, 30), drive: ['prednji', 'zadnji', '4x4'].includes(it.drive) ? it.drive : null, body: str(it.body, 30), color: COLORS.includes(it.color) ? it.color : null, color_code: str(it.color_code || (COLORS.includes(it.color) ? null : it.color), 20), mileage: int(it.mileage), description: str(it.description, 4000),
        city: str(it.city, 60) || u.city, images: imgList(it.images, true),
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
        title, make_id: m?.make_id || null, model_id: m?.id || null, model_text: m?.id ? null : str(m?.name || it.model || it.make, 80),
        year: int(it.year), fuel: str(it.fuel, 30), engine: str(it.engine, 40), part_no: str(it.part_no, 60), side: str(it.side, 30), color: COLORS.includes(it.color) ? it.color : null, color_code: str(it.color_code, 20),
        condition: ['polovno', 'novo', 'oštećeno'].includes(it.condition) ? it.condition : (bool(it.damaged) ? 'oštećeno' : 'polovno'),
        price: num(it.price), negotiable: bool(it.negotiable), description: str(it.description, 4000),
        city: str(it.city, 60) || u.city, images: imgList(it.images, true), vehicle_id: veh?.id || null,
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

// Sve što je trenutno na stanju; oglasi sa ext_id koji nisu na spisku se skidaju (prodato / rastavljeno)
app.post('/api/feed/active', ({ req, body }) => {
  const u = feedUser(req);
  const table = body.kind === 'vehicles' ? 'vehicles' : 'parts';
  const status = table === 'vehicles' ? 'done' : 'sold';
  const ids = Array.isArray(body.ext_ids) ? body.ext_ids.map(String).slice(0, 200000) : null;
  if (!ids || !ids.length) throw bad('Prazan spisak — ništa nije skinuto (zaštita od greške).');
  const keep = new Set(ids);
  const active = all(`SELECT id, ext_id FROM ${table} WHERE user_id=? AND ext_id IS NOT NULL AND status='active'`, u.id);
  const drop = active.filter(r => !keep.has(r.ext_id));
  // kočnica: ako bi se odjednom skinulo više od pola oglasa (a više od 200), to je vjerovatno greška
  if (drop.length > 200 && drop.length > active.length / 2 && !body.force) {
    throw bad(`Zaustavljeno: skinulo bi se ${drop.length} od ${active.length} oglasa. Ako je to namjerno, pošalji ponovo sa "force": true.`);
  }
  tx(() => { for (const r of drop) run(`UPDATE ${table} SET status=?, updated_at=datetime('now') WHERE id=?`, status, r.id); });
  return { ok: true, removed: drop.length, active: active.length - drop.length };
}, { limit: 8e6 });

// Slika iz programa / shopa: čuva se na ovom sajtu (velika + mala)
function decodeImg(dataUrl, max) {
  const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || '');
  if (!m) throw bad('Neispravna slika');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > max) throw bad('Slika je prevelika');
  const jpg = buf[0] === 0xff && buf[1] === 0xd8, png = buf[0] === 0x89 && buf[1] === 0x50, webp = buf.slice(8, 12).toString() === 'WEBP';
  if (!jpg && !png && !webp) throw bad('Dozvoljene su samo slike');
  return { buf, ext: jpg ? 'jpg' : png ? 'png' : 'webp' };
}
app.post('/api/feed/image', ({ req, body }) => {
  feedUser(req);
  const full = decodeImg(body.full, 6e6);
  const thumb = body.thumb ? decodeImg(body.thumb, 8e5) : null;
  const id = Date.now().toString(36) + crypto.randomBytes(6).toString('hex');
  fs.writeFileSync(path.join(UPLOAD_DIR, `${id}.${full.ext}`), full.buf);
  if (thumb) fs.writeFileSync(path.join(UPLOAD_DIR, `${id}_t.jpg`), thumb.buf);
  return { url: `/uploads/${id}.${full.ext}` };
}, { limit: 1e7 });
