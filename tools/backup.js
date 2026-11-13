// Kopija baze: tačan snimak i dok sajt radi (VACUUM INTO), spakovan (.gz). Čuva se 14 dana.
// Upotreba: node tools/backup.js   (pokreće ga tools/backup.sh svaku noć)
import '../server/env.js';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { openDb } from '../server/sqlite.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.resolve(ROOT, process.env.DATA_DIR || 'data');
const SRC = path.join(DATA, 'polovnidijelovi.db');
const OUT = path.join(DATA, 'backup');
fs.mkdirSync(OUT, { recursive: true });

const day = new Date().toISOString().slice(0, 10);
const tmp = path.join(OUT, `baza-${day}.db`);
const gz = tmp + '.gz';
fs.rmSync(tmp, { force: true });
const db = await openDb(SRC);
db.exec(`VACUUM INTO '${tmp.replace(/'/g, "''")}'`);
db.close();
fs.writeFileSync(gz, zlib.gzipSync(fs.readFileSync(tmp), { level: 9 }));
fs.rmSync(tmp);
// stare kopije (starije od 14 dana) se brišu
for (const f of fs.readdirSync(OUT)) {
  const p = path.join(OUT, f);
  if (/^baza-.*\.db(\.gz)?$/.test(f) && Date.now() - fs.statSync(p).mtimeMs > 14 * 864e5) fs.rmSync(p);
}
console.log(`${new Date().toISOString()} kopija baze: ${gz} (${(fs.statSync(gz).size / 1024).toFixed(0)} KB)`);
