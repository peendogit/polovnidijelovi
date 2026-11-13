// Tipovi dijelova: spisak, prepoznavanje tipa iz naziva dijela
import { all, get, db, setting, setSetting } from './db.js';
import { normalize } from './lib.js';
import { app } from './router.js';

let cache = null;
function load() {
  if (!cache) cache = all('SELECT id, title, grp, norm FROM part_types ORDER BY title COLLATE NOCASE');
  return cache;
}
export const clearTypes = () => { cache = null; };
export const typeById = id => (id ? get('SELECT * FROM part_types WHERE id=?', Number(id)) : null);

// "Far prednji lijevi LED xenon" -> tip "Far prednji lijevi" (najduži tip kojim naziv počinje), ili tačno poklapanje
export function findType(text) {
  const n = normalize(text);
  if (!n) return null;
  let best = null;
  for (const t of load()) {
    if (t.norm === n) return t;
    if ((n.startsWith(t.norm + ' ')) && (!best || t.norm.length > best.norm.length)) best = t;
  }
  return best;
}

app.get('/api/part-types', () => load().map(t => ({ id: t.id, t: t.title, g: t.grp })));

// jednom: dodijeli tip postojećim oglasima prema nazivu
if (!setting('types_backfill_v1')) {
  const rows = all('SELECT id, title FROM parts WHERE type_id IS NULL');
  const up = db.prepare('UPDATE parts SET type_id=? WHERE id=?');
  let n = 0;
  db.exec('BEGIN');
  for (const r of rows) { const t = findType(r.title); if (t) { up.run(t.id, r.id); n++; } }
  db.exec('COMMIT');
  setSetting('types_backfill_v1', String(n));
  if (n) console.log('Tip dijela dodijeljen postojećim oglasima:', n);
}
