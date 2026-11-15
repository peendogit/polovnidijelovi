// Istaknuti oglasi: vlasnik zatraži (izabere paket), admin odobri kad primi uplatu -> oglas je na vrhu i označen.
import { app } from '../router.js';
import { all, get, run, setting, setSetting } from '../db.js';
import { bad, notFound, forbidden, str, int, rateLimit } from '../lib.js';
import { sendMail, SITE_URL } from '../mail.js';
import { telegram, telegramEnabled } from '../telegram.js';

const A = { auth: true, admin: true };
const DEF_PRICES = [{ days: 7, price: 3 }, { days: 30, price: 10 }];
const DEF_PAY = 'Nakon zahtjeva javićemo ti se na telefon radi uplate. Oglas se ističe čim uplata stigne.';

export function featuredPrices() {
  try { const p = JSON.parse(setting('featured_prices', '')); if (Array.isArray(p) && p.length) return p; } catch { /* podrazumijevano */ }
  return DEF_PRICES;
}
const TBL = k => (k === 'vehicle' ? 'vehicles' : 'parts');
const kindOf = k => (k === 'vehicle' ? 'vehicle' : 'part');
const link = (kind, id) => `${SITE_URL}/${kind === 'vehicle' ? 'vozilo' : 'dio'}/${id}`;

// produži od danas, ili od kraja trenutnog isticanja ako još traje
function extend(kind, id, days) {
  run(`UPDATE ${TBL(kind)} SET featured_until = datetime(MAX(COALESCE(featured_until, datetime('now')), datetime('now')), ?) WHERE id=?`, `+${int(days)} days`, int(id));
}

app.get('/api/featured/info', () => ({ prices: featuredPrices(), pay_info: setting('featured_pay_info', DEF_PAY) }));

app.post('/api/featured/request', async ({ user, body }) => {
  rateLimit('feat:' + user.id, 10, 3600e3);
  const kind = kindOf(body.kind), id = int(body.id);
  const item = get(`SELECT id, user_id, status FROM ${TBL(kind)} WHERE id=?`, id);
  if (!item) throw notFound();
  if (item.user_id !== user.id) throw forbidden();
  if (item.status !== 'active') throw bad('Istaknuti se može samo aktivan oglas');
  const pack = featuredPrices().find(p => p.days === int(body.days));
  if (!pack) throw bad('Izaberi paket');
  if (get("SELECT 1 x FROM featured_requests WHERE kind=? AND item_id=? AND status='new'", kind, id)) throw bad('Zahtjev za ovaj oglas je već poslan — javićemo ti se');
  run('INSERT INTO featured_requests (kind, item_id, user_id, days, price, paid) VALUES (?,?,?,?,?,0)', kind, id, user.id, pack.days, pack.price);
  // javi adminu na Telegram
  const what = kind === 'vehicle'
    ? get("SELECT COALESCE(mk.name || ' ' || mo.name, v.model_text) || COALESCE(' ' || v.year, '') t FROM vehicles v LEFT JOIN car_make mk ON mk.id=v.make_id LEFT JOIN car_model mo ON mo.id=v.model_id WHERE v.id=?", id)?.t
    : get('SELECT title t FROM parts WHERE id=?', id)?.t;
  telegram(`⭐ Novi zahtjev za isticanje\n\n${what || ''} (${kind === 'vehicle' ? 'vozilo' : 'dio'})\nPaket: ${pack.days} dana — ${pack.price} KM\nKorisnik: ${user.name}${user.phone ? ' · ' + user.phone : ''}\n\nOglas: ${link(kind, id)}\nOdobri: ${SITE_URL}/admin/istaknuto`);
  // i emailom administratorima
  const admins = all('SELECT email FROM users WHERE is_admin=1 AND blocked=0');
  for (const a of admins) sendMail(a.email, 'Novi zahtjev: istaknuti oglas', 'Istaknuti oglas',
    `${user.name} (${user.phone || 'bez telefona'}) želi istaknuti oglas na ${pack.days} dana za ${pack.price} KM.`, 'Otvori administraciju', `${SITE_URL}/admin/istaknuto`).catch(() => {});
  return { ok: true };
}, { auth: true });

// ---------- administracija ----------
app.get('/api/admin/featured', () => ({
  requests: all(`SELECT f.*, u.name user_name, u.phone user_phone,
      CASE f.kind WHEN 'vehicle' THEN (SELECT COALESCE(mk.name || ' ' || mo.name, v.model_text) || COALESCE(' ' || v.year, '') FROM vehicles v LEFT JOIN car_make mk ON mk.id=v.make_id LEFT JOIN car_model mo ON mo.id=v.model_id WHERE v.id=f.item_id)
        ELSE (SELECT p.title FROM parts p WHERE p.id=f.item_id) END title
    FROM featured_requests f LEFT JOIN users u ON u.id=f.user_id WHERE f.status='new' ORDER BY f.id DESC`),
  active: [
    ...all(`SELECT 'part' kind, p.id, p.title, p.featured_until, u.name user_name FROM parts p JOIN users u ON u.id=p.user_id WHERE p.featured_until > datetime('now') ORDER BY p.featured_until`),
    ...all(`SELECT 'vehicle' kind, v.id, COALESCE(mk.name || ' ' || mo.name, v.model_text) || COALESCE(' ' || v.year, '') title, v.featured_until, u.name user_name
      FROM vehicles v JOIN users u ON u.id=v.user_id LEFT JOIN car_make mk ON mk.id=v.make_id LEFT JOIN car_model mo ON mo.id=v.model_id WHERE v.featured_until > datetime('now') ORDER BY v.featured_until`),
  ],
  prices: featuredPrices(),
  pay_info: setting('featured_pay_info', DEF_PAY),
  telegram: telegramEnabled(),
  earned_30d: get("SELECT COALESCE(SUM(price),0) s FROM featured_requests WHERE status='done' AND paid=1 AND paid_at > datetime('now','-30 days')").s,
  owed: get("SELECT COALESCE(SUM(price),0) s FROM featured_requests WHERE status='done' AND paid=0").s,
}), A);

app.post('/api/admin/featured/:id', ({ params, body }) => {
  const f = get("SELECT * FROM featured_requests WHERE id=? AND status='new'", int(params.id));
  if (!f) throw notFound();
  const ok = body.action === 'approve';
  if (ok) extend(f.kind, f.item_id, f.days);
  // odobreno: plaćeno odmah, ili duguje (plati kasnije)
  const paid = ok && body.paid !== false ? 1 : 0;
  run("UPDATE featured_requests SET status=?, done_at=datetime('now'), paid=?, paid_at=CASE WHEN ? THEN datetime('now') END WHERE id=?", ok ? 'done' : 'rejected', paid, paid, f.id);
  return { ok: true };
}, A);

// admin direktno istakne (days>0) ili skine isticanje (days=0)
app.post('/api/admin/feature', ({ body }) => {
  const kind = kindOf(body.kind), id = int(body.id), days = int(body.days) || 0;
  if (!get(`SELECT 1 x FROM ${TBL(kind)} WHERE id=?`, id)) throw notFound();
  if (days > 0) extend(kind, id, Math.min(days, 365));
  else run(`UPDATE ${TBL(kind)} SET featured_until=NULL WHERE id=?`, id);
  return { ok: true };
}, A);

app.post('/api/admin/featured-settings', ({ body }) => {
  const prices = (Array.isArray(body.prices) ? body.prices : [])
    .map(p => ({ days: int(p.days), price: Number(String(p.price).replace(',', '.')) }))
    .filter(p => p.days > 0 && p.days <= 365 && p.price >= 0 && p.price < 10000).slice(0, 4);
  if (!prices.length) throw bad('Upiši bar jedan paket (dana i cijena)');
  setSetting('featured_prices', JSON.stringify(prices));
  setSetting('featured_pay_info', str(body.pay_info, 1000) || DEF_PAY);
  return { ok: true };
}, A);

// ---------- naplata: ko je koliko potrošio, platio, duguje ----------
app.get('/api/admin/billing', () => {
  const sum = w => get(`SELECT COALESCE(SUM(price),0) s, COUNT(*) n FROM featured_requests WHERE status='done' ${w}`);
  return {
    totals: {
      paid: sum('AND paid=1'), owed: sum('AND paid=0'),
      month: sum("AND paid=1 AND paid_at >= datetime('now','start of month')"),
      last_month: sum("AND paid=1 AND paid_at >= datetime('now','start of month','-1 month') AND paid_at < datetime('now','start of month')"),
    },
    users: all(`SELECT u.id, u.name, u.phone, u.type, COUNT(*) n, SUM(f.price) spent, SUM(CASE WHEN f.paid=1 THEN f.price ELSE 0 END) paid,
        SUM(CASE WHEN f.paid=0 THEN f.price ELSE 0 END) owed, MAX(f.done_at) last
      FROM featured_requests f JOIN users u ON u.id=f.user_id WHERE f.status='done' GROUP BY u.id ORDER BY owed DESC, spent DESC LIMIT 300`),
    unpaid: all(`SELECT f.id, f.kind, f.item_id, f.days, f.price, f.done_at, u.id user_id, u.name, u.phone,
        CASE f.kind WHEN 'vehicle' THEN (SELECT COALESCE(mk.name || ' ' || mo.name, v.model_text) || COALESCE(' ' || v.year, '') FROM vehicles v LEFT JOIN car_make mk ON mk.id=v.make_id LEFT JOIN car_model mo ON mo.id=v.model_id WHERE v.id=f.item_id)
        ELSE (SELECT p.title FROM parts p WHERE p.id=f.item_id) END title
      FROM featured_requests f JOIN users u ON u.id=f.user_id WHERE f.status='done' AND f.paid=0 ORDER BY f.done_at`),
    recent: all(`SELECT f.id, f.price, f.days, f.paid_at, u.name FROM featured_requests f JOIN users u ON u.id=f.user_id
      WHERE f.status='done' AND f.paid=1 ORDER BY f.paid_at DESC LIMIT 20`),
  };
}, A);

// označi jednu stavku plaćenom (ili vrati na dug)
app.post('/api/admin/billing/:id', ({ params, body }) => {
  const f = get("SELECT id FROM featured_requests WHERE id=? AND status='done'", int(params.id));
  if (!f) throw notFound();
  const paid = body.paid === false ? 0 : 1;
  run("UPDATE featured_requests SET paid=?, paid_at=CASE WHEN ? THEN datetime('now') END WHERE id=?", paid, paid, f.id);
  return { ok: true };
}, A);

// korisnik platio sve što duguje
app.post('/api/admin/billing/user/:id', ({ params }) => {
  const n = run("UPDATE featured_requests SET paid=1, paid_at=datetime('now') WHERE user_id=? AND status='done' AND paid=0", int(params.id)).changes;
  return { ok: true, n: Number(n) };
}, A);

// probna poruka na Telegram (dugme u adminu)
app.post('/api/admin/telegram-test', async () => {
  if (!telegramEnabled()) throw bad('Telegram nije podešen: u .env upiši TELEGRAM_BOT_TOKEN i TELEGRAM_CHAT_ID pa restartuj sajt.');
  if (!await telegram('✅ polovnidijelovi.com: Telegram obavijesti rade.')) throw bad('Poruka nije poslana — provjeri token i chat ID.');
  return { ok: true };
}, A);
