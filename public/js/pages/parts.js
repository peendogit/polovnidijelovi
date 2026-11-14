import { html, raw, render, $, api, go, qs, setTitle, formData, km, ago, fail, toast, state, busy, partUrl, canonical, getTypes } from '../core.js';
import { typeSuggest, matchTypes, icon, vehiclePicker, partRow, citySelect, pagedList, gallery, bindGallery, contactButtons, sellerBlock, modal, confirmBox, antiSpam, crumbs, featureBox, bindFeatureBox, filterFields, bindFilters, hasFilters } from '../components.js';

// Lista dijelova; /dijelovi?make=&model=&gen=&q=&city=&sort=
export async function partsPage({ el, query, params }) {
  let q = { ...query };
  let heading = 'Polovni dijelovi';
  if (params.mk) {
    const s = await api(`/api/slug${qs({ make: params.mk, model: params.md })}`);
    if (!s) { const e = new Error('Model nije pronađen'); e.status = 404; throw e; }
    q = { ...q, make: s.make_id, model: s.model || '' };
    heading = `Polovni dijelovi ${s.make_name}${s.model ? ' ' + s.model : ''}`;
  }
  setTitle(heading);
  render(el, html`
  <section class="page-head">
    <div class="row"><h1 style="padding-left:12px">${heading}</h1></div>
    <form id="pf" class="stack" style="gap:10px" role="search">
      <div id="pp" class="stack" style="gap:10px"></div>
      <label class="f"><span>Dio ili kataloški broj</span><input name="q" value="${q.q || ''}" placeholder="far, branik, 5G0941005…" autocomplete="off"></label><input type="hidden" name="type" value="${q.type || ''}">
      ${await filterFields(q)}
      <button class="btn accent big block">${icon('search', 20)} Pretraži</button>
      ${q.make || q.q || hasFilters(q) || q.sort ? html`<a href="/dijelovi" class="reset-link">Poništi pretragu</a>` : ''}
    </form>
  </section>
  <div class="wrap">
    <div class="count-line"><span class="c" id="pc">…</span>
      <label><span class="sr">Poredaj</span><select id="ps">
        <option value="">Najnovije</option><option value="cijena" ${q.sort === 'cijena' ? 'selected' : ''}>Najjeftinije</option><option value="cijena-" ${q.sort === 'cijena-' ? 'selected' : ''}>Najskuplje</option>
      </select></label></div>
    <div id="pv"></div>
    <div id="pl"></div>
  </div>`);

  const picker = await vehiclePicker($('#pp', el), { make: q.make, model: q.model, gen: q.gen });
  const filters = bindFilters($('#pf', el), $('#pp', el), picker, q);
  const search = () => {
    const v = picker.get();
    const f = formData($('#pf', el));
    go('/dijelovi' + qs({ make: v.make, model: v.model, gen: v.gen, q: f.q.trim(), type: f.type, ...filters(), sort: $('#ps', el).value }));
  };
  typeSuggest($('#pf input[name=q]', el), $('#pf input[name=type]', el), () => search());
  $('#pf', el).onsubmit = e => { e.preventDefault(); search(); };
  $('#ps', el).onchange = search;

  // vozila tog modela na otpadima (prije liste, da se lista ne pomjera)
  if (q.make && q.model) {
    const vr = await api('/api/vehicles' + qs({ make: q.make, model: q.model, gen: q.gen, limit: 1 }));
    if (vr.total) {
      render($('#pv', el), html`<a class="cta-row" style="margin-bottom:10px" href="/vozila${qs({ make: q.make, model: q.model, gen: q.gen })}">
        <span class="dot">${icon('car', 20, '#1B1E22')}</span><div><strong>${vr.total} ${vr.total === 1 ? 'vozilo' : 'vozila'} ovog modela na otpadima</strong><span>Pitaj otpad za bilo koji dio</span></div>${icon('right', 20)}</a>`);
    }
  }
  const types = await getTypes();
  await pagedList({
    box: $('#pl', el), query,
    fetch: page => api('/api/parts' + qs({ ...q, stranica: undefined, page })),
    draw: (items, total) => {
      $('#pc', el).textContent = `${total} ${total === 1 ? 'oglas' : 'oglasa'}`;
      if (items.length) return html`<div class="list cols">${items.map(p => partRow(p))}</div>`;
      const v = picker.get();
      const near = q.q && !q.type ? matchTypes(types, q.q, 4) : [];
      return html`${near.length ? html`<div class="card" style="margin-bottom:10px">Možda tražiš: ${near.map((t, i) => html`${i ? ', ' : ''}<a href="/dijelovi${qs({ ...q, q: t.t, type: t.id, stranica: undefined })}"><strong>${t.t}</strong></a>`)}</div>` : ''}<div class="empty"><strong>Nema takvih dijelova</strong>Pošalji „Tražim dio“ — otpadi koji ga imaju javiće ti se sa cijenom.
        <div style="margin-top:14px"><a class="btn dark" href="/trazim/novi${qs({ make: v.make, model: v.model, gen: v.gen, part: q.q })}">${icon('send', 18, '#fff')} Tražim ovaj dio</a></div></div>`;
    },
  });
}

// Detalj dijela
export async function partPage({ el, params }) {
  const p = await api('/api/parts/' + encodeURIComponent(params.id));
  setTitle(`${p.title} ${p.vehicle || ''}`);
  canonical(partUrl(p));
  const ctxText = `${p.title} ${p.vehicle || ''} — ${location.origin}${partUrl(p)}`;
  const facts = [['Stanje', p.condition], ['Kataloški broj', p.part_no], ['Godište', p.year], ['Motor', p.engine], ['Snaga', p.power_kw ? p.power_kw + ' kW' : null], ['Kod motora', p.engine_code], ['Gorivo', p.fuel],
    ['Mjenjač', p.gearbox], ['Broj brzina', p.gears], ['Kod mjenjača', p.gearbox_code], ['Karoserija', p.body], ['Pogon', p.drive], ['Strana', p.side], ['Boja', p.color], ['Kod boje', p.color_code], ['Lokacija', p.city], ['Objavljeno', ago(p.created_at)]]
    .filter(x => x[1]);
  render(el, html`
  ${crumbs([['Početna', '/'], ['Dijelovi', '/dijelovi'], p.make_name && [p.make_name, '/dijelovi' + qs({ make: p.make_id })], p.generation && [p.generation, '/dijelovi' + qs({ make: p.make_id, gen: p.model_id })], [p.title]])}
  <div class="det-grid">
    <div class="dg-col">
      <div class="dg-media">${gallery(p.images, p.title)}</div>
    </div>
    <div class="dg-col">
      <div class="det dg-side">
        ${p.status !== 'active' ? html`<p style="margin:0 0 8px"><span class="badge ${p.status === 'sold' ? 'ok' : ''}">${p.status === 'sold' ? 'Prodato' : 'Skriveno'}</span></p>` : ''}
        ${p.featured ? html`<span class="feat-b" style="margin-bottom:6px">${icon('star', 12, '#1B1E22', 2.2)} Istaknuto</span>` : ''}
        ${p.part_no ? html`<div class="sku">Kataloški broj: <strong>${p.part_no}</strong></div>` : ''}
        <h1>${p.title}</h1>
        <div class="veh">${p.generation ? html`<a href="/dijelovi${qs({ make: p.make_id, gen: p.model_id })}">${p.make_name} ${p.generation}</a>` : p.vehicle}</div>
        <div class="price-row">
          <div class="price">${km(p.price)} ${p.negotiable ? html`<small>· po dogovoru</small>` : ''}</div>
          <button class="icon-btn round" id="share" aria-label="Podijeli">${icon('share', 22)}</button>
          <button class="icon-btn round" id="fav" aria-label="${p.fav ? 'Ukloni iz sačuvanih' : 'Sačuvaj'}">${icon('heart', 22, p.fav ? '#B42318' : 'currentColor')}</button>
        </div>
        <div class="btns3" style="margin-top:14px">${contactButtons(p.seller, ctxText)}</div>
        ${p.mine ? '' : html`<button class="btn line block" id="ask" style="margin-top:8px">${icon('chat', 18)} Pošalji upit prodavcu</button>`}
        <div class="seller-box">${sellerBlock(p.seller)}</div>
        ${p.vehicle_ad ? html`<a class="cta-row" style="margin-top:12px;background:var(--bg)" href="/vozilo/${p.vehicle_ad.id}"><span class="dot">${icon('car', 20, '#1B1E22')}</span><div><strong>Skinuto sa vozila</strong><span>${[p.vehicle_ad.vehicle, p.vehicle_ad.year, p.vehicle_ad.engine].filter(Boolean).join(' · ')} — pogledaj ostale dijelove sa ovog auta</span></div>${icon('right', 20)}</a>` : ''}
        ${p.mine ? '' : html`<button class="link rep" id="rep">${icon('flag', 14)} Prijavi oglas</button>`}
      </div>
      ${p.description ? html`<div class="det dg-desc"><h2 class="det-h">${icon('chat', 20)} Opis prodavca</h2><div class="desc">${p.description}</div></div>` : ''}
      ${p.mine ? html`<div class="det dg-own">
        <strong>${p.user_id === state.user?.id ? 'Tvoj oglas' : 'Administrator — tuđi oglas'}</strong> <span class="hint">· ${p.views} pregleda</span>
        ${featureBox(p, 'part')}
        <div class="btns" style="margin-top:10px">
          <a class="btn dark" href="/uredi/dio/${p.id}">${icon('edit', 18, '#fff')} Uredi</a>
          <button class="btn danger" id="del">Obriši</button>
        </div></div>` : ''}
    </div>
    <div class="det dg-info">
        <h2 class="det-h">${icon('list', 20)} Podaci o dijelu</h2>
        <dl class="facts">${facts.map(([a, b]) => html`<div><dt>${a}</dt><dd>${b}</dd></div>`)}</dl>
    </div>
  </div>
  ${p.similar?.length ? html`<section class="sec"><div class="sec-h"><h2>Još za ${p.make_name} ${p.generation || ''}</h2><a href="/dijelovi${qs({ make: p.make_id, gen: p.model_id })}">Svi</a></div>
    <div class="list cols">${p.similar.map(x => partRow(x))}</div></section>` : ''}`);
  bindGallery(el, p.images);
  bindFeatureBox(el, () => partPage({ el, params }));

  $('#ask', el)?.addEventListener('click', () => inquiryModal({ part_id: p.id }, `Zanima me: ${p.title}${p.vehicle ? ' za ' + p.vehicle : ''}. Da li je još dostupno?`));
  $('#fav', el).onclick = async () => {
    if (!state.user) return go('/prijava?next=' + encodeURIComponent(location.pathname));
    try { const r = await api('/api/favorites', { body: { kind: 'part', id: p.id } }); toast(r.fav ? 'Sačuvano' : 'Uklonjeno iz sačuvanih'); partPage({ el, params }); } catch (e) { fail(e); }
  };
  $('#share', el).onclick = () => share(`${p.title} ${p.vehicle || ''} — ${km(p.price)}`);
  $('#rep', el)?.addEventListener('click', () => reportModal('part', p.id));
  el.querySelectorAll('[data-st]').forEach(b => {
    b.onclick = async () => {
      try { await api(`/api/parts/${p.id}/status`, { body: { status: b.dataset.st } }); toast('Sačuvano'); partPage({ el, params }); } catch (e) { fail(e); }
    };
  });
  $('#del', el)?.addEventListener('click', async () => {
    if (!await confirmBox('Obrisati ovaj oglas? (npr. kad je dio prodat)', 'Obriši')) return;
    try { await api('/api/parts/' + p.id, { method: 'DELETE' }); toast('Obrisano'); go('/profil'); } catch (e) { fail(e); }
  });
}

export async function share(text) {
  const url = location.href.split('#')[0];
  if (navigator.share) { try { await navigator.share({ title: text, text, url }); } catch { /* odustao */ } return; }
  try { await navigator.clipboard.writeText(url); toast('Link kopiran'); } catch { toast(url); }
}

// Upit prodavcu (dio / vozilo / prodavac)
export function inquiryModal(target, defText = '') {
  const u = state.user;
  modal('Pošalji upit', html`<form class="stack" id="iqF">${antiSpam()}
    <label class="f req"><span>Poruka</span><textarea name="message" required>${defText}</textarea></label>
    ${u ? html`<p class="hint" style="margin:0">Prodavac će vidjeti tvoje ime i broj: <strong>${u.name}, ${u.phone}</strong></p>` : html`
      <div class="grid2"><label class="f req"><span>Ime</span><input name="name" required autocomplete="name"></label>
      <label class="f req"><span>Telefon</span><input name="phone" type="tel" required autocomplete="tel" placeholder="06x…"></label></div>`}
    <button class="btn dark big block">Pošalji</button></form>`, (m, close) => {
    $('#iqF', m).onsubmit = async e => {
      e.preventDefault();
      const b = e.submitter; busy(b, true, 'Šaljem…');
      try { await api('/api/inquiries', { body: { ...target, ...formData(e.target) } }); close(); toast('Upit poslan. Prodavac će te kontaktirati.'); }
      catch (err) { fail(err); busy(b, false); }
    };
  });
}

export function reportModal(kind, id) {
  modal('Prijavi oglas', html`<form class="stack" id="rpF">
    <label class="f"><span>Šta nije u redu?</span><select name="reason"><option>Prevara / lažan oglas</option><option>Dio je prodat</option><option>Pogrešna kategorija ili model</option><option>Neprikladan sadržaj</option><option>Drugo</option></select></label>
    <button class="btn dark block">Pošalji prijavu</button></form>`, (m, close) => {
    $('#rpF', m).onsubmit = async e => {
      e.preventDefault();
      try { await api('/api/reports', { body: { kind, id, reason: e.target.reason.value } }); close(); toast('Hvala, pregledaćemo.'); } catch (err) { fail(err); }
    };
  });
}
