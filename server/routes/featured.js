// Istaknuti oglasi: vlasnik zatraži (izabere paket), admin odobri kad primi uplatu -> oglas je na vrhu i označen.
import { app } from '../router.js';
import { all, get, run, setting, setSetting } from '../db.js';
import { bad, notFound, forbidden, str, int, rateLimit } from '../lib.js';
import { sendMail, SITE_URL } from '../mail.js';

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
  run('INSERT INTO featured_requests (kind, item_id, user_id, days, price) VALUES (?,?,?,?,?)', kind, id, user.id, pack.days, pack.price);
  // javi administratorima
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
  earned_30d: get("SELECT COALESCE(SUM(price),0) s FROM featured_requests WHERE status='done' AND done_at > datetime('now','-30 days')").s,
}), A);

app.post('/api/admin/featured/:id', ({ params, body }) => {
  const f = get("SELECT * FROM featured_requests WHERE id=? AND status='new'", int(params.id));
  if (!f) throw notFound();
  if (body.action === 'approve') extend(f.kind, f.item_id, f.days);
  run("UPDATE featured_requests SET status=?, done_at=datetime('now') WHERE id=?", body.action === 'approve' ? 'done' : 'rejected', f.id);
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
