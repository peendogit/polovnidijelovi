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
export async function go(path, replace = false) {
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
window.addEventListener('popstate', dispatch);
export function setTitle(t) { document.title = t ? `${t} | polovnidijelovi.com` : 'Polovni auto dijelovi i vozila za dijelove | polovnidijelovi.com'; }

// ---------- meni (drawer) ----------
export function closeDrawer() { const d = $('#drawer'); if (d) d.hidden = true; }

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
