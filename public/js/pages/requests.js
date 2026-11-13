import { html, raw, render, $, api, go, qs, setTitle, formData, km, ago, fail, toast, state, busy, loadMe } from '../core.js';
import { icon, vehiclePicker, requestRow, citySelect, pagedList, contactButtons, verifiedBadge, imageInput, suggestModel, confirmBox, gallery, bindGallery, bindYear, engineSelect } from '../components.js';

export async function requestsPage({ el, query: q }) {
  setTitle('Tražim dio');
  const otpad = state.user?.type === 'otpad';
  render(el, html`
  <section class="page-head">
    <div class="row"><h1 style="padding-left:12px">Tražim dio</h1></div>
    <p class="sub">${otpad ? 'Kupci traže ove dijelove. Pošalji ponudu sa cijenom — kupac te zove.' : 'Kupci objave šta traže, a otpadi im se javljaju sa cijenom.'}</p>
    <a class="btn accent big block" href="/trazim/novi">${icon('send', 20)} Objavi šta tražiš</a>
    <form id="rf" class="stack" style="gap:10px;margin-top:14px">
      <div id="rp" class="stack" style="gap:10px"></div>
      <div class="grid2"><label class="f"><span>Dio</span><input name="q" value="${q.q || ''}" placeholder="far, mjenjač…"></label>
      <label class="f"><span>Grad</span>${await citySelect('city', q.city)}</label></div>
      ${otpad ? html`<label class="check" style="color:#fff"><input type="checkbox" name="unanswered" ${q.unanswered ? 'checked' : ''}> Samo gdje još nisam ponudio</label>` : ''}
      <button class="btn line block">${icon('search', 18)} Filtriraj</button>
      ${q.make || q.q || q.city || q.unanswered ? html`<a href="/trazim" class="reset-link">Poništi pretragu</a>` : ''}
    </form>
  </section>
  <div class="wrap"><div class="count-line"><span class="c" id="rc">…</span></div><div id="rl"></div></div>`);
  const picker = await vehiclePicker($('#rp', el), { make: q.make, model: q.model, gen: q.gen });
  $('#rf', el).onsubmit = e => {
    e.preventDefault();
    const v = picker.get(); const f = formData(e.target);
    go('/trazim' + qs({ make: v.make, model: v.model, gen: v.gen, q: f.q.trim(), city: f.city, unanswered: f.unanswered ? 1 : '' }));
  };
  await pagedList({
    box: $('#rl', el), query: q, per: 30,
    fetch: page => api('/api/requests' + qs({ ...q, stranica: undefined, page })),
    draw: (items, total) => {
      $('#rc', el).textContent = `${total} ${total === 1 ? 'otvoren zahtjev' : 'otvorenih zahtjeva'}`;
      return items.length ? html`<div class="list">${items.map(requestRow)}</div>` : html`<div class="empty"><strong>Nema zahtjeva</strong>Promijeni filter ili objavi svoj.</div>`;
    },
  });
  if (otpad && state.counts.requests) { api('/api/requests/seen', { body: {} }).then(loadMe).catch(() => {}); }
}

export async function newRequestPage({ el, query: q }) {
  if (!state.user) return go('/prijava?next=' + encodeURIComponent(location.pathname + location.search), true);
  setTitle('Objavi šta tražiš');
  render(el, html`
  <section class="page-head"><div class="row"><a href="/trazim" class="icon-btn" aria-label="Nazad">${icon('back', 22, '#fff')}</a><h1>Tražim dio</h1></div>
    <p class="sub">Svi otpadi vide tvoj zahtjev i javljaju ti se sa cijenom.</p></section>
  <form class="wrap stack" id="nr" style="padding-top:16px">
    <div class="card stack">
      <strong>Za koje vozilo?</strong>
      <div id="np" class="stack" style="gap:10px"></div>
      <button type="button" class="link" id="nomodel" style="align-self:flex-start">Nema mog modela?</button>
      <label class="f" id="mtxt" hidden><span>Upiši marku i model</span><input name="model_text" placeholder="npr. Volkswagen Golf 8 facelift"></label>
      <div class="grid2"><label class="f"><span>Godište</span><select name="year"></select></label>
      <label class="f"><span>Motor</span>${engineSelect('engine', '')}</label></div>
    </div>
    <div class="card stack">
      <label class="f req"><span>Koji dio tražiš?</span><input name="part" required maxlength="120" value="${q.part || ''}" placeholder="npr. far prednji lijevi"></label>
      <label class="f"><span>Opis (nije obavezno)</span><textarea name="description" placeholder="kataloški broj, boja, stanje, da li treba slanje…"></textarea></label>
      <label class="f"><span>Tvoj grad</span>${await citySelect('city', state.user.city, 'Izaberi grad')}</label>
      <div><div class="f" style="margin-bottom:6px;font-size:12.5px;font-weight:600;color:var(--muted)">Slika (ako imaš — npr. naljepnica dijela)</div><div id="ni"></div></div>
    </div>
    <p class="hint" style="margin:0">Otpadi će te zvati na <strong>${state.user.phone}</strong>. Ponude vidiš u Profilu.</p>
    <button class="btn accent big block">${icon('send', 20)} Objavi zahtjev</button>
  </form>`);
  const picker = await vehiclePicker($('#np', el), { make: q.make, model: q.model, gen: q.gen }, { anyText: 'Izaberi marku' });
  const imgs = imageInput($('#ni', el), [], 3);
  bindYear($('#np', el), picker, $('#nr select[name=year]', el), q.year);
  $('#nomodel', el).onclick = () => { $('#mtxt', el).hidden = false; const v = picker.get(); suggestModel(v.make, v.makeName); };
  $('#nr', el).onsubmit = async e => {
    e.preventDefault();
    const v = picker.get(); const f = formData(e.target);
    if (!v.make && !f.model_text) return toast('Izaberi marku vozila', true);
    if (imgs.busy()) return toast('Sačekaj da se slike učitaju', true);
    const b = e.submitter; busy(b, true, 'Objavljujem…');
    try {
      const r = await api('/api/requests', { body: { ...f, make_id: v.make, model_id: v.gen || null, model_text: f.model_text || (!v.gen && v.model ? v.label : ''), images: imgs.get() } });
      toast('Objavljeno! Otpadi će ti se javiti.'); go('/trazim/' + r.id, true);
    } catch (err) { fail(err); busy(b, false); }
  };
}

export async function requestPage({ el, params }) {
  const r = await api('/api/requests/' + encodeURIComponent(params.id));
  setTitle(`Tražim: ${r.part}`);
  const u = state.user;
  const canOffer = u && !r.mine && r.status === 'open';
  render(el, html`
  <section class="page-head"><div class="row"><a href="/trazim" class="icon-btn" aria-label="Nazad">${icon('back', 22, '#fff')}</a><h1>Tražim dio</h1></div></section>
  <div class="wrap stack" style="padding-top:16px">
    <div class="card">
      ${r.status !== 'open' ? html`<p style="margin:0 0 8px"><span class="badge">Zatvoren</span></p>` : ''}
      <h2 style="font-size:28px">${r.part}</h2>
      <div style="color:var(--muted);margin:4px 0 10px">${[r.vehicle || r.model_text, r.year, r.engine].filter(Boolean).join(' · ')}</div>
      ${r.description ? html`<div class="desc" style="margin-bottom:10px">${r.description}</div>` : ''}
      ${r.images?.length ? html`<div style="margin-bottom:10px">${gallery(r.images, r.part)}</div>` : ''}
      <div class="hint">${[r.buyer_name, r.city, ago(r.created_at)].filter(Boolean).join(' · ')}</div>
      ${!r.mine && u && r.buyer_phone ? html`<div class="btns3" style="margin-top:12px">${contactButtons({ phone: r.buyer_phone, viber: r.buyer_viber, whatsapp: r.buyer_whatsapp }, `zahtjev „${r.part}“`)}</div>` : ''}
      ${!u ? html`<p class="hint" style="margin:10px 0 0"><a href="/prijava?next=/trazim/${r.id}">Prijavi se</a> da vidiš broj kupca i pošalješ ponudu.</p>` : ''}
    </div>
    ${r.mine ? html`
      <div class="sec-h" style="margin-top:6px"><h2>Ponude (${r.offers.length})</h2></div>
      ${r.offers.length ? html`<div class="list">${r.offers.map(o => html`<div class="row-item" style="flex-direction:column;gap:8px">
        <div style="display:flex;justify-content:space-between;width:100%;gap:10px;align-items:baseline">
          <a href="/prodavac/${o.user_id}" style="font-weight:700;font-size:16px">${o.seller_name}</a>
          <span style="font-family:var(--head);font-size:24px;font-weight:800">${km(o.price)}</span></div>
        <div class="hint">${[o.seller_type === 'otpad' ? 'Otpad' : 'Privatno', o.seller_city, ago(o.created_at)].filter(Boolean).join(' · ')} ${verifiedBadge(o.seller_verified)}${o.seller_ships ? ' · šalje brzom poštom' : ''}</div>
        ${o.message ? html`<div class="desc">${o.message}</div>` : ''}
        ${o.part_id ? html`<a href="/dio/${o.part_id}" style="font-weight:600">Pogledaj oglas dijela →</a>` : ''}
        <div class="btns3" style="width:100%">${contactButtons({ phone: o.seller_phone, viber: o.seller_viber, whatsapp: o.seller_whatsapp }, `ponuda za „${r.part}“`)}</div>
      </div>`)}</div>` : html`<div class="empty"><strong>Još nema ponuda</strong>Otpadi su obaviješteni. Ponude će se pojaviti ovdje.</div>`}
      <button class="btn line block" id="close">${r.status === 'open' ? 'Našao sam dio — zatvori zahtjev' : 'Ponovo otvori zahtjev'}</button>` : ''}
    ${r.my_offer ? html`<div class="card offer-sent" id="ofSent">
      <div class="os-head">
        <span class="os-ok">${icon('check', 18, '#145C2B', 2.6)}</span>
        <div style="flex:1"><strong>Ponuda poslana</strong><div class="hint">${ago(r.my_offer.created_at)} · kupac vidi tvoj broj</div></div>
        ${canOffer ? html`<button class="icon-btn" id="ofEdit" aria-label="Izmijeni ponudu">${icon('edit', 20)}</button>` : ''}
      </div>
      <div class="os-price">${km(r.my_offer.price)}</div>
      ${r.my_offer.message ? html`<div class="desc">${r.my_offer.message}</div>` : ''}
    </div>` : ''}
    ${canOffer ? html`<form class="card stack" id="of" ${r.my_offer ? raw('hidden') : ''}>
      <strong style="font-size:17px">${r.my_offer ? 'Izmijeni ponudu' : 'Pošalji ponudu'}</strong>
      <label class="f"><span>Cijena (KM)</span><input name="price" inputmode="decimal" value="${r.my_offer?.price ?? ''}" placeholder="npr. 150"></label>
      <label class="f"><span>Poruka</span><textarea name="message" placeholder="stanje, garancija, slanje brzom poštom…">${r.my_offer?.message || ''}</textarea></label>
      <button class="btn accent big block">${r.my_offer ? 'Sačuvaj izmjene' : 'Pošalji ponudu'}</button>
      ${r.my_offer ? html`<div class="btns"><button type="button" class="btn line" id="ofCancel">Odustani</button><button type="button" class="btn danger" id="delOf">Povuci ponudu</button></div>` : ''}
      <span class="hint">Kupac vidi tvoju cijenu, poruku i broj telefona.</span>
    </form>` : ''}
    ${!r.mine && !canOffer && r.offers_count !== undefined ? html`<p class="hint">${r.offers_count} ${r.offers_count === 1 ? 'ponuda' : 'ponuda'} do sada.</p>` : ''}
  </div>`);
  bindGallery(el, r.images);
  $('#close', el)?.addEventListener('click', async () => {
    try { await api(`/api/requests/${r.id}/close`, { body: {} }); toast('Sačuvano'); requestPage({ el, params }); } catch (e) { fail(e); }
  });
  $('#of', el)?.addEventListener('submit', async e => {
    e.preventDefault();
    const b = e.submitter; busy(b, true, 'Šaljem…');
    try { await api(`/api/requests/${r.id}/offer`, { body: formData(e.target) }); toast(r.my_offer ? 'Ponuda izmijenjena' : 'Ponuda poslana kupcu'); await requestPage({ el, params }); $('#ofSent', el)?.scrollIntoView({ block: 'center' }); }
    catch (err) { fail(err); busy(b, false); }
  });
  $('#ofEdit', el)?.addEventListener('click', () => { $('#ofSent', el).hidden = true; $('#of', el).hidden = false; $('#of', el).price.focus(); });
  $('#ofCancel', el)?.addEventListener('click', () => { $('#of', el).hidden = true; $('#ofSent', el).hidden = false; });
  $('#delOf', el)?.addEventListener('click', async () => {
    if (!await confirmBox('Povući ponudu?', 'Povuci')) return;
    try { await api(`/api/requests/${r.id}/offer`, { method: 'DELETE' }); toast('Ponuda povučena'); requestPage({ el, params }); } catch (e) { fail(e); }
  });
  if (r.mine) loadMe();
}

