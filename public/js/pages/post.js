import { html, raw, render, $, api, go, qs, setTitle, formData, fail, toast, state, busy, getMeta, partUrl } from '../core.js';
import { icon, vehiclePicker, imageInput, suggestModel, citySelect, bindYear, engineSelect, optSelect, BODIES, DRIVES, GEARBOXES } from '../components.js';

// "1.6 TDI" -> "1.6" (za padajući meni)
const engNum = e => (String(e || '').match(/\d[.,]\d/) || [''])[0].replace(',', '.');

const needLogin = () => go('/prijava?next=' + encodeURIComponent(location.pathname + location.search), true);

export async function postChoosePage({ el }) {
  if (!state.user) return needLogin();
  setTitle('Objavi');
  const otpad = state.user.type === 'otpad';
  render(el, html`
  <section class="page-head"><div class="row"><h1 style="padding-left:12px">Šta objavljuješ?</h1></div><p class="sub">Objava je besplatna.</p></section>
  <div class="wrap stack" style="padding-top:16px">
    <a class="cta-row" href="/objavi/dio"><span class="dot">${icon('wrench', 20, '#1B1E22')}</span><div><strong>Dio</strong><span>Jedan dio sa slikom i cijenom</span></div>${icon('right', 20)}</a>
    <a class="cta-row" href="/objavi/vozilo"><span class="dot">${icon('car', 20, '#1B1E22')}</span><div><strong>Vozilo za dijelove</strong><span>${otpad ? 'Auto koji rastavljaš — kupci pitaju za bilo koji dio' : 'Cijelo vozilo koje se rastavlja'}</span></div>${icon('right', 20)}</a>
    <a class="cta-row" href="/trazim/novi"><span class="dot">${icon('send', 20, '#1B1E22')}</span><div><strong>Tražim dio</strong><span>Napiši šta ti treba — otpadi šalju ponude</span></div>${icon('right', 20)}</a>
    ${otpad ? html`<p class="hint">Imaš puno dijelova u svom programu? U <a href="/profil/postavke">Postavkama</a> uzmi API ključ za automatsko slanje.</p>` : ''}
  </div>`);
}

const PARTS = ['Far prednji lijevi', 'Far prednji desni', 'Štop lijevi', 'Štop desni', 'Prednji branik', 'Zadnji branik', 'Hauba', 'Gepek vrata', 'Vrata prednja lijeva', 'Vrata prednja desna',
  'Vrata zadnja lijeva', 'Vrata zadnja desna', 'Blatobran lijevi', 'Blatobran desni', 'Retrovizor lijevi', 'Retrovizor desni', 'Motor', 'Mjenjač', 'Alnaser', 'Alternator', 'Kompresor klime',
  'Turbina', 'Brizgaljka', 'Pumpa visokog pritiska', 'EGR ventil', 'Hladnjak vode', 'Hladnjak klime', 'Interkuler', 'Ventilator', 'Kočiona čeljust', 'Amortizer', 'Vilica', 'Poluosovina',
  'Volan', 'Airbag volana', 'Kontrolna tabla', 'Računar motora', 'Radio', 'Navigacija', 'Sjedišta', 'Felne', 'Vjetrobransko staklo', 'Podizač stakla', 'Brava vrata', 'Rezervoar', 'Lajsne'];

export async function partFormPage({ el, params, query }) {
  if (!state.user) return needLogin();
  const edit = params.id ? await api('/api/parts/' + params.id) : null;
  if (edit && !edit.mine) throw Object.assign(new Error('To nije tvoj oglas'), { status: 403 });
  const meta = await getMeta();
  const myVeh = state.user.type === 'otpad' ? (await api('/api/my/vehicles?status=active')).items : [];
  const p = edit || {};
  const preV = query.vozilo ? myVeh.find(v => String(v.id) === String(query.vozilo)) : null;
  const src = edit || preV || (query.make ? { make_id: query.make, model_name: query.model, model_id: query.gen, year: query.year, engine: query.engine, fuel: query.fuel } : {});
  setTitle(edit ? 'Uredi dio' : 'Objavi dio');
  render(el, html`
  <section class="page-head"><div class="row"><a href="${edit ? '/dio/' + p.id : '/objavi'}" class="icon-btn" aria-label="Nazad">${icon('back', 22, '#fff')}</a><h1>${edit ? 'Uredi dio' : 'Objavi dio'}</h1></div></section>
  <form class="wrap stack" id="pf" style="padding-top:16px" novalidate>
    ${myVeh.length ? html`<div class="card stack"><label class="f"><span>Sa mog vozila (popuni podatke automatski)</span>
      <select name="vehicle_id" id="vsel"><option value="">— nije sa mog vozila —</option>
      ${myVeh.map(v => html`<option value="${v.id}" ${String(v.id) === String(p.vehicle_id || query.vozilo || '') ? raw('selected') : ''}>${v.vehicle || v.model_text} ${v.year || ''} ${v.engine || ''}</option>`)}</select></label></div>` : ''}
    <div class="card stack">
      <strong>Vozilo</strong>
      <div id="vp" class="stack" style="gap:10px"></div>
      <button type="button" class="link" id="nomodel" style="align-self:flex-start">Nema mog modela?</button>
      <label class="f" id="mtxt" ${p.model_text ? '' : raw('hidden')}><span>Upiši marku i model</span><input name="model_text" value="${p.model_text || ''}" placeholder="npr. Volkswagen Golf 8 facelift"></label>
      <div class="grid3">
        <label class="f"><span>Godište</span><select name="year"></select></label>
        <label class="f"><span>Motor</span>${engineSelect('engine', engNum(src.engine) || src.engine)}</label>
        <label class="f"><span>Gorivo</span><select name="fuel"><option value="">—</option>${meta.fuels.map(f => html`<option ${src.fuel === f ? raw('selected') : ''}>${f}</option>`)}</select></label>
      </div>
    </div>
    <div class="card stack">
      <strong>Dio</strong>
      <label class="f req"><span>Naziv dijela</span><input name="title" list="partNames" required maxlength="120" value="${p.title || ''}" placeholder="npr. Far prednji lijevi"></label>
      <datalist id="partNames">${PARTS.map(x => html`<option value="${x}">`)}</datalist>
      <div class="grid2">
        <label class="f"><span>Kataloški broj</span><input name="part_no" value="${p.part_no || ''}" placeholder="nije obavezno"></label>
        <label class="f"><span>Strana</span><select name="side"><option value="">—</option>${['lijevo', 'desno', 'prednje', 'zadnje', 'prednje lijevo', 'prednje desno', 'zadnje lijevo', 'zadnje desno'].map(s => html`<option ${p.side === s ? raw('selected') : ''}>${s}</option>`)}</select></label>
      </div>
      <div class="grid2">
        <label class="f"><span>Boja</span>${optSelect('color', meta.colors, p.color || src.color)}</label>
        <label class="f"><span>Kod boje</span><input name="color_code" value="${p.color_code || src.color_code || ''}" placeholder="npr. LC9X" class="caps" autocapitalize="characters" autocomplete="off"></label>
      </div>
      <label class="f"><span>Cijena (KM)</span><input name="price" inputmode="decimal" value="${p.price ?? ''}" placeholder="prazno = na upit"></label>
      <label class="check"><input type="checkbox" name="damaged" ${p.condition === 'oštećeno' ? 'checked' : ''}> Dio je oštećen</label>
      <label class="f"><span>Opis</span><textarea name="description" placeholder="stanje, oštećenja, šta je uključeno, garancija…">${p.description || ''}</textarea></label>
      <div class="loc-line">${icon('pin', 18)} Lokacija: <strong>${(edit ? p.city : state.user.city) || 'nije upisana'}</strong> <a href="/profil/postavke">promijeni u profilu</a></div>
    </div>
    <div class="card"><strong style="display:block;margin-bottom:8px">Slike</strong><div id="pi"></div></div>
    <button class="btn accent big block" name="go" value="1">${edit ? 'Sačuvaj izmjene' : 'Objavi dio'}</button>
    ${edit ? '' : html`<button class="btn line block" name="next" value="1">Objavi i dodaj još jedan sa istog vozila</button>`}
  </form>`);

  const picker = await vehiclePicker($('#vp', el), { make: src.make_id, model: src.model_name, gen: src.model_id }, { genRequired: true, anyText: 'Izaberi marku' });
  const imgs = imageInput($('#pi', el), p.images || []);
  bindYear($('#vp', el), picker, $('#pf select[name=year]', el), src.year);
  $('#nomodel', el).onclick = () => { $('#mtxt', el).hidden = false; const v = picker.get(); suggestModel(v.make, v.makeName); };
  $('#vsel', el)?.addEventListener('change', async e => {
    const v = myVeh.find(x => String(x.id) === e.target.value);
    if (!v) return;
    await picker.set({ make: v.make_id, model: v.model_name, gen: v.model_id });
    $('#vp', el).dispatchEvent(new Event('pick'));
    const f = $('#pf', el);
    f.year.value = v.year || ''; f.year.dispatchEvent(new Event('change'));
    f.engine.value = engNum(v.engine); f.fuel.value = v.fuel || '';
    f.color.value = v.color || ''; f.color_code.value = v.color_code || '';
    if (v.model_text) { $('#mtxt', el).hidden = false; f.model_text.value = v.model_text; }
  });

  $('#pf', el).onsubmit = async e => {
    e.preventDefault();
    const f = formData(e.target);
    const v = picker.get();
    if (!f.title.trim()) return toast('Upiši naziv dijela', true);
    if (!v.gen && !f.model_text.trim()) return toast(v.model ? 'Izaberi generaciju (npr. facelift ili ne)' : 'Izaberi marku, model i generaciju', true);
    if (imgs.busy()) return toast('Sačekaj da se slike učitaju', true);
    const b = e.submitter; busy(b, true, 'Snimam…');
    if (f.color_code) f.color_code = f.color_code.trim().toUpperCase();
    const body = { ...f, make_id: v.make, model_id: v.gen || null, images: imgs.get(), condition: f.damaged ? 'oštećeno' : 'polovno', negotiable: 0 };
    delete body.damaged;
    try {
      const r = edit ? await api('/api/parts/' + p.id, { method: 'PUT', body }) : await api('/api/parts', { body });
      toast(edit ? 'Sačuvano' : 'Dio objavljen');
      if (b?.name === 'next') {
        go('/objavi/dio' + qs({ vozilo: f.vehicle_id, make: v.make, model: v.model, gen: v.gen, year: f.year, engine: f.engine, fuel: f.fuel }), true);
      } else go(partUrl({ id: r.id, title: f.title, model_name: v.model, model_text: f.model_text, part_no: f.part_no }), true);
    } catch (err) { fail(err); busy(b, false); }
  };
}

export async function vehicleFormPage({ el, params }) {
  if (!state.user) return needLogin();
  const edit = params.id ? await api('/api/vehicles/' + params.id) : null;
  if (edit && !edit.mine) throw Object.assign(new Error('To nije tvoje vozilo'), { status: 403 });
  const meta = await getMeta();
  const v = edit || {};
  setTitle(edit ? 'Uredi vozilo' : 'Objavi vozilo za dijelove');
  render(el, html`
  <section class="page-head"><div class="row"><a href="${edit ? '/vozilo/' + v.id : '/objavi'}" class="icon-btn" aria-label="Nazad">${icon('back', 22, '#fff')}</a><h1>${edit ? 'Uredi vozilo' : 'Vozilo za dijelove'}</h1></div>
    <p class="sub">Kupci će moći pitati za bilo koji dio sa ovog vozila.</p></section>
  <form class="wrap stack" id="vf" style="padding-top:16px" novalidate>
    <div class="card stack">
      <strong>Vozilo</strong>
      <div id="vp" class="stack" style="gap:10px"></div>
      <button type="button" class="link" id="nomodel" style="align-self:flex-start">Nema mog modela?</button>
      <label class="f" id="mtxt" ${v.model_text ? '' : raw('hidden')}><span>Upiši marku i model</span><input name="model_text" value="${v.model_text || ''}"></label>
      <div class="grid2">
        <label class="f req"><span>Godište</span><select name="year" required></select></label>
        <label class="f"><span>Gorivo</span><select name="fuel"><option value="">—</option>${meta.fuels.map(f => html`<option ${v.fuel === f ? raw('selected') : ''}>${f}</option>`)}</select></label>
      </div>
      <div class="grid3">
        <label class="f"><span>Motor</span>${engineSelect('engine', engNum(v.engine) || v.engine)}</label>
        <label class="f"><span>Kod motora</span><input name="engine_code" class="caps" value="${v.engine_code || ''}" placeholder="BKC" autocapitalize="characters" autocomplete="off"></label>
        <label class="f"><span>Snaga kW</span><input name="power_kw" inputmode="numeric" value="${v.power_kw || ''}"></label>
      </div>
      <div class="grid3">
        <label class="f"><span>Mjenjač</span>${optSelect('gearbox', GEARBOXES, v.gearbox)}</label>
        <label class="f"><span>Broj brzina</span>${optSelect('gears', ['4', '5', '6', '7', '8', '9'], v.gears ? String(v.gears) : '')}</label>
        <label class="f"><span>Kod mjenjača</span><input name="gearbox_code" class="caps" value="${v.gearbox_code || ''}" placeholder="JCR" autocapitalize="characters" autocomplete="off"></label>
      </div>
      <div class="grid2">
        <label class="f"><span>Pogon</span>${optSelect('drive', DRIVES, v.drive)}</label>
        <label class="f"><span>Karoserija</span>${optSelect('body', BODIES, v.body)}</label>
      </div>
      <div class="grid2">
        <label class="f"><span>Boja</span>${optSelect('color', meta.colors, v.color)}</label>
        <label class="f"><span>Kod boje</span><input name="color_code" value="${v.color_code || ''}" placeholder="npr. LC9X" class="caps" autocapitalize="characters" autocomplete="off"></label>
      </div>
      <label class="f"><span>Kilometraža</span><input name="mileage" inputmode="numeric" value="${v.mileage || ''}" placeholder="nije obavezno"></label>
      <label class="f"><span>Opis</span><textarea name="description" placeholder="koji dijelovi su dostupni, šta je već prodato, oštećenja…">${v.description || ''}</textarea></label>
      <div class="loc-line">${icon('pin', 18)} Lokacija: <strong>${(edit ? v.city : state.user.city) || 'nije upisana'}</strong> <a href="/profil/postavke">promijeni u profilu</a></div>
    </div>
    <div class="card"><strong style="display:block;margin-bottom:8px">Slike vozila</strong><div id="vi"></div></div>
    <button class="btn accent big block">${edit ? 'Sačuvaj izmjene' : 'Objavi vozilo'}</button>
  </form>`);
  const picker = await vehiclePicker($('#vp', el), { make: v.make_id, model: v.model_name, gen: v.model_id }, { genRequired: true, anyText: 'Izaberi marku' });
  const imgs = imageInput($('#vi', el), v.images || []);
  bindYear($('#vp', el), picker, $('#vf select[name=year]', el), v.year);
  $('#nomodel', el).onclick = () => { $('#mtxt', el).hidden = false; const x = picker.get(); suggestModel(x.make, x.makeName); };
  $('#vf', el).onsubmit = async e => {
    e.preventDefault();
    const f = formData(e.target);
    const x = picker.get();
    if (!x.gen && !f.model_text.trim()) return toast(x.model ? 'Izaberi generaciju (npr. facelift ili ne)' : 'Izaberi marku, model i generaciju', true);
    if (!f.year) return toast('Upiši godište', true);
    if (imgs.busy()) return toast('Sačekaj da se slike učitaju', true);
    const b = e.submitter; busy(b, true, 'Snimam…');
    for (const k of ['engine_code', 'gearbox_code', 'color_code']) if (f[k]) f[k] = f[k].trim().toUpperCase();
    const body = { ...f, make_id: x.make, model_id: x.gen || null, images: imgs.get() };
    try {
      const r = edit ? await api('/api/vehicles/' + v.id, { method: 'PUT', body }) : await api('/api/vehicles', { body });
      toast(edit ? 'Sačuvano' : 'Vozilo objavljeno');
      go('/vozilo/' + r.id, true);
    } catch (err) { fail(err); busy(b, false); }
  };
}
