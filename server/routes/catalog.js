// Marke, modeli i generacije (sa faceliftovima)
import { app } from '../router.js';
import { all, get, run } from '../db.js';
import { bad, genLabel, str, bool, rateLimit } from '../lib.js';

let makesCache = null;
export const clearCatalogCache = () => { makesCache = null; };

app.get('/api/makes', () => {
  if (!makesCache) {
    makesCache = all(`SELECT k.id, k.name, k.popular FROM car_make k
      WHERE k.active=1 AND EXISTS (SELECT 1 FROM car_model m WHERE m.make_id=k.id AND m.active=1)
      ORDER BY k.name COLLATE NOCASE`);
  }
  return makesCache;
});

// Modeli jedne marke: grupisano po nazivu, sa rasponom godina
app.get('/api/makes/:id/models', ({ params }) => {
  const rows = all(`SELECT name, MIN(date_from) df, MAX(COALESCE(date_to,'9999')) dt, COUNT(*) gens
    FROM car_model WHERE make_id=? AND active=1 GROUP BY name ORDER BY name COLLATE NOCASE`, params.id);
  return rows.map(r => ({
    name: r.name,
    gens: r.gens,
    years: r.df ? `${r.df.slice(0, 4)}–${r.dt === '9999' ? 'danas' : r.dt.slice(0, 4)}` : '',
  }));
});

// Generacije jednog modela (npr. Golf 7 i Golf 7 facelift)
app.get('/api/makes/:id/generations', ({ params, query }) => {
  const rows = all(`SELECT * FROM car_model WHERE make_id=? AND name=? AND active=1
    ORDER BY COALESCE(date_from,'0000'), restyling, restyling_second`, params.id, query.name || '');
  return rows.map(m => ({ id: m.id, label: genLabel(m), from: m.date_from, to: m.date_to, facelift: m.restyling_second ? 2 : m.restyling ? 1 : 0 }));
});

app.get('/api/models/:id', ({ params }) => {
  const m = get('SELECT m.*, k.name make_name FROM car_model m JOIN car_make k ON k.id=m.make_id WHERE m.id=?', params.id);
  if (!m) return null;
  return { id: m.id, make_id: m.make_id, make_name: m.make_name, name: m.name, label: genLabel(m) };
});

// "Nema mog modela"
app.post('/api/model-suggestions', ({ user, body, ip }) => {
  rateLimit('sugg:' + ip, 10, 3600e3);
  const model = str(body.model, 80);
  if (!model) throw bad('Upiši model');
  run('INSERT INTO model_suggestions (user_id, make_id, make_text, model_text, years, facelift) VALUES (?,?,?,?,?,?)',
    user?.id, str(body.make_id, 60), str(body.make, 60), model, str(body.years, 30), bool(body.facelift));
  return { ok: true };
});
