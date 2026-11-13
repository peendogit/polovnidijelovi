-- polovnidijelovi.com — šema baze (SQLite)
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS car_make (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  popular INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS car_model (
  id TEXT PRIMARY KEY,
  make_id TEXT NOT NULL REFERENCES car_make(id),
  name TEXT NOT NULL,
  generation_name TEXT,
  restyling INTEGER DEFAULT 0,
  restyling_second INTEGER DEFAULT 0,
  date_from TEXT,            -- 'YYYY-MM'
  date_to TEXT,
  car2db_gen_id TEXT,
  car2db_model_id TEXT,
  active INTEGER DEFAULT 1
);
CREATE INDEX IF NOT EXISTS ix_model_make ON car_model(make_id, name);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL DEFAULT 'privatno',   -- 'privatno' | 'otpad'
  name TEXT NOT NULL,                      -- ime i prezime ili naziv otpada
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  phone TEXT,
  viber INTEGER DEFAULT 1,
  whatsapp INTEGER DEFAULT 0,
  city TEXT,
  address TEXT,
  about TEXT,
  logo TEXT,
  ships INTEGER DEFAULT 0,                 -- šalje brzom poštom
  pass_hash TEXT NOT NULL,
  verified INTEGER DEFAULT 0,              -- "Provjeren otpad"
  is_admin INTEGER DEFAULT 0,
  blocked INTEGER DEFAULT 0,
  api_key TEXT,
  seen_requests_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login TEXT
);

CREATE TABLE IF NOT EXISTS vehicles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  make_id TEXT REFERENCES car_make(id),
  model_id TEXT REFERENCES car_model(id),
  model_text TEXT,
  year INTEGER,
  fuel TEXT,
  engine TEXT,          -- npr. 1.6 TDI
  engine_code TEXT,
  power_kw INTEGER,
  gearbox TEXT,
  drive TEXT,              -- prednji | zadnji | 4x4
  body TEXT,
  color TEXT,
  color_code TEXT,
  mileage INTEGER,
  description TEXT,
  city TEXT,
  images TEXT DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'active',   -- active | done | hidden
  views INTEGER DEFAULT 0,
  ext_id TEXT,
  search TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS ix_veh_model ON vehicles(status, make_id, model_id);
CREATE INDEX IF NOT EXISTS ix_veh_user ON vehicles(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_veh_ext ON vehicles(user_id, ext_id) WHERE ext_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS parts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  make_id TEXT REFERENCES car_make(id),
  model_id TEXT REFERENCES car_model(id),
  model_text TEXT,
  year INTEGER,
  fuel TEXT,
  engine TEXT,
  part_no TEXT,          -- kataloški / OEM broj
  side TEXT,             -- lijevo / desno / prednje / zadnje
  color TEXT,
  color_code TEXT,
  condition TEXT DEFAULT 'polovno',  -- polovno | novo | oštećeno
  price REAL,
  negotiable INTEGER DEFAULT 0,
  description TEXT,
  city TEXT,
  images TEXT DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'active',   -- active | sold | hidden
  views INTEGER DEFAULT 0,
  ext_id TEXT,
  search TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS ix_parts_model ON parts(status, make_id, model_id);
CREATE INDEX IF NOT EXISTS ix_parts_user ON parts(user_id);
CREATE INDEX IF NOT EXISTS ix_parts_vehicle ON parts(vehicle_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_parts_ext ON parts(user_id, ext_id) WHERE ext_id IS NOT NULL;

-- "Tražim dio" — zahtjev kupca koji vide svi otpadi
CREATE TABLE IF NOT EXISTS requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  make_id TEXT REFERENCES car_make(id),
  model_id TEXT REFERENCES car_model(id),
  model_text TEXT,
  year INTEGER,
  engine TEXT,
  part TEXT NOT NULL,
  description TEXT,
  city TEXT,
  images TEXT DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'open',     -- open | closed
  search TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS ix_req_status ON requests(status, created_at);

CREATE TABLE IF NOT EXISTS offers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  price REAL,
  message TEXT,
  part_id INTEGER REFERENCES parts(id) ON DELETE SET NULL,
  seen INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(request_id, user_id)
);

-- Upiti ("Pitaj za dio", "Pitaj sve otpade", poruka prodavcu)
CREATE TABLE IF NOT EXISTS inquiries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  to_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  from_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  name TEXT,
  phone TEXT,
  vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE SET NULL,
  part_id INTEGER REFERENCES parts(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  seen INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS ix_inq_to ON inquiries(to_user_id, seen);

-- "Nema mog modela" — prijedlozi korisnika, admin odobrava
CREATE TABLE IF NOT EXISTS model_suggestions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  make_id TEXT,
  make_text TEXT,
  model_text TEXT NOT NULL,
  years TEXT,
  facelift INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'new',      -- new | done | rejected
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS favorites (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,       -- part | vehicle
  item_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, kind, item_id)
);

CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL, item_id INTEGER NOT NULL,
  user_id INTEGER, reason TEXT,
  status TEXT DEFAULT 'new',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
