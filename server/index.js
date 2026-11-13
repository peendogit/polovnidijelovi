// polovnidijelovi.com — HTTP server bez vanjskih paketa
import './env.js';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { get, run, UPLOAD_DIR } from './db.js';
import { HttpError, parseCookies, readToken } from './lib.js';
import { routes } from './router.js';
import { renderIndex, sitemap } from './seo.js';
import './routes/auth.js';
import './routes/catalog.js';
import './routes/parts.js';
import './routes/vehicles.js';
import './routes/requests.js';
import './routes/inquiries.js';
import './routes/users.js';
import './routes/upload.js';
import './routes/admin.js';
import './routes/feed.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUB = path.join(ROOT, 'public');
const PORT = Number(process.env.PORT || 3030);

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

function send(req, res, status, body, type = 'application/json; charset=utf-8', extra = {}) {
  let buf = Buffer.isBuffer(body) ? body : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
  const headers = { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff', ...extra };
  if (buf.length > 1024 && /json|text|javascript|xml|svg/.test(type) && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
    buf = zlib.gzipSync(buf);
    headers['Content-Encoding'] = 'gzip';
    headers.Vary = 'Accept-Encoding';
  }
  headers['Content-Length'] = buf.length;
  res.writeHead(status, headers);
  res.end(req.method === 'HEAD' ? undefined : buf);
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', c => {
      size += c.length;
      if (size > limit) { reject(new HttpError(413, 'Prevelik zahtjev')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function serveFile(req, res, file, cache) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return send(req, res, 404, 'Nema', 'text/plain');
    const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
    const etag = `"${st.size}-${st.mtimeMs | 0}"`;
    if (req.headers['if-none-match'] === etag) { res.writeHead(304); return res.end(); }
    if (/text|javascript|json|svg|xml/.test(type)) {
      return send(req, res, 200, fs.readFileSync(file), type, { 'Cache-Control': cache, ETag: etag });
    }
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, 'Cache-Control': cache, ETag: etag });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = decodeURIComponent(url.pathname);
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress;
  try {
    // ---------- API ----------
    if (p.startsWith('/api/')) {
      const m = routes.match(req.method, p);
      if (!m) throw new HttpError(404, 'Nepoznata adresa');
      const cookies = parseCookies(req.headers.cookie);
      const uid = readToken(cookies.pd_s);
      let user = uid ? get('SELECT * FROM users WHERE id=?', uid) : null;
      if (user?.blocked) user = null;
      if (m.route.auth && !user) throw new HttpError(401, 'Prijavi se');
      if (m.route.admin && !user?.is_admin) throw new HttpError(403, 'Samo za administratora');
      let body = {};
      if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
        const raw = await readBody(req, m.route.limit || 1e6);
        if (raw.length) {
          if (!/application\/json/.test(req.headers['content-type'] || '')) throw new HttpError(415, 'Očekujem JSON');
          try { body = JSON.parse(raw.toString('utf8')); } catch { throw new HttpError(400, 'Neispravan JSON'); }
        }
      }
      const secure = req.headers['x-forwarded-proto'] === 'https';
      const ctx = { req, res, params: m.params, query: Object.fromEntries(url.searchParams), body, user, ip, secure, setCookie: null };
      const out = await m.route.handler(ctx);
      const extra = { 'Cache-Control': 'no-store' };
      if (ctx.setCookie) extra['Set-Cookie'] = ctx.setCookie;
      return send(req, res, 200, out ?? { ok: true }, 'application/json; charset=utf-8', extra);
    }

    // ---------- slike ----------
    if (p.startsWith('/uploads/')) {
      const name = path.basename(p);
      return serveFile(req, res, path.join(UPLOAD_DIR, name), 'public, max-age=31536000, immutable');
    }
    if (p === '/sitemap.xml') return send(req, res, 200, sitemap(`https://${req.headers.host}`), TYPES['.xml']);
    if (p === '/robots.txt') {
      return send(req, res, 200, `User-agent: *\nDisallow: /api/\nDisallow: /profil\nDisallow: /admin\nSitemap: https://${req.headers.host}/sitemap.xml\n`, TYPES['.txt']);
    }

    // ---------- statički fajlovi ----------
    if (/\.[a-z0-9]+$/i.test(p) && !p.includes('..')) {
      const f = path.join(PUB, p);
      if (f.startsWith(PUB)) return serveFile(req, res, f, p.startsWith('/js/') || p.endsWith('.css') ? 'no-cache' : 'public, max-age=86400');
    }

    // ---------- sve ostalo: aplikacija (index.html sa SEO podacima) ----------
    const html = renderIndex(p, req.headers.host);
    return send(req, res, html.status || 200, html.body, TYPES['.html'], { 'Cache-Control': 'no-cache' });
  } catch (e) {
    const status = e.status || 500;
    if (status === 500) console.error(new Date().toISOString(), req.method, p, e);
    if (!res.headersSent) send(req, res, status, { error: status === 500 ? 'Greška na serveru' : e.message });
  }
});

server.listen(PORT, '127.0.0.1', () => console.log(`polovnidijelovi radi na http://127.0.0.1:${PORT}`));

// čišćenje: zahtjevi stariji od 60 dana se zatvaraju
setInterval(() => {
  run("UPDATE requests SET status='closed' WHERE status='open' AND created_at < datetime('now','-60 days')");
}, 6 * 3600e3).unref();
