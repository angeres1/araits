// Channel adapters (Dropi / Mercado Libre). No API credentials exist yet, so these are MOCKS that
// return deterministic-ish data through the same interface the real clients will implement.
// Swap by setting DROPI_API_KEY / ML_ACCESS_TOKEN and implementing fetchOrders/fetchCatalog below.
import { tx } from './db.js';

export const mode = () => (process.env.DROPI_API_KEY || process.env.ML_ACCESS_TOKEN ? 'live-not-implemented' : 'mock');

export function mockFetchOrders(db, n = 5) {
  const products = db.prepare('SELECT id FROM products WHERE stock > 0').all();
  const drops = db.prepare('SELECT id FROM dropshippers').all();
  if (!products.length || !drops.length) return [];
  return Array.from({ length: n }, () => ({
    dropshipper_id: drops[Math.floor(Math.random() * drops.length)].id,
    product_id: products[Math.floor(Math.random() * products.length)].id,
    qty: 1 + Math.floor(Math.random() * 2),
    channel: Math.random() < 0.6 ? 'dropi' : 'mercadolibre',
  }));
}

// Pulls new orders from channels and reserves stock (status 'pendiente' = reserved, see listStock).
export function syncOrders(db, bus, n = 5) {
  const incoming = mockFetchOrders(db, n);
  tx(db, () => {
    const ins = db.prepare("INSERT INTO orders (dropshipper_id, product_id, qty, channel, status, created_at) VALUES (?,?,?,?, 'pendiente', ?)");
    for (const o of incoming) ins.run(o.dropshipper_id, o.product_id, o.qty, o.channel, new Date().toISOString());
  });
  bus?.emit('stock', {});
  return { mode: mode(), imported: incoming.length };
}
