// Jednokratna dopuna baze modela (novembar 2026):
//  - ispravke nelogičnih unosa (verzija motora upisana kao generacija, "do" prije "od", pogrešan naziv)
//  - novije generacije i faceliftovi (2019–2025) koji su falili
// Pokreće se jednom, pri prvom startu nakon ažuriranja (settings: models_update_2026_11).
import crypto from 'node:crypto';

// [marka, model, oznaka generacije | null, facelift (0/1/2), od, do | null]
const ADD = [
  // Volkswagen
  ['Volkswagen', 'Golf 8', null, 1, 2024, null],
  ['Volkswagen', 'Polo', 'AW', 1, 2021, null],
  ['Volkswagen', 'T-Cross', null, 1, 2024, null],
  ['Volkswagen', 'T-Roc', null, 0, 2025, null],
  ['Volkswagen', 'Taigo', null, 0, 2021, null],
  ['Volkswagen', 'Tiguan', null, 0, 2024, null],
  ['Volkswagen', 'Touareg', 'CR', 1, 2023, null],
  ['Volkswagen', 'Arteon', null, 1, 2020, 2024],
  ['Volkswagen', 'ID.3', null, 1, 2023, null],
  ['Volkswagen', 'ID.4', null, 0, 2020, null],
  ['Volkswagen', 'ID.5', null, 0, 2021, null],
  ['Volkswagen', 'ID.7', null, 0, 2023, null],
  ['Volkswagen', 'ID. Buzz', null, 0, 2022, null],
  ['Volkswagen', 'Multivan', 'T7', 0, 2021, null],
  ['Volkswagen', 'Amarok', null, 0, 2022, null],
  // Audi
  ['Audi', 'A3', '8Y', 1, 2024, null],
  ['Audi', 'A5', 'B10', 0, 2024, null],
  ['Audi', 'A6', 'C9', 0, 2025, null],
  ['Audi', 'A8', 'D5', 1, 2021, null],
  ['Audi', 'Q3', null, 0, 2025, null],
  ['Audi', 'Q5', null, 0, 2024, null],
  ['Audi', 'Q4 e-tron', null, 0, 2021, null],
  ['Audi', 'Q6 e-tron', null, 0, 2024, null],
  ['Audi', 'Q8 e-tron', null, 0, 2022, 2024],
  // BMW
  ['BMW', '1', 'F70', 0, 2024, null],
  ['BMW', '2', 'G42', 0, 2021, null],
  ['BMW', '2 Active Tourer', 'U06', 0, 2022, null],
  ['BMW', '3', 'G20 LCI', 1, 2022, null],
  ['BMW', '4', 'G22', 1, 2024, null],
  ['BMW', '5', 'G60', 0, 2023, null],
  ['BMW', '7', 'G70', 0, 2022, null],
  ['BMW', 'X1', 'U11', 0, 2022, null],
  ['BMW', 'X2', 'U10', 0, 2023, null],
  ['BMW', 'X4', 'G02', 1, 2021, null],
  ['BMW', 'X5', 'G05', 1, 2023, null],
  ['BMW', 'X6', 'G06', 1, 2023, null],
  ['BMW', 'X7', 'G07', 1, 2022, null],
  ['BMW', 'M2', 'G87', 0, 2023, null],
  ['BMW', 'iX', 'I20', 0, 2021, null],
  ['BMW', 'i4', 'G26', 0, 2021, null],
  ['BMW', 'iX1', 'U11', 0, 2022, null],
  ['BMW', 'i5', 'G60', 0, 2023, null],
  // Mercedes-Benz
  ['Mercedes-Benz', 'B', 'W247', 1, 2022, null],
  ['Mercedes-Benz', 'CLA', 'C118', 1, 2023, 2025],
  ['Mercedes-Benz', 'CLA', 'C178', 0, 2025, null],
  ['Mercedes-Benz', 'GLA', 'H247', 1, 2023, null],
  ['Mercedes-Benz', 'GLC Coupe', 'C254', 0, 2023, null],
  ['Mercedes-Benz', 'GLE', 'V167', 1, 2023, null],
  ['Mercedes-Benz', 'GLS', 'X167', 1, 2023, null],
  ['Mercedes-Benz', 'V', 'W447', 1, 2019, null],
  ['Mercedes-Benz', 'Vito', 'W447', 1, 2020, null],
  ['Mercedes-Benz', 'Citan', 'W420', 0, 2021, null],
  ['Mercedes-Benz', 'EQA', 'H243', 0, 2021, null],
  ['Mercedes-Benz', 'EQB', 'X243', 0, 2021, null],
  ['Mercedes-Benz', 'EQE', 'V295', 0, 2022, null],
  ['Mercedes-Benz', 'EQS', 'V297', 0, 2021, null],
  // Škoda
  ['Škoda', 'Fabia', 'PJ', 0, 2021, null],
  ['Škoda', 'Superb', 'B9', 0, 2024, null],
  ['Škoda', 'Scala', null, 1, 2024, null],
  ['Škoda', 'Elroq', null, 0, 2024, null],
  // Seat / Cupra
  ['Seat', 'Leon', null, 1, 2024, null],
  ['Seat', 'Ibiza', null, 1, 2021, null],
  ['Seat', 'Arona', null, 1, 2021, null],
  ['Seat', 'Ateca', null, 1, 2020, null],
  ['Cupra', 'Leon', null, 0, 2020, null],
  ['Cupra', 'Ateca', null, 0, 2020, null],
  ['Cupra', 'Born', null, 0, 2021, null],
  ['Cupra', 'Tavascan', null, 0, 2024, null],
  ['Cupra', 'Terramar', null, 0, 2024, null],
  // Opel
  ['Opel', 'Astra', 'L', 0, 2021, null],
  ['Opel', 'Corsa', 'F', 1, 2023, null],
  ['Opel', 'Mokka', 'B', 0, 2020, null],
  ['Opel', 'Grandland', null, 0, 2024, null],
  ['Opel', 'Vivaro', 'C', 0, 2019, null],
  ['Opel', 'Frontera', null, 0, 2024, null],
  // Renault / Dacia
  ['Renault', 'Captur', null, 1, 2024, null],
  ['Renault', 'Espace', null, 0, 2023, null],
  ['Renault', 'Scenic', 'E-Tech', 0, 2024, null],
  ['Renault', 'Kangoo', null, 0, 2021, null],
  ['Renault', 'Trafic', null, 1, 2019, null],
  ['Renault', 'Master', null, 0, 2024, null],
  ['Dacia', 'Duster', null, 1, 2021, 2024],
  ['Dacia', 'Duster', null, 0, 2024, null],
  ['Dacia', 'Logan', null, 0, 2020, 2022],
  ['Dacia', 'Logan', null, 1, 2022, null],
  ['Dacia', 'Jogger', null, 0, 2021, null],
  ['Dacia', 'Spring', null, 0, 2021, null],
  // Peugeot / Citroën
  ['Peugeot', '208', null, 1, 2023, null],
  ['Peugeot', '2008', null, 1, 2023, null],
  ['Peugeot', '308', 'P5', 0, 2021, null],
  ['Peugeot', '3008', null, 0, 2024, null],
  ['Peugeot', '5008', null, 1, 2020, 2023],
  ['Peugeot', '5008', null, 0, 2024, null],
  ['Peugeot', '508', null, 1, 2023, null],
  ['Peugeot', '408', null, 0, 2022, null],
  ['Peugeot', 'Partner', 'K9', 0, 2018, null],
  ['Citroën', 'C3', null, 1, 2020, 2024],
  ['Citroën', 'C3', null, 0, 2024, null],
  ['Citroën', 'C3 AirCross', null, 1, 2021, 2024],
  ['Citroën', 'C3 AirCross', null, 0, 2024, null],
  ['Citroën', 'C4', null, 0, 2020, null],
  ['Citroën', 'C4 X', null, 0, 2022, null],
  ['Citroën', 'C5 AirCross', null, 1, 2022, null],
  ['Citroën', 'C5 X', null, 0, 2022, null],
  // Ford
  ['Ford', 'Fiesta', null, 1, 2022, 2023],
  ['Ford', 'Focus', '4', 1, 2022, 2025],
  ['Ford', 'Kuga', null, 1, 2024, null],
  ['Ford', 'Puma', null, 1, 2024, null],
  ['Ford', 'Ranger', null, 0, 2022, null],
  ['Ford', 'Transit Connect', null, 0, 2022, null],
  // Fiat
  ['Fiat', 'Tipo', null, 1, 2020, null],
  ['Fiat', '600', null, 0, 2023, null],
  ['Fiat', 'Grande Panda', null, 0, 2024, null],
  ['Fiat', 'Doblo', null, 0, 2022, null],
  // Toyota
  ['Toyota', 'Yaris', 'XP210', 0, 2020, 2024],
  ['Toyota', 'Yaris', 'XP210', 1, 2024, null],
  ['Toyota', 'Yaris Cross', 'XP210', 1, 2024, null],
  ['Toyota', 'Corolla', 'E210', 1, 2022, null],
  ['Toyota', 'RAV4', 'XA60', 0, 2025, null],
  ['Toyota', 'Aygo X', null, 0, 2022, null],
  ['Toyota', 'Land Cruiser Prado', 'J250', 0, 2024, null],
  ['Toyota', 'bZ4X', null, 0, 2022, null],
  ['Toyota', 'Proace City', null, 0, 2019, null],
  // Hyundai / Kia
  ['Hyundai', 'Tucson', 'NX4', 1, 2024, null],
  ['Hyundai', 'Kona', null, 1, 2020, 2023],
  ['Hyundai', 'Kona', 'SX2', 0, 2023, null],
  ['Hyundai', 'Ioniq 5', null, 0, 2021, null],
  ['Hyundai', 'Ioniq 6', null, 0, 2022, null],
  ['Kia', 'Ceed', null, 1, 2021, null],
  ['Kia', 'Sorento', null, 1, 2024, null],
  ['Kia', 'EV6', null, 0, 2021, null],
  ['Kia', 'EV9', null, 0, 2023, null],
  ['Kia', 'EV3', null, 0, 2024, null],
  // Nissan / Mazda
  ['Nissan', 'Juke', 'F16', 1, 2024, null],
  ['Nissan', 'X-Trail', 'T33', 0, 2021, null],
  ['Mazda', 'CX-5', 'KF', 1, 2021, null],
  ['Mazda', 'CX-60', null, 0, 2022, null],
  ['Mazda', 'CX-80', null, 0, 2024, null],
  // Volvo
  ['Volvo', 'XC40', null, 1, 2022, null],
  ['Volvo', 'XC60', null, 1, 2021, null],
  ['Volvo', 'XC90', null, 2, 2024, null],
  ['Volvo', 'EX30', null, 0, 2023, null],
  // ostali
  ['Suzuki', 'Swift', null, 0, 2024, null],
  ['Suzuki', 'S-Cross', null, 0, 2021, null],
  ['MINI', 'Cooper', 'F56', 1, 2021, 2024],
  ['MINI', 'Cooper', 'J01', 0, 2024, null],
  ['MINI', 'Countryman', 'U25', 0, 2024, null],
  ['Land Rover', 'Range Rover', 'L460', 0, 2022, null],
  ['Land Rover', 'Range Rover Sport', 'L461', 0, 2022, null],
  ['Land Rover', 'Range Rover Evoque', 'L551', 1, 2023, null],
  ['Jeep', 'Compass', null, 1, 2021, null],
  ['Jeep', 'Avenger', null, 0, 2023, null],
  ['Tesla', 'Model 3', 'Highland', 1, 2023, null],
  ['Tesla', 'Model Y', null, 0, 2020, 2025],
  ['Tesla', 'Model Y', 'Juniper', 1, 2025, null],
  ['Alfa Romeo', 'Tonale', null, 0, 2022, null],
  ['Alfa Romeo', 'Junior', null, 0, 2024, null],
  ['Honda', 'Civic', null, 0, 2021, null],
  ['Honda', 'HR-V', null, 0, 2021, null],
  ['Honda', 'CR-V', null, 0, 2023, null],
  ['Honda', 'Jazz', null, 0, 2020, null],
];

// ispravke postojećih: [marka, model, facelift, od (godina), oznaka|undefined, { do, oznaka, ... }]
const FIX = [
  ['Volkswagen', 'Golf 8', 0, 2019, undefined, { to: 2024 }],
  ['Volkswagen', 'Polo', 0, 2017, undefined, { to: 2021, gen: 'AW' }],
  ['Volkswagen', 'T-Cross', 0, 2019, undefined, { to: 2024 }],
  ['Volkswagen', 'Tiguan', 1, 2020, undefined, { to: 2024 }],
  ['Volkswagen', 'Touareg', 0, 2018, undefined, { to: 2023, gen: 'CR' }],
  ['Volkswagen', 'ID.3', 0, 2019, undefined, { to: 2023 }],
  ['Volkswagen', 'Arteon', 0, 2017, undefined, { to: 2020 }],
  ['Audi', 'A3', 0, 2020, '8Y', { to: 2024 }],
  ['Audi', 'A8', 0, 2017, 'D5', { to: 2021 }],
  ['Audi', 'TT', 1, 2018, '8S', { to: 2023 }],
  ['BMW', '1', 0, 2019, 'F40', { to: 2024 }],
  ['BMW', '2', 0, 2019, 'F44', { to: 2024 }],
  ['BMW', '4', 0, 2020, 'G22', { to: 2024 }],
  ['BMW', '5', 1, 2020, 'G30', { to: 2023 }],
  ['BMW', '7', 1, 2019, 'G11', { to: 2022 }],
  ['BMW', 'X1', 1, 2019, 'F48', { to: 2022 }],
  ['BMW', 'X2', 0, 2017, 'F39', { to: 2023 }],
  ['BMW', 'X4', 0, 2018, 'G02', { to: 2021 }],
  ['BMW', 'X5', 0, 2018, 'G05', { to: 2023 }],
  ['BMW', 'X6', 0, 2019, 'G06', { to: 2023 }],
  ['BMW', 'X7', 0, 2018, 'G07', { to: 2022 }],
  ['BMW', 'M3', 0, 2020, 'G80', { to: null }],
  ['BMW', 'M4', 0, 2020, 'G82', { to: null }],
  ['Mercedes-Benz', 'CLA', 0, 2019, 'C118', { to: 2023 }],
  ['Mercedes-Benz', 'GLA', 0, 2019, 'H247', { to: 2023 }],
  ['Mercedes-Benz', 'GLE', 0, 2018, 'W167', { to: 2023 }],
  ['Mercedes-Benz', 'GLS', 0, 2019, 'X167', { to: 2023 }],
  ['Mercedes-Benz', 'V', 0, 2014, 'W447', { to: 2019 }],
  ['Mercedes-Benz', 'Citan', 0, 2012, 'W415', { to: 2021 }],
  ['Škoda', 'Superb', 1, 2019, undefined, { to: 2023 }],
  ['Škoda', 'Scala', 0, 2019, undefined, { to: 2024 }],
  ['Seat', 'Leon', 0, 2020, undefined, { to: 2024 }],
  ['Seat', 'Ibiza', 0, 2017, undefined, { to: 2021 }],
  ['Seat', 'Arona', 0, 2017, undefined, { to: 2021 }],
  ['Opel', 'Astra', 1, 2019, 'K', { to: 2021 }],
  ['Opel', 'Corsa', 0, 2019, 'F', { to: 2023 }],
  ['Opel', 'Mokka', 1, 2016, 'X', { to: 2019 }],
  ['Opel', 'Vivaro', 0, 2014, 'B', { to: 2019 }],
  ['Opel', 'Combo', 0, 2018, 'E', { to: null }],
  ['Renault', 'Captur', 0, 2019, undefined, { to: 2024 }],
  ['Renault', 'Arkana', 0, 2019, undefined, { to: null }],
  ['Dacia', 'Duster', 0, 2017, undefined, { to: 2021 }],
  ['Peugeot', '208', 0, 2019, undefined, { to: 2023 }],
  ['Peugeot', '208', 0, 2012, undefined, { gen: null }],
  ['Peugeot', '2008', 0, 2019, undefined, { to: 2023 }],
  ['Peugeot', '308', 1, 2017, 'T9', { to: 2021 }],
  ['Peugeot', '3008', 1, 2020, undefined, { to: 2023 }],
  ['Peugeot', '5008', 0, 2017, undefined, { to: 2020 }],
  ['Peugeot', '508', 0, 2018, undefined, { to: 2023 }],
  ['Citroën', 'C3', 0, 2016, undefined, { to: 2020 }],
  ['Citroën', 'C3 AirCross', 0, 2017, undefined, { to: 2021 }],
  ['Citroën', 'C5 AirCross', 0, 2017, undefined, { to: 2022 }],
  ['Citroën', 'Berlingo', 0, 2018, undefined, { to: null }],
  ['Ford', 'Fiesta', 0, 2017, undefined, { to: 2022 }],
  ['Ford', 'Focus', 0, 2018, '4', { to: 2022 }],
  ['Ford', 'Kuga', 0, 2019, undefined, { to: 2024 }],
  ['Ford', 'Puma', 0, 2019, undefined, { to: 2024 }],
  ['Ford', 'Mustang Mach-E', 0, 2020, undefined, { to: null }],
  ['Fiat', 'Punto', 0, 2012, 'Punto', { gen: null }],
  ['Toyota', 'Yaris Cross', 0, 2020, 'XP210', { to: 2024 }],
  ['Toyota', 'Corolla', 0, 2019, 'E210', { to: 2022 }],
  ['Toyota', 'RAV4', 0, 2018, 'XA50', { to: 2025 }],
  ['Toyota', 'Land Cruiser Prado', 1, 2020, '150 Series', { to: 2024 }],
  ['Toyota', 'CHR C-HR', 1, 2019, undefined, { to: 2023 }],
  ['Hyundai', 'Tucson', 0, 2020, undefined, { to: 2024, gen: 'NX4' }],
  ['Hyundai', 'Kona', 0, 2017, undefined, { to: 2020 }],
  ['Kia', 'Ceed', 0, 2018, undefined, { to: 2021 }],
  ['Kia', 'Sorento', 0, 2020, undefined, { to: 2024 }],
  ['Nissan', 'Juke', 0, 2019, undefined, { to: 2024, gen: 'F16' }],
  ['Nissan', 'X-Trail', 1, 2017, 'T32', { to: 2021 }],
  ['Mazda', 'CX-5', 0, 2017, undefined, { to: 2021, gen: 'KF' }],
  ['Mazda', '3', 0, 2019, 'BP', { to: null }],
  ['Mazda', 'CX-30', 0, 2019, undefined, { to: null }],
  ['Volvo', 'XC40', 0, 2017, undefined, { to: 2022 }],
  ['Volvo', 'XC60', 0, 2017, undefined, { to: 2021 }],
  ['Volvo', 'XC90', 1, 2019, undefined, { to: 2024 }],
  ['Suzuki', 'Swift', 0, 2016, undefined, { to: 2024 }],
  ['Suzuki', 'Ertiga', 1, 2019, undefined, { to: null }],
  ['MINI', 'Cooper', 0, 2013, 'F56', { to: 2021 }],
  ['MINI', 'Countryman', 1, 2020, undefined, { to: 2024, gen: 'F60' }],
  ['Land Rover', 'Defender', 0, 2019, undefined, { to: null, gen: 'L663' }],
  ['Land Rover', 'Range Rover', 1, 2017, undefined, { to: 2022 }],
  ['Land Rover', 'Range Rover Sport', 1, 2017, undefined, { to: 2022 }],
  ['Land Rover', 'Range Rover Evoque', 0, 2018, 'L551', { to: 2023 }],
  ['Jeep', 'Compass', 0, 2017, undefined, { to: 2021 }],
  ['Tesla', 'Model 3', 0, 2017, undefined, { to: 2023 }],
  ['Tesla', 'Cybertruck', 0, 2021, undefined, { from: 2023, to: null }],
];

// nelogični unosi (verzija motora/karoserije upisana kao generacija) — sakrivaju se, oglasi prelaze na pravu generaciju
// [marka, model, oznaka, od, -> prebaci na: {facelift, od}]
const HIDE = [
  ['BMW', '3', '330i', 2015, { fl: 1, from: 2015 }],
  ['Mercedes-Benz', 'E', 'E 220', 2019, { fl: 1, from: 2020 }],
  ['Volkswagen', 'Variant VII', 'TDI', 2014, null],
  ['Škoda', 'Octavia', 'COMBI', 2019, { fl: 0, from: 2020 }],
];

// pogrešno napisani nazivi
const RENAME = [['Volkswagen', 'Pasat', 'Passat'], ['Volkswagen', 'Pasat CC', 'Passat CC']];

export function runModelsUpdate(db) {
  const get = (sql, ...a) => db.prepare(sql).get(...a);
  const run = (sql, ...a) => db.prepare(sql).run(...a);
  const makeId = name => get('SELECT id FROM car_make WHERE name=?', name)?.id;
  const ym = (y, end) => (y == null ? null : `${y}-${end ? '12' : '01'}`);
  const find = (mk, name, fl, from, gen) => get(`SELECT * FROM car_model WHERE make_id=? AND name=? AND active=1
    AND restyling=? AND restyling_second=? AND substr(date_from,1,4)=? ${gen !== undefined ? 'AND COALESCE(generation_name,\'\')=?' : ''} LIMIT 1`,
  mk, name, fl >= 1 ? 1 : 0, fl >= 2 ? 1 : 0, String(from), ...(gen !== undefined ? [gen || ''] : []));
  const log = { added: 0, fixed: 0, hidden: 0, renamed: 0, missing: [] };
  db.exec('BEGIN');
  try {
    for (const [mk, from, to] of RENAME) {
      const id = makeId(mk);
      if (id) log.renamed += Number(run('UPDATE car_model SET name=? WHERE make_id=? AND name=?', to, id, from).changes);
    }
    for (const [mkName, name, fl, from, gen, ch] of FIX) {
      const mk = makeId(mkName); const m = mk && find(mk, name, fl, from, gen);
      if (!m) { log.missing.push(`fix ${mkName} ${name} ${from}`); continue; }
      const set = {};
      if ('to' in ch) set.date_to = ym(ch.to, true);
      if ('from' in ch) set.date_from = ym(ch.from);
      if ('gen' in ch) set.generation_name = ch.gen;
      run(`UPDATE car_model SET ${Object.keys(set).map(k => k + '=?').join(',')} WHERE id=?`, ...Object.values(set), m.id);
      log.fixed++;
    }
    for (const [mkName, name, gen, from, target] of HIDE) {
      const mk = makeId(mkName); const m = mk && get('SELECT * FROM car_model WHERE make_id=? AND name=? AND generation_name=? AND substr(date_from,1,4)=? AND active=1', mk, name, gen, String(from));
      if (!m) { log.missing.push(`hide ${mkName} ${name} ${gen}`); continue; }
      const t = target && find(mk, name, target.fl, target.from);
      if (t) for (const tb of ['parts', 'vehicles', 'requests']) run(`UPDATE ${tb} SET model_id=? WHERE model_id=?`, t.id, m.id);
      run('UPDATE car_model SET active=0, merged_into=? WHERE id=?', t ? t.id : null, m.id);
      log.hidden++;
    }
    for (const [mkName, name, gen, fl, from, to] of ADD) {
      const mk = makeId(mkName);
      if (!mk) { log.missing.push(`marka ${mkName}`); continue; }
      if (find(mk, name, fl, from)) continue; // već postoji
      run(`INSERT INTO car_model (id, make_id, name, generation_name, restyling, restyling_second, date_from, date_to, active)
        VALUES (?,?,?,?,?,?,?,?,1)`, crypto.randomUUID(), mk, name, gen, fl >= 1 ? 1 : 0, fl >= 2 ? 1 : 0, ym(from), ym(to, true));
      log.added++;
    }
    // marke koje su dobile modele, a bile su sakrivene (npr. Cupra)
    run('UPDATE car_make SET active=1 WHERE id IN (SELECT DISTINCT make_id FROM car_model WHERE active=1)');
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
  return log;
}
