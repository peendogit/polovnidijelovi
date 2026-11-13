// Dijelovi interfejsa koji se ponavljaju
import { html, raw, render, $, $$, api, esc, km, ago, intlPhone, thumb, getMakes, getMeta, toast, fail, busy, state, pushOverlay } from './core.js';

// ---------- ikone (stroke SVG) ----------
const P = {
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  car: '<path d="M3 13l2-5a2 2 0 0 1 2-1h10a2 2 0 0 1 2 1l2 5v4H3z"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>',
  send: '<path d="M3 11l18-8-8 18-2-8-8-2z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  wrench: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4 2.6-2.6z"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
  chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
  back: '<path d="M15 6l-6 6 6 6"/>',
  right: '<path d="M9 6l6 6-6 6"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  pin: '<path d="M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  x: '<path d="M18 6L6 18M6 6l12 12"/>',
  camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  store: '<path d="M3 9l1.5-5h15L21 9M4 9v11h16V9M9 20v-6h6v6"/><path d="M3 9h18"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/>',
  truck: '<path d="M1 4h14v12H1zM15 9h4l3 3v4h-7"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  flag: '<path d="M4 22V4M4 4h13l-2 4 2 4H4"/>',
};
export const icon = (name, size = 22, color = 'currentColor', sw = 2) =>
  raw(`<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`);

export const img = (src, cls = 'thumb', alt = '') => src
  ? html`<img class="${cls}" src="${thumb(src)}" alt="${alt}" loading="lazy" onerror="if(!this.dataset.f){this.dataset.f=1;this.src='${raw(esc(src))}'}">`
  : html`<div class="${cls}" aria-hidden="true">${icon('camera', 22, '#9AA0A8', 1.6)}</div>`;

export const verifiedBadge = v => v ? html`<span class="verified">${icon('shield', 14, '#145C2B', 2.2)} Provjeren otpad</span>` : '';

// ---------- kartice ----------
export function partRow(p, opts = {}) {
  const st = p.status && p.status !== 'active' ? html` <span class="badge ${p.status === 'sold' ? 'ok' : ''}">${p.status === 'sold' ? 'Prodato' : 'Skriveno'}</span>` : '';
  return html`<a class="row-item" href="/dio/${p.id}">
    ${img(p.images?.[0], 'thumb', p.title)}
    <div class="info">
      <span class="t">${p.title}${st}</span>
      <span class="s">${[p.vehicle || p.model_text, p.year].filter(Boolean).join(' · ')}</span>
      <span class="s">${[p.seller_name && !opts.noSeller ? p.seller_name : null, p.city].filter(Boolean).join(' · ')}${opts.views ? ` · ${p.views} pregleda` : ''}</span>
      <span class="p">${km(p.price)}</span>
    </div>
  </a>`;
}

export function vehicleRow(v, opts = {}) {
  const st = v.status && v.status !== 'active' ? html` <span class="badge">${v.status === 'done' ? 'Rastavljeno' : 'Skriveno'}</span>` : '';
  return html`<a class="row-item" href="/vozilo/${v.id}">
    ${img(v.images?.[0], 'thumb lg', v.vehicle)}
    <div class="info">
      <span class="t">${v.vehicle || v.model_text}${st}</span>
      <span class="s">${[v.year, v.fuel, v.engine, v.power_kw ? v.power_kw + ' kW' : null].filter(Boolean).join(' · ')}</span>
      <span class="s">${[opts.noSeller ? null : v.seller_name, v.city].filter(Boolean).join(' · ')}</span>
      <span class="s" style="font-weight:700;color:var(--text)">${v.parts_count ? `${v.parts_count} dijelova objavljeno · ` : ''}Pitaj za dio →</span>
    </div>
  </a>`;
}

export function vehicleCard(v) {
  return html`<div class="vcard">
    <a href="/vozilo/${v.id}" class="ph" style="text-decoration:none">${v.images?.[0] ? html`<img src="${v.images[0]}" alt="${v.vehicle}" loading="lazy">` : icon('car', 40, '#9AA0A8', 1.4)}
      <span class="badge dark">Rastavlja se</span></a>
    <div class="body">
      <a href="/vozilo/${v.id}" style="text-decoration:none">
        <div class="name">${v.vehicle || v.model_text}</div>
        <div class="meta">${[v.year, v.fuel, v.engine, v.power_kw ? v.power_kw + ' kW' : null, v.city].filter(Boolean).join(' · ')}</div>
      </a>
      <div class="meta" style="display:flex;align-items:center;gap:6px;color:#3B414A">${icon('pin', 16)} ${v.seller_name}${v.seller_verified ? html` ${verifiedBadge(1)}` : ''}</div>
      <div class="btns">
        ${v.seller_phone ? html`<a class="btn accent" href="tel:${intlPhone(v.seller_phone)}">${icon('phone', 17)} Pozovi</a>` : ''}
        <a class="btn line" href="/vozilo/${v.id}#pitaj">Pitaj za dio</a>
      </div>
    </div>
  </div>`;
}

export function requestRow(r) {
  return html`<a class="row-item" href="/trazim/${r.id}">
    <div class="thumb" style="width:52px;height:52px;border-radius:26px;background:var(--accent)">${icon('send', 20, '#1B1E22')}</div>
    <div class="info">
      <span class="t">${r.part}</span>
      <span class="s">${[r.vehicle || r.model_text, r.year].filter(Boolean).join(' · ')}</span>
      <span class="s">${[r.city, ago(r.created_at)].filter(Boolean).join(' · ')}${r.status === 'closed' ? ' · zatvoren' : ''}</span>
      <span class="s" style="font-weight:700;color:var(--text)">${r.offers ? `${r.offers} ${r.offers === 1 ? 'ponuda' : 'ponuda'}` : 'Još nema ponuda'}${r.my_offer !== undefined && r.my_offer !== null ? ` · tvoja: ${km(r.my_offer)}` : ''}${r.new_offers ? html` <span class="num">${r.new_offers} nova</span>` : ''}</span>
    </div>
  </a>`;
}

export function listOr(items, fn, empty) {
  return items?.length ? html`<div class="list">${items.map(fn)}</div>` : html`<div class="empty">${empty}</div>`;
}

// ---------- kontakt ----------
export function contactButtons(s, ctx = '') {
  if (!s?.phone) return '';
  const tel = intlPhone(s.phone);
  const text = encodeURIComponent(ctx ? `Pozdrav, vidio sam na polovnidijelovi.com: ${ctx}` : 'Pozdrav, vidio sam oglas na polovnidijelovi.com');
  return html`<a class="btn accent" href="tel:${tel}">${icon('phone', 18)} Pozovi</a>
    ${s.viber ? html`<a class="btn viber" href="viber://chat?number=${encodeURIComponent(tel)}">${icon('chat', 18)} Viber</a>` : ''}
    ${s.whatsapp ? html`<a class="btn wa" href="https://wa.me/${tel.replace('+', '')}?text=${text}" target="_blank" rel="noopener">${icon('chat', 18)} WhatsApp</a>` : ''}`;
}
export function sellerBlock(s) {
  return html`<a class="seller" href="/prodavac/${s.id}">
    <div class="avatar">${s.logo ? html`<img src="${s.logo}" alt="">` : (s.name || '?')[0].toUpperCase()}</div>
    <div style="flex:1;min-width:0">
      <div style="font-weight:700;font-size:16px">${s.name}</div>
      <div class="hint">${[s.type === 'otpad' ? 'Auto otpad' : 'Privatni prodavac', s.city].filter(Boolean).join(' · ')}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:2px">${verifiedBadge(s.verified)}${s.ships ? html`<span class="verified" style="color:var(--text)">${icon('truck', 14)} Šalje brzom poštom</span>` : ''}</div>
    </div>
    ${icon('right', 18, '#5A616B')}
  </a>`;
}

// ---------- modal ----------
export function modal(title, body, onMount) {
  const m = document.createElement('div');
  m.className = 'modal';
  m.innerHTML = html`<div class="box" role="dialog" aria-modal="true" aria-label="${title}">
    <div class="mh"><h2>${title}</h2><button class="icon-btn" data-close aria-label="Zatvori">${icon('x')}</button></div>
    ${body}</div>`.s;
  const close = pushOverlay(() => { m.remove(); document.removeEventListener('keydown', onKey); });
  const onKey = e => { if (e.key === 'Escape') close(); };
  m.addEventListener('click', e => { if (e.target === m || e.target.closest('[data-close]')) close(); });
  document.addEventListener('keydown', onKey);
  document.body.appendChild(m);
  onMount?.(m, close);
  m.querySelector('input,select,textarea')?.focus();
  return close;
}
export function confirmBox(text, yes = 'Da') {
  return new Promise(res => {
    let done = false;
    const close = modal('Potvrdi', html`<p style="margin:0 0 16px">${text}</p><div class="btns"><button class="btn line" data-close>Odustani</button><button class="btn dark" id="cfYes">${yes}</button></div>`, (m, c) => {
      $('#cfYes', m).onclick = () => { done = true; c(); res(true); };
      new MutationObserver(() => { if (!document.body.contains(m) && !done) res(false); }).observe(document.body, { childList: true });
    });
    return close;
  });
}

// ---------- galerija ----------
export function gallery(images, alt) {
  if (!images?.length) return html`<div class="gallery none">${icon('camera', 40, '#9AA0A8', 1.4)}</div>`;
  return html`<div class="gallery"><div class="strip">${images.map((s, i) => html`<img src="${s}" alt="${alt} — slika ${i + 1}" data-i="${i}" ${i ? raw('loading="lazy"') : ''}>`)}</div>
    ${images.length > 1 ? html`<span class="n"><span class="gi">1</span>/${images.length}</span>` : ''}</div>`;
}
export function bindGallery(root, images) {
  const strip = $('.gallery .strip', root);
  if (!strip) return;
  const n = $('.gallery .gi', root);
  strip.addEventListener('scroll', () => { if (n) n.textContent = Math.round(strip.scrollLeft / strip.clientWidth) + 1; }, { passive: true });
  strip.addEventListener('click', e => {
    if (e.target.dataset.i === undefined) return;
    lightbox(images, Number(e.target.dataset.i), i => { strip.scrollLeft = i * strip.clientWidth; });
  });
}

// Slike preko cijelog ekrana: listanje prstom (ili strelicama), "nazad" zatvara
export function lightbox(images, start = 0, onClose) {
  const lb = document.createElement('div');
  lb.className = 'lightbox';
  lb.setAttribute('role', 'dialog');
  lb.setAttribute('aria-label', 'Slike');
  lb.innerHTML = html`<div class="lb-strip">${images.map((s, i) => html`<div class="lb-slide"><img src="${s}" alt="Slika ${i + 1}" ${Math.abs(i - start) > 1 ? raw('loading="lazy"') : ''}></div>`)}</div>
    <div class="lb-top"><span class="lb-n">${start + 1} / ${images.length}</span><button class="icon-btn lb-x" aria-label="Zatvori">${icon('x', 26, '#fff')}</button></div>
    ${images.length > 1 ? html`<button class="icon-btn lb-prev" aria-label="Prethodna">${icon('back', 30, '#fff')}</button><button class="icon-btn lb-next" aria-label="Sljedeća">${icon('right', 30, '#fff')}</button>` : ''}`.s;
  document.body.appendChild(lb);
  document.body.style.overflow = 'hidden';
  const st = lb.querySelector('.lb-strip');
  const n = lb.querySelector('.lb-n');
  const cur = () => Math.round(st.scrollLeft / st.clientWidth);
  st.scrollLeft = start * st.clientWidth;
  st.addEventListener('scroll', () => { n.textContent = `${cur() + 1} / ${images.length}`; }, { passive: true });
  const to = i => st.scrollTo({ left: Math.max(0, Math.min(images.length - 1, i)) * st.clientWidth, behavior: 'smooth' });
  const onKey = e => {
    if (e.key === 'ArrowRight') to(cur() + 1);
    else if (e.key === 'ArrowLeft') to(cur() - 1);
    else if (e.key === 'Escape') close();
  };
  document.addEventListener('keydown', onKey);
  const close = pushOverlay(() => {
    const i = cur();
    lb.remove();
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onKey);
    onClose?.(i);
  });
  lb.querySelector('.lb-x').onclick = close;
  lb.querySelector('.lb-prev')?.addEventListener('click', () => to(cur() - 1));
  lb.querySelector('.lb-next')?.addEventListener('click', () => to(cur() + 1));
}

// ---------- izbor vozila: marka → model → generacija ----------
// value: {make, model, gen}; opts: {genRequired, labels:boolean, names:{make,gen}}
export async function vehiclePicker(box, value = {}, opts = {}) {
  const makes = await getMakes();
  const pop = makes.filter(m => m.popular);
  const id = Math.random().toString(36).slice(2, 7);
  render(box, html`
    <label class="f ${opts.genRequired ? 'req' : ''}"><span>Marka</span>
      <select id="mk${id}" name="${opts.names?.make || ''}"><option value="">${opts.anyText || 'Sve marke'}</option>
        <optgroup label="Najčešće">${pop.map(m => html`<option value="${m.id}">${m.name}</option>`)}</optgroup>
        <optgroup label="Sve marke">${makes.map(m => html`<option value="${m.id}">${m.name}</option>`)}</optgroup>
      </select></label>
    <div class="grid2">
      <label class="f ${opts.genRequired ? 'req' : ''}"><span>Model</span><select id="md${id}" disabled><option value="">Svi modeli</option></select></label>
      <label class="f ${opts.genRequired ? 'req' : ''}"><span>Generacija</span><select id="gn${id}" name="${opts.names?.gen || ''}" disabled><option value="">Sve generacije</option></select></label>
    </div>`);
  const mk = $('#mk' + id, box), md = $('#md' + id, box), gn = $('#gn' + id, box);
  let gens = [];
  async function loadModels(make, model) {
    md.innerHTML = '<option value="">Svi modeli</option>'; md.disabled = !make;
    gn.innerHTML = '<option value="">Sve generacije</option>'; gn.disabled = true;
    if (!make) return;
    const list = await api(`/api/makes/${encodeURIComponent(make)}/models`);
    md.innerHTML = html`<option value="">${opts.genRequired ? 'Izaberi model' : 'Svi modeli'}</option>${list.map(m => html`<option value="${m.name}">${m.name}${m.years ? ` (${m.years})` : ''}</option>`)}`.s;
    if (model) { md.value = model; await loadGens(make, model); }
  }
  async function loadGens(make, model, gen) {
    gn.innerHTML = '<option value="">Sve generacije</option>'; gn.disabled = !model;
    if (!model) return;
    gens = await api(`/api/makes/${encodeURIComponent(make)}/generations?name=${encodeURIComponent(model)}`);
    gn.innerHTML = html`<option value="">${opts.genRequired ? 'Izaberi generaciju' : 'Sve generacije'}</option>${gens.map(g => html`<option value="${g.id}">${g.label}</option>`)}`.s;
    if (gens.length === 1 && opts.genRequired) gn.value = gens[0].id;
    if (gen) gn.value = gen;
  }
  mk.addEventListener('change', async () => { await loadModels(mk.value); box.dispatchEvent(new Event('pick')); });
  md.addEventListener('change', async () => { await loadGens(mk.value, md.value); box.dispatchEvent(new Event('pick')); });
  gn.addEventListener('change', () => box.dispatchEvent(new Event('pick')));

  if (value.make) { mk.value = value.make; await loadModels(value.make, value.model); if (value.gen) gn.value = value.gen; }
  return {
    get() {
      const g = gens.find(x => x.id === gn.value);
      const makeName = mk.selectedOptions[0]?.value ? mk.selectedOptions[0].textContent : '';
      return { make: mk.value, model: md.value, gen: gn.value, makeName, label: [makeName, g ? g.label : md.value].filter(Boolean).join(' ') };
    },
    async set(v) { mk.value = v.make || ''; await loadModels(v.make, v.model); if (v.gen) gn.value = v.gen; },
  };
}

// "Nema mog modela"
export function suggestModel(makeId, makeName) {
  modal('Nema mog modela', html`<form class="stack" id="sgF">
    <p class="hint" style="margin:0">Upiši model koji fali. Dodaćemo ga u spisak, a ti u međuvremenu možeš objaviti oglas sa upisanim modelom.</p>
    <label class="f"><span>Marka</span><input name="make" value="${makeName || ''}" required></label>
    <label class="f"><span>Model i generacija</span><input name="model" placeholder="npr. Golf 8 facelift" required></label>
    <label class="f"><span>Godine proizvodnje</span><input name="years" placeholder="npr. 2024–" inputmode="numeric"></label>
    <button class="btn dark block">Pošalji</button></form>`, (m, close) => {
    $('#sgF', m).onsubmit = async e => {
      e.preventDefault();
      const f = e.target;
      try {
        await api('/api/model-suggestions', { body: { make_id: makeId, make: f.make.value, model: f.model.value, years: f.years.value } });
        close(); toast('Hvala! Model će uskoro biti dodan.');
      } catch (err) { fail(err); }
    };
  });
}

// ---------- slike: smanjivanje na telefonu i upload ----------
async function loadImage(file) {
  if ('createImageBitmap' in window) {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { /* idi na Image */ }
  }
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im); im.onerror = () => rej(new Error('Slika se ne može otvoriti'));
    im.src = URL.createObjectURL(file);
  });
}
function toJpeg(src, max, q) {
  const w = src.width, h = src.height, k = Math.min(1, max / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.round(w * k); c.height = Math.round(h * k);
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  g.drawImage(src, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', q);
}
export async function uploadFile(file) {
  const bmp = await loadImage(file);
  const full = toJpeg(bmp, 1600, 0.82);
  const th = toJpeg(bmp, 420, 0.75);
  const r = await api('/api/upload', { body: { full, thumb: th } });
  return r.url;
}
// ---------- profilna slika / logo: korisnik sam namjesti šta se vidi u krugu ----------
// Prst: pomjeranje; dva prsta ili klizač: uvećanje. Vraća URL snimljene slike ili null.
export async function avatarUpload(file) {
  const bmp = await loadImage(file);
  const src = toJpeg(bmp, 1600, 0.9);
  const im = new Image();
  await new Promise((res, rej) => { im.onload = res; im.onerror = () => rej(new Error('Slika se ne može otvoriti')); im.src = src; });
  return new Promise(resolve => {
    let done = false;
    modal('Namjesti sliku', html`
      <p class="hint" style="margin:0 0 10px">Pomjeri sliku prstom i uvećaj da u krugu bude ono što želiš.</p>
      <div class="crop" id="cr"><img src="${src}" alt="" draggable="false"><div class="crop-mask"></div></div>
      <label class="f" style="margin-top:12px"><span>Uvećanje</span><input type="range" id="cz" min="1" max="4" step="0.01" value="1" style="min-height:44px;padding:0;border:0"></label>
      <div class="btns" style="margin-top:12px"><button class="btn line" data-close>Odustani</button><button class="btn accent" id="cok">Sačuvaj sliku</button></div>`, (m, close) => {
      const stage = $('#cr', m), img = $('img', stage), zoom = $('#cz', m);
      const S = () => stage.clientWidth;
      let z = 1, x = 0, y = 0; // x,y = pomak centra slike od centra kruga (px na ekranu)
      const base = () => Math.max(S() / im.width, S() / im.height); // slika uvijek pokriva krug
      const clamp = () => {
        const k = base() * z, mx = Math.max(0, (im.width * k - S()) / 2), my = Math.max(0, (im.height * k - S()) / 2);
        x = Math.min(mx, Math.max(-mx, x)); y = Math.min(my, Math.max(-my, y));
      };
      const draw = () => {
        clamp();
        const k = base() * z;
        img.style.width = im.width * k + 'px'; img.style.height = im.height * k + 'px';
        img.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
      };
      draw();
      zoom.oninput = () => { z = Number(zoom.value); draw(); };
      const pts = new Map(); let last = null, pinch = null;
      stage.addEventListener('pointerdown', e => { stage.setPointerCapture(e.pointerId); pts.set(e.pointerId, e); last = e; if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), z }; } });
      stage.addEventListener('pointermove', e => {
        if (!pts.has(e.pointerId)) return;
        pts.set(e.pointerId, e);
        if (pts.size === 2 && pinch) {
          const [a, b] = [...pts.values()];
          z = Math.min(4, Math.max(1, pinch.z * Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) / pinch.d));
          zoom.value = z;
        } else if (pts.size === 1 && last) { x += e.clientX - last.clientX; y += e.clientY - last.clientY; }
        last = e; draw();
      });
      const up = e => { pts.delete(e.pointerId); pinch = null; last = pts.size ? [...pts.values()][0] : null; };
      stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
      stage.addEventListener('wheel', e => { e.preventDefault(); z = Math.min(4, Math.max(1, z * (e.deltaY < 0 ? 1.08 : 0.93))); zoom.value = z; draw(); }, { passive: false });
      new MutationObserver((_, ob) => { if (!document.body.contains(m)) { ob.disconnect(); if (!done) resolve(null); } }).observe(document.body, { childList: true });
      $('#cok', m).onclick = async () => {
        const b = $('#cok', m); busy(b, true, 'Snimam…');
        try {
          const out = 512, k = base() * z * (out / S());
          const c = document.createElement('canvas'); c.width = c.height = out;
          const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, out, out);
          const r = out / S();
          g.drawImage(im, out / 2 + x * r - (im.width * k) / 2, out / 2 + y * r - (im.height * k) / 2, im.width * k, im.height * k);
          const full = c.toDataURL('image/jpeg', 0.88);
          const t = document.createElement('canvas'); t.width = t.height = 160; t.getContext('2d').drawImage(c, 0, 0, 160, 160);
          const res = await api('/api/upload', { body: { full, thumb: t.toDataURL('image/jpeg', 0.8) } });
          done = true; close(); resolve(res.url);
        } catch (err) { fail(err); busy(b, false); }
      };
    });
  });
}

// images: početna lista; vraća {get()}
export function imageInput(box, images = [], max = 12) {
  let list = [...images];
  let pending = 0;
  const draw = () => {
    render(box, html`<div class="imgs">
      ${list.map((u, i) => html`<div class="im"><img src="${thumb(u)}" alt="Slika ${i + 1}" onerror="this.src='${raw(esc(u))}'">
        <button type="button" class="rm" data-rm="${i}" aria-label="Ukloni sliku">×</button>
        ${i === 0 ? html`<span class="badge acc main">Glavna</span>` : html`<button type="button" class="badge main" data-first="${i}" style="border:0;cursor:pointer">Glavna?</button>`}</div>`)}
      ${Array.from({ length: pending }, () => html`<div class="im busy"></div>`)}
      ${list.length + pending < max ? html`<label class="add">${icon('camera', 24)}<span>Dodaj slike</span><input type="file" accept="image/*" multiple class="sr"></label>` : ''}
    </div><div class="hint" style="margin-top:6px">Do ${max} slika. Prva slika je glavna.</div>`);
    $$('[data-rm]', box).forEach(b => { b.onclick = () => { list.splice(Number(b.dataset.rm), 1); draw(); }; });
    $$('[data-first]', box).forEach(b => { b.onclick = () => { const [x] = list.splice(Number(b.dataset.first), 1); list.unshift(x); draw(); }; });
    const inp = $('input[type=file]', box);
    if (inp) inp.onchange = async () => {
      const files = [...inp.files].slice(0, max - list.length - pending);
      pending += files.length; draw();
      for (const f of files) {
        try { list.push(await uploadFile(f)); } catch (e) { fail(e); }
        pending--; draw();
      }
    };
  };
  draw();
  return { get: () => list, busy: () => pending > 0 };
}

export async function citySelect(name, value, any = 'Svi gradovi') {
  const meta = await getMeta();
  const has = value && !meta.cities.includes(value);
  return html`<select name="${name}"><option value="">${any}</option>${has ? html`<option selected>${value}</option>` : ''}${meta.cities.map(c => html`<option ${c === value ? raw('selected') : ''}>${c}</option>`)}</select>`;
}

// "Učitaj još" za liste
export function pager(box, total, shown, onMore) {
  render(box, shown < total ? html`<div class="more"><button class="btn line">Učitaj još (${total - shown})</button></div>` : '');
  const b = $('button', box);
  if (b) b.onclick = async () => { busy(b, true, 'Učitavam…'); try { await onMore(); } catch (e) { fail(e); busy(b, false); } };
}

export const isOtpad = () => state.user?.type === 'otpad';
