// polovnidijelovi.com — pokretanje aplikacije, meni, rute
import { html, raw, render, $, route, dispatch, loadMe, onMe, state, setTitle, api, go, toast, setMe, pushOverlay, pwa, canInstall, consent, getMeta } from './core.js';
import { icon, installApp } from './components.js';
import { homePage } from './pages/home.js';
import { partsPage, partPage } from './pages/parts.js';
import { vehiclesPage, vehiclePage } from './pages/vehicles.js';
import { requestsPage, newRequestPage, requestPage } from './pages/requests.js';
import { postChoosePage, partFormPage, vehicleFormPage } from './pages/post.js';
import { loginPage, registerPage, completeProfilePage, profilePage, sellersPage, sellerPage, verifyPage, forgotPage, resetPage, sendVerifyAgain } from './pages/account.js';
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
route('/dovrsi-profil', completeProfilePage);
route('/profil', profilePage);
route('/profil/:tab', profilePage);
route('/otpadi', sellersPage);
route('/prodavac/:id', sellerPage);
route('/admin', adminPage);
route('/admin/:tab', adminPage);
route('/uslovi', termsPage);
route('/privatnost', privacyPage);
route('/kolacici', privacyPage);
route('/potvrdi/:token', verifyPage);
route('/zaboravljena-lozinka', forgotPage);
route('/nova-lozinka/:token', resetPage);

// ---------- obavijest o kolačićima ----------
function drawConsent() {
  let b = $('#ckbar');
  if (consent.get() || location.pathname === '/privatnost' || location.pathname === '/kolacici') { b?.remove(); return; }
  if (b) return;
  b = document.createElement('div'); b.id = 'ckbar'; b.className = 'ckbar'; b.setAttribute('role', 'dialog'); b.setAttribute('aria-label', 'Kolačići');
  render(b, html`<div class="ck-in"><strong>Kolačići 🍪</strong>
    <p>Koristimo <b>neophodne</b> kolačiće da bi prijava i sajt radili. Uz tvoj pristanak i <b>funkcionalne</b> (npr. pamtimo da si zatvorio obavijest). Ne koristimo kolačiće za praćenje ni reklame. <a href="/privatnost#kolacici">Više o tome</a></p>
    <div class="ck-btns"><button class="btn accent" id="ckAll">Prihvati sve</button><button class="btn line" id="ckNec">Samo neophodni</button></div></div>`);
  document.body.appendChild(b);
  $('#ckAll', b).onclick = () => { consent.set(true); b.remove(); };
  $('#ckNec', b).onclick = () => { consent.set(false); b.remove(); };
}
document.addEventListener('routechange', drawConsent);
document.addEventListener('consentchange', drawConsent);

// ---------- Politika privatnosti i kolačića ----------
async function privacyPage({ el }) {
  setTitle('Privatnost i kolačići');
  const meta = await getMeta();
  const c = consent.get();
  const owner = meta.owner || 'vlasnik sajta polovnidijelovi.com';
  const mail = meta.contact ? html`<a href="mailto:${meta.contact}">${meta.contact}</a>` : 'kontakt adresu navedenu na sajtu';
  render(el, html`<section class="page-head"><div class="row"><h1 style="padding-left:12px">Privatnost i kolačići</h1></div><p class="sub">U skladu sa Zakonom o zaštiti ličnih podataka BiH („Sl. glasnik BiH“, br. 12/2025).</p></section>
  <div class="wrap legal" style="padding-top:16px">
    <div class="card stack" id="kolacici">
      <h2>Tvoj izbor kolačića</h2>
      <p>Trenutno: <strong>${!c ? 'nisi još izabrao' : c.func ? 'neophodni i funkcionalni' : 'samo neophodni'}</strong>. Izbor možeš promijeniti bilo kad.</p>
      <div class="btns"><button class="btn accent" id="pAll">Dozvoli sve</button><button class="btn line" id="pNec">Samo neophodni</button></div>
    </div>
    <div class="card stack">
      <h2>Koje kolačiće koristimo</h2>
      <div class="tblwrap"><table class="tbl">
        <tr><th>Naziv</th><th>Vrsta</th><th>Svrha</th><th>Traje</th></tr>
        <tr><td>pd_s</td><td>neophodan</td><td>Prijava na nalog (da ostaneš prijavljen)</td><td>60 dana</td></tr>
        <tr><td>pd_g</td><td>neophodan</td><td>Sigurnost prijave preko Google-a</td><td>10 minuta</td></tr>
        <tr><td>pd_consent</td><td>neophodan</td><td>Pamti tvoj izbor kolačića</td><td>12 mjeseci</td></tr>
        <tr><td>pd_inst_x</td><td>funkcionalan</td><td>Pamti da si zatvorio traku „Instaliraj aplikaciju“</td><td>14 dana</td></tr>
      </table></div>
      <p>Ne koristimo kolačiće za analitiku, praćenje ni reklame. Fontovi i sve ostalo učitavaju se sa našeg servera. Ako se prijavljuješ preko Google-a, Google koristi svoje kolačiće na svojoj stranici za prijavu, a na našoj prijavi se sa Google servera učitava njihov logo.</p>
    </div>
    <div class="card stack">
      <h2>Ko obrađuje podatke</h2>
      <p>Kontrolor podataka je ${owner}. Za sva pitanja i zahtjeve u vezi sa ličnim podacima piši na ${mail}.</p>
      <h2>Koje podatke čuvamo i zašto</h2>
      <ul>
        <li><b>Nalog:</b> ime ili naziv, email, broj telefona, grad, adresa (otpadi), Viber/WhatsApp — da bi mogao objavljivati i da te kupci i prodavci mogu kontaktirati.</li>
        <li><b>Oglasi i slike</b> koje objaviš — da bi bili vidljivi kupcima.</li>
        <li><b>„Tražim dio“ i ponude</b> — vide ih samo otpadi i ti; brišu se automatski posle 15 dana.</li>
        <li><b>Upiti</b> (ime, telefon, poruka) — šalju se prodavcu kojem pišeš.</li>
        <li><b>IP adresa</b> — privremeno, za zaštitu od spama i zloupotrebe.</li>
        <li><b>Pretrage</b> — bez tvoje IP adrese i bez imena, samo zbirno (šta se najviše traži); brišu se posle 90 dana.</li>
      </ul>
      <p>Pravni osnov: izvršenje usluge koju tražiš (nalog, oglasi, upiti) i legitimni interes (sigurnost sajta, zaštita od spama). Funkcionalni kolačići samo uz tvoj pristanak.</p>
      <h2>Kome se podaci prosljeđuju</h2>
      <ul>
        <li><b>Contabo</b> (Njemačka) — server na kojem radi sajt.</li>
        <li><b>Brevo</b> (EU) — slanje emailova (potvrda emaila, nova lozinka, obavijesti).</li>
        <li><b>Google</b> — samo ako se prijaviš preko Google naloga.</li>
        <li>Kupcima i prodavcima — ono što sam objaviš ili pošalješ (oglas, upit, ponuda, broj telefona).</li>
      </ul>
      <p>Podatke ne prodajemo i ne dajemo nikome za reklame.</p>
      <h2>Koliko dugo</h2>
      <p>Dok imaš nalog. Kad obrišeš nalog, brišu se nalog, oglasi, slike, zahtjevi, ponude i upiti. Sigurnosne kopije baze se čuvaju do 90 dana, pa se brišu same.</p>
      <h2>Tvoja prava</h2>
      <p>Imaš pravo da tražiš pristup svojim podacima, ispravku, brisanje, ograničenje obrade, prenos podataka i da prigovoriš obradi. Većinu podataka mijenjaš sam u Profil → Postavke, a nalog možeš obrisati u Profil → Postavke → „Obriši nalog“. Za ostalo piši na ${mail}. Ako smatraš da su ti prava povrijeđena, možeš se obratiti Agenciji za zaštitu ličnih podataka u Bosni i Hercegovini.</p>
    </div>
  </div>`);
  const upd = f => { consent.set(f); toast('Sačuvano'); privacyPage({ el }); };
  $('#pAll', el).onclick = () => upd(true);
  $('#pNec', el).onclick = () => upd(false);
  if (location.hash === '#kolacici') $('#kolacici', el).scrollIntoView();
}

function termsPage({ el }) {
  setTitle('Uslovi korištenja');
  render(el, html`<section class="page-head"><div class="row"><h1 style="padding-left:12px">Uslovi korištenja</h1></div></section>
  <div class="wrap" style="padding-top:16px"><div class="card stack" style="font-size:15px">
    <p style="margin:0">polovnidijelovi.com je oglasnik: povezuje kupce i prodavce polovnih auto dijelova. Sajt ne prodaje dijelove i nije strana u kupoprodaji.</p>
    <p style="margin:0">Za tačnost oglasa, stanje dijela, cijenu i garanciju odgovara prodavac. Prije plaćanja provjeri dio i prodavca. Ne šalji novac unaprijed nepoznatim osobama.</p>
    <p style="margin:0">Zabranjeno je objavljivati ukradene dijelove, lažne oglase i tuđe slike. Takvi oglasi i nalozi se brišu bez upozorenja.</p>
    <p style="margin:0">Tvoje ime, grad i broj telefona vide kupci i prodavci kojima se javljaš. Email se ne prikazuje javno. Više u <a href="/privatnost">Privatnost i kolačići</a>.</p>
  </div></div>`);
}

// ---------- meni ----------
function navItems() {
  const u = state.user, c = state.counts || {};
  const prof = (c.inquiries || 0) + (c.offers || 0) + (c.admin_total || 0);
  return [
    ['/dijelovi', 'search', 'Traži', 0],
    ['/vozila', 'car', 'Vozila', 0],
    ['/trazim', 'send', 'Tražim dio', u?.type === 'otpad' ? c.requests : 0],
    ['/objavi', 'plus', 'Objavi', 0],
    [u ? '/profil' : '/prijava', 'user', u ? 'Profil' : 'Prijava', prof],
  ];
}
// traka "potvrdi email" ispod zaglavlja
function drawBanner() {
  const u = state.user;
  let b = $('#vbanner');
  const need = u && u.mail_enabled && !u.email_verified && !location.pathname.startsWith('/potvrdi');
  if (!need) { b?.remove(); return; }
  if (!b) { b = document.createElement('div'); b.id = 'vbanner'; b.className = 'vbanner'; $('.top').after(b); }
  render(b, html`<span>Potvrdi email (<strong>${u.email}</strong>) da bi mogao objavljivati.</span><button class="link" id="vbb">Pošalji ponovo</button>`);
  $('#vbb', b).onclick = sendVerifyAgain;
}

function drawNav() {
  drawBanner();
  const p = location.pathname;
  const on = href => (href === '/dijelovi' ? p.startsWith('/dijelovi') || p.startsWith('/dio') || p.startsWith('/polovni-dijelovi')
    : href === '/vozila' ? p.startsWith('/vozil') : p.startsWith(href));
  render($('#bottomNav'), html`${navItems().map(([href, ic, label, n]) => html`<a href="${href}" class="${on(href) ? 'on' : ''}">${icon(ic, 22)}${label}${n ? html`<span class="num">${n}</span>` : ''}</a>`)}`);
  render($('.top-links'), html`
    <a href="/dijelovi" class="${on('/dijelovi') ? 'on' : ''}">Dijelovi</a>
    <a href="/vozila" class="${on('/vozila') ? 'on' : ''}">Vozila za dijelove</a>
    <a href="/trazim" class="${on('/trazim') ? 'on' : ''}">Tražim dio${state.user?.type === 'otpad' && state.counts.requests ? html` <span class="num">${state.counts.requests}</span>` : ''}</a>
    <a href="/otpadi" class="${on('/otpadi') ? 'on' : ''}">Otpadi</a>
    ${state.user?.is_admin ? html`<a href="/admin" class="${on('/admin') ? 'on' : ''}">Admin${state.counts.admin_total ? html` <span class="num red">${state.counts.admin_total}</span>` : ''}</a>` : ''}
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
      ${u.is_admin ? html`<a href="/admin">${icon('shield')} Administracija${state.counts.admin_total ? html` <span class="num red">${state.counts.admin_total}</span>` : ''}</a>` : ''}
      <button class="it" id="dlo">${icon('logout')} Odjavi se</button>`
      : html`<a href="/prijava">${icon('user')} Prijava</a><a href="/registracija">${icon('plus')} Registracija</a>`}
    ${pwa.installed ? '' : html`<hr><button class="it" id="dinst">${icon('plus')} Instaliraj aplikaciju</button>`}
    <hr><a href="/uslovi">Uslovi korištenja</a>
  </div>`);
  d.hidden = false;
  const close = pushOverlay(() => { d.hidden = true; });
  // klik na link: go() sam zatvori meni; klik pored ili na X: zatvori kao "nazad"
  d.onclick = e => { if (e.target === d || e.target.closest('#dx')) close(); };
  $('#dinst', d)?.addEventListener('click', () => { close(); setTimeout(installApp, 50); });
  $('#dlo', d)?.addEventListener('click', async () => { await api('/api/auth/logout', { body: {} }); setMe({ user: null }); toast('Odjavljen si'); go('/'); });
}
$('#menuBtn').onclick = openDrawer;

// traka "Instaliraj aplikaciju" na dnu (dok je korisnik ne zatvori)
function drawInstallBar() {
  let b = $('#instbar');
  let hidden = false;
  try { hidden = Date.now() - Number(localStorage.getItem('pd_inst_x') || 0) < 14 * 864e5; } catch { /* */ }
  if (!canInstall() || hidden) { b?.remove(); return; }
  if (!b) { b = document.createElement('div'); b.id = 'instbar'; b.className = 'instbar'; document.body.appendChild(b); }
  render(b, html`<img src="/icons/kljuc-192.png" alt="" width="40" height="40"><div><strong>Polovni dijelovi na telefonu</strong><span>Brže otvaranje, ikona na početnom ekranu</span></div>
    <button class="btn accent sm" id="instb">Instaliraj</button><button class="icon-btn" id="instx" aria-label="Zatvori">${icon('x', 18, '#fff')}</button>`);
  $('#instb', b).onclick = installApp;
  $('#instx', b).onclick = () => { if (consent.func()) { try { localStorage.setItem('pd_inst_x', Date.now()); } catch { /* */ } } b.remove(); };
}
document.addEventListener('pwachange', drawInstallBar);
setTimeout(drawInstallBar, 4000);
onMe(drawNav);
document.addEventListener('routechange', drawNav);

// osvježi brojače svake 2 minute (nove poruke, ponude, zahtjevi)
setInterval(() => { if (state.user && !document.hidden) loadMe(); }, 120e3);

// prijavljen preko Google-a a bez telefona: prvo dopuni profil
document.addEventListener('routechange', () => {
  if (state.user && !state.user.phone && !location.pathname.startsWith('/dovrsi-profil') && !location.pathname.startsWith('/uslovi')) go('/dovrsi-profil?next=' + encodeURIComponent(location.pathname + location.search), true);
});
await loadMe();
await dispatch();
