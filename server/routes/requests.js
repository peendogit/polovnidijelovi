// "Tražim dio": kupac objavi šta mu treba, otpadi šalju ponude
import { app } from '../router.js';
import { all, get, run } from '../db.js';
import { bad, notFound, forbidden, str, int, num, imgList, modelById, searchWords, normalize, rateLimit } from '../lib.js';
import { vehicleFilter, MODEL_JOIN, MODEL_COLS, fmtVehicleRow, pageArgs, countAndList } from './common.js';

const COLS = `r.id, r.user_id, r.part, r.description, r.year, r.engine, r.city, r.images, r.status, r.created_at, r.make_id, r.model_id, r.model_text,
  u.name buyer_name, ${MODEL_COLS}, (SELECT COUNT(*) FROM offers o WHERE o.request_id=r.id) offers`;
const FROM = `FROM requests r JOIN users u ON u.id=r.user_id AND u.blocked=0 ${MODEL_JOIN('r')}`;

app.get('/api/requests', ({ query, user }) => {
  const [w, a] = vehicleFilter(query, 'r');
  w.unshift("r.status='open'");
  if (query.city) { w.push('r.city=?'); a.push(query.city); }
  for (const word of searchWords(query.q)) {
    w.push('r.search LIKE ?'); a.push(`%${word}%`);
  }
  if (query.unanswered && user) { w.push('NOT EXISTS (SELECT 1 FROM offers o WHERE o.request_id=r.id AND o.user_id=?)'); a.push(user.id); }
  const { limit, offset, page } = pageArgs(query, 30);
  const r = countAndList(FROM, w, a, 'r.id DESC', limit, offset, COLS + (user ? `, (SELECT price FROM offers o WHERE o.request_id=r.id AND o.user_id=${Number(user.id)}) my_offer` : ''));
  return { total: r.total, page, limit, items: r.items.map(fmtVehicleRow) };
});

// otpad je pogledao zahtjeve — skini broj sa ikone
app.post('/api/requests/seen', ({ user }) => {
  run("UPDATE users SET seen_requests_at=datetime('now') WHERE id=?", user.id);
  return { ok: true };
}, { auth: true });

app.get('/api/requests/:id', ({ params, user }) => {
  const r = get(`SELECT r.*, u.name buyer_name, u.phone buyer_phone, u.viber buyer_viber, u.whatsapp buyer_whatsapp, ${MODEL_COLS}
    FROM requests r JOIN users u ON u.id=r.user_id ${MODEL_JOIN('r')} WHERE r.id=?`, int(params.id));
  if (!r) throw notFound('Zahtjev ne postoji');
  const mine = user && (user.id === r.user_id || user.is_admin);
  const out = fmtVehicleRow(r);
  out.mine = !!mine;
  // telefon kupca vide samo prijavljeni korisnici (otpadi da ga mogu nazvati)
  if (!user) { delete out.buyer_phone; delete out.buyer_viber; delete out.buyer_whatsapp; }
  const offerCols = `o.id, o.price, o.message, o.created_at, o.part_id, o.user_id, s.name seller_name, s.type seller_type, s.phone seller_phone,
    s.viber seller_viber, s.whatsapp seller_whatsapp, s.city seller_city, s.verified seller_verified, s.ships seller_ships`;
  if (mine) {
    out.offers = all(`SELECT ${offerCols} FROM offers o JOIN users s ON s.id=o.user_id WHERE o.request_id=? ORDER BY o.price IS NULL, o.price`, r.id);
    if (user.id === r.user_id) run('UPDATE offers SET seen=1 WHERE request_id=?', r.id);
  } else {
    out.offers_count = get('SELECT COUNT(*) c FROM offers WHERE request_id=?', r.id).c;
    out.my_offer = user ? get(`SELECT ${offerCols} FROM offers o JOIN users s ON s.id=o.user_id WHERE o.request_id=? AND o.user_id=?`, r.id, user.id) : null;
  }
  return out;
});

app.post('/api/requests', ({ user, body }) => {
  rateLimit('req:' + user.id, 20, 24 * 3600e3);
  const part = str(body.part, 120);
  if (!part) throw bad('Napiši koji dio tražiš');
  const m = modelById(str(body.model_id, 60));
  if (!m && !str(body.model_text) && !str(body.make_id)) throw bad('Izaberi vozilo');
  const desc = str(body.description, 2000);
  const search = normalize([part, desc, m?.make_name, m?.name, body.model_text, body.engine].join(' '));
  const r = run(`INSERT INTO requests (user_id, make_id, model_id, model_text, year, engine, part, description, city, images, search)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
  user.id, m ? m.make_id : str(body.make_id, 60), m?.id, str(body.model_text, 80), int(body.year), str(body.engine, 40), part,
  desc, str(body.city, 60) || user.city, imgList(body.images), search);
  return { id: Number(r.lastInsertRowid) };
}, { auth: true, verified: true });

app.post('/api/requests/:id/close', ({ user, params }) => {
  const r = get('SELECT * FROM requests WHERE id=?', int(params.id));
  if (!r) throw notFound();
  if (r.user_id !== user.id && !user.is_admin) throw forbidden();
  run("UPDATE requests SET status=? WHERE id=?", r.status === 'open' ? 'closed' : 'open', r.id);
  return { ok: true };
}, { auth: true });

app.get('/api/my/requests', ({ user }) => {
  return all(`SELECT ${COLS}, (SELECT COUNT(*) FROM offers o WHERE o.request_id=r.id AND o.seen=0) new_offers
    ${FROM} WHERE r.user_id=? ORDER BY r.status='open' DESC, r.id DESC LIMIT 100`, user.id).map(fmtVehicleRow);
}, { auth: true });

// Ponuda prodavca (jedna po zahtjevu, može se izmijeniti)
app.post('/api/requests/:id/offer', ({ user, params, body }) => {
  rateLimit('offer:' + user.id, 200, 3600e3);
  const r = get('SELECT * FROM requests WHERE id=?', int(params.id));
  if (!r) throw notFound();
  if (r.status !== 'open') throw bad('Zahtjev je zatvoren');
  if (r.user_id === user.id) throw bad('Ne možeš ponuditi na svoj zahtjev');
  const price = num(body.price);
  const message = str(body.message, 1000);
  if (price === null && !message) throw bad('Upiši cijenu ili poruku');
  let part_id = int(body.part_id);
  if (part_id && !get('SELECT 1 x FROM parts WHERE id=? AND user_id=?', part_id, user.id)) part_id = null;
  run(`INSERT INTO offers (request_id, user_id, price, message, part_id) VALUES (?,?,?,?,?)
    ON CONFLICT(request_id, user_id) DO UPDATE SET price=excluded.price, message=excluded.message, part_id=excluded.part_id, seen=0, created_at=datetime('now')`,
  r.id, user.id, price, message, part_id);
  return { ok: true };
}, { auth: true, verified: true });

app.del('/api/requests/:id/offer', ({ user, params }) => {
  run('DELETE FROM offers WHERE request_id=? AND user_id=?', int(params.id), user.id);
  return { ok: true };
}, { auth: true });

// Ponude koje sam ja poslao
app.get('/api/my/offers', ({ user }) => {
  return all(`SELECT o.id, o.price, o.message, o.created_at, r.id request_id, r.part, r.status, r.year, r.model_text, ${MODEL_COLS}
    FROM offers o JOIN requests r ON r.id=o.request_id ${MODEL_JOIN('r')} WHERE o.user_id=? ORDER BY o.id DESC LIMIT 100`, user.id).map(fmtVehicleRow);
}, { auth: true });

