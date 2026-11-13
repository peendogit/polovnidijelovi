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
