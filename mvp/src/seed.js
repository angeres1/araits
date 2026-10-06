import { openDb, tx } from './db.js';
import { hashPin } from './auth.js';
import { runAlerts } from './logic.js';

const db = openDb();
if (db.prepare('SELECT COUNT(*) AS n FROM users').get().n > 0 && !process.argv.includes('--force')) {
  console.log('DB ya tiene datos. Usa --force tras borrar data/app.db para re-sembrar.'); process.exit(0);
}
const iso = (daysAgo, h = 12) => { const d = new Date(Date.now() - daysAgo * 86400000); d.setUTCHours(h, 0, 0, 0); return d.toISOString(); };

tx(db, () => {
  const users = [['Admin', 'admin'], ['Marta (Bodega)', 'bodega'], ['Camilo (Alistamiento)', 'alistamiento'], ['Sofía (Devoluciones)', 'devoluciones'], ['Diego (Operador)', 'operador'], ['Laura (Comercial)', 'comercial']];
  users.forEach(([name, role], i) => { const { salt, hash } = hashPin('1234'); db.prepare('INSERT INTO users (name, role, pin_hash, pin_salt) VALUES (?,?,?,?)').run(name, role, hash, salt); });

  const prods = [['Audífonos BT i12', '7701000000011', 120], ['Smartwatch D20', '7701000000028', 45], ['Cargador 20W', '7701000000035', 8], ['Lámpara LED Aro', '7701000000042', 0], ['Mouse Gamer RGB', '7701000000059', 60], ['Teclado Mecánico', '7701000000066', 25]];
  prods.forEach(([n, b, s], i) => db.prepare('INSERT INTO products (sku, barcode, name, stock, source) VALUES (?,?,?,?,?)').run(`SKU-${100 + i}`, b, n, s, 'dropi'));
  db.prepare("INSERT INTO products (sku, barcode, name, stock, source) VALUES ('MAN-DEMO', NULL, 'Organizador Importado (sin código)', 15, 'manual')").run();

  const drops = [['TiendaNova', '573001112233', 40], ['ElectroFlash', '573004445566', 25], ['HogarSmart', '573007778899', 15]];
  drops.forEach(([n, p]) => db.prepare('INSERT INTO dropshippers (name, phone) VALUES (?,?)').run(n, p));

  // 21 days of history. TiendaNova collapses yesterday (40/day -> 4) to demo FR-7.
  const ins = db.prepare('INSERT INTO orders (dropshipper_id, product_id, qty, channel, status, guia_despacho, created_at, shipped_at) VALUES (?,?,?,?,?,?,?,?)');
  let g = 1000;
  for (let d = 21; d >= 1; d--) {
    drops.forEach(([, , base], di) => {
      const n = di === 0 && d === 1 ? 4 : base;
      for (let k = 0; k < n; k++) {
        const status = d > 2 ? 'despachado' : 'despachado';
        ins.run(di + 1, 1 + ((k + d) % 6), 1, k % 3 ? 'dropi' : 'mercadolibre', status, `GD-${++g}`, iso(d, 8 + (k % 10)), iso(d, 18));
      }
    });
  }
  // Today's open orders (reserve stock).
  for (let k = 0; k < 6; k++) ins.run(1 + (k % 3), 1 + (k % 6), 1, k % 2 ? 'dropi' : 'mercadolibre', 'pendiente', null, new Date().toISOString(), null);
});
console.log('Sembrado:', runAlerts(db), '| usuarios PIN 1234 | guías de ejemplo: GD-1001..');
