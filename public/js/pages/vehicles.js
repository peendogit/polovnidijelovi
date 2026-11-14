import { html, raw, render, $, $$, api, go, qs, setTitle, formData, ago, fail, toast, state, busy, getMeta } from '../core.js';
import { vehicleUrl, canonical } from '../core.js';
import { icon, vehiclePicker, vehicleCard, vehicleRow, partRow, citySelect, pagedList, gallery, bindGallery, contactButtons, sellerBlock, modal, confirmBox, engineSelect, optSelect, BODIES, DRIVES, GEARBOXES, antiSpam, filterFields, bindFilters, hasFilters } from '../components.js';
import { inquiryModal, share, reportModal } from './parts.js';

// Vozila za dijelove — filter i lista (nacrt 5)
export async function vehiclesPage({ el, query: q }) {
  setTitle('Vozila za dijelove');
  const meta = await getMeta();
  render(el, html`
  <section class="page-head">
    <div class="row"><a href="/" class="icon-btn" aria-label="Nazad">${icon('back', 22, '#fff')}</a><h1>Vozila za dijelove</h1></div>
    <form id="vf" class="stack" style="gap:10px" role="search">
      <div id="vp" class="stack" style="gap:10px"></div>
      ${await filterFields(q)}
      <input type="hidden" name="sort" value="${q.sort || ''}">
      <button class="btn accent big block">${icon('search', 20)} Prikaži vozila</button>
      ${q.make || hasFilters(q) || q.sort ? html`<a href="/vozila" class="reset-link">Poništi pretragu</a>` : ''}
    </form>
  </section>
  <div class="wrap">
    <div class="count-line"><span class="c" id="vc">…</span>
      <label><span class="sr">Poredaj</span><select id="vs"><option value="">Najnovija</option>
        <option value="godiste" ${q.sort === 'godiste' ? 'selected' : ''}>Najnovije godište</option><option value="godiste-" ${q.sort === 'godiste-' ? 'selected' : ''}>Najstarije godište</option></select></label>
    </div>
    <div id="vb" style="margin-bottom:12px"></div><div id="vl"></div>
  </div>`);

  const picker = await vehiclePicker($('#vp', el), { make: q.make, model: q.model, gen: q.gen });
  const filters = bindFilters($('#vf', el), $('#vp', el), picker, q);
  // ako je model izabran, odmah prikaži (kao u nacrtu: izabereš Golf 6 → svi Golf 6)
  $('#vp', el).addEventListener('pick', () => { const v = picker.get(); if (v.model) submit(); });
  const submit = () => {
    const v = picker.get();
    const f = formData($('#vf', el));
    go('/vozila' + qs({ make: v.make, model: v.model, gen: v.gen, ...filters(), sort: $('#vs', el).value }), true);
  };
  $('#vf', el).onsubmit = e => { e.preventDefault(); submit(); };
  $('#vs', el).onchange = submit;

  const label = picker.get().label;
  let shownTotal = 0;
  await pagedList({
    box: $('#vl', el), query: q,
    fetch: page => api('/api/vehicles' + qs({ ...q, stranica: undefined, page })),
    draw: (items, total) => {
      shownTotal = total;
      $('#vc', el).textContent = q.model ? `${label} na otpadima: ${total} ${total === 1 ? 'vozilo' : 'vozila'}` : `${total} ${total === 1 ? 'vozilo' : 'vozila'} za dijelove`;
      if (!items.length) {
        return html`<div class="empty"><strong>Trenutno nema takvih vozila</strong>Objavi „Tražim dio“ — otpadi koji dobiju ovaj model javiće ti se.
          <div style="margin-top:14px"><a class="btn dark" href="/trazim/novi${qs({ make: q.make, model: q.model, gen: q.gen })}">${icon('send', 18, '#fff')} Tražim dio</a></div></div>`;
      }
      const [first, ...rest] = items;
      return html`<div class="stack">${vehicleCard(first)}${rest.length ? html`<div class="list">${rest.map(v => vehicleRow(v))}</div>` : ''}</div>`;
    },
  });
  if (q.model && shownTotal) {
    render($('#vb', el), html`<div class="card stack" style="gap:8px;padding:16px">
      <strong style="font-size:16px">Treba ti dio za ${label}?</strong>
      <span class="hint" style="font-size:14px">Pošalji jedan upit svim otpadima koji imaju ovaj model.</span>
      <button class="btn dark block" id="askAll">Pitaj sve otpade</button></div>`);
    $('#askAll', el).onclick = () => askAllModal({ make: q.make, model: q.model, gen: q.gen }, label);
  }
}

function askAllModal(target, label) {
  const u = state.user;
  modal(`Pitaj sve otpade — ${label}`, html`<form class="stack" id="aaF">${antiSpam()}
    <label class="f req"><span>Koji dio tražiš?</span><textarea name="message" required placeholder="npr. far lijevi, xenon. Godište 2010, 1.6 TDI."></textarea></label>
    ${u ? html`<p class="hint" style="margin:0">Otpadi će te zvati na: <strong>${u.phone}</strong></p>` : html`
    <div class="grid2"><label class="f req"><span>Ime</span><input name="name" required></label><label class="f req"><span>Telefon</span><input name="phone" type="tel" required placeholder="06x…"></label></div>`}
    <button class="btn dark big block">Pošalji svim otpadima</button></form>`, (m, close) => {
    $('#aaF', m).onsubmit = async e => {
      e.preventDefault();
      const b = e.submitter; busy(b, true, 'Šaljem…');
      try {
        const r = await api('/api/inquiries/broadcast', { body: { ...target, ...formData(e.target) } });
        close(); toast(`Poslano na ${r.sent} ${r.sent === 1 ? 'otpad' : 'otpada'}. Javiće ti se.`);
      } catch (err) { fail(err); busy(b, false); }
    };
  });
}

// Detalj vozila
export async function vehiclePage({ el, params }) {
  const v = await api('/api/vehicles/' + encodeURIComponent(params.id));
  const name = v.vehicle || v.model_text;
  setTitle(`${name} ${v.year || ''} — vozilo za dijelove`);
  canonical(vehicleUrl(v));
  render(el, html`
  <div class="det-grid">
    <div>${gallery(v.images, name)}</div>
    <div class="stack" style="gap:0">
      <div class="det">
        <p style="margin:0 0 8px"><span class="badge ${v.status === 'active' ? 'dark' : ''}">${v.status === 'active' ? 'Rastavlja se' : v.status === 'done' ? 'Rastavljeno' : 'Skriveno'}</span></p>
        <h1>${name}</h1>
        <div class="veh">${v.generation ? html`<a href="/vozila${qs({ make: v.make_id, gen: v.model_id })}">${v.make_name} ${v.generation}</a>` : ''}</div>
        <dl class="facts">
          ${[['Godište', v.year], ['Gorivo', v.fuel], ['Motor', v.engine], ['Snaga', v.power_kw ? v.power_kw + ' kW' : null], ['Kod motora', v.engine_code],
            ['Mjenjač', v.gearbox], ['Broj brzina', v.gears], ['Kod mjenjača', v.gearbox_code], ['Pogon', v.drive], ['Karoserija', v.body], ['Boja', v.color], ['Kod boje', v.color_code], ['Kilometraža', v.mileage ? v.mileage.toLocaleString('bs-BA') + ' km' : null], ['Lokacija', v.city], ['Objavljeno', ago(v.created_at)]]
            .filter(x => x[1]).map(([a, b]) => html`<div><dt>${a}</dt><dd>${b}</dd></div>`)}
        </dl>
        ${v.description ? html`<div class="desc">${v.description}</div>` : ''}
      </div>
      <div class="det" style="margin-top:10px" id="pitaj">
        ${sellerBlock(v.seller)}
        <div class="btns3" style="margin-top:12px">${contactButtons(v.seller, `${name} ${v.year || ''} — ${location.origin}${vehicleUrl(v)}`)}</div>
        ${v.mine ? '' : html`<button class="btn dark block big" id="ask" style="margin-top:8px">${icon('chat', 18, '#fff')} Pitaj za dio sa ovog vozila</button>`}
      </div>
      <div class="det" style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn line sm" id="fav">${icon('heart', 18, v.fav ? '#B42318' : 'currentColor')} ${v.fav ? 'Sačuvano' : 'Sačuvaj'}</button>
        <button class="btn line sm" id="share">${icon('share', 18)} Podijeli</button>
        ${v.mine ? '' : html`<button class="btn ghost sm" id="rep">${icon('flag', 16)} Prijavi</button>`}
      </div>
      ${v.mine ? html`<div class="det" style="margin-top:10px">
        <strong>${v.user_id === state.user?.id ? 'Tvoje vozilo' : 'Administrator — tuđe vozilo'}</strong> <span class="hint">· ${v.views} pregleda</span>
        <div class="btns" style="margin-top:10px">
          <a class="btn accent" href="/objavi/dio?vozilo=${v.id}">${icon('plus', 18)} Dodaj dio</a>
          <a class="btn dark" href="/uredi/vozilo/${v.id}">${icon('edit', 18, '#fff')} Uredi</a>
          ${v.status === 'active' ? html`<button class="btn line" data-st="done">Rastavljeno</button>` : html`<button class="btn line" data-st="active">Ponovo aktiviraj</button>`}
          <button class="btn danger" id="del">Obriši</button>
        </div></div>` : ''}
    </div>
  </div>
  <section class="sec">
    <div class="sec-h"><h2>Dijelovi sa ovog vozila</h2></div>
    ${v.parts.length ? html`<div class="list cols">${v.parts.map(p => partRow(p, { noSeller: true }))}</div>`
      : html`<div class="empty">Pojedinačni dijelovi još nisu objavljeni — ${v.mine ? 'dodaj ih dugmetom „Dodaj dio“.' : 'pitaj otpad za bilo koji dio sa ovog vozila.'}</div>`}
  </section>
  ${v.same_model?.length ? html`<section class="sec"><div class="sec-h"><h2>Još ${v.make_name} ${v.generation || ''}</h2><a href="/vozila${qs({ make: v.make_id, gen: v.model_id })}">Sva</a></div>
    <div class="list">${v.same_model.map(x => vehicleRow(x))}</div></section>` : ''}`);
  bindGallery(el, v.images);
  if (location.hash === '#pitaj' && !v.mine) setTimeout(() => inquiryModal({ vehicle_id: v.id }, `Zanima me dio sa vozila ${name} ${v.year || ''}: `), 50);

  $('#ask', el)?.addEventListener('click', () => inquiryModal({ vehicle_id: v.id }, `Zanima me dio sa vozila ${name} ${v.year || ''}: `));
  $('#fav', el).onclick = async () => {
    if (!state.user) return go('/prijava?next=' + encodeURIComponent(location.pathname));
    try { const r = await api('/api/favorites', { body: { kind: 'vehicle', id: v.id } }); toast(r.fav ? 'Sačuvano' : 'Uklonjeno'); vehiclePage({ el, params }); } catch (e) { fail(e); }
  };
  $('#share', el).onclick = () => share(`${name} ${v.year || ''} — vozilo za dijelove`);
  $('#rep', el)?.addEventListener('click', () => reportModal('vehicle', v.id));
  $$('[data-st]', el).forEach(b => {
    b.onclick = async () => { try { await api(`/api/vehicles/${v.id}/status`, { body: { status: b.dataset.st } }); toast('Sačuvano'); vehiclePage({ el, params }); } catch (e) { fail(e); } };
  });
  $('#del', el)?.addEventListener('click', async () => {
    if (!await confirmBox('Obrisati vozilo? Dijelovi sa njega ostaju objavljeni.', 'Obriši')) return;
    try { await api('/api/vehicles/' + v.id, { method: 'DELETE' }); toast('Obrisano'); go('/profil/vozila'); } catch (e) { fail(e); }
  });
}
