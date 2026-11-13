import { html, render, $, api, go, qs, setTitle, state } from '../core.js';
import { icon, vehiclePicker, partRow, vehicleCard, vehicleRow, requestRow } from '../components.js';

export async function homePage({ el }) {
  setTitle('');
  render(el, html`
  <section class="hero">
    <h1>Polovni dijelovi sa otpada iz cijele BiH</h1>
    <p class="lead">Izaberi auto, nađi dio, pozovi prodavca.</p>
    <form class="card search-card" id="hs" role="search">
      <div id="hp" class="stack" style="gap:10px"></div>
      <label class="f"><span>Dio</span><input name="q" placeholder="far, branik, mjenjač…" autocomplete="off"></label>
      <button class="btn accent big block">Pretraži</button>
    </form>
  </section>
  <section class="sec" style="padding-top:18px">
    <div class="tiles">
      <a class="tile" href="/dijelovi">${icon('wrench', 26, '#1B1E22', 1.8)}<strong>Dijelovi</strong><span>Pojedinačni dijelovi</span></a>
      <a class="tile dark" href="/vozila">${icon('car', 26, '#F5B301', 1.8)}<strong>Vozila za dijelove</strong><span>Sva vozila na otpadima</span></a>
    </div>
  </section>
  <section class="sec" style="padding-top:12px">
    <a class="cta-row" href="/trazim/novi">
      <span class="dot">${icon('send', 20, '#1B1E22')}</span>
      <div><strong>Tražim dio</strong><span>Napiši šta ti treba — otpadi ti se javljaju sa cijenom.</span></div>
      ${icon('right', 20)}
    </a>
  </section>
  <div id="hl"><div class="loading">Učitavam…</div></div>`);

  const picker = await vehiclePicker($('#hp', el), {});
  $('#hs', el).onsubmit = e => {
    e.preventDefault();
    const v = picker.get();
    const f = e.target;
    go('/dijelovi' + qs({ make: v.make, model: v.model, gen: v.gen, q: f.q.value.trim() }));
  };

  const d = await api('/api/home');
  const [first, ...rest] = d.vehicles;
  render($('#hl', el), html`
    <section class="sec">
      <div class="sec-h"><h2>Rastavlja se</h2><a href="/vozila">Sva vozila</a></div>
      ${first ? html`<div class="stack">${vehicleCard(first)}${rest.length ? html`<div class="list">${rest.map(v => vehicleRow(v))}</div>` : ''}</div>`
        : html`<div class="empty"><strong>Još nema vozila</strong>Otpadi: objavite vozila koja rastavljate.<div style="margin-top:12px"><a class="btn dark" href="/objavi/vozilo">Objavi vozilo</a></div></div>`}
    </section>
    <section class="sec">
      <div class="sec-h"><h2>Novi dijelovi</h2><a href="/dijelovi">Svi</a></div>
      ${d.parts.length ? html`<div class="list cols">${d.parts.map(p => partRow(p))}</div>`
        : html`<div class="empty"><strong>Još nema oglasa</strong>Budi prvi — objava je besplatna.<div style="margin-top:12px"><a class="btn dark" href="/objavi/dio">Objavi dio</a></div></div>`}
    </section>
    ${d.requests.length ? html`<section class="sec">
      <div class="sec-h"><h2>Kupci traže</h2><a href="/trazim">Svi zahtjevi</a></div>
      <div class="list">${d.requests.map(requestRow)}</div>
      ${state.user?.type === 'otpad' ? '' : html`<p class="hint" style="margin:8px 2px 0">Imaš otpad? <a href="/registracija?tip=otpad">Registruj se</a> i odgovaraj kupcima sa cijenom.</p>`}
    </section>` : ''}
  `);
}
