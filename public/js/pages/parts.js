import { html, raw, render, $, api, go, qs, setTitle, formData, km, ago, fail, toast, state, busy, partUrl, canonical } from '../core.js';
import { icon, vehiclePicker, partRow, citySelect, pagedList, gallery, bindGallery, contactButtons, sellerBlock, modal, confirmBox, antiSpam } from '../components.js';

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
      <label class="f"><span>Dio ili kataloški broj</span><input name="q" value="${q.q || ''}" placeholder="far, branik, 5G0941005…" autocomplete="off"></label>
      <label class="f"><span>Grad</span>${await citySelect('city', q.city)}</label>
      <button class="btn accent big block">${icon('search', 20)} Pretraži</button>
      ${q.make || q.q || q.city || q.sort ? html`<a href="/dijelovi" class="reset-link">Poništi pretragu</a>` : ''}
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
  const search = () => {
    const v = picker.get();
    const f = formData($('#pf', el));
    go('/dijelovi' + qs({ make: v.make, model: v.model, gen: v.gen, q: f.q.trim(), city: f.city, sort: $('#ps', el).value }));
  };
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
  await pagedList({
    box: $('#pl', el), query,
    fetch: page => api('/api/parts' + qs({ ...q, stranica: undefined, page })),
    draw: (items, total) => {
      $('#pc', el).textContent = `${total} ${total === 1 ? 'oglas' : 'oglasa'}`;
      if (items.length) return html`<div class="list cols">${items.map(p => partRow(p))}</div>`;
      const v = picker.get();
      return html`<div class="empty"><strong>Nema takvih dijelova</strong>Pošalji „Tražim dio“ — otpadi koji ga imaju javiće ti se sa cijenom.
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
  render(el, html`
  <div class="det-grid">
    <div>${gallery(p.images, p.title)}</div>
    <div class="stack" style="gap:0">
      <div class="det">
        ${p.status !== 'active' ? html`<p style="margin:0 0 8px"><span class="badge ${p.status === 'sold' ? 'ok' : ''}">${p.status === 'sold' ? 'Prodato' : 'Skriveno'}</span></p>` : ''}
        <h1>${p.title}</h1>
        <div class="veh">${p.generation ? html`<a href="/dijelovi${qs({ make: p.make_id, gen: p.model_id })}">${p.make_name} ${p.generation}</a>` : p.vehicle}</div>
        <div class="price">${km(p.price)} ${p.negotiable ? html`<small>· po dogovoru</small>` : ''}</div>
        <dl class="facts">
          ${[['Stanje', p.condition], ['Godište', p.year], ['Motor', p.engine], ['Gorivo', p.fuel], ['Strana', p.side], ['Boja', p.color], ['Kod boje', p.color_code], ['Kataloški broj', p.part_no], ['Lokacija', p.city], ['Objavljeno', ago(p.created_at)]]
            .filter(x => x[1]).map(([a, b]) => html`<div><dt>${a}</dt><dd>${b}</dd></div>`)}
        </dl>
        ${p.description ? html`<div class="desc">${p.description}</div>` : ''}
        ${p.vehicle_ad ? html`<a class="cta-row" style="margin-top:14px;background:var(--bg)" href="/vozilo/${p.vehicle_ad.id}"><span class="dot">${icon('car', 20, '#1B1E22')}</span><div><strong>Dio sa vozila ${p.vehicle_ad.year || ''}</strong><span>Pogledaj ostale dijelove sa ovog auta</span></div>${icon('right', 20)}</a>` : ''}
      </div>
      <div class="det" style="margin-top:10px">
        ${sellerBlock(p.seller)}
        <div class="btns3" style="margin-top:12px">${contactButtons(p.seller, ctxText)}</div>
        ${p.mine ? '' : html`<button class="btn line block" id="ask" style="margin-top:8px">${icon('chat', 18)} Pošalji upit prodavcu</button>`}
      </div>
      <div class="det" style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn line sm" id="fav">${icon('heart', 18, p.fav ? '#B42318' : 'currentColor')} ${p.fav ? 'Sačuvano' : 'Sačuvaj'}</button>
        <button class="btn line sm" id="share">${icon('share', 18)} Podijeli</button>
        ${p.mine ? '' : html`<button class="btn ghost sm" id="rep">${icon('flag', 16)} Prijavi oglas</button>`}
      </div>
      ${p.mine ? html`<div class="det" style="margin-top:10px">
        <strong>${p.user_id === state.user?.id ? 'Tvoj oglas' : 'Administrator — tuđi oglas'}</strong> <span class="hint">· ${p.views} pregleda</span>
        <div class="btns" style="margin-top:10px">
          <a class="btn dark" href="/uredi/dio/${p.id}">${icon('edit', 18, '#fff')} Uredi</a>
          <button class="btn danger" id="del">Obriši</button>
        </div></div>` : ''}
    </div>
  </div>
  ${p.similar?.length ? html`<section class="sec"><div class="sec-h"><h2>Još za ${p.make_name} ${p.generation || ''}</h2><a href="/dijelovi${qs({ make: p.make_id, gen: p.model_id })}">Svi</a></div>
    <div class="list cols">${p.similar.map(x => partRow(x))}</div></section>` : ''}`);
  bindGallery(el, p.images);

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
