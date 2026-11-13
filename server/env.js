// Učitava .env (KLJUČ=vrijednost) bez paketa
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const f = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env');
if (fs.existsSync(f)) {
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
