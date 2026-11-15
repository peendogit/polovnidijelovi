// Šta se najviše traži: DIO + VOZILO (npr. "Far — VW Golf 7 (2012–2017)") i najtraženija vozila.
// Spaja pretrage na sajtu i "Tražim dio" zahtjeve.
import { all } from './db.js';
import { genLabel } from './lib.js';
import { findType } from './types.js';

const vehLabel = r => {
  if (r.gen_name) return `${r.make_name} ${genLabel({ name: r.gen_name, generation_name: r.generation_name, restyling: r.restyling, restyling_second: r.restyling_second, date_from: r.date_from, date_to: r.date_to })}`;
  if (r.model) return `${r.make_name || ''} ${r.model}`.trim();
  return r.make_name || '';
};
const cap = s => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export function demand(days = 30) {
  const since = `-${Number(days)} days`;
  const searches = all(`SELECT s.term, t.title type_title, s.results, k.name make_name, s.model,
      mo.name gen_name, mo.generation_name, mo.restyling, mo.restyling_second, mo.date_from, mo.date_to
    FROM search_log s LEFT JOIN part_types t ON t.id=s.type_id LEFT JOIN car_make k ON k.id=s.make_id LEFT JOIN car_model mo ON mo.id=s.gen_id
    WHERE s.created_at > datetime('now', ?) LIMIT 50000`, since);
  const requests = all(`SELECT r.part, k.name make_name, COALESCE(mo.name, r.model_text) model,
      mo.name gen_name, mo.generation_name, mo.restyling, mo.restyling_second, mo.date_from, mo.date_to
    FROM requests r LEFT JOIN car_make k ON k.id=r.make_id LEFT JOIN car_model mo ON mo.id=r.model_id
    WHERE r.created_at > datetime('now', ?) LIMIT 20000`, since);

  const combos = new Map(), vehicles = new Map();
  const add = (map, key, f) => { const o = map.get(key) || f(); map.set(key, o); return o; };
  for (const s of searches) {
    const part = s.type_title || cap(s.term) || '';
    const veh = vehLabel(s);
    if (part) {
      const o = add(combos, part.toLowerCase() + '|' + veh, () => ({ part, vehicle: veh, searches: 0, requests: 0, none: 0 }));
      o.searches++; if (!s.results) o.none++;
    }
    if (veh) { const v = add(vehicles, veh, () => ({ vehicle: veh, searches: 0, requests: 0 })); v.searches++; }
  }
  for (const r of requests) {
    // "far prednji lijevi" -> tip "Far", da se sabira sa pretragama
    const part = findType(r.part)?.title || cap(String(r.part || '').trim());
    const veh = vehLabel(r);
    const o = add(combos, part.toLowerCase() + '|' + veh, () => ({ part, vehicle: veh, searches: 0, requests: 0, none: 0 }));
    o.requests++;
    if (veh) { const v = add(vehicles, veh, () => ({ vehicle: veh, searches: 0, requests: 0 })); v.requests++; }
  }
  const total = o => o.searches + o.requests;
  const sort = arr => arr.map(o => ({ ...o, n: total(o) })).sort((a, b) => b.n - a.n);
  const list = sort([...combos.values()]);
  return {
    searches: searches.length, requests: requests.length,
    top: list.filter(o => o.vehicle).slice(0, 30),                 // dio + tačno vozilo
    anyVehicle: list.filter(o => !o.vehicle).slice(0, 15),         // traženo bez izbora vozila
    missing: list.filter(o => o.none > 0).sort((a, b) => b.none - a.none).slice(0, 30), // traženo, a nema na sajtu
    vehicles: sort([...vehicles.values()]).slice(0, 20),
  };
}
