import { html, raw, render, $, $$, api, go, qs, setTitle, formData, ago, fail, toast, state, getMakes, loadMe } from '../core.js';
import { confirmBox, modal, fmtDate } from '../components.js';

export async function adminPage({ el, params }) {
  if (!state.user?.is_admin) return go('/', true);
  setTitle('Administracija');
  await loadMe().catch(() => {});
  const ac = state.counts?.admin || {};
  const tab = params.tab || (ac.featured ? 'istaknuto' : 'pregled');
  const tabs = [['pregled', 'Pregled'], ['trazeno', 'Najtraženije'], ['korisnici', 'Korisnici'], ['modeli', 'Modeli'], ['istaknuto', 'Istaknuto'], ['naplata', 'Naplata'], ['prijave', 'Prijave'], ['spam', 'Spam']];
  render(el, html`
  <section class="page-head" style="padding-bottom:8px"><div class="row"><h1 style="padding-left:12px">Administracija</h1></div></section>
  <nav class="tabs">${tabs.map(t => { const n = { istaknuto: ac.featured, prijave: ac.reports, modeli: ac.models }[t[0]]; return html`<a href="/admin/${t[0]}" class="${t[0] === tab ? 'on' : ''}">${t[1]}${n ? html` <span class="num red">${n}</span>` : ''}</a>`; })}</nav>
  <div class="wrap" style="padding-top:14px" id="at"></div>`);
  $('.tabs .on', el)?.scrollIntoView({ inline: 'center', block: 'nearest' });
  const box = $('#at', el);
  await ({ pregled: overview, trazeno: demand, korisnici: users, modeli: models, istaknuto: featured, naplata: billing, prijave: reports, spam }[tab] || overview)(box);
}

async function overview(box) {
  const s = await api('/api/admin/stats');
  const items = [['Korisnika', s.users], ['Otpada', s.otpadi], ['Aktivnih dijelova', s.parts], ['Vozila za dijelove', s.vehicles], ['Otvorenih zahtjeva', s.requests],
    ['Ponuda ukupno', s.offers], ['Upita (30 dana)', s.inquiries], ['Novih korisnika (7 dana)', s.new_users_7d], ['Novih prijava', s.reports], ['Blokiranih (spam)', s.spam_blocked], ['Prijedloga modela', s.suggestions]];
  render(box, html`<div class="stats">${items.map(([l, v]) => html`<div class="stat"><b>${v}</b><span>${l}</span></div>`)}</div>`);
}

async function users(box, q = {}) {
  const list = await api('/api/admin/users' + qs(q));
  render(box, html`
    <form id="uf" class="grid2" style="margin-bottom:12px"><input name="q" placeholder="ime, email, telefon" value="${q.q || ''}">
      <select name="type"><option value="">Svi</option><option value="otpad" ${q.type === 'otpad' ? 'selected' : ''}>Otpadi</option><option value="privatno" ${q.type === 'privatno' ? 'selected' : ''}>Privatni</option></select></form>
    <div class="list">${list.map(u => html`<div class="row-item" style="flex-direction:column;gap:6px">
      <div style="display:flex;justify-content:space-between;width:100%;gap:8px"><a href="/prodavac/${u.id}"><strong>${u.name}</strong></a><span class="hint">#${u.id} · ${ago(u.created_at)}</span></div>
      <span class="hint">${u.type} · ${u.email} · ${u.phone || ''} · ${u.city || ''} · ${u.parts} dijelova · ${u.vehicles} vozila</span>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${u.verified ? html`<span class="badge ok">provjeren</span>` : ''}${u.is_admin ? html`<span class="badge acc">admin</span>` : ''}${u.blocked ? html`<span class="badge bad">blokiran</span>` : ''}
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn line sm" data-u="${u.id}" data-k="verified" data-v="${u.verified ? 0 : 1}">${u.verified ? 'Skini „provjeren“' : 'Označi provjeren'}</button>
        <button class="btn line sm" data-u="${u.id}" data-k="type" data-v="${u.type === 'otpad' ? 'privatno' : 'otpad'}">${u.type === 'otpad' ? 'Prebaci u privatno' : 'Prebaci u otpad'}</button>
        <button class="btn line sm" data-u="${u.id}" data-k="blocked" data-v="${u.blocked ? 0 : 1}">${u.blocked ? 'Odblokiraj' : 'Blokiraj'}</button>
        <button class="btn line sm" data-pw="${u.id}">Nova lozinka</button>
      </div></div>`)}</div>`);
  const f = $('#uf', box);
  f.onsubmit = e => { e.preventDefault(); users(box, formData(f)); };
  f.type.onchange = () => users(box, formData(f));
  $$('[data-u]', box).forEach(b => {
    b.onclick = async () => {
      try { await api('/api/admin/users/' + b.dataset.u, { body: { [b.dataset.k]: b.dataset.v } }); toast('Sačuvano'); users(box, q); } catch (e) { fail(e); }
    };
  });
  $$('[data-pw]', box).forEach(b => {
    b.onclick = async () => {
      if (!await confirmBox('Postaviti novu lozinku ovom korisniku?', 'Da')) return;
      try { const r = await api(`/api/admin/users/${b.dataset.pw}/password`, { body: {} }); modal('Nova lozinka', html`<p>Pošalji korisniku ovu lozinku (neka je promijeni u Postavkama):</p><input readonly value="${r.password}" style="font-size:22px;font-weight:700">`); } catch (e) { fail(e); }
    };
  });
}

async function models(box) {
  const [sug, makes] = await Promise.all([api('/api/admin/suggestions'), getMakes()]);
  render(box, html`
    <form class="card stack" id="mf">
      <strong style="font-size:17px">Dodaj model / generaciju / facelift</strong>
      <label class="f"><span>Marka</span><select name="make_id" required><option value="">Izaberi</option>${makes.map(m => html`<option value="${m.id}">${m.name}</option>`)}</select></label>
      <div class="grid2"><label class="f"><span>Model (npr. Golf 8)</span><input name="name" required></label>
      <label class="f"><span>Oznaka gen. (npr. CD1)</span><input name="generation_name"></label></div>
      <div class="grid3"><label class="f"><span>Od godine</span><input name="from" inputmode="numeric" required></label>
      <label class="f"><span>Do godine</span><input name="to" inputmode="numeric" placeholder="prazno = još se pravi"></label>
      <label class="f"><span>Facelift</span><select name="facelift"><option value="0">ne</option><option value="1">facelift</option><option value="2">facelift 2</option></select></label></div>
      <input type="hidden" name="suggestion_id">
      <button class="btn accent block">Dodaj</button>
      <p class="hint" style="margin:0">Nova marka? <button type="button" class="link" id="nm">Dodaj marku</button></p>
    </form>
    <h2 style="font-size:22px;margin:18px 0 8px">Prijedlozi korisnika (${sug.length})</h2>
    ${sug.length ? html`<div class="list">${sug.map(s => html`<div class="row-item" style="flex-direction:column;gap:6px">
      <strong>${s.make_name || s.make_text || '?'} — ${s.model_text}</strong><span class="hint">${s.years || ''} · ${s.user_name || 'gost'} · ${ago(s.created_at)}</span>
      <div style="display:flex;gap:6px"><button class="btn dark sm" data-fill="${s.id}">Popuni formu</button><button class="btn line sm" data-rej="${s.id}">Odbij</button></div></div>`)}</div>`
      : html`<div class="empty">Nema novih prijedloga.</div>`}`);
  const f = $('#mf', box);
  f.onsubmit = async e => {
    e.preventDefault();
    try { const r = await api('/api/admin/models', { body: formData(f) }); toast('Dodano: ' + r.label); models(box); } catch (err) { fail(err); }
  };
  $('#nm', box).onclick = () => modal('Nova marka', html`<form class="stack" id="nmf"><label class="f"><span>Naziv</span><input name="name" required></label>
    <label class="check"><input type="checkbox" name="popular"> Česta marka (na vrhu spiska)</label><button class="btn dark block">Dodaj</button></form>`, (m, close) => {
    $('#nmf', m).onsubmit = async e => { e.preventDefault(); try { await api('/api/admin/makes', { body: formData(e.target) }); close(); toast('Marka dodana — osvježi stranicu'); } catch (err) { fail(err); } };
  });
  $$('[data-fill]', box).forEach(b => {
    b.onclick = () => {
      const s = sug.find(x => String(x.id) === b.dataset.fill);
      if (s.make_id) f.make_id.value = s.make_id;
      f.name.value = s.model_text.replace(/\s*facelift.*/i, '');
      f.facelift.value = /facelift/i.test(s.model_text) ? '1' : '0';
      const ys = (s.years || '').match(/\d{4}/g) || [];
      f.from.value = ys[0] || ''; f.to.value = ys[1] || '';
      f.suggestion_id.value = s.id;
      f.scrollIntoView({ behavior: 'smooth' });
    };
  });
  $$('[data-rej]', box).forEach(b => {
    b.onclick = async () => { try { await api('/api/admin/suggestions/' + b.dataset.rej, { body: { status: 'rejected' } }); models(box); } catch (e) { fail(e); } };
  });
}

async function reports(box) {
  const list = await api('/api/admin/reports');
  render(box, list.length ? html`<div class="list">${list.map(r => html`<div class="row-item" style="flex-direction:column;gap:6px">
    <a href="/${r.kind === 'vehicle' ? 'vozilo' : r.kind === 'user' ? 'prodavac' : 'dio'}/${r.item_id}"><strong>${r.kind} #${r.item_id}</strong></a>
    <span>${r.reason}</span><span class="hint">${r.user_name || 'gost'} · ${ago(r.created_at)}</span>
    <div style="display:flex;gap:6px">
      ${r.kind !== 'user' ? html`<button class="btn danger sm" data-del="${r.kind}:${r.item_id}:${r.id}">Obriši oglas</button>` : ''}
      <button class="btn line sm" data-ok="${r.id}">Riješeno</button></div></div>`)}</div>` : html`<div class="empty">Nema novih prijava.</div>`);
  $$('[data-ok]', box).forEach(b => { b.onclick = async () => { await api('/api/admin/reports/' + b.dataset.ok, { body: {} }); reports(box); }; });
  $$('[data-del]', box).forEach(b => {
    b.onclick = async () => {
      const [kind, id, rid] = b.dataset.del.split(':');
      if (!await confirmBox('Obrisati oglas?', 'Obriši')) return;
      try {
        await api(`/api/${kind === 'vehicle' ? 'vehicles' : 'parts'}/${id}`, { method: 'DELETE' });
        await api('/api/admin/reports/' + rid, { body: {} });
        toast('Obrisano'); reports(box);
      } catch (e) { fail(e); }
    };
  });
}


async function spam(box) {
  const d = await api('/api/admin/blocklist');
  const row = (r, act) => html`<div class="row-item" style="flex-direction:column;gap:6px">
    <strong>${r.name || ''} ${r.phone || r.value}</strong>
    <span class="hint">${r.reporters ? `prijavilo ${r.reporters} prodavaca · ` : ''}${r.msgs ? `${r.msgs} upita · ` : ''}${r.ips ? `${r.ips} IP adresa · ` : ''}${r.reason || ''} ${ago(r.last || r.created_at)}</span>
    ${act}</div>`;
  render(box, html`
    <form class="card stack" id="bf"><strong style="font-size:17px">Blokiraj broj ili IP</strong>
      <div class="grid2"><select name="kind"><option value="phone">Telefon</option><option value="ip">IP adresa</option></select><input name="value" placeholder="06x… ili IP" required></div>
      <button class="btn dark block">Blokiraj</button></form>
    <h2 style="font-size:22px;margin:18px 0 8px">Prijavljeni kao spam (${d.reported.length})</h2>
    ${d.reported.length ? html`<div class="list">${d.reported.map(r => row(r, html`<button class="btn danger sm" data-blk="${r.phone_norm}">Blokiraj</button>`))}</div>` : html`<div class="empty">Nema.</div>`}
    <h2 style="font-size:22px;margin:18px 0 8px">Puno upita u 24 h</h2>
    ${d.busiest.length ? html`<div class="list">${d.busiest.map(r => row(r, html`<button class="btn danger sm" data-blk="${r.phone_norm}">Blokiraj</button>`))}</div>` : html`<div class="empty">Nema sumnjivih.</div>`}
    <h2 style="font-size:22px;margin:18px 0 8px">Blokirani (${d.blocked.length})</h2>
    ${d.blocked.length ? html`<div class="list">${d.blocked.map(r => row({ ...r, name: r.kind === 'ip' ? 'IP' : 'Tel.' }, html`<button class="btn line sm" data-unb="${r.value}">Odblokiraj</button>`))}</div>` : html`<div class="empty">Niko nije blokiran.</div>`}`);
  $('#bf', box).onsubmit = async e => { e.preventDefault(); try { await api('/api/admin/blocklist', { body: formData(e.target) }); toast('Blokirano'); spam(box); } catch (err) { fail(err); } };
  $$('[data-blk]', box).forEach(b => { b.onclick = async () => { try { await api('/api/admin/blocklist', { body: { kind: 'phone', value: b.dataset.blk, reason: 'admin' } }); toast('Blokirano'); spam(box); } catch (e) { fail(e); } }; });
  $$('[data-unb]', box).forEach(b => { b.onclick = async () => { try { await api('/api/admin/blocklist/' + encodeURIComponent(b.dataset.unb), { method: 'DELETE' }); toast('Odblokirano'); spam(box); } catch (e) { fail(e); } }; });
}

// ---------- istaknuti oglasi ----------
async function featured(box) {
  const d = await api('/api/admin/featured');
  const url = (k, id) => (k === 'vehicle' ? '/vozilo/' : '/dio/') + id;
  const prices = [...d.prices, {}, {}].slice(0, 4);
  render(box, html`
    <div class="stats" style="margin-bottom:14px"><div class="stat"><b>${d.requests.length}</b><span>Zahtjeva čeka</span></div><div class="stat"><b>${d.active.length}</b><span>Trenutno istaknuto</span></div><div class="stat"><b>${d.earned_30d} KM</b><span>Plaćeno (30 dana)</span></div><div class="stat"><b style="color:${d.owed ? '#B42318' : 'inherit'}">${d.owed} KM</b><span>Duguju · <a href="/admin/naplata">Naplata</a></span></div></div>
    <h2 style="font-size:22px;margin:0 0 8px">Zahtjevi</h2>
    <p class="hint" style="margin:0 0 8px">Pozovi korisnika i dogovori uplatu. „Odobri — plaćeno“ ako je platio; „Odobri — duguje“ ako plaća kasnije (vidiš u tabu Naplata). Oglas odmah ide na vrh.</p>
    ${d.requests.length ? html`<div class="list">${d.requests.map(r => html`<div class="row-item" style="flex-direction:column;gap:6px">
      <div style="display:flex;justify-content:space-between;width:100%;gap:8px"><a href="${url(r.kind, r.item_id)}"><strong>${r.title || '(obrisan oglas)'}</strong></a><span class="hint">${ago(r.created_at)}</span></div>
      <span class="hint">${r.kind === 'vehicle' ? 'Vozilo' : 'Dio'} · <strong style="color:var(--text)">${r.days} dana · ${r.price} KM</strong> · ${r.user_name || ''} ${r.user_phone ? html`· <a href="tel:${r.user_phone}">${r.user_phone}</a>` : ''}</span>
      <div style="display:flex;gap:6px"><button class="btn accent sm" data-fr="${r.id}" data-a="approve">Odobri — plaćeno</button><button class="btn line sm" data-fr="${r.id}" data-a="approve" data-owe="1">Odobri — duguje</button><button class="btn ghost sm" data-fr="${r.id}" data-a="reject">Odbij</button></div>
    </div>`)}</div>` : html`<div class="empty">Nema novih zahtjeva.</div>`}
    <h2 style="font-size:22px;margin:18px 0 8px">Trenutno istaknuto</h2>
    ${d.active.length ? html`<div class="list">${d.active.map(a => html`<div class="row-item" style="align-items:center">
      <div class="info"><a href="${url(a.kind, a.id)}"><strong>${a.title}</strong></a><span class="hint">${a.kind === 'vehicle' ? 'Vozilo' : 'Dio'} · ${a.user_name} · do ${fmtDate(a.featured_until)}</span></div>
      <button class="btn ghost sm" data-un="${a.kind}:${a.id}">Skini</button></div>`)}</div>` : html`<div class="empty">Ništa nije istaknuto.</div>`}
    <p class="hint">Bilo koji oglas možeš istaknuti i sam: otvori oglas pa dole „Istakni (admin)“.</p>
    <form class="card stack" id="fsF" style="margin-top:14px"><strong style="font-size:17px">Paketi i uputstvo za uplatu</strong>
      ${prices.map((p, i) => html`<div class="grid2"><label class="f"><span>Paket ${i + 1}: broj dana</span><input name="d${i}" inputmode="numeric" value="${p.days || ''}" placeholder="${i < 2 ? '' : 'prazno = nema'}"></label>
        <label class="f"><span>Cijena (KM)</span><input name="p${i}" inputmode="decimal" value="${p.price ?? ''}"></label></div>`)}
      <label class="f"><span>Šta korisnik vidi o uplati</span><textarea name="pay_info" rows="3">${d.pay_info}</textarea></label>
      <button class="btn dark block">Sačuvaj</button></form>`);
  $$('[data-fr]', box).forEach(b => { b.onclick = async () => { try { await api('/api/admin/featured/' + b.dataset.fr, { body: { action: b.dataset.a, paid: !b.dataset.owe } }); toast(b.dataset.a !== 'approve' ? 'Odbijeno' : b.dataset.owe ? 'Odobreno — upisano kao dug' : 'Odobreno i plaćeno'); adminPage({ el: box.closest('main') || document.querySelector('#view'), params: { tab: 'istaknuto' } }); } catch (e) { fail(e); } }; });
  $$('[data-un]', box).forEach(b => { b.onclick = async () => { const [kind, id] = b.dataset.un.split(':'); try { await api('/api/admin/feature', { body: { kind, id, days: 0 } }); toast('Skinuto'); featured(box); } catch (e) { fail(e); } }; });
  $('#fsF', box).onsubmit = async e => {
    e.preventDefault();
    const f = formData(e.target);
    const list = [0, 1, 2, 3].map(i => ({ days: f['d' + i], price: f['p' + i] })).filter(p => p.days && p.price !== '');
    try { await api('/api/admin/featured-settings', { body: { prices: list, pay_info: f.pay_info } }); toast('Sačuvano'); featured(box); } catch (err) { fail(err); }
  };
}

// ---------- najtraženiji dijelovi ----------
async function demand(box, days = 30) {
  const d = await api('/api/admin/demand?days=' + days);
  const bar = (n, max) => html`<span class="dm-bar"><i style="width:${Math.max(4, Math.round(n / (max || 1) * 100))}%"></i></span>`;
  const list = (rows, label, extra) => {
    if (!rows.length) return html`<div class="empty" style="padding:16px">Još nema podataka.</div>`;
    const max = rows[0].n;
    return html`<div class="list">${rows.map((r, i) => html`<div class="row-item dm-row"><span class="dm-n">${i + 1}</span>
      <div class="info"><span class="t">${label(r)}</span>${bar(r.n, max)}</div>
      <div class="dm-c"><strong>${r.n}×</strong>${extra ? extra(r) : ''}</div></div>`)}</div>`;
  };
  const none = r => (r.none ? html`<small class="dm-none">${r.none} bez rezultata</small>` : '');
  const veh = r => [r.make_name, r.model].filter(Boolean).join(' ');
  render(box, html`
    <div class="seg light" style="max-width:420px;margin-bottom:14px">${[7, 30, 90].map(n => html`<a href="#" data-days="${n}" class="${n === d.days ? 'on' : ''}">${n} dana</a>`)}</div>
    <div class="stats" style="margin-bottom:14px"><div class="stat"><b>${d.searches}</b><span>Pretraga dijelova</span></div>
      <div class="stat"><b>${d.missing.reduce((a, r) => a + r.n, 0)}</b><span>Bez rezultata</span></div>
      <div class="stat"><b>${d.requests.reduce((a, r) => a + r.n, 0)}</b><span>„Tražim dio“ zahtjeva</span></div></div>
    <h2 class="dm-h">Najtraženiji dijelovi</h2>
    ${list(d.types, r => r.title, none)}
    <h2 class="dm-h">Traženo, a nema na sajtu</h2><p class="hint" style="margin:-4px 0 8px">Ovo kupci traže, a niko nema — vrijedi nabaviti ili objaviti.</p>
    ${list(d.missing, r => [r.term || '(bez teksta)', veh(r)].filter(Boolean).join(' — '))}
    <h2 class="dm-h">Najtraženija vozila</h2>
    ${list(d.models, veh)}
    <h2 class="dm-h">Šta kupci pišu u „Tražim dio“</h2>
    ${list(d.requests, r => [r.part, veh(r)].filter(Boolean).join(' — '))}
    <h2 class="dm-h">Tačan tekst pretrage</h2>
    ${list(d.terms, r => r.term, none)}
    <h2 class="dm-h">Najgledaniji oglasi</h2>
    ${d.viewed.length ? html`<div class="list">${d.viewed.map((p, i) => html`<a class="row-item dm-row" href="/dio/${p.id}"><span class="dm-n">${i + 1}</span>
      <div class="info"><span class="t">${p.title}</span><span class="s">${[p.make_name, p.model_name || p.model_text].filter(Boolean).join(' ')}</span></div>
      <div class="dm-c"><strong>${p.views}</strong><small>pregleda</small></div></a>`)}</div>` : html`<div class="empty" style="padding:16px">Još nema podataka.</div>`}
    <p class="hint">Broje se pretrage posjetilaca (ne tvoje kao admina); ista pretraga istog posjetioca u 30 min broji se jednom. Podaci se čuvaju 90 dana.</p>`);
  $$('[data-days]', box).forEach(a => { a.onclick = e => { e.preventDefault(); demand(box, Number(a.dataset.days)); }; });
}

// ---------- naplata: potrošeno, plaćeno, dug ----------
async function billing(box) {
  const d = await api('/api/admin/billing');
  const t = d.totals;
  const url = (k, id) => (k === 'vehicle' ? '/vozilo/' : '/dio/') + id;
  const KM = n => `${Math.round((n || 0) * 100) / 100} KM`;
  render(box, html`
    <div class="stats" style="margin-bottom:14px">
      <div class="stat"><b style="color:${t.owed.s ? '#B42318' : 'inherit'}">${KM(t.owed.s)}</b><span>Duguju ukupno (${t.owed.n})</span></div>
      <div class="stat"><b>${KM(t.month.s)}</b><span>Plaćeno ovaj mjesec</span></div>
      <div class="stat"><b>${KM(t.last_month.s)}</b><span>Prošli mjesec</span></div>
      <div class="stat"><b>${KM(t.paid.s)}</b><span>Plaćeno ukupno (${t.paid.n})</span></div>
    </div>
    <h2 class="dm-h" style="margin-top:0">Ko duguje</h2>
    ${d.unpaid.length ? html`<div class="list">${d.unpaid.map(f => html`<div class="row-item" style="align-items:center">
      <div class="info"><span class="t">${f.name} · <span style="color:#B42318">${KM(f.price)}</span></span>
        <span class="s"><a href="${url(f.kind, f.item_id)}">${f.title || '(obrisan oglas)'}</a> · ${f.days} dana · ${fmtDate(f.done_at)}${f.phone ? html` · <a href="tel:${f.phone}">${f.phone}</a>` : ''}</span></div>
      <button class="btn accent sm" data-pay="${f.id}">Platio</button></div>`)}</div>` : html`<div class="empty" style="padding:16px">Niko ništa ne duguje.</div>`}
    <h2 class="dm-h">Po korisnicima</h2>
    ${d.users.length ? html`<div class="list">${d.users.map(u => html`<div class="row-item" style="flex-direction:column;gap:6px">
      <div style="display:flex;justify-content:space-between;width:100%;gap:8px"><strong>${u.name}</strong><span class="hint">${u.n}× istaknuto · zadnje ${fmtDate(u.last)}</span></div>
      <div class="bill3"><span><small>Potrošio</small><b>${KM(u.spent)}</b></span><span><small>Platio</small><b>${KM(u.paid)}</b></span><span><small>Duguje</small><b style="color:${u.owed ? '#B42318' : 'inherit'}">${KM(u.owed)}</b></span></div>
      ${u.owed ? html`<div style="display:flex;gap:6px">${u.phone ? html`<a class="btn line sm" href="tel:${u.phone}">Pozovi</a>` : ''}<button class="btn accent sm" data-payall="${u.id}" data-name="${u.name}" data-sum="${KM(u.owed)}">Platio sve (${KM(u.owed)})</button></div>` : ''}
    </div>`)}</div>` : html`<div class="empty" style="padding:16px">Još niko nije istakao oglas.</div>`}
    <h2 class="dm-h">Zadnje uplate</h2>
    ${d.recent.length ? html`<div class="list">${d.recent.map(f => html`<div class="row-item" style="align-items:center">
      <div class="info"><span class="t">${f.name}</span><span class="s">${f.days} dana · ${fmtDate(f.paid_at)}</span></div>
      <strong>${KM(f.price)}</strong><button class="btn ghost sm" data-unpay="${f.id}" title="Greškom označeno">Poništi</button></div>`)}</div>` : html`<div class="empty" style="padding:16px">Još nema uplata.</div>`}`);
  const act = async (url, body, msg) => { try { await api(url, { body }); toast(msg); await loadMe(); billing(box); } catch (e) { fail(e); } };
  $$('[data-pay]', box).forEach(b => { b.onclick = () => act('/api/admin/billing/' + b.dataset.pay, { paid: true }, 'Upisano kao plaćeno'); });
  $$('[data-unpay]', box).forEach(b => { b.onclick = async () => { if (await confirmBox('Vratiti ovu uplatu na dug?', 'Vrati')) act('/api/admin/billing/' + b.dataset.unpay, { paid: false }, 'Vraćeno na dug'); }; });
  $$('[data-payall]', box).forEach(b => { b.onclick = async () => { if (await confirmBox(`${b.dataset.name} je platio sve (${b.dataset.sum})?`, 'Da, platio')) act('/api/admin/billing/user/' + b.dataset.payall, {}, 'Sve plaćeno'); }; });
}
