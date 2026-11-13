// Osnova: API pozivi, HTML šabloni sa zaštitom, ruter, poruke
export class Raw { constructor(s) { this.s = s; } toString() { return this.s; } }
export const raw = s => new Raw(String(s ?? ''));
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function val(v) {
  if (v === null || v === undefined || v === false) return '';
  if (v instanceof Raw) return v.s;
  if (Array.isArray(v)) return v.map(val).join('');
  return esc(v);
}
// html`<b>${tekst}</b>` — sve ubačeno se automatski "escape"-uje
export function html(strings, ...vals) {
  let out = strings[0];
  vals.forEach((v, i) => { out += val(v) + strings[i + 1]; });
  return new Raw(out);
}
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export function render(el, tpl) { el.innerHTML = tpl instanceof Raw ? tpl.s : esc(tpl); }

// ---------- API ----------
export async function api(path, opts = {}) {
  const o = { method: opts.method || (opts.body ? 'POST' : 'GET'), headers: {}, credentials: 'same-origin' };
  if (opts.body !== undefined) { o.headers['Content-Type'] = 'application/json'; o.body = JSON.stringify(opts.body); }
  let res;
  try { res = await fetch(path, o); } catch { throw new Error('Nema interneta. Provjeri vezu.'); }
  let data = null;
  try { data = await res.json(); } catch { /* prazno */ }
  if (!res.ok) {
    const e = new Error(data?.error || 'Greška (' + res.status + ')');
    e.status = res.status;
    throw e;
  }
  return data;
}
export const qs = obj => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) if (v !== null && v !== undefined && v !== '' && v !== false) p.set(k, v);
  const s = p.toString();
  return s ? '?' + s : '';
};

// ---------- stanje ----------
export const state = { user: null, counts: {}, meta: null, makes: null };
const listeners = new Set();
export const onMe = fn => listeners.add(fn);
export async function loadMe() {
  try {
    const r = await api('/api/me');
    state.user = r.user; state.counts = r.counts || {};
  } catch { state.user = null; state.counts = {}; }
  listeners.forEach(f => f());
  return state.user;
}
export function setMe(r) { state.user = r.user; state.counts = r.counts || {}; listeners.forEach(f => f()); }
export async function getMeta() { if (!state.meta) state.meta = await api('/api/meta'); return state.meta; }
export async function getMakes() { if (!state.makes) state.makes = await api('/api/makes'); return state.makes; }

// ---------- poruke ----------
let tt;
export function toast(msg, bad = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast show' + (bad ? ' bad' : '');
  clearTimeout(tt);
  tt = setTimeout(() => { t.className = 'toast'; }, bad ? 4000 : 2600);
}
export const fail = e => toast(e?.message || String(e), true);

// ---------- ruter ----------
const routes = [];
export const route = (pattern, page) => {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '/?$');
  routes.push({ re, keys, page });
};
let navId = 0;
// ---------- prozori preko stranice (slika preko cijelog ekrana, modal, meni) ----------
// Svaki otvoreni prozor dobije svoj korak u istoriji, pa ga dugme "nazad" na telefonu zatvori.
const overlays = [];
let skipPop = 0, backDone = null, backWait = null;
export function pushOverlay(closeFn) {
  overlays.push(closeFn);
  history.pushState({ ov: overlays.length }, '', location.href);
  // vraća funkciju za zatvaranje iz interfejsa (X, klik pored...)
  return () => {
    const i = overlays.indexOf(closeFn);
    if (i < 0) return;
    overlays.splice(i, 1);
    closeFn();
    skipPop++;
    backWait = new Promise(r => { backDone = r; });
    history.back();
  };
}
function closeAllOverlays() { while (overlays.length) overlays.pop()(); }

// Da li je stranica otvorena dugmetom "nazad" (tada liste vraćamo kako su bile)
export const nav = { back: false };
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

export async function go(path, replace = false) {
  if (backWait) await backWait;
  nav.back = false;
  if (overlays.length) { closeAllOverlays(); replace = true; }
  if (replace) history.replaceState({}, '', path); else history.pushState({}, '', path);
  await dispatch();
  window.scrollTo(0, 0);
}
export async function dispatch() {
  const id = ++navId;
  const url = new URL(location.href);
  const view = $('#view');
  closeDrawer();
  for (const r of routes) {
    const m = url.pathname.match(r.re);
    if (!m) continue;
    const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
    const query = Object.fromEntries(url.searchParams);
    try {
      await r.page({ el: view, params, query, isCurrent: () => id === navId });
    } catch (e) {
      if (id !== navId) return;
      if (e.status === 401) { go('/prijava?next=' + encodeURIComponent(url.pathname + url.search), true); return; }
      render(view, html`<div class="wrap" style="padding-top:24px"><div class="empty"><strong>${e.status === 404 ? 'Nije pronađeno' : 'Greška'}</strong>${e.message}<div style="margin-top:14px"><a class="btn dark" href="/" data-link>Na početnu</a></div></div></div>`);
    }
    document.dispatchEvent(new CustomEvent('routechange'));
    return;
  }
  render(view, html`<div class="wrap" style="padding-top:24px"><div class="empty"><strong>Stranica ne postoji</strong><a href="/" data-link>Na početnu</a></div></div>`);
}
// presretanje klikova na unutrašnje linkove
document.addEventListener('click', e => {
  const a = e.target.closest('a[href]');
  if (!a || a.target || a.hasAttribute('download') || e.ctrlKey || e.metaKey || e.shiftKey) return;
  const href = a.getAttribute('href');
  if (!href.startsWith('/') || href.startsWith('//') || href.startsWith('/uploads/') || href.startsWith('/api/')) return;
  e.preventDefault();
  go(href);
});
window.addEventListener('popstate', () => {
  if (skipPop) { skipPop--; if (!skipPop) { backDone?.(); backWait = null; } return; }
  if (overlays.length) { overlays.pop()(); return; } // "nazad" zatvara prozor, stranica ostaje
  nav.back = true;
  dispatch().then(() => { nav.back = false; });
});
export function setTitle(t) { document.title = t ? `${t} | polovnidijelovi.com` : 'Polovni auto dijelovi i vozila za dijelove | polovnidijelovi.com'; }

// ---------- meni (drawer) ----------
export function closeDrawer() { const d = $('#drawer'); if (d) d.hidden = true; }
export function closeOverlays() { closeAllOverlays(); }

// ---------- formatiranje ----------
export const km = v => (v === null || v === undefined || v === '' ? 'Na upit' : Number(v).toLocaleString('bs-BA', { maximumFractionDigits: 2 }) + ' KM');
export function ago(s) {
  if (!s) return '';
  const d = new Date(s.replace(' ', 'T') + 'Z');
  const m = Math.round((Date.now() - d) / 60000);
  if (m < 1) return 'upravo';
  if (m < 60) return `prije ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `prije ${h} h`;
  const days = Math.round(h / 24);
  if (days === 1) return 'jučer';
  if (days < 30) return `prije ${days} dana`;
  return d.toLocaleDateString('bs-BA');
}
// telefon: 065123456 -> +38765123456
export function intlPhone(p) {
  let s = String(p || '').replace(/[^\d+]/g, '');
  if (s.startsWith('00')) s = '+' + s.slice(2);
  else if (s.startsWith('0')) s = '+387' + s.slice(1);
  else if (!s.startsWith('+')) s = '+' + s;
  return s;
}
export const thumb = u => (u && u.startsWith('/uploads/') ? u.replace(/\.(jpg|png|webp)$/, '_t.jpg') : u);
// formular -> objekat
export function formData(form) {
  const o = {};
  for (const el of form.elements) {
    if (!el.name) continue;
    if (el.type === 'checkbox') o[el.name] = el.checked;
    else if (el.type === 'radio') { if (el.checked) o[el.name] = el.value; }
    else o[el.name] = el.value;
  }
  return o;
}
export function busy(btn, on, text) {
  if (!btn) return;
  if (on) { btn.dataset.t = btn.textContent; btn.disabled = true; if (text) btn.textContent = text; }
  else { btn.disabled = false; if (btn.dataset.t) btn.textContent = btn.dataset.t; }
}
// "Moj auto" — pamti se na telefonu
export const myCar = {
  get() { try { return JSON.parse(localStorage.getItem('pd_car') || 'null'); } catch { return null; } },
  set(v) { try { v ? localStorage.setItem('pd_car', JSON.stringify(v)) : localStorage.removeItem('pd_car'); } catch { /* */ } },
};

// ---------- zapamćene liste (za povratak "nazad" na isto mjesto) ----------
export const listCache = new Map(); // ključ: adresa stranice -> { items, total, page, y }
export const pageKey = () => location.pathname + location.search;
let st;
window.addEventListener('scroll', () => {
  clearTimeout(st);
  st = setTimeout(() => { const c = listCache.get(pageKey()); if (c) c.y = window.scrollY; }, 120);
}, { passive: true });

// ---------- lijepi linkovi: /dio/123-far-prednji-lijevi-5g0941005 ----------
export function slugify(t) {
  return String(t || '').toLowerCase()
    .replace(/[čć]/g, 'c').replace(/đ/g, 'dj').replace(/š/g, 's').replace(/ž/g, 'z')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80).replace(/-+$/, '');
}
const withSlug = (base, id, text) => { const sl = slugify(text); return `${base}${id}${sl ? '-' + sl : ''}`; };
export const partUrl = p => withSlug('/dio/', p.id, [p.title, p.model_name || p.model_text, p.part_no].filter(Boolean).join(' '));
export const vehicleUrl = v => withSlug('/vozilo/', v.id, [v.make_name, v.model_name || v.model_text, v.year].filter(Boolean).join(' '));
// ako je otvoren stari/kratki link, zamijeni adresu pravom (bez novog koraka u istoriji)
export function canonical(url) {
  if (location.pathname !== url) history.replaceState(history.state, '', url + location.search + location.hash);
}
