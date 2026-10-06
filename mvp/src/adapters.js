// Channel adapters (Dropi / Mercado Libre). No API credentials exist yet, so these are MOCKS exposing the interface
// the real clients must implement:
//   fetchOrders(): [{ channel, external_id, dropshipper_id, product_id, qty, status }]   (inbound: new + cancelled)
//   pushStock(channel, product_id, available)                                              (outbound: stock levels)
// Swap by setting DROPI_API_KEY / ML_ACCESS_TOKEN and implementing the two functions in `live`.
import { tx } from './db.js';

export const mode = () => (process.env.DROPI_API_KEY || process.env.ML_ACCESS_TOKEN ? 'live-not-implemented' : 'mock');
const rnd = (n) => Math.floor(Math.random() * n);
const ext = () => Math.random().toString(36).slice(2, 10).toUpperCase();

const mock = {
  fetchOrders(db, n) {
    const products = db.prepare('SELECT id FROM products WHERE stock > 0').all();
    const drops = db.prepare('SELECT id FROM dropshippers').all();
    if (!products.length || !drops.length) return [];
    const fresh = Array.from({ length: n }, () => ({
      channel: Math.random() < 0.6 ? 'dropi' : 'mercadolibre', external_id: ext(),
      dropshipper_id: drops[rnd(drops.length)].id, product_id: products[rnd(products.length)].id, qty: 1 + rnd(2), status: 'pendiente',
    }));
    // The channel also reports a cancellation for one order that is still pending in our DB.
    const pend = db.prepare("SELECT channel, external_id FROM orders WHERE status='pendiente' AND external_id IS NOT NULL LIMIT 20").all();
    if (pend.length && Math.random() < 0.5) fresh.push({ ...pend[rnd(pend.length)], status: 'cancelado' });
    return fresh;
  },
  pushStock() { /* nothing to call; the log row is the evidence */ },
};

// Pulls new orders + cancellations. Idempotent per (channel, external_id). Pending orders reserve stock (see listStock).
export function syncOrders(db, bus, n = 5) {
  const incoming = mock.fetchOrders(db, n);
  let imported = 0, cancelled = 0;
  tx(db, () => {
    const ins = db.prepare("INSERT OR IGNORE INTO orders (dropshipper_id, product_id, qty, channel, status, external_id, created_at) VALUES (?,?,?,?, 'pendiente', ?, ?)");
    for (const o of incoming) {
      if (o.status === 'cancelado') {
        cancelled += Number(db.prepare("UPDATE orders SET status='cancelado' WHERE channel = ? AND external_id = ? AND status='pendiente'").run(o.channel, o.external_id).changes);
      } else imported += Number(ins.run(o.dropshipper_id, o.product_id, o.qty, o.channel, o.external_id, new Date().toISOString()).changes);
    }
  });
  db.prepare("INSERT INTO channel_sync_log (channel, direction, detail, mode, created_at) VALUES ('todos','in',?,?,?)")
    .run(`pedidos nuevos ${imported}, cancelados ${cancelled}`, mode(), new Date().toISOString());
  bus?.emit('stock', {});
  return { mode: mode(), imported, cancelled };
}

// Outbound stock push: batches product ids touched by stock events and records what would be sent to each channel (FR-3).
export function startStockPush(db, bus) {
  const dirty = new Set();
  bus.on('stock', (e) => { if (e?.product_id) dirty.add(e.product_id); });
  return setInterval(() => {
    if (!dirty.size) return;
    const ids = [...dirty]; dirty.clear();
    for (const id of ids) {
      const p = db.prepare(`SELECT stock - COALESCE((SELECT SUM(qty) FROM orders WHERE product_id = p.id AND status='pendiente'),0) AS available FROM products p WHERE id = ?`).get(id);
      if (!p) continue;
      for (const ch of ['dropi', 'mercadolibre']) {
        mock.pushStock(ch, id, p.available);
        db.prepare("INSERT INTO channel_sync_log (channel, direction, product_id, detail, mode, created_at) VALUES (?, 'out', ?, ?, ?, ?)")
          .run(ch, id, `disponible=${p.available}`, mode(), new Date().toISOString());
      }
    }
  }, 1000).unref();
}
