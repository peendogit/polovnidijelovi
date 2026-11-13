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
const cut = t => slug(t).slice(0, 80).replace(/-+$/, '');
const withSlug = (base, id, text) => { const sl = cut(text); return `${base}${id}${sl ? '-' + sl : ''}`; };
export const partPath = r => withSlug('/dio/', r.id, [r.title, r.model_name || r.model_text, r.part_no].filter(Boolean).join(' '));
export const vehiclePath = r => withSlug('/vozilo/', r.id, [r.make_name, r.model_name || r.model_text, r.year].filter(Boolean).join(' '));

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
    const r = get(`SELECT p.id, p.title, p.part_no, p.condition, p.description, p.price, p.city, p.images, p.year, p.status, k.name make_name, mo.name model_name, mo.generation_name, mo.restyling, mo.restyling_second, p.model_text
      FROM parts p LEFT JOIN car_make k ON k.id=p.make_id LEFT JOIN car_model mo ON mo.id=p.model_id WHERE p.id=?`, Number(m[1]));
    if (!r || r.status === 'hidden') return { status: 404, title: 'Oglas ne postoji' };
    const v = vehicleName(r);
    return {
      title: `${r.title} ${v}${r.year ? ' ' + r.year : ''} — ${r.price ? r.price + ' KM' : 'cijena na upit'}`,
      desc: `${r.title}${r.part_no ? ' (' + r.part_no + ')' : ''} za ${v}. ${r.city ? 'Lokacija: ' + r.city + '. ' : ''}Polovni dio sa otpada — pozovi prodavca direktno.`,
      img: parseImgs(r.images)[0],
      canon: partPath(r),
      ld: {
        '@context': 'https://schema.org', '@type': 'Product', name: `${r.title} ${v}`.trim(),
        ...(r.part_no ? { mpn: r.part_no } : {}), ...(r.make_name ? { brand: { '@type': 'Brand', name: r.make_name } } : {}),
        image: parseImgs(r.images).slice(0, 5), description: (r.description || '').slice(0, 300) || undefined,
        offers: r.price ? { '@type': 'Offer', price: r.price, priceCurrency: 'BAM', itemCondition: r.condition === 'novo' ? 'https://schema.org/NewCondition' : r.condition === 'oštećeno' ? 'https://schema.org/DamagedCondition' : 'https://schema.org/UsedCondition', availability: r.status === 'active' ? 'https://schema.org/InStock' : 'https://schema.org/SoldOut' } : undefined,
      },
    };
  }
  if ((m = p.match(/^\/vozilo\/(\d+)/))) {
    const r = get(`SELECT v.id, v.year, v.engine, v.city, v.images, v.status, k.name make_name, mo.name model_name, mo.generation_name, mo.restyling, mo.restyling_second, v.model_text
      FROM vehicles v LEFT JOIN car_make k ON k.id=v.make_id LEFT JOIN car_model mo ON mo.id=v.model_id WHERE v.id=?`, Number(m[1]));
    if (!r || r.status === 'hidden') return { status: 404, title: 'Vozilo ne postoji' };
    const v = vehicleName(r);
    return {
      title: `${v}${r.year ? ' ' + r.year : ''}${r.engine ? ' ' + r.engine : ''} — vozilo za dijelove`,
      desc: `${v} se rastavlja za dijelove${r.city ? ' u mjestu ' + r.city : ''}. Pitaj za bilo koji dio sa ovog vozila.`,
      img: parseImgs(r.images)[0],
      canon: vehiclePath(r),
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

// Za Google: obični linkovi na oglase i stranice (vidi ih i bez JavaScripta)
function seoList(p, sp) {
  const page = Math.max(1, parseInt(sp?.get('stranica'), 10) || 1);
  const per = 24, off = (page - 1) * per;
  let rows = [], total = 0, base = p, kind = 'dio';
  const parts = (where, args) => {
    total = get(`SELECT COUNT(*) c FROM parts p WHERE p.status='active' ${where}`, ...args).c;
    rows = all(`SELECT p.id, p.title t, p.title, p.part_no, p.model_text, k.name mk, mo.name md, mo.name model_name, p.price FROM parts p LEFT JOIN car_make k ON k.id=p.make_id LEFT JOIN car_model mo ON mo.id=p.model_id
      WHERE p.status='active' ${where} ORDER BY p.id DESC LIMIT ? OFFSET ?`, ...args, per, off);
  };
  let m;
  if (p === '/dijelovi') parts('', []);
  else if ((m = p.match(/^\/polovni-dijelovi\/([\w-]+)(?:\/([\w-]+))?$/))) {
    const sl = findSlug(m[1], m[2]);
    if (!sl) return '';
    if (sl.model) parts('AND p.model_id IN (SELECT id FROM car_model WHERE make_id=? AND name=?)', [sl.make_id, sl.model]);
    else parts('AND p.make_id=?', [sl.make_id]);
  } else if (p === '/vozila') {
    kind = 'vozilo';
    total = get("SELECT COUNT(*) c FROM vehicles WHERE status='active'").c;
    rows = all(`SELECT v.id, k.name mk, k.name make_name, mo.name md, mo.name model_name, v.model_text, v.year, v.year t FROM vehicles v LEFT JOIN car_make k ON k.id=v.make_id LEFT JOIN car_model mo ON mo.id=v.model_id
      WHERE v.status='active' ORDER BY v.id DESC LIMIT ? OFFSET ?`, per, off);
  } else return '';
  const pages = Math.ceil(total / per);
  const links = rows.map(r => `<li><a href="${kind === 'dio' ? partPath(r) : vehiclePath(r)}">${esc([r.t, r.mk, r.md].filter(Boolean).join(' '))}</a></li>`).join('');
  const nav = [];
  if (page > 1) nav.push(`<a href="${base}${page > 2 ? '?stranica=' + (page - 1) : ''}">Prethodna stranica</a>`);
  if (page < pages) nav.push(`<a href="${base}?stranica=${page + 1}">Sljedeća stranica</a>`);
  return `<noscript><ul>${links}</ul><p>${nav.join(' | ')}</p></noscript>`;
}

export function renderIndex(p, host = SITE, sp = null) {
  const m = meta(p);
  const title = m.title ? `${m.title} | ${SITE}` : `Polovni auto dijelovi i vozila za dijelove | ${SITE}`;
  const abs = u => (u.startsWith('http') ? u : `https://${host}${u}`);
  const img = abs(m.img || '/icons/og.png');
  if (m.ld?.image) m.ld.image = m.ld.image.map(abs);
  const body = template()
    .replace(/__TITLE__/g, esc(title))
    .replace(/__DESC__/g, esc((m.desc || DEF_DESC).slice(0, 300)))
    .replace(/__IMG__/g, esc(img))
    .replace('<!--SEO-->', seoList(p, sp))
    .replace(/__CANON__/g, esc(`https://${host}${m.canon || (p + (sp?.get('stranica') ? '?stranica=' + Number(sp.get('stranica')) : ''))}`))
    .replace('<!--JSONLD-->', m.ld ? `<script type="application/ld+json">${JSON.stringify(m.ld).replace(/</g, '\\u003c')}</script>` : '');
  return { status: m.status || 200, body };
}

export function sitemap(base) {
  const urls = ['/', '/dijelovi', '/vozila', '/trazim', '/otpadi'];
  const models = all(`SELECT DISTINCT k.name make_name, mo.name model_name FROM (
      SELECT model_id FROM parts WHERE status='active' UNION SELECT model_id FROM vehicles WHERE status='active') x
    JOIN car_model mo ON mo.id=x.model_id JOIN car_make k ON k.id=mo.make_id`);
  for (const r of models) urls.push(`/polovni-dijelovi/${slug(r.make_name)}/${slug(r.model_name)}`);
  for (const r of all(`SELECT v.id, v.year, v.model_text, k.name make_name, mo.name model_name FROM vehicles v LEFT JOIN car_make k ON k.id=v.make_id
      LEFT JOIN car_model mo ON mo.id=v.model_id WHERE v.status='active' ORDER BY v.id DESC LIMIT 5000`)) urls.push(vehiclePath(r));
  for (const r of all(`SELECT p.id, p.title, p.part_no, p.model_text, mo.name model_name FROM parts p LEFT JOIN car_model mo ON mo.id=p.model_id
      WHERE p.status='active' ORDER BY p.id DESC LIMIT 40000`)) urls.push(partPath(r));
  for (const r of all("SELECT id FROM users WHERE type='otpad' AND blocked=0")) urls.push(`/prodavac/${r.id}`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `<url><loc>${base}${u}</loc></url>`).join('\n')}\n</urlset>\n`;
}
