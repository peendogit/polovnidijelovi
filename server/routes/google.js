// Prijava sa Google nalogom (OAuth 2.0, bez dodatnih paketa). U .env:
//   GOOGLE_CLIENT_ID=....apps.googleusercontent.com   GOOGLE_CLIENT_SECRET=GOCSPX-...
// U Google konzoli "Authorized redirect URI":  https://polovnidijelovi.com/api/auth/google/callback
import crypto from 'node:crypto';
import { app } from '../router.js';
import { get, run } from '../db.js';
import { SITE_URL } from '../mail.js';
import { HttpError, hashPassword, makeToken, sessionCookie, parseCookies, rateLimit, str } from '../lib.js';

const ID = String(process.env.GOOGLE_CLIENT_ID || '').trim();
const SECRET = String(process.env.GOOGLE_CLIENT_SECRET || '').trim();
export const googleEnabled = () => !!(ID && SECRET);
const REDIRECT = `${SITE_URL}/api/auth/google/callback`;
const safeNext = n => (typeof n === 'string' && /^\/(?![\/\\])/.test(n) && !n.startsWith('/api/') ? n.slice(0, 300) : '/');
const stateCookie = (v, secure) => `pd_g=${v}; Path=/api/auth/google; HttpOnly; SameSite=Lax; Max-Age=${v ? 600 : 0}${secure ? '; Secure' : ''}`;

app.get('/api/auth/google/start', (ctx) => {
  if (!googleEnabled()) throw new HttpError(404, 'Prijava sa Google nije uključena');
  rateLimit('gstart:' + ctx.ip, 30, 600e3);
  const state = crypto.randomBytes(18).toString('base64url');
  const next = safeNext(ctx.query.next);
  ctx.setCookie = stateCookie(`${state}.${Buffer.from(next).toString('base64url')}`, ctx.secure);
  const u = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  u.search = new URLSearchParams({ client_id: ID, redirect_uri: REDIRECT, response_type: 'code', scope: 'openid email profile', state, prompt: 'select_account' });
  ctx.redirect = u.toString();
});

app.get('/api/auth/google/callback', async (ctx) => {
  const fail = msg => { ctx.setCookie = stateCookie('', ctx.secure); ctx.redirect = '/prijava?greska=' + encodeURIComponent(msg); };
  if (!googleEnabled()) return fail('Prijava sa Google nije uključena');
  rateLimit('gcb:' + ctx.ip, 30, 600e3);
  const [st, nextB] = String(parseCookies(ctx.req.headers.cookie).pd_g || '').split('.');
  let next = '/';
  try { next = safeNext(Buffer.from(nextB || '', 'base64url').toString()); } catch { /* */ }
  // zaštita: odgovor mora pripadati prijavi koju je počeo ovaj preglednik
  if (!st || !ctx.query.state || st.length !== String(ctx.query.state).length || !crypto.timingSafeEqual(Buffer.from(st), Buffer.from(String(ctx.query.state)))) return fail('Prijava je istekla. Pokušaj ponovo.');
  if (ctx.query.error || !ctx.query.code) return fail('Prijava sa Google je otkazana.');

  let info;
  try {
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code: String(ctx.query.code), client_id: ID, client_secret: SECRET, redirect_uri: REDIRECT, grant_type: 'authorization_code' }),
      signal: AbortSignal.timeout(10000),
    });
    const j = await r.json();
    if (!r.ok || !j.id_token) throw new Error(j.error_description || j.error || 'token');
    // id_token je stigao direktno od Google-a preko HTTPS-a uz našu tajnu, pa je dovoljno pročitati ga i provjeriti kome je namijenjen
    info = JSON.parse(Buffer.from(j.id_token.split('.')[1], 'base64url').toString());
  } catch (e) {
    console.error('Google prijava:', e.message);
    return fail('Google prijava trenutno ne radi. Pokušaj ponovo ili se prijavi emailom.');
  }
  if (info.aud !== ID || !['accounts.google.com', 'https://accounts.google.com'].includes(info.iss) || Number(info.exp) * 1000 < Date.now()) return fail('Neispravan odgovor od Google-a.');
  if (!info.email || !info.email_verified) return fail('Google nalog nema potvrđen email.');
  const email = String(info.email).toLowerCase().slice(0, 120);
  const sub = String(info.sub);

  let u = get('SELECT * FROM users WHERE google_sub=?', sub) || get('SELECT * FROM users WHERE email=?', email);
  if (u) {
    if (u.blocked) return fail('Nalog je blokiran.');
    // postojeći nalog sa istim emailom: poveži sa Google-om (Google je potvrdio da je email njegov)
    run("UPDATE users SET google_sub=?, email_verified=1, last_login=datetime('now') WHERE id=?", sub, u.id);
  } else {
    rateLimit('greg:' + ctx.ip, 5, 3600e3);
    const name = str(info.name, 80) || email.split('@')[0];
    const id = Number(run('INSERT INTO users (type, name, email, pass_hash, email_verified, google_sub) VALUES (?,?,?,?,1,?)',
      'privatno', name, email, hashPassword(crypto.randomBytes(24).toString('hex')), sub).lastInsertRowid);
    if (get('SELECT COUNT(*) c FROM users').c === 1) run('UPDATE users SET is_admin=1 WHERE id=?', id);
  }
  u = get('SELECT * FROM users WHERE id=?', u?.id || get('SELECT id FROM users WHERE google_sub=?', sub).id);
  ctx.setCookie = [sessionCookie(makeToken(u), ctx.secure), stateCookie('', ctx.secure)];
  // novi korisnik (nema telefona): prvo dopuni profil
  ctx.redirect = u.phone ? next : '/dovrsi-profil?next=' + encodeURIComponent(next);
});
