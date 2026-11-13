// Zajedničko za dijelove i vozila: filter po vozilu, formatiranje
import { get, all } from '../db.js';
import { parseImgs, vehicleName, genLabel } from '../lib.js';

// Filter po marki / modelu (naziv) / generaciji (id). Vraća [sqlDio, parametri]
export function vehicleFilter(q, alias) {
  const w = []; const a = [];
  if (q.gen) { w.push(`${alias}.model_id=?`); a.push(q.gen); }
  else if (q.make && q.model) {
    w.push(`${alias}.model_id IN (SELECT id FROM car_model WHERE make_id=? AND name=?)`); a.push(q.make, q.model);
  } else if (q.make) { w.push(`${alias}.make_id=?`); a.push(q.make); }
  return [w, a];
}

export const MODEL_JOIN = (alias) => `
  LEFT JOIN car_make mk ON mk.id=${alias}.make_id
  LEFT JOIN car_model mo ON mo.id=${alias}.model_id`;
export const MODEL_COLS = `mk.name make_name, mo.name model_name, mo.generation_name, mo.restyling, mo.restyling_second, mo.date_from gen_from, mo.date_to gen_to`;

export function sellerOf(userId) {
  return get('SELECT id, type, name, phone, viber, whatsapp, city, address, logo, ships, verified, created_at FROM users WHERE id=?', userId);
}

export function fmtVehicleRow(r) {
  return {
    ...r,
    images: parseImgs(r.images),
    vehicle: vehicleName(r),
    generation: r.model_name ? genLabel({ name: r.model_name, generation_name: r.generation_name, restyling: r.restyling, restyling_second: r.restyling_second, date_from: r.gen_from, date_to: r.gen_to }) : r.model_text,
  };
}

export function pageArgs(q, def = 24) {
  const limit = Math.min(Math.max(parseInt(q.limit, 10) || def, 1), 60);
  const page = Math.max(parseInt(q.page, 10) || 1, 1);
  return { limit, offset: (page - 1) * limit, page };
}

export function countAndList(sqlFrom, where, args, order, limit, offset, cols) {
  const W = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const total = get(`SELECT COUNT(*) c ${sqlFrom} ${W}`, ...args).c;
  const items = all(`SELECT ${cols} ${sqlFrom} ${W} ORDER BY ${order} LIMIT ? OFFSET ?`, ...args, limit, offset);
  return { total, items };
}
