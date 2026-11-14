import { html, render, $, $$, api, go, qs, setTitle, formData, ago, fail, toast, state, getMakes } from '../core.js';
import { confirmBox, modal, fmtDate } from '../components.js';

export async function adminPage({ el, params }) {
  if (!state.user?.is_admin) return go('/', true);
  setTitle('Administracija');
  const tab = params.tab || 'pregled';
  const tabs = [['pregled', 'Pregled'], ['korisnici', 'Korisnici'], ['modeli', 'Modeli'], ['istaknuto', 'Istaknuto'], ['prijave', 'Prijave'], ['spam', 'Spam']];
  render(el, html`
  <section class="page-head" style="padding-bottom:8px"><div class="row"><h1 style="padding-left:12px">Administracija</h1></div></section>
  <nav class="tabs">${tabs.map(t => html`<a href="/admin/${t[0]}" class="${t[0] === tab ? 'on' : ''}">${t[1]}</a>`)}</nav>
  <div class="wrap" style="padding-top:14px" id="at"></div>`);
  const box = $('#at', el);
  await ({ pregled: overview, korisnici: users, modeli: models, istaknuto: featured, prijave: reports, spam }[tab] || overview)(box);
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
    <div class="stats" style="margin-bottom:14px"><div class="stat"><b>${d.requests.length}</b><span>Zahtjeva čeka</span></div><div class="stat"><b>${d.active.length}</b><span>Trenutno istaknuto</span></div><div class="stat"><b>${d.earned_30d} KM</b><span>Odobreno (30 dana)</span></div></div>
    <h2 style="font-size:22px;margin:0 0 8px">Zahtjevi</h2>
    <p class="hint" style="margin:0 0 8px">Pozovi korisnika, dogovori uplatu, pa kad stigne klikni „Odobri“ — oglas odmah ide na vrh.</p>
    ${d.requests.length ? html`<div class="list">${d.requests.map(r => html`<div class="row-item" style="flex-direction:column;gap:6px">
      <div style="display:flex;justify-content:space-between;width:100%;gap:8px"><a href="${url(r.kind, r.item_id)}"><strong>${r.title || '(obrisan oglas)'}</strong></a><span class="hint">${ago(r.created_at)}</span></div>
      <span class="hint">${r.kind === 'vehicle' ? 'Vozilo' : 'Dio'} · <strong style="color:var(--text)">${r.days} dana · ${r.price} KM</strong> · ${r.user_name || ''} ${r.user_phone ? html`· <a href="tel:${r.user_phone}">${r.user_phone}</a>` : ''}</span>
      <div style="display:flex;gap:6px"><button class="btn accent sm" data-fr="${r.id}" data-a="approve">Odobri (uplaćeno)</button><button class="btn ghost sm" data-fr="${r.id}" data-a="reject">Odbij</button></div>
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
  $$('[data-fr]', box).forEach(b => { b.onclick = async () => { try { await api('/api/admin/featured/' + b.dataset.fr, { body: { action: b.dataset.a } }); toast(b.dataset.a === 'approve' ? 'Odobreno — oglas je istaknut' : 'Odbijeno'); featured(box); } catch (e) { fail(e); } }; });
  $$('[data-un]', box).forEach(b => { b.onclick = async () => { const [kind, id] = b.dataset.un.split(':'); try { await api('/api/admin/feature', { body: { kind, id, days: 0 } }); toast('Skinuto'); featured(box); } catch (e) { fail(e); } }; });
  $('#fsF', box).onsubmit = async e => {
    e.preventDefault();
    const f = formData(e.target);
    const list = [0, 1, 2, 3].map(i => ({ days: f['d' + i], price: f['p' + i] })).filter(p => p.days && p.price !== '');
    try { await api('/api/admin/featured-settings', { body: { prices: list, pay_info: f.pay_info } }); toast('Sačuvano'); featured(box); } catch (err) { fail(err); }
  };
}
