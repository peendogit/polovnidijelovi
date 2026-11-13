// SEO: naslov/opis/slika za svaku stranicu (Google i dijeljenje na Viber/Facebook), sitemap, lijepi linkovi modela
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { all, get } from './db.js';
import { app } from './router.js';
import { parseImgs, vehicleName, normalize } from './lib.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = path.join(ROOT, 'public/index.html');
let tpl = null, tplTime = 0;
function template() {
  const t = fs.statSync(INDEX).mtimeMs;
  if (!tpl || t !== tplTime) { tpl = fs.readFileSync(INDEX, 'utf8'); tplTime = t; }
  return tpl;
}
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const slug = s => normalize(s).replace(/ /g, '-');

const SITE = 'polovnidijelovi.com';
const DEF_DESC = 'Polovni auto dijelovi i vozila za dijelove sa otpada iz cijele BiH. Pretraga po marki, modelu i generaciji (i facelift). Objavi „Tražim dio“ i otpadi ti se javljaju sa cijenom.';

function findSlug(mk, md) {
  const make = all('SELECT id, name FROM car_make WHERE active=1').find(m => slug(m.name) === mk);
  if (!make) return null;
  if (!md) return { make_id: make.id, make_name: make.name, model: null };
  const model = all('SELECT DISTINCT name FROM car_model WHERE make_id=? AND active=1', make.id).find(m => slug(m.name) === md);
  return model ? { make_id: make.id, make_name: make.name, model: model.name } : null;
}
app.get('/api/slug', ({ query }) => findSlug(query.make, query.model));

function meta(p) {
  let m;
  if ((m = p.match(/^\/dio\/(\d+)/))) {
    const r = get(`SELECT p.title, p.price, p.city, p.images, p.year, p.status, k.name make_name, mo.name model_name, mo.generation_name, mo.restyling, mo.restyling_second, p.model_text
      FROM parts p LEFT JOIN car_make k ON k.id=p.make_id LEFT JOIN car_model mo ON mo.id=p.model_id WHERE p.id=?`, Number(m[1]));
    if (!r || r.status === 'hidden') return { status: 404, title: 'Oglas ne postoji' };
    const v = vehicleName(r);
    return {
      title: `${r.title} ${v}${r.year ? ' ' + r.year : ''} — ${r.price ? r.price + ' KM' : 'cijena na upit'}`,
      desc: `${r.title} za ${v}. ${r.city ? 'Lokacija: ' + r.city + '. ' : ''}Polovni dio sa otpada — pozovi prodavca direktno.`,
      img: parseImgs(r.images)[0],
    };
  }
  if ((m = p.match(/^\/vozilo\/(\d+)/))) {
    const r = get(`SELECT v.year, v.engine, v.city, v.images, v.status, k.name make_name, mo.name model_name, mo.generation_name, mo.restyling, mo.restyling_second, v.model_text
      FROM vehicles v LEFT JOIN car_make k ON k.id=v.make_id LEFT JOIN car_model mo ON mo.id=v.model_id WHERE v.id=?`, Number(m[1]));
    if (!r || r.status === 'hidden') return { status: 404, title: 'Vozilo ne postoji' };
    const v = vehicleName(r);
    return {
      title: `${v}${r.year ? ' ' + r.year : ''}${r.engine ? ' ' + r.engine : ''} — vozilo za dijelove`,
      desc: `${v} se rastavlja za dijelove${r.city ? ' u mjestu ' + r.city : ''}. Pitaj za bilo koji dio sa ovog vozila.`,
      img: parseImgs(r.images)[0],
    };
  }
  if ((m = p.match(/^\/prodavac\/(\d+)/))) {
    const u = get("SELECT name, city, about, logo FROM users WHERE id=? AND blocked=0", Number(m[1]));
    if (!u) return { status: 404, title: 'Prodavac ne postoji' };
    return { title: `${u.name}${u.city ? ' — ' + u.city : ''} | polovni dijelovi`, desc: u.about || `Polovni dijelovi i vozila za dijelove: ${u.name}.`, img: u.logo };
  }
  if ((m = p.match(/^\/polovni-dijelovi\/([\w-]+)(?:\/([\w-]+))?/))) {
    const s = findSlug(m[1], m[2]);
    if (!s) return { status: 404, title: 'Nije pronađeno' };
    const name = `${s.make_name}${s.model ? ' ' + s.model : ''}`;
    return { title: `Polovni dijelovi ${name} — otpadi BiH`, desc: `Polovni dijelovi za ${name}: farovi, branici, motori, mjenjači i ostalo sa otpada iz cijele BiH. Vozila ${name} za dijelove.` };
  }
  if (p.startsWith('/vozila')) return { title: 'Vozila za dijelove na otpadima u BiH', desc: 'Sva vozila koja se rastavljaju za dijelove na otpadima. Izaberi model i pitaj otpad za dio.' };
  if (p.startsWith('/trazim')) return { title: 'Tražim dio — kupci traže polovne dijelove', desc: 'Objavi koji dio tražiš, a otpadi ti se javljaju sa cijenom.' };
  if (p.startsWith('/dijelovi')) return { title: 'Polovni auto dijelovi — pretraga', desc: DEF_DESC };
  if (p.startsWith('/otpadi')) return { title: 'Auto otpadi u BiH', desc: 'Spisak auto otpada i prodavaca polovnih dijelova u BiH.' };
  return {};
}

export function renderIndex(p, host = SITE) {
  const m = meta(p);
  const title = m.title ? `${m.title} | ${SITE}` : `Polovni auto dijelovi i vozila za dijelove | ${SITE}`;
  const abs = u => (u.startsWith('http') ? u : `https://${host}${u}`);
  const img = abs(m.img || '/icons/og.png');
  const body = template()
    .replace(/__TITLE__/g, esc(title))
    .replace(/__DESC__/g, esc((m.desc || DEF_DESC).slice(0, 300)))
    .replace(/__IMG__/g, esc(img));
  return { status: m.status || 200, body };
}

export function sitemap(base) {
  const urls = ['/', '/dijelovi', '/vozila', '/trazim', '/otpadi'];
  const models = all(`SELECT DISTINCT k.name make_name, mo.name model_name FROM (
      SELECT model_id FROM parts WHERE status='active' UNION SELECT model_id FROM vehicles WHERE status='active') x
    JOIN car_model mo ON mo.id=x.model_id JOIN car_make k ON k.id=mo.make_id`);
  for (const r of models) urls.push(`/polovni-dijelovi/${slug(r.make_name)}/${slug(r.model_name)}`);
  for (const r of all("SELECT id FROM vehicles WHERE status='active' ORDER BY id DESC LIMIT 5000")) urls.push(`/vozilo/${r.id}`);
  for (const r of all("SELECT id FROM parts WHERE status='active' ORDER BY id DESC LIMIT 40000")) urls.push(`/dio/${r.id}`);
  for (const r of all("SELECT id FROM users WHERE type='otpad' AND blocked=0")) urls.push(`/prodavac/${r.id}`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `<url><loc>${base}${u}</loc></url>`).join('\n')}\n</urlset>\n`;
}
