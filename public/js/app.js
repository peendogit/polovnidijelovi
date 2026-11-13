// polovnidijelovi.com — pokretanje aplikacije, meni, rute
import { html, render, $, route, dispatch, loadMe, onMe, state, setTitle, api, go, toast, setMe } from './core.js';
import { icon } from './components.js';
import { homePage } from './pages/home.js';
import { partsPage, partPage } from './pages/parts.js';
import { vehiclesPage, vehiclePage } from './pages/vehicles.js';
import { requestsPage, newRequestPage, requestPage } from './pages/requests.js';
import { postChoosePage, partFormPage, vehicleFormPage } from './pages/post.js';
import { loginPage, registerPage, profilePage, sellersPage, sellerPage } from './pages/account.js';
import { adminPage } from './pages/admin.js';

route('/', homePage);
route('/dijelovi', partsPage);
route('/polovni-dijelovi/:mk', partsPage);
route('/polovni-dijelovi/:mk/:md', partsPage);
route('/dio/:id', partPage);
route('/vozila', vehiclesPage);
route('/vozilo/:id', vehiclePage);
route('/trazim', requestsPage);
route('/trazim/novi', newRequestPage);
route('/trazim/:id', requestPage);
route('/objavi', postChoosePage);
route('/objavi/dio', partFormPage);
route('/uredi/dio/:id', partFormPage);
route('/objavi/vozilo', vehicleFormPage);
route('/uredi/vozilo/:id', vehicleFormPage);
route('/prijava', loginPage);
route('/registracija', registerPage);
route('/profil', profilePage);
route('/profil/:tab', profilePage);
route('/otpadi', sellersPage);
route('/prodavac/:id', sellerPage);
route('/admin', adminPage);
route('/admin/:tab', adminPage);
route('/uslovi', termsPage);

function termsPage({ el }) {
  setTitle('Uslovi korištenja');
  render(el, html`<section class="page-head"><div class="row"><h1 style="padding-left:12px">Uslovi korištenja</h1></div></section>
  <div class="wrap" style="padding-top:16px"><div class="card stack" style="font-size:15px">
    <p style="margin:0">polovnidijelovi.com je oglasnik: povezuje kupce i prodavce polovnih auto dijelova. Sajt ne prodaje dijelove i nije strana u kupoprodaji.</p>
    <p style="margin:0">Za tačnost oglasa, stanje dijela, cijenu i garanciju odgovara prodavac. Prije plaćanja provjeri dio i prodavca. Ne šalji novac unaprijed nepoznatim osobama.</p>
    <p style="margin:0">Zabranjeno je objavljivati ukradene dijelove, lažne oglase i tuđe slike. Takvi oglasi i nalozi se brišu bez upozorenja.</p>
    <p style="margin:0">Tvoje ime, grad i broj telefona vide kupci i prodavci kojima se javljaš. Email se ne prikazuje javno.</p>
  </div></div>`);
}

// ---------- meni ----------
function navItems() {
  const u = state.user, c = state.counts || {};
  const prof = (c.inquiries || 0) + (c.offers || 0);
  return [
    ['/dijelovi', 'search', 'Traži', 0],
    ['/vozila', 'car', 'Vozila', 0],
    ['/trazim', 'send', 'Tražim dio', u?.type === 'otpad' ? c.requests : 0],
    ['/objavi', 'plus', 'Objavi', 0],
    [u ? '/profil' : '/prijava', 'user', u ? 'Profil' : 'Prijava', prof],
  ];
}
function drawNav() {
  const p = location.pathname;
  const on = href => (href === '/dijelovi' ? p.startsWith('/dijelovi') || p.startsWith('/dio') || p.startsWith('/polovni-dijelovi')
    : href === '/vozila' ? p.startsWith('/vozil') : p.startsWith(href));
  render($('#bottomNav'), html`${navItems().map(([href, ic, label, n]) => html`<a href="${href}" class="${on(href) ? 'on' : ''}">${icon(ic, 22)}${label}${n ? html`<span class="num">${n}</span>` : ''}</a>`)}`);
  render($('.top-links'), html`
    <a href="/dijelovi" class="${on('/dijelovi') ? 'on' : ''}">Dijelovi</a>
    <a href="/vozila" class="${on('/vozila') ? 'on' : ''}">Vozila za dijelove</a>
    <a href="/trazim" class="${on('/trazim') ? 'on' : ''}">Tražim dio${state.user?.type === 'otpad' && state.counts.requests ? html` <span class="num">${state.counts.requests}</span>` : ''}</a>
    <a href="/otpadi" class="${on('/otpadi') ? 'on' : ''}">Otpadi</a>
    ${state.user ? html`<a href="/profil" class="${on('/profil') ? 'on' : ''}">Profil${(state.counts.inquiries || 0) + (state.counts.offers || 0) ? html` <span class="num">${(state.counts.inquiries || 0) + (state.counts.offers || 0)}</span>` : ''}</a>` : html`<a href="/prijava">Prijava</a>`}
    <a href="/objavi" class="cta">+ Objavi</a>`);
}
function openDrawer() {
  const d = $('#drawer');
  const u = state.user;
  render(d, html`<div class="panel" role="dialog" aria-label="Meni">
    <div class="head"><strong>${u ? u.name : 'Meni'}</strong><button class="icon-btn" id="dx" aria-label="Zatvori">${icon('x')}</button></div>
    <a href="/">${icon('home')} Početna</a>
    <a href="/dijelovi">${icon('wrench')} Dijelovi</a>
    <a href="/vozila">${icon('car')} Vozila za dijelove</a>
    <a href="/trazim">${icon('send')} Tražim dio</a>
    <a href="/otpadi">${icon('store')} Auto otpadi</a>
    <hr>
    <a href="/objavi">${icon('plus')} Objavi oglas</a>
    ${u ? html`<a href="/profil">${icon('user')} Moj profil</a>
      ${u.is_admin ? html`<a href="/admin">${icon('shield')} Administracija</a>` : ''}
      <button class="it" id="dlo">${icon('logout')} Odjavi se</button>`
      : html`<a href="/prijava">${icon('user')} Prijava</a><a href="/registracija">${icon('plus')} Registracija</a>`}
    <hr><a href="/uslovi">Uslovi korištenja</a>
  </div>`);
  d.hidden = false;
  d.onclick = e => { if (e.target === d || e.target.closest('#dx') || e.target.closest('a')) d.hidden = true; };
  $('#dlo', d)?.addEventListener('click', async () => { await api('/api/auth/logout', { body: {} }); setMe({ user: null }); d.hidden = true; toast('Odjavljen si'); go('/'); });
}
$('#menuBtn').onclick = openDrawer;
onMe(drawNav);
document.addEventListener('routechange', drawNav);

// osvježi brojače svake 2 minute (nove poruke, ponude, zahtjevi)
setInterval(() => { if (state.user && !document.hidden) loadMe(); }, 120e3);

await loadMe();
await dispatch();
