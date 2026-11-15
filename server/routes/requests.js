// "Tražim dio": kupac objavi šta mu treba, otpadi šalju ponude
import { app } from '../router.js';
import { all, get, run } from '../db.js';
import crypto from 'node:crypto';
import { bad, notFound, forbidden, str, int, num, bool, imgList, modelById, searchWords, normalize, rateLimit, hashPassword, HttpError } from '../lib.js';
import { mailEnabled } from '../mail.js';
import { normPhone } from './inquiries.js';
import { vehicleFilter, MODEL_JOIN, MODEL_COLS, fmtVehicleRow, pageArgs, countAndList } from './common.js';

const COLS = `r.id, r.user_id, (u.type='gost') guest, r.part, r.visibility, r.description, r.year, r.engine, r.city, r.images, r.status, r.created_at, r.make_id, r.model_id, r.model_text,
  u.name buyer_name, ${MODEL_COLS}, (SELECT COUNT(*) FROM offers o WHERE o.request_id=r.id) offers`;
const FROM = `FROM requests r JOIN users u ON u.id=r.user_id AND u.blocked=0 ${MODEL_JOIN('r')}`;

// Privatnost: zahtjev "samo otpadi" vide samo prijavljeni otpadi (i admin); broj kupca i broj ponuda vide samo otpadi.
export const isTrade = user => !!user && (user.type === 'otpad' || !!user.is_admin);
// broj ponuda vidi samo kupac (i admin); ime kupca samo otpadi
export function publicReq(r, user) {
  if (user && (r.user_id === user.id || user.is_admin)) return r;
  const o = { ...r };
  delete o.offers;
  if (!isTrade(user)) o.buyer_name = 'Kupac';
  return o;
}
// za listu: koje zahtjeve ovaj korisnik smije vidjeti
export function visibleWhere(user) {
  if (isTrade(user)) return ['1', []];
  if (user) return ["(r.visibility='public' OR r.user_id=?)", [user.id]];
  return ["r.visibility='public'", []];
}

app.get('/api/requests', ({ query, user }) => {
  const [w, a] = vehicleFilter(query, 'r');
  w.unshift("r.status='open'");
  const [vw, va] = visibleWhere(user); w.push(vw); a.push(...va);
  if (query.others && user) { w.push('r.user_id<>?'); a.push(user.id); }
  if (query.city) { w.push('r.city=?'); a.push(query.city); }
  for (const word of searchWords(query.q)) {
    w.push('r.search LIKE ?'); a.push(`%${word}%`);
  }
  if (query.unanswered && user) { w.push('NOT EXISTS (SELECT 1 FROM offers o WHERE o.request_id=r.id AND o.user_id=?)'); a.push(user.id); }
  const { limit, offset, page } = pageArgs(query, 30);
  const r = countAndList(FROM, w, a, 'r.id DESC', limit, offset, COLS + (user ? `, (SELECT price FROM offers o WHERE o.request_id=r.id AND o.user_id=${Number(user.id)}) my_offer` : ''));
  return { total: r.total, page, limit, private_hidden: !isTrade(user), items: r.items.map(x => publicReq(fmtVehicleRow(x), user)) };
});

// otpad je pogledao zahtjeve — skini broj sa ikone
app.post('/api/requests/seen', ({ user }) => {
  run("UPDATE users SET seen_requests_at=datetime('now') WHERE id=?", user.id);
  return { ok: true };
}, { auth: true });

app.get('/api/requests/:id', ({ params, user }) => {
  const r = get(`SELECT r.*, u.name buyer_name, u.phone buyer_phone, u.viber buyer_viber, u.whatsapp buyer_whatsapp, (u.type='gost') guest, ${MODEL_COLS}
    FROM requests r JOIN users u ON u.id=r.user_id ${MODEL_JOIN('r')} WHERE r.id=?`, int(params.id));
  if (!r) throw notFound('Zahtjev ne postoji');
  const mine = user && (user.id === r.user_id || user.is_admin);
  if (!mine && r.visibility !== 'public' && !isTrade(user)) {
    throw Object.assign(new Error(user ? 'Ovaj zahtjev vide samo otpadi.' : 'Ovaj zahtjev vide samo prijavljeni otpadi. Prijavi se.'), { status: 403 });
  }
  const out = publicReq(fmtVehicleRow(r), user);
  out.mine = !!mine;
  out.own = !!user && user.id === r.user_id;
  out.expires_at = get("SELECT datetime(?, '+15 days') d", r.created_at).d;
  out.trade = isTrade(user);
  // telefon kupca vide samo otpadi, i to samo ako je kupac dozvolio
  if (!mine && !(isTrade(user) && r.show_phone)) { delete out.buyer_phone; delete out.buyer_viber; delete out.buyer_whatsapp; }
  delete out.search;
  const offerCols = `o.id, o.price, o.message, o.created_at, o.part_id, o.user_id, s.name seller_name, s.type seller_type, s.phone seller_phone,
    s.viber seller_viber, s.whatsapp seller_whatsapp, s.city seller_city, s.verified seller_verified, s.ships seller_ships`;
  if (mine) {
    out.offers = all(`SELECT ${offerCols} FROM offers o JOIN users s ON s.id=o.user_id WHERE o.request_id=? ORDER BY o.price IS NULL, o.price`, r.id);
    if (user.id === r.user_id) run('UPDATE offers SET seen=1 WHERE request_id=?', r.id);
  }
  // tuđi zahtjev (i admin kad nije njegov): moja ponuda
  if (user && user.id !== r.user_id) out.my_offer = get(`SELECT ${offerCols} FROM offers o JOIN users s ON s.id=o.user_id WHERE o.request_id=? AND o.user_id=?`, r.id, user.id) || null;
  return out;
});

// Gost (bez naloga): ostavi ime i broj; otpadi mu se javljaju na Viber, WhatsApp ili poziv.
// Za svaki broj se napravi skriveni "gost" nalog (bez prijave), da sve ostalo radi isto.
function guestUser(body, ip) {
  if (body.website) return null; // robot (skriveno polje)
  const t = Number(body.t || 0);
  if (t && Date.now() - t < 4000) throw bad('Sačekaj sekundu pa pošalji ponovo.');
  rateLimit('greq:' + ip, 6, 24 * 3600e3);
  const phone = (str(body.phone, 30) || '').replace(/[^\d+]/g, '');
  const np = normPhone(phone);
  if (np.length < 8 || np.length > 15) throw bad('Upiši ispravan broj telefona — otpadi ti se javljaju na njega');
  if (get("SELECT 1 x FROM blocklist WHERE (kind='phone' AND value=?) OR (kind='ip' AND value=?)", np, ip)) throw bad('Slanje sa ovog broja nije moguće.');
  const email = `gost-${np}@gost.polovnidijelovi.com`;
  let u = get('SELECT * FROM users WHERE email=?', email);
  if (u?.blocked) throw bad('Slanje sa ovog broja nije moguće.');
  if (u && get("SELECT COUNT(*) c FROM requests WHERE user_id=? AND created_at > datetime('now','-1 day')", u.id).c >= 3) {
    throw bad('Sa ovog broja su danas već poslana 3 zahtjeva. Pokušaj sutra ili se registruj.');
  }
  const name = str(body.name, 80) || 'Kupac';
  if (u) run('UPDATE users SET name=?, phone=?, viber=?, whatsapp=?, city=COALESCE(?, city) WHERE id=?', name, phone, bool(body.viber), bool(body.whatsapp), str(body.city, 60), u.id);
  else {
    const id = Number(run("INSERT INTO users (type, name, email, phone, viber, whatsapp, city, pass_hash, email_verified) VALUES ('gost',?,?,?,?,?,?,?,1)",
      name, email, phone, bool(body.viber), bool(body.whatsapp), str(body.city, 60), hashPassword(crypto.randomBytes(24).toString('hex'))).lastInsertRowid);
    u = { id };
  }
  return get('SELECT * FROM users WHERE id=?', u.id);
}

app.post('/api/requests', ({ user, body, ip }) => {
  let guest = false;
  if (!user) {
    user = guestUser(body, ip);
    if (!user) return { ok: true, guest: true };
    guest = true;
  } else {
    if (!user.phone) { const e = new HttpError(403, 'Prvo upiši broj telefona u profilu.'); e.code = 'phone'; throw e; }
    if (!user.email_verified && mailEnabled()) { const e = new HttpError(403, 'Prvo potvrdi email — link smo ti poslali na ' + user.email + '.'); e.code = 'verify'; throw e; }
  }
  rateLimit('req:' + user.id, 20, 24 * 3600e3);
  const part = str(body.part, 120);
  if (!part) throw bad('Napiši koji dio tražiš');
  const m = modelById(str(body.model_id, 60));
  if (!m && !str(body.model_text) && !str(body.make_id)) throw bad('Izaberi vozilo');
  const desc = str(body.description, 2000);
  const search = normalize([part, desc, m?.make_name, m?.name, body.model_text, body.engine].join(' '));
  const r = run(`INSERT INTO requests (user_id, make_id, model_id, model_text, year, engine, part, description, city, images, search, visibility, show_phone)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  user.id, m ? m.make_id : str(body.make_id, 60), m?.id, str(body.model_text, 80), int(body.year), str(body.engine, 40), part,
  desc, str(body.city, 60) || user.city, guest ? '[]' : imgList(body.images), search,
  guest ? 'otpadi' : (body.visibility === 'public' ? 'public' : 'otpadi'), guest || !(body.show_phone === false || body.show_phone === 0 || body.show_phone === '0') ? 1 : 0);
  return guest ? { ok: true, guest: true } : { id: Number(r.lastInsertRowid) };
});

app.post('/api/requests/:id/close', ({ user, params }) => {
  const r = get('SELECT * FROM requests WHERE id=?', int(params.id));
  if (!r) throw notFound();
  if (r.user_id !== user.id) throw forbidden();
  run("UPDATE requests SET status=? WHERE id=?", r.status === 'open' ? 'closed' : 'open', r.id);
  return { ok: true };
}, { auth: true });

// kupac mijenja ko vidi zahtjev i da li otpadi vide broj
app.post('/api/requests/:id/privacy', ({ user, params, body }) => {
  const r = get('SELECT * FROM requests WHERE id=?', int(params.id));
  if (!r) throw notFound();
  if (r.user_id !== user.id && !user.is_admin) throw forbidden();
  const vis = body.visibility === undefined ? r.visibility : (body.visibility === 'public' ? 'public' : 'otpadi');
  const ph = body.show_phone === undefined ? r.show_phone : (body.show_phone ? 1 : 0);
  run('UPDATE requests SET visibility=?, show_phone=? WHERE id=?', vis, ph, r.id);
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
  if (r.visibility !== 'public' && !isTrade(user)) throw forbidden('Na ovaj zahtjev mogu odgovoriti samo otpadi');
  if (get('SELECT type FROM users WHERE id=?', r.user_id)?.type === 'gost') throw bad('Kupac nema nalog — javi mu se direktno na Viber, WhatsApp ili telefon.');
  if (get('SELECT blocked FROM users WHERE id=?', r.user_id)?.blocked) throw notFound();
  const price = num(body.price);
  if (price !== null && (price < 0 || price > 1e6)) throw bad('Provjeri cijenu');
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

