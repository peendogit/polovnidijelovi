// Baza: otvaranje, šema, početni podaci (marke i modeli sa faceliftovima)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from './sqlite.js';

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
if (!cols('parts').includes('color')) db.exec('ALTER TABLE parts ADD COLUMN color TEXT');
if (!cols('parts').includes('color_code')) db.exec('ALTER TABLE parts ADD COLUMN color_code TEXT');

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
