import { html, raw, render, $, $$, api, go, qs, setTitle, formData, ago, fail, toast, state, busy, setMe, loadMe, partUrl, safeNext } from '../core.js';
import { icon, partRow, vehicleRow, requestRow, listOr, citySelect, pager, pagedList, confirmBox, avatarUpload, contactButtons, verifiedBadge } from '../components.js';
import { inquiryModal } from './parts.js';

// ---------- prijava / registracija ----------
export async function loginPage({ el, query }) {
  if (state.user) return go(safeNext(query.next, '/profil'), true);
  setTitle('Prijava');
  render(el, html`
  <section class="page-head"><div class="row"><h1 style="padding-left:12px">Prijava</h1></div></section>
  <form class="wrap stack" id="lf" style="padding-top:16px;max-width:520px">
    <div class="card stack">
      <label class="f"><span>Email</span><input name="email" type="email" autocomplete="email" required></label>
      <label class="f"><span>Lozinka</span><input name="password" type="password" autocomplete="current-password" required></label>
      <button class="btn accent big block">Prijavi se</button>
    </div>
    <p style="text-align:center;margin:4px 0">Nemaš nalog? <a href="/registracija${qs({ next: query.next })}">Registruj se besplatno</a></p>
    <p style="text-align:center;margin:0"><a href="/zaboravljena-lozinka">Zaboravio si lozinku?</a></p>
  </form>`);
  $('#lf', el).onsubmit = async e => {
    e.preventDefault();
    const b = e.submitter; busy(b, true, 'Prijavljujem…');
    try { setMe(await api('/api/auth/login', { body: formData(e.target) })); toast('Dobro došao!'); go(safeNext(query.next, '/'), true); }
    catch (err) { fail(err); busy(b, false); }
  };
}

export async function registerPage({ el, query }) {
  if (state.user) return go('/profil', true);
  setTitle('Registracija');
  const otpad = query.tip === 'otpad';
  render(el, html`
  <section class="page-head"><div class="row"><h1 style="padding-left:12px">Registracija</h1></div><p class="sub">Besplatno. Traje pola minute.</p></section>
  <form class="wrap stack" id="rf" style="padding-top:16px;max-width:520px">
    <fieldset class="seg"><legend class="sr">Vrsta naloga</legend>
      <label><input type="radio" name="type" value="privatno" ${otpad ? '' : 'checked'}><strong>Privatno lice</strong><span>Kupujem ili prodajem pokoji dio</span></label>
      <label><input type="radio" name="type" value="otpad" ${otpad ? 'checked' : ''}><strong>Auto otpad</strong><span>Prodajem dijelove i vozila</span></label>
    </fieldset>
    <div class="card stack">
      <label class="f req"><span id="nl">${otpad ? 'Naziv otpada' : 'Ime i prezime'}</span><input name="name" required autocomplete="name"></label>
      <label class="f req"><span>Broj telefona</span><input name="phone" type="tel" required autocomplete="tel" placeholder="06x xxx xxx"></label>
      <div class="grid2"><label class="check"><input type="checkbox" name="viber" checked> Imam Viber</label><label class="check"><input type="checkbox" name="whatsapp"> Imam WhatsApp</label></div>
      <label class="f"><span>Grad</span>${await citySelect('city', '', 'Izaberi grad')}</label>
      <label class="f" id="adr" ${otpad ? '' : raw('hidden')}><span>Adresa otpada</span><input name="address"></label>
      <label class="f req"><span>Email</span><input name="email" type="email" required autocomplete="email"></label>
      <label class="f req"><span>Lozinka (najmanje 6 znakova)</span><input name="password" type="password" minlength="6" required autocomplete="new-password"></label>
      <button class="btn accent big block">Napravi nalog</button>
      <p class="hint" style="margin:0">Registracijom prihvataš <a href="/uslovi">uslove korištenja</a>.</p>
    </div>
    <p style="text-align:center">Već imaš nalog? <a href="/prijava${qs({ next: query.next })}">Prijavi se</a></p>
  </form>`);
  $$('input[name=type]', el).forEach(r => { r.onchange = () => { const o = r.value === 'otpad' && r.checked; $('#nl', el).textContent = o ? 'Naziv otpada' : 'Ime i prezime'; $('#adr', el).hidden = !o; }; });
  $('#rf', el).onsubmit = async e => {
    e.preventDefault();
    const b = e.submitter; busy(b, true, 'Pravim nalog…');
    try { setMe(await api('/api/auth/register', { body: formData(e.target) })); toast('Nalog napravljen!'); go(safeNext(query.next, null) || (state.user.type === 'otpad' ? '/objavi' : '/'), true); }
    catch (err) { fail(err); busy(b, false); }
  };
}

// ---------- profil ----------
const TABS = [
  ['oglasi', 'Moji dijelovi'], ['vozila', 'Moja vozila', 'otpad'], ['poruke', 'Upiti', null, 'inquiries'],
  ['zahtjevi', 'Moji zahtjevi', null, 'offers'], ['ponude', 'Moje ponude', 'otpad'], ['sacuvano', 'Sačuvano'], ['postavke', 'Postavke'],
];

export async function profilePage({ el, params }) {
  if (!state.user) return go('/prijava?next=' + encodeURIComponent(location.pathname), true);
  await loadMe();
  const u = state.user;
  const tabs = TABS.filter(t => !t[2] || u.type === t[2]);
  const tab = params.tab || (state.counts.inquiries ? 'poruke' : state.counts.offers ? 'zahtjevi' : 'oglasi');
  setTitle('Moj profil');
  render(el, html`
  <section class="page-head" style="padding-bottom:12px">
    <div class="row"><h1 style="padding-left:12px">${u.name}</h1>${u.is_admin ? html`<a class="btn accent sm" href="/admin">Admin</a>` : ''}</div>
    <p class="sub" style="margin-bottom:0">${u.type === 'otpad' ? 'Auto otpad' : 'Privatni nalog'}${u.city ? ' · ' + u.city : ''} ${u.verified ? verifiedBadge(1) : ''}</p>
  </section>
  <nav class="tabs" aria-label="Profil">${tabs.map(t => html`<a href="/profil/${t[0]}" class="${t[0] === tab ? 'on' : ''}">${t[1]}${t[3] && state.counts[t[3]] ? html` <span class="num">${state.counts[t[3]]}</span>` : ''}</a>`)}</nav>
  <div class="wrap" style="padding-top:14px" id="pt"><div class="loading">Učitavam…</div></div>`);
  $('.tabs .on', el)?.scrollIntoView({ inline: 'center', block: 'nearest' });
  const box = $('#pt', el);
  const fn = { oglasi: tabParts, vozila: tabVehicles, poruke: tabInquiries, zahtjevi: tabRequests, ponude: tabOffers, sacuvano: tabFavs, postavke: tabSettings }[tab] || tabParts;
  await fn(box);
}

async function tabParts(box) {
  let st = 'active', page = 1, items = [];
  const draw = async (reset) => {
    if (reset) { page = 1; items = []; }
    const r = await api('/api/my/parts' + qs({ status: st, page }));
    items = items.concat(r.items);
    render(box, html`
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
        <a class="btn accent sm" href="/objavi/dio">${icon('plus', 18)} Novi dio</a>

      </div>
      <div class="hint" style="margin-bottom:8px">${r.total} oglasa</div>
      ${listOr(items, p => partRow(p, { noSeller: true, views: true }), 'Nema oglasa u ovoj grupi.')}<div id="mm"></div>`);
    $$('[data-st]', box).forEach(b => { b.onclick = () => { st = b.dataset.st; draw(true); }; });
    pager($('#mm', box), r.total, items.length, async () => { page++; await draw(); });
  };
  await draw(true);
}

async function tabVehicles(box) {
  const r = await api('/api/my/vehicles');
  render(box, html`<div style="margin-bottom:12px"><a class="btn accent sm" href="/objavi/vozilo">${icon('plus', 18)} Novo vozilo</a></div>
    ${listOr(r.items, v => vehicleRow(v, { noSeller: true }), 'Još nisi objavio vozilo za dijelove.')}`);
}

async function tabInquiries(box) {
  const items = await api('/api/my/inquiries');
  render(box, items.length ? html`<div class="list">${items.map(i => html`<div class="row-item" style="flex-direction:column;gap:6px" data-id="${i.id}">
    <div style="display:flex;justify-content:space-between;width:100%;gap:8px"><strong>${i.name}</strong><span class="hint">${ago(i.created_at)}${i.seen ? '' : html` <span class="badge acc">novo</span>`}</span></div>
    ${i.part_id ? html`<a class="hint" href="${partUrl({ id: i.part_id, title: i.part_title })}">Dio: ${i.part_title || 'oglas'}</a>` : i.vehicle_id ? html`<a class="hint" href="/vozilo/${i.vehicle_id}">Vozilo: ${i.vehicle || 'pogledaj'}</a>` : ''}
    <div class="desc">${i.message}</div>
    <div class="btns3" style="width:100%">${contactButtons({ phone: i.phone, viber: 1, whatsapp: 1 }, '')}</div>
    <div style="display:flex;gap:16px;align-self:flex-end">
      <button class="link" data-spam="${i.id}" style="font-size:13px;color:var(--bad)">Spam</button>
      <button class="link" data-del="${i.id}" style="font-size:13px;color:var(--muted)">Obriši</button>
    </div>
  </div>`)}</div>` : html`<div class="empty"><strong>Nema upita</strong>Kad te kupac pita za dio ili vozilo, pojaviće se ovdje.</div>`);
  $$('[data-spam]', box).forEach(b => {
    b.onclick = async () => {
      if (!await confirmBox('Označiti kao spam? Upit nestaje, a ako i drugi otpadi prijave ovaj broj, on se blokira na cijelom sajtu.', 'Spam')) return;
      try { const r = await api(`/api/my/inquiries/${b.dataset.spam}/spam`, { body: {} }); toast(r.blocked ? 'Broj je blokiran' : 'Označeno kao spam'); tabInquiries(box); } catch (e) { fail(e); }
    };
  });
  $$('[data-del]', box).forEach(b => {
    b.onclick = async () => { try { await api('/api/my/inquiries/' + b.dataset.del, { method: 'DELETE' }); b.closest('.row-item').remove(); } catch (e) { fail(e); } };
  });
  loadMe();
}

async function tabRequests(box) {
  const items = await api('/api/my/requests');
  render(box, html`<div style="margin-bottom:12px"><a class="btn accent sm" href="/trazim/novi">${icon('send', 18)} Novi zahtjev</a></div>
    ${listOr(items, requestRow, 'Nisi objavio nijedan zahtjev. Objavi šta tražiš, a otpadi ti šalju ponude.')}`);
}

async function tabOffers(box) {
  const items = await api('/api/my/offers');
  render(box, html`<div style="margin-bottom:12px"><a class="btn dark sm" href="/trazim">Zahtjevi kupaca</a></div>
    ${listOr(items, o => html`<a class="row-item" href="/trazim/${o.request_id}"><div class="info">
      <span class="t">${o.part}</span><span class="s">${[o.vehicle || o.model_text, o.year].filter(Boolean).join(' · ')}</span>
      <span class="s">Tvoja ponuda: <strong>${o.price != null ? o.price + ' KM' : '—'}</strong> · ${ago(o.created_at)}${o.status !== 'open' ? ' · zatvoren' : ''}</span></div></a>`, 'Još nisi slao ponude.')}`);
}

async function tabFavs(box) {
  const r = await api('/api/favorites');
  render(box, html`<h2 style="font-size:22px;margin-bottom:8px">Dijelovi</h2>${listOr(r.parts, p => partRow(p), 'Nema sačuvanih dijelova.')}
    <h2 style="font-size:22px;margin:18px 0 8px">Vozila</h2>${listOr(r.vehicles, v => vehicleRow(v), 'Nema sačuvanih vozila.')}`);
}

async function tabSettings(box) {
  const u = state.user;
  render(box, html`
  <form class="card stack" id="sf">
    <strong style="font-size:17px">Podaci</strong>
    <div style="display:flex;gap:12px;align-items:center">
      <div class="avatar" style="width:64px;height:64px;border-radius:32px" id="lg">${u.logo ? html`<img src="${u.logo}" alt="">` : (u.name || '?')[0]}</div>
      <label class="btn line sm">${icon('camera', 18)} ${u.type === 'otpad' ? 'Logo otpada' : 'Slika'}<input type="file" accept="image/*" class="sr" id="lgf"></label>
      <input type="hidden" name="logo" value="${u.logo || ''}">
    </div>
    <label class="f req"><span>${u.type === 'otpad' ? 'Naziv otpada' : 'Ime i prezime'}</span><input name="name" value="${u.name}" required></label>
    <label class="f req"><span>Telefon</span><input name="phone" type="tel" value="${u.phone || ''}" required></label>
    <div class="grid2"><label class="check"><input type="checkbox" name="viber" ${u.viber ? 'checked' : ''}> Viber</label><label class="check"><input type="checkbox" name="whatsapp" ${u.whatsapp ? 'checked' : ''}> WhatsApp</label></div>
    <label class="f"><span>Grad</span>${await citySelect('city', u.city, 'Izaberi grad')}</label>
    <label class="f"><span>Adresa</span><input name="address" value="${u.address || ''}"></label>
    ${u.type === 'otpad' ? html`<label class="check"><input type="checkbox" name="ships" ${u.ships ? 'checked' : ''}> Šaljemo dijelove brzom poštom</label>
      <label class="f"><span>O otpadu (radno vrijeme, garancija…)</span><textarea name="about">${u.about || ''}</textarea></label>` : html`<input type="hidden" name="about" value="${u.about || ''}">`}
    <button class="btn accent block">Sačuvaj</button>
  </form>
  <form class="card stack" id="emf" style="margin-top:12px">
    <strong style="font-size:17px">Email</strong>
    <p style="margin:0">${u.email} ${u.mail_enabled ? (u.email_verified ? html`<span class="badge ok">potvrđen</span>` : html`<span class="badge bad">nije potvrđen</span>`) : ''}</p>
    ${u.mail_enabled && !u.email_verified ? html`<button type="button" class="btn accent block" id="vres">Pošalji ponovo link za potvrdu</button>` : ''}
    <details><summary class="link" style="display:inline-flex;align-items:center">Promijeni email</summary>
      <div class="stack" style="margin-top:10px">
        <label class="f"><span>Novi email</span><input type="email" name="email" autocomplete="email"></label>
        <label class="f"><span>Tvoja lozinka</span><input type="password" name="password" autocomplete="current-password"></label>
        <button class="btn line block">Sačuvaj novi email</button>
      </div></details>
  </form>
  <form class="card stack" id="pwf" style="margin-top:12px">
    <strong style="font-size:17px">Promjena lozinke</strong>
    <label class="f"><span>Stara lozinka</span><input type="password" name="old" autocomplete="current-password" required></label>
    <label class="f"><span>Nova lozinka</span><input type="password" name="password" autocomplete="new-password" minlength="6" required></label>
    <button class="btn line block">Promijeni lozinku</button>
  </form>
  ${u.type === 'otpad' ? html`<div class="card stack" style="margin-top:12px">
    <strong style="font-size:17px">Automatsko slanje dijelova (API)</strong>
    <p class="hint" style="margin:0">Ako dijelove vodiš u svom programu, on ih može sam slati ovdje. Daj ovaj ključ svom programeru — uputstvo je u README fajlu na GitHubu.</p>
    <div id="ak">${u.has_api_key ? html`<p style="margin:0">Ključ je napravljen. Novi ključ poništava stari.</p>` : ''}</div>
    <button class="btn line block" id="akb">${u.has_api_key ? 'Napravi novi ključ' : 'Napravi API ključ'}</button></div>` : ''}
  <div class="card stack" style="margin-top:12px">
    <a class="btn line block" href="/prodavac/${u.id}">Kako drugi vide moj profil</a>
    <button class="btn danger block" id="lo">${icon('logout', 18)} Odjavi se</button>
  </div>`);
  const f = $('#sf', box);
  $('#lgf', box).onchange = async e => {
    const file = e.target.files[0]; if (!file) return;
    e.target.value = '';
    try {
      const url = await avatarUpload(file);
      if (!url) return;
      f.logo.value = url; render($('#lg', box), html`<img src="${url}" alt="">`);
      setMe(await api('/api/me', { method: 'PUT', body: formData(f) }));
      toast('Slika sačuvana');
    } catch (err) { fail(err); }
  };
  f.onsubmit = async e => {
    e.preventDefault();
    const b = e.submitter; busy(b, true, 'Snimam…');
    try { setMe(await api('/api/me', { method: 'PUT', body: formData(f) })); toast('Sačuvano'); } catch (err) { fail(err); }
    busy(b, false);
  };
  $('#vres', box)?.addEventListener('click', sendVerifyAgain);
  $('#emf', box).onsubmit = async e => {
    e.preventDefault();
    try { setMe(await api('/api/me/email', { body: formData(e.target) })); toast(state.user.email_verified ? 'Email promijenjen' : 'Email promijenjen — provjeri sanduče i potvrdi ga'); tabSettings(box); } catch (err) { fail(err); }
  };
  $('#pwf', box).onsubmit = async e => {
    e.preventDefault();
    try { await api('/api/me/password', { body: formData(e.target) }); e.target.reset(); toast('Lozinka promijenjena'); } catch (err) { fail(err); }
  };
  $('#akb', box)?.addEventListener('click', async () => {
    if (u.has_api_key && !await confirmBox('Napraviti novi ključ? Stari prestaje raditi.', 'Napravi')) return;
    try {
      const r = await api('/api/me/api-key', { body: {} });
      render($('#ak', box), html`<label class="f"><span>Tvoj API ključ (sačuvaj ga — ne prikazuje se ponovo)</span><input readonly value="${r.api_key}" id="akv"></label>`);
      $('#akv', box).onclick = e => e.target.select();
      loadMe();
    } catch (err) { fail(err); }
  });
  $('#lo', box).onclick = async () => { await api('/api/auth/logout', { body: {} }); setMe({ user: null }); toast('Odjavljen si'); go('/'); };
}

// ---------- otpadi / prodavac ----------
export async function sellersPage({ el, query }) {
  setTitle('Auto otpadi');
  const list = await api('/api/sellers' + qs({ city: query.city }));
  render(el, html`
  <section class="page-head"><div class="row"><h1 style="padding-left:12px">Auto otpadi</h1></div>
    <form id="cf"><label class="f"><span>Grad</span>${await citySelect('city', query.city)}</label></form></section>
  <div class="wrap" style="padding-top:14px">
    ${listOr(list, s => html`<a class="row-item" href="/prodavac/${s.id}">
      <div class="avatar">${s.logo ? html`<img src="${s.logo}" alt="">` : s.name[0]}</div>
      <div class="info"><span class="t">${s.name}</span><span class="s">${s.city || ''}</span>
      <span class="s">${s.vehicles} vozila · ${s.parts} dijelova</span>${s.verified ? verifiedBadge(1) : ''}</div></a>`, 'Još nema otpada u ovom gradu.')}
    <p class="hint" style="text-align:center;margin-top:14px">Imaš otpad? <a href="/registracija?tip=otpad">Registruj ga besplatno</a></p>
  </div>`);
  $('#cf select', el).onchange = e => go('/otpadi' + qs({ city: e.target.value }), true);
}

export async function sellerPage({ el, params, query }) {
  const s = await api('/api/sellers/' + encodeURIComponent(params.id));
  setTitle(s.name);
  const tab = query.tab || (s.vehicles ? 'vozila' : 'dijelovi');
  render(el, html`
  <section class="page-head">
    <div class="row"><a href="/otpadi" class="icon-btn" aria-label="Nazad">${icon('back', 22, '#fff')}</a><h1>${s.name}</h1></div>
    <p class="sub">${[s.type === 'otpad' ? 'Auto otpad' : 'Privatni prodavac', s.address, s.city].filter(Boolean).join(' · ')}</p>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px">${s.verified ? html`<span class="badge acc">${icon('shield', 14, '#1B1E22')} Provjeren otpad</span>` : ''}${s.ships ? html`<span class="badge">${icon('truck', 14)} Šalje brzom poštom</span>` : ''}</div>
    <div class="btns3">${contactButtons(s, s.name)}</div>
    ${state.user?.id === s.id ? '' : html`<button class="btn line block" id="ask" style="margin-top:8px;background:transparent;color:#fff;border-color:#4A4F57">Pošalji upit</button>`}
  </section>
  ${s.about ? html`<div class="wrap" style="padding-top:12px"><div class="card desc">${s.about}</div></div>` : ''}
  <nav class="tabs" style="margin-top:12px">
    <a href="?tab=vozila" class="${tab === 'vozila' ? 'on' : ''}">Vozila (${s.vehicles})</a>
    <a href="?tab=dijelovi" class="${tab === 'dijelovi' ? 'on' : ''}">Dijelovi (${s.parts})</a></nav>
  <div class="wrap" style="padding-top:12px"><div id="sl"></div></div>`);
  $$('.tabs a', el).forEach(a => { a.onclick = e => { e.preventDefault(); go(`/prodavac/${s.id}${a.getAttribute('href')}`, true); }; });
  $('#ask', el)?.addEventListener('click', () => inquiryModal({ to: s.id }, 'Pozdrav, zanima me '));
  await pagedList({
    box: $('#sl', el), query,
    fetch: page => api((tab === 'vozila' ? '/api/vehicles' : '/api/parts') + qs({ seller: s.id, page })),
    draw: items => listOr(items, tab === 'vozila' ? v => vehicleRow(v, { noSeller: true }) : p => partRow(p, { noSeller: true }), 'Ništa objavljeno.'),
  });
}


export async function sendVerifyAgain() {
  try {
    const r = await api('/api/auth/verify-send', { body: {} });
    toast(r.already ? 'Email je već potvrđen' : `Link poslan na ${r.email}. Provjeri i Spam/Promotions.`);
  } catch (e) { fail(e); }
}

// ---------- potvrda emaila / zaboravljena lozinka ----------
export async function verifyPage({ el, params }) {
  setTitle('Potvrda emaila');
  render(el, html`<section class="page-head"><div class="row"><h1 style="padding-left:12px">Potvrda emaila</h1></div></section><div class="wrap" style="padding-top:16px"><div class="card" id="vb">Provjeravam…</div></div>`);
  try {
    setMe(await api('/api/auth/verify', { body: { token: params.token } }));
    render($('#vb', el), html`<div class="stack"><strong style="font-size:18px">✓ Email je potvrđen</strong><span>Sada možeš objavljivati dijelove, vozila i zahtjeve.</span><a class="btn accent block" href="/objavi">Objavi oglas</a></div>`);
  } catch (e) {
    render($('#vb', el), html`<div class="stack"><strong style="font-size:18px">Link ne važi</strong><span>${e.message}</span>${state.user ? html`<button class="btn dark block" id="va">Pošalji novi link</button>` : html`<a class="btn dark block" href="/prijava">Prijavi se</a>`}</div>`);
    $('#va', el)?.addEventListener('click', sendVerifyAgain);
  }
}

export async function forgotPage({ el }) {
  setTitle('Zaboravljena lozinka');
  render(el, html`<section class="page-head"><div class="row"><h1 style="padding-left:12px">Zaboravljena lozinka</h1></div><p class="sub">Poslaćemo ti link za novu lozinku.</p></section>
  <form class="wrap stack" id="ff" style="padding-top:16px;max-width:520px"><div class="card stack">
    <label class="f"><span>Email sa kojim si se registrovao</span><input name="email" type="email" required autocomplete="email"></label>
    <button class="btn accent big block">Pošalji link</button></div>
    <p style="text-align:center"><a href="/prijava">Nazad na prijavu</a></p></form>`);
  $('#ff', el).onsubmit = async e => {
    e.preventDefault();
    const b = e.submitter; busy(b, true, 'Šaljem…');
    try {
      await api('/api/auth/forgot', { body: formData(e.target) });
      render($('#ff', el), html`<div class="card stack"><strong style="font-size:18px">Provjeri email</strong><span>Ako postoji nalog sa tim emailom, poslali smo link za novu lozinku. Link važi 1 sat. Pogledaj i Spam/Promotions.</span></div>`);
    } catch (err) { fail(err); busy(b, false); }
  };
}

export async function resetPage({ el, params }) {
  setTitle('Nova lozinka');
  render(el, html`<section class="page-head"><div class="row"><h1 style="padding-left:12px">Nova lozinka</h1></div></section>
  <form class="wrap stack" id="rf" style="padding-top:16px;max-width:520px"><div class="card stack">
    <label class="f"><span>Nova lozinka (najmanje 6 znakova)</span><input name="password" type="password" minlength="6" required autocomplete="new-password"></label>
    <button class="btn accent big block">Sačuvaj lozinku</button></div></form>`);
  $('#rf', el).onsubmit = async e => {
    e.preventDefault();
    const b = e.submitter; busy(b, true, 'Snimam…');
    try { setMe(await api('/api/auth/reset', { body: { token: params.token, password: e.target.password.value } })); toast('Lozinka promijenjena — prijavljen si'); go('/profil', true); }
    catch (err) { fail(err); busy(b, false); }
  };
}
