// Prodavci (otpadi) — javni profil i spisak
import { app } from '../router.js';
import { all, get } from '../db.js';
import { notFound, int } from '../lib.js';

app.get('/api/sellers', ({ query }) => {
  const w = ["u.type='otpad'", 'u.blocked=0']; const a = [];
  if (query.city) { w.push('u.city=?'); a.push(query.city); }
  return all(`SELECT u.id, u.name, u.city, u.logo, u.verified, u.ships,
      (SELECT COUNT(*) FROM parts p WHERE p.user_id=u.id AND p.status='active') parts,
      (SELECT COUNT(*) FROM vehicles v WHERE v.user_id=u.id AND v.status='active') vehicles
    FROM users u WHERE ${w.join(' AND ')} ORDER BY u.verified DESC, vehicles DESC, parts DESC LIMIT 300`, ...a);
});

app.get('/api/sellers/:id', ({ params }) => {
  const u = get(`SELECT id, type, name, phone, viber, whatsapp, city, address, about, logo, ships, verified, created_at
    FROM users WHERE id=? AND blocked=0`, int(params.id));
  if (!u) throw notFound('Prodavac ne postoji');
  u.parts = get("SELECT COUNT(*) c FROM parts WHERE user_id=? AND status='active'", u.id).c;
  u.vehicles = get("SELECT COUNT(*) c FROM vehicles WHERE user_id=? AND status='active'", u.id).c;
  return u;
});
