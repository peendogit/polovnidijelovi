// Baza: otvaranje, šema, početni podaci (marke i modeli sa faceliftovima)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from './sqlite.js';
import { runModelsUpdate } from './models-update.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DATA_DIR = path.resolve(ROOT, process.env.DATA_DIR || 'data');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

export const db = await openDb(path.join(DATA_DIR, 'polovnidijelovi.db'));
db.exec(fs.readFileSync(path.join(ROOT, 'server/schema.sql'), 'utf8'));

// Dopune šeme za postojeće baze
const cols = t => db.prepare(`PRAGMA table_info(${t})`).all().map(c => c.name);
if (!cols('vehicles').includes('drive')) db.exec('ALTER TABLE vehicles ADD COLUMN drive TEXT');
// "Boja" je postala "Kod boje" (npr. LC9X); nova "Boja" je izbor iz liste
if (!cols('vehicles').includes('color_code')) {
  db.exec('ALTER TABLE vehicles ADD COLUMN color_code TEXT');
  db.exec('UPDATE vehicles SET color_code=color, color=NULL WHERE color IS NOT NULL');
}
if (!cols('vehicles').includes('gearbox_code')) db.exec('ALTER TABLE vehicles ADD COLUMN gearbox_code TEXT');
if (!cols('vehicles').includes('gears')) db.exec('ALTER TABLE vehicles ADD COLUMN gears INTEGER');
if (!cols('users').includes('email_verified')) {
  db.exec('ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0');
  db.exec('UPDATE users SET email_verified=1'); // postojeći korisnici ostaju kako jesu
}
if (!cols('inquiries').includes('ip')) db.exec('ALTER TABLE inquiries ADD COLUMN ip TEXT');
if (!cols('inquiries').includes('phone_norm')) db.exec('ALTER TABLE inquiries ADD COLUMN phone_norm TEXT');
db.exec('CREATE INDEX IF NOT EXISTS ix_inq_phone ON inquiries(phone_norm, created_at)');
if (!cols('inquiries').includes('spam')) db.exec('ALTER TABLE inquiries ADD COLUMN spam INTEGER DEFAULT 0');
if (!cols('parts').includes('type_id')) db.exec('ALTER TABLE parts ADD COLUMN type_id INTEGER');
db.exec('CREATE INDEX IF NOT EXISTS ix_parts_type ON parts(type_id)');
if (!db.prepare('SELECT COUNT(*) c FROM part_types').get().c) {
  const f = path.join(ROOT, 'data/tipovi-dijelova.json');
  if (fs.existsSync(f)) {
    const nrm = s => String(s).toLowerCase().replace(/[čć]/g, 'c').replace(/đ/g, 'dj').replace(/š/g, 's').replace(/ž/g, 'z').replace(/[^a-z0-9]+/g, ' ').trim();
    const ins = db.prepare('INSERT OR IGNORE INTO part_types (title, grp, norm) VALUES (?,?,?)');
    db.exec('BEGIN'); for (const t of JSON.parse(fs.readFileSync(f, 'utf8'))) ins.run(t.t, t.g, nrm(t.t)); db.exec('COMMIT');
  }
}
if (!cols('parts').includes('color')) db.exec('ALTER TABLE parts ADD COLUMN color TEXT');
if (!cols('parts').includes('color_code')) db.exec('ALTER TABLE parts ADD COLUMN color_code TEXT');
for (const [c, t] of [['engine_code', 'TEXT'], ['power_kw', 'INTEGER'], ['gearbox', 'TEXT'], ['gearbox_code', 'TEXT'], ['gears', 'INTEGER'], ['body', 'TEXT'], ['drive', 'TEXT']])
  if (!cols('parts').includes(c)) db.exec(`ALTER TABLE parts ADD COLUMN ${c} ${t}`);

// Prvo pokretanje: ubaci marke i modele
const cnt = db.prepare('SELECT COUNT(*) c FROM car_model').get().c;
if (!cnt) {
  const seed = path.join(ROOT, 'data/vozila.sql');
  if (fs.existsSync(seed)) {
    db.exec(fs.readFileSync(seed, 'utf8'));
    console.log('Ubačene marke i modeli:', db.prepare('SELECT COUNT(*) c FROM car_model').get().c);
  }
}

const norm = a => a.map(v => (v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v));
// ---------- čišćenje duplih generacija (npr. Audi Q7 4M facelift 2019 dva puta) ----------
// Isti model, isti facelift i ista godina početka = isti auto. Ostaje jedan, ostali se sakriju,
// a oglasi koji su bili na sakrivenom prebace se na onaj koji ostaje.
if (!cols('car_model').includes('merged_into')) db.exec('ALTER TABLE car_model ADD COLUMN merged_into TEXT');
function dedupeModels() {
  const rows = db.prepare(`SELECT m.*,
      (SELECT COUNT(*) FROM parts p WHERE p.model_id=m.id) + (SELECT COUNT(*) FROM vehicles v WHERE v.model_id=m.id) + (SELECT COUNT(*) FROM requests r WHERE r.model_id=m.id) used
    FROM car_model m WHERE m.active=1 AND m.date_from IS NOT NULL`).all();
  const groups = new Map();
  for (const r of rows) {
    const k = [r.make_id, r.name.toLowerCase(), r.restyling ? 1 : 0, r.restyling_second ? 1 : 0, String(r.date_from).slice(0, 4)].join('|');
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }
  const y = d => (d ? String(d).slice(0, 4) : null);
  let merged = 0;
  db.exec('BEGIN');
  try {
    for (const g of groups.values()) {
      if (g.length < 2) continue;
      // ostaje: onaj koji već ima oglase, pa onaj sa oznakom generacije, pa onaj sa dužim rasponom godina
      g.sort((a, b) => (b.used > 0) - (a.used > 0) || !!b.generation_name - !!a.generation_name
        || (Number(y(b.date_to) || 9999) - Number(y(b.date_from))) - (Number(y(a.date_to) || 9999) - Number(y(a.date_from))) || String(a.id).localeCompare(String(b.id)));
      const [keep, ...rest] = g;
      // raspon godina: najranije od - najkasnije do (prazno "do" = proizvodi se i danas)
      const anyOpen = g.some(x => !x.date_to);
      const to = anyOpen ? null : g.map(x => x.date_to).sort().pop();
      const gen = keep.generation_name || rest.find(x => x.generation_name)?.generation_name || null;
      db.prepare('UPDATE car_model SET date_to=?, generation_name=? WHERE id=?').run(to, gen, keep.id);
      for (const r of rest) {
        for (const t of ['parts', 'vehicles', 'requests']) db.prepare(`UPDATE ${t} SET model_id=? WHERE model_id=?`).run(keep.id, r.id);
        db.prepare('UPDATE car_model SET active=0, merged_into=? WHERE id=?').run(keep.id, r.id);
        merged++;
      }
    }
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
  return merged;
}
if (!db.prepare("SELECT value FROM settings WHERE key='models_dedup_v1'").get()) {
  const n = dedupeModels();
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('models_dedup_v1', ?)").run(String(n));
  if (n) console.log('Spojeno duplih generacija:', n);
}
if (!db.prepare("SELECT value FROM settings WHERE key='models_update_2026_11'").get()) {
  const log = runModelsUpdate(db);
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('models_update_2026_11', ?)").run(JSON.stringify(log));
  console.log(`Modeli: dodano ${log.added}, ispravljeno ${log.fixed}, sakriveno ${log.hidden}, preimenovano ${log.renamed}`);
  if (log.missing.length) console.log('Nije pronađeno:', log.missing.join(' | '));
}

export const all = (sql, ...a) => db.prepare(sql).all(...norm(a));
export const get = (sql, ...a) => db.prepare(sql).get(...norm(a));
export const run = (sql, ...a) => db.prepare(sql).run(...norm(a));

export function tx(fn) {
  db.exec('BEGIN');
  try { const r = fn(); db.exec('COMMIT'); return r; }
  catch (e) { db.exec('ROLLBACK'); throw e; }
}

export function setting(key, def = null) {
  return get('SELECT value FROM settings WHERE key=?', key)?.value ?? def;
}
export function setSetting(key, value) {
  run('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', key, value);
}
