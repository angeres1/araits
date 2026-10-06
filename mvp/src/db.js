import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export function openDb(path = process.env.DB_PATH || 'data/app.db') {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  return db;
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
CREATE TABLE IF NOT EXISTS alerts (
  id INTEGER PRIMARY KEY, dropshipper_id INTEGER NOT NULL REFERENCES dropshippers(id), day TEXT NOT NULL,
  baseline REAL NOT NULL, volume INTEGER NOT NULL, drop_pct REAL NOT NULL, status TEXT NOT NULL DEFAULT 'nueva',
  created_at TEXT NOT NULL, UNIQUE(dropshipper_id, day)
);
`;
