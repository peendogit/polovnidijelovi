// Pomoćne funkcije: greške, lozinke, sesije, oznake modela
import crypto from 'node:crypto';
import { get } from './db.js';

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export const bad = m => new HttpError(400, m);
export const notFound = (m = 'Nije pronađeno') => new HttpError(404, m);
export const forbidden = (m = 'Nemaš pravo na ovo') => new HttpError(403, m);
export const needLogin = () => new HttpError(401, 'Prijavi se');

// ---------- lozinke (scrypt) ----------
export function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const h = crypto.scryptSync(String(pw), salt, 64).toString('hex');
  return `${salt}:${h}`;
}
export function checkPassword(pw, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, h] = stored.split(':');
  const x = crypto.scryptSync(String(pw), salt, 64);
  const y = Buffer.from(h, 'hex');
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// ---------- sesija: potpisan kolačić ----------
const SECRET = process.env.SECRET || 'promijeni-me';
if (SECRET === 'promijeni-me' && process.env.NODE_ENV === 'production') {
  console.warn('UPOZORENJE: postavi SECRET u .env fajlu!');
}
const DAYS = 60;
export function makeToken(userId) {
  const exp = Date.now() + DAYS * 864e5;
  const body = `${userId}.${exp}`;
  const sig = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}
export function readToken(tok) {
  if (!tok) return null;
  const [uid, exp, sig] = String(tok).split('.');
  if (!uid || !exp || !sig) return null;
  const good = crypto.createHmac('sha256', SECRET).update(`${uid}.${exp}`).digest('base64url');
  if (good.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(good), Buffer.from(sig))) return null;
  if (Number(exp) < Date.now()) return null;
  return Number(uid);
}
export function sessionCookie(token, secure) {
  return `pd_s=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${token ? DAYS * 86400 : 0}${secure ? '; Secure' : ''}`;
}
export function parseCookies(h = '') {
  const o = {};
  for (const p of h.split(';')) {
    const i = p.indexOf('=');
    if (i > 0) o[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  }
  return o;
}

// ---------- jednostavna zaštita od previše zahtjeva ----------
const hits = new Map();
export function rateLimit(key, max, windowMs) {
  const now = Date.now();
  const arr = (hits.get(key) || []).filter(t => now - t < windowMs);
  if (arr.length >= max) throw new HttpError(429, 'Previše pokušaja. Sačekaj malo pa probaj ponovo.');
  arr.push(now);
  hits.set(key, arr);
}
setInterval(() => { const n = Date.now(); for (const [k, a] of hits) if (!a.some(t => n - t < 3600e3)) hits.delete(k); }, 600e3).unref();

// ---------- modeli ----------
const yr = d => (d ? String(d).slice(0, 4) : '');
// "Golf 7 facelift (2017–2020)"
export function genLabel(m) {
  if (!m) return '';
  let s = m.name;
  if (m.generation_name) s += ' ' + m.generation_name;
  if (m.restyling_second) s += ' facelift 2';
  else if (m.restyling) s += ' facelift';
  if (m.date_from) s += ` (${yr(m.date_from)}–${m.date_to ? yr(m.date_to) : 'danas'})`;
  return s;
}
export function vehicleName(row) {
  // row: make_name, model_name, generation_name, restyling, restyling_second, model_text
  const parts = [];
  if (row.make_name) parts.push(row.make_name);
  if (row.model_name) {
    let s = row.model_name;
    if (row.generation_name) s += ' ' + row.generation_name;
    if (row.restyling_second) s += ' facelift 2';
    else if (row.restyling) s += ' facelift';
    parts.push(s);
  } else if (row.model_text) parts.push(row.model_text);
  return parts.join(' ');
}
export function modelById(id) {
  return id ? get('SELECT m.*, k.name make_name FROM car_model m JOIN car_make k ON k.id=m.make_id WHERE m.id=?', id) : null;
}

// ---------- ulaz ----------
export const str = (v, max = 200) => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim().slice(0, max);
  return s === '' ? null : s;
};
export const int = v => {
  if (v === undefined || v === null || v === '') return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
};
export const num = v => {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
export const bool = v => (v === true || v === 1 || v === '1' || v === 'true' || v === 'on' ? 1 : 0);
export function imgList(v) {
  let a = v;
  if (typeof a === 'string') { try { a = JSON.parse(a); } catch { a = []; } }
  if (!Array.isArray(a)) return '[]';
  return JSON.stringify(a.filter(x => typeof x === 'string' && (/^\/uploads\/[\w.-]+$/.test(x) || /^https:\/\/[^\s"'<>]+$/.test(x))).slice(0, 12));
}
export const parseImgs = s => { try { return JSON.parse(s || '[]'); } catch { return []; } };

export const FUELS = ['dizel', 'benzin', 'benzin + plin', 'hibrid', 'električni'];
export const CITIES = ['Banja Luka', 'Bihać', 'Bijeljina', 'Brčko', 'Bugojno', 'Cazin', 'Doboj', 'Goražde', 'Gradačac', 'Gradiška', 'Kakanj', 'Konjic', 'Livno', 'Lukavac', 'Modriča', 'Mostar', 'Orašje', 'Prijedor', 'Sanski Most', 'Sarajevo', 'Srebrenik', 'Teslić', 'Travnik', 'Trebinje', 'Tešanj', 'Tuzla', 'Visoko', 'Vitez', 'Zavidovići', 'Zenica', 'Zvornik', 'Široki Brijeg', 'Živinice'];

// Pretraga bez obzira na kvačice: "Mjenjač" = "mjenjac"
export function normalize(s) {
  return String(s || '').toLowerCase()
    .replace(/[čć]/g, 'c').replace(/đ/g, 'dj').replace(/š/g, 's').replace(/ž/g, 'z')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}
export function searchWords(q) {
  return normalize(q).split(' ').filter(w => w.length >= 2).slice(0, 6);
}
