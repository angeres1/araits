import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export function openDb(path = process.env.DB_PATH || 'data/app.db') {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  migrate(db);
  return db;
}

function ensureColumn(db, table, col, ddl) {
  if (!db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${ddl}`);
}

// Lightweight forward migrations for DBs created by earlier versions.
function migrate(db) {
  ensureColumn(db, 'users', 'must_change_pin', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(db, 'users', 'active', 'INTEGER NOT NULL DEFAULT 1');
  ensureColumn(db, 'ingestas', 'ref', 'TEXT');
  ensureColumn(db, 'stock_movements', 'client_id', 'TEXT');
  ensureColumn(db, 'orders', 'external_id', 'TEXT');
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS ux_ingestas_ref ON ingestas(ref) WHERE ref IS NOT NULL;
           CREATE UNIQUE INDEX IF NOT EXISTS ux_mov_client ON stock_movements(client_id) WHERE client_id IS NOT NULL;
           CREATE UNIQUE INDEX IF NOT EXISTS ux_orders_ext ON orders(channel, external_id) WHERE external_id IS NOT NULL;
           CREATE INDEX IF NOT EXISTS idx_mov_created ON stock_movements(created_at);`);
}

// Run fn inside a transaction; rolls back on throw (FR-4/FR-6 integrity NFR).
export function tx(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const r = fn();
    db.exec('COMMIT');
    return r;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL, pin_hash TEXT NOT NULL, pin_salt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY, sku TEXT UNIQUE, barcode TEXT UNIQUE, name TEXT NOT NULL, photo TEXT,
  stock INTEGER NOT NULL DEFAULT 0, low_threshold INTEGER NOT NULL DEFAULT 10,
  location TEXT, source TEXT NOT NULL DEFAULT 'dropi'
);
CREATE TABLE IF NOT EXISTS ingestas (
  id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, opened_at TEXT NOT NULL, closed_at TEXT
);
CREATE TABLE IF NOT EXISTS stock_movements (
  id INTEGER PRIMARY KEY, product_id INTEGER NOT NULL REFERENCES products(id), qty INTEGER NOT NULL,
  type TEXT NOT NULL, via TEXT, ref TEXT, ingesta_id INTEGER, user_id INTEGER, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS dropshippers (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, phone TEXT, umbral_pct REAL NOT NULL DEFAULT 90
);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY, dropshipper_id INTEGER NOT NULL REFERENCES dropshippers(id),
  product_id INTEGER NOT NULL REFERENCES products(id), qty INTEGER NOT NULL DEFAULT 1,
  channel TEXT NOT NULL, status TEXT NOT NULL, guia_despacho TEXT, created_at TEXT NOT NULL, shipped_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_orders_drop_date ON orders(dropshipper_id, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_guia ON orders(guia_despacho);
CREATE TABLE IF NOT EXISTS returns (
  id INTEGER PRIMARY KEY, guia_retorno TEXT NOT NULL, guia_origen TEXT, sin_detalle INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'abierta', user_id INTEGER, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS return_units (
  id INTEGER PRIMARY KEY, return_id INTEGER NOT NULL REFERENCES returns(id), order_id INTEGER NOT NULL REFERENCES orders(id),
  product_id INTEGER NOT NULL, qty INTEGER NOT NULL DEFAULT 1, match TEXT NOT NULL,
  causa TEXT, restocked INTEGER NOT NULL DEFAULT 0, closed_at TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS channel_sync_log (
  id INTEGER PRIMARY KEY, channel TEXT NOT NULL, direction TEXT NOT NULL, product_id INTEGER, detail TEXT,
  mode TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY, user_id INTEGER, action TEXT NOT NULL, detail TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS alerts (
  id INTEGER PRIMARY KEY, dropshipper_id INTEGER NOT NULL REFERENCES dropshippers(id), day TEXT NOT NULL,
  baseline REAL NOT NULL, volume INTEGER NOT NULL, drop_pct REAL NOT NULL, status TEXT NOT NULL DEFAULT 'nueva',
  created_at TEXT NOT NULL, UNIQUE(dropshipper_id, day)
);
`;
