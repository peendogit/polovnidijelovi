// Upload slika: telefon sam smanji sliku (velika + mala), server samo provjeri i snimi
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { app } from '../router.js';
import { UPLOAD_DIR } from '../db.js';
import { bad, rateLimit } from '../lib.js';

function decode(dataUrl, maxBytes) {
  const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || '');
  if (!m) throw bad('Neispravna slika');
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > maxBytes) throw bad('Slika je prevelika');
  const isJpg = buf[0] === 0xff && buf[1] === 0xd8;
  const isPng = buf[0] === 0x89 && buf[1] === 0x50;
  const isWebp = buf.slice(8, 12).toString() === 'WEBP';
  if (!isJpg && !isPng && !isWebp) throw bad('Dozvoljene su samo slike');
  return { buf, ext: isJpg ? 'jpg' : isPng ? 'png' : 'webp' };
}

app.post('/api/upload', ({ user, body }) => {
  rateLimit('up:' + user.id, 250, 3600e3);
  const full = decode(body.full, 4e6);
  const thumb = body.thumb ? decode(body.thumb, 6e5) : null;
  const id = Date.now().toString(36) + crypto.randomBytes(6).toString('hex');
  const name = `${id}.${full.ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, name), full.buf);
  if (thumb) fs.writeFileSync(path.join(UPLOAD_DIR, `${id}_t.${thumb.ext}`), thumb.buf);
  return { url: `/uploads/${name}` };
}, { auth: true, limit: 7e6 });
