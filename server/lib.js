// Pomoćne funkcije: greške, lozinke, sesije, oznake modela
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { get, DATA_DIR } from './db.js';

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
// Tajni ključ: iz .env; ako nije postavljen (ili je ostao početni), napravi se nasumičan i čuva u data/.secret
function loadSecret() {
  const env = process.env.SECRET;
  if (env && env !== 'promijeni-me' && env.length >= 16) return env;
  const f = path.join(DATA_DIR, '.secret');
  try { const v = fs.readFileSync(f, 'utf8').trim(); if (v.length >= 32) return v; } catch { /* nema */ }
  const v = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(f, v, { mode: 0o600 });
  return v;
}
const SECRET = loadSecret();
const DAYS = 60;
// Potpis uključuje i dio heša lozinke: promjena lozinke odjavljuje sve stare prijave
const sign = (uid, exp, passHash) => crypto.createHmac('sha256', SECRET).update(`${uid}.${exp}.${String(passHash).slice(-24)}`).digest('base64url');
export function makeToken(user) {
  const exp = Date.now() + DAYS * 864e5;
  return `${user.id}.${exp}.${sign(user.id, exp, user.pass_hash)}`;
}
// vraća korisnika ili null
export function userFromToken(tok) {
  if (!tok) return null;
  const [uid, exp, sig] = String(tok).split('.');
  if (!/^\d+$/.test(uid || '') || !/^\d+$/.test(exp || '') || !sig) return null;
  if (Number(exp) < Date.now()) return null;
  const user = get('SELECT * FROM users WHERE id=?', Number(uid));
  if (!user || user.blocked) return null;
  const good = sign(uid, exp, user.pass_hash);
  if (good.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(good), Buffer.from(sig))) return null;
  return user;
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
// Korisnici mogu samo slike učitane na sajt; vanjski https linkovi samo kroz API otpada (external=true)
export function imgList(v, external = false) {
  let a = v;
  if (typeof a === 'string') { try { a = JSON.parse(a); } catch { a = []; } }
  if (!Array.isArray(a)) return '[]';
  return JSON.stringify(a.filter(x => typeof x === 'string' && (/^\/uploads\/[\w.-]+$/.test(x) || (external && /^https:\/\/[^\s"'<>\\`]+$/.test(x)))).slice(0, 12));
}
export const parseImgs = s => { try { return JSON.parse(s || '[]'); } catch { return []; } };

export const FUELS = ['dizel', 'benzin', 'benzin + plin', 'hibrid', 'električni'];
// Svi gradovi i opštine u BiH (+ Brčko distrikt)
export const CITIES = ['Banovići', 'Banja Luka', 'Berkovići', 'Bihać', 'Bijeljina', 'Bileća', 'Bosanska Krupa', 'Bosanski Petrovac', 'Bosansko Grahovo', 'Bratunac', 'Brčko', 'Breza', 'Brod', 'Bugojno', 'Busovača', 'Bužim', 'Cazin', 'Čajniče', 'Čapljina', 'Čelić', 'Čelinac', 'Čitluk', 'Derventa', 'Doboj', 'Doboj Istok', 'Doboj Jug', 'Dobretići', 'Domaljevac-Šamac', 'Donji Vakuf', 'Donji Žabar', 'Drvar', 'Foča', 'Fojnica', 'Gacko', 'Glamoč', 'Goražde', 'Gornji Vakuf-Uskoplje', 'Gračanica', 'Gradačac', 'Gradiška', 'Grude', 'Hadžići', 'Han Pijesak', 'Ilidža', 'Ilijaš', 'Istočni Drvar', 'Istočni Mostar', 'Istočno Sarajevo', 'Jablanica', 'Jajce', 'Jezero', 'Kakanj', 'Kalesija', 'Kalinovik', 'Kiseljak', 'Kladanj', 'Ključ', 'Kneževo', 'Konjic', 'Kostajnica', 'Kotor Varoš', 'Kozarska Dubica', 'Kreševo', 'Krupa na Uni', 'Kupres', 'Laktaši', 'Livno', 'Lopare', 'Lukavac', 'Ljubinje', 'Ljubuški', 'Maglaj', 'Milići', 'Modriča', 'Mostar', 'Mrkonjić Grad', 'Neum', 'Nevesinje', 'Novi Grad', 'Novi Travnik', 'Novo Goražde', 'Odžak', 'Olovo', 'Orašje', 'Osmaci', 'Oštra Luka', 'Pale', 'Pelagićevo', 'Petrovac', 'Petrovo', 'Posušje', 'Prijedor', 'Prnjavor', 'Prozor-Rama', 'Ravno', 'Ribnik', 'Rogatica', 'Rudo', 'Sanski Most', 'Sapna', 'Sarajevo', 'Sokolac', 'Srbac', 'Srebrenica', 'Srebrenik', 'Stanari', 'Stolac', 'Šamac', 'Šekovići', 'Šipovo', 'Široki Brijeg', 'Teočak', 'Teslić', 'Tešanj', 'Tomislavgrad', 'Travnik', 'Trebinje', 'Trnovo', 'Tuzla', 'Ugljevik', 'Usora', 'Vareš', 'Velika Kladuša', 'Visoko', 'Višegrad', 'Vitez', 'Vlasenica', 'Vogošća', 'Vukosavlje', 'Zavidovići', 'Zenica', 'Zvornik', 'Žepče', 'Živinice'];

// Pretraga bez obzira na kvačice: "Mjenjač" = "mjenjac"
export function normalize(s) {
  return String(s || '').toLowerCase()
    .replace(/[čć]/g, 'c').replace(/đ/g, 'dj').replace(/š/g, 's').replace(/ž/g, 'z')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}
export function searchWords(q) {
  return normalize(q).split(' ').filter(w => w.length >= 2).slice(0, 6);
}

const COLOR_LIST = ['bež', 'bijela', 'bordo', 'crna', 'crvena', 'ljubičasta', 'narandžasta', 'plava', 'siva', 'smeđa', 'srebrena', 'zelena', 'zlatna', 'žuta'];
// stare (detaljnije) boje -> glavna boja
export const COLOR_MERGE = {
  'biserno bijela': 'bijela', 'mat crna': 'crna', 'tamno siva (grafit)': 'siva', 'mat siva': 'siva',
  'tamno plava': 'plava', 'svijetlo plava': 'plava', 'tirkizna': 'plava', 'tamno zelena': 'zelena', 'maslinasta': 'zelena',
  'šampanj': 'bež', 'bakarna': 'smeđa', 'roza': 'ostalo', 'dvobojna': 'ostalo',
};
// po abecedi (č, ć, š, ž na svom mjestu); "ostalo" uvijek na kraju
export const COLORS = [...COLOR_LIST.sort((a, b) => a.localeCompare(b, 'bs')), 'ostalo'];
export const upper = (v, max) => { const s = str(v, max); return s ? s.toUpperCase() : null; };
// mjenjač: samo 'manuelni' ili 'automatik' (DSG, tiptronic… = automatik)
export const gearboxKind = v => { const s = String(v || '').toLowerCase(); return /auto|dsg|tiptr|cvt|steptr|s.?tronic|dct/.test(s) ? 'automatik' : /manu|ru[cč]n/.test(s) ? 'manuelni' : null; };
// karoserija i pogon: isti nazivi svuda (shop šalje npr. 'Hatchback', 'Coupe', 'Van')
export const BODIES = ['limuzina', 'hečbek', 'karavan', 'SUV', 'kupe', 'kabrio', 'monovolumen', 'kombi', 'pickup'];
const BODY_MAP = { hatchback: 'hečbek', hecbek: 'hečbek', sedan: 'limuzina', limousine: 'limuzina', caravan: 'karavan', kombi: 'kombi', van: 'kombi', coupe: 'kupe', 'coupé': 'kupe', kabriolet: 'kabrio', cabrio: 'kabrio', cabriolet: 'kabrio', suv: 'SUV', dzip: 'SUV', 'džip': 'SUV', minivan: 'monovolumen', mpv: 'monovolumen', 'pick-up': 'pickup' };
export const bodyKind = v => { const s = String(v || '').trim().toLowerCase(); if (!s) return null; return BODY_MAP[s] || BODIES.find(b => b.toLowerCase() === s) || null; };
export const driveKind = v => { const s = String(v || '').trim().toLowerCase(); return ['prednji', 'zadnji', '4x4'].includes(s) ? s : /awd|4wd|4x4|quattro|4motion|xdrive/.test(s) ? '4x4' : /fwd/.test(s) ? 'prednji' : /rwd/.test(s) ? 'zadnji' : null; };
export const gearsInt = v => { const n = int(v); return n >= 4 && n <= 9 ? n : null; };
