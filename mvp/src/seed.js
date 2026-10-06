// Demo data. `node src/seed.js --demo` keeps PIN 123456 without forcing a change; without --demo every user must change it on first login.
import { openDb, tx } from './db.js';
import { hashPin } from './auth.js';
import { runAlerts, CAUSAS } from './logic.js';

const demo = process.argv.includes('--demo');
const db = openDb();
if (db.prepare('SELECT COUNT(*) AS n FROM users').get().n > 0 && !process.argv.includes('--force')) {
  console.log('DB ya tiene datos. Borra data/app.db y usa --force para re-sembrar.'); process.exit(0);
}
const iso = (daysAgo, h = 12, m = 0) => { const d = new Date(Date.now() - daysAgo * 86400000); d.setUTCHours(h, m, 0, 0); return d.toISOString(); };
const pick = (a, i) => a[i % a.length];

tx(db, () => {
  const users = [['Admin', 'admin'], ['Marta (Bodega)', 'bodega'], ['Camilo (Alistamiento)', 'alistamiento'], ['Sofía (Devoluciones)', 'devoluciones'], ['Diego (Operador)', 'operador'], ['Laura (Comercial)', 'comercial']];
  for (const [name, role] of users) { const { salt, hash } = hashPin('123456'); db.prepare('INSERT INTO users (name, role, pin_hash, pin_salt, must_change_pin) VALUES (?,?,?,?,?)').run(name, role, hash, salt, demo ? 0 : 1); }

  const prods = [
    ['Audífonos BT i12', '7701000000011', 120, 20], ['Smartwatch D20', '7701000000028', 45, 10], ['Cargador 20W', '7701000000035', 8, 15], ['Lámpara LED Aro', '7701000000042', 0, 10],
    ['Mouse Gamer RGB', '7701000000059', 60, 15], ['Teclado Mecánico', '7701000000066', 25, 10], ['Power Bank 10000mAh', '7701000000073', 70, 15], ['Soporte Celular Auto', '7701000000080', 150, 25],
    ['Cámara Seguridad WiFi', '7701000000097', 18, 8], ['Parlante Bluetooth Mini', '7701000000103', 34, 10], ['Hub USB-C 7en1', '7701000000110', 12, 10], ['Ring Light 26cm', '7701000000127', 40, 10],
  ];
  prods.forEach(([n, b, s, low], i) => db.prepare('INSERT INTO products (sku, barcode, name, stock, low_threshold, source, location) VALUES (?,?,?,?,?,?,?)').run(`SKU-${100 + i}`, b, n, s, low, 'dropi', `A-${1 + (i % 4)}-${1 + (i % 6)}`));
  db.prepare("INSERT INTO products (sku, barcode, name, stock, source) VALUES ('MAN-DEMO', NULL, 'Organizador Importado (sin código)', 15, 'manual')").run();
  const NP = prods.length + 1;

  const drops = [['TiendaNova', '573001112233', 40, 'caida'], ['ElectroFlash', '573004445566', 25, 'estable'], ['HogarSmart', '573007778899', 15, 'estable'], ['GadgetZone', '573001230001', 30, 'baja'], ['MegaImport', '573009870002', 12, 'sube'], ['Casa24', '573005550003', 20, 'estable']];
  drops.forEach(([n, p]) => db.prepare('INSERT INTO dropshippers (name, phone) VALUES (?,?)').run(n, p));

  const ins = db.prepare('INSERT INTO orders (dropshipper_id, product_id, qty, channel, status, guia_despacho, external_id, created_at, shipped_at) VALUES (?,?,?,?,?,?,?,?,?)');
  const mov = db.prepare('INSERT INTO stock_movements (product_id, qty, type, via, ref, user_id, created_at) VALUES (?,?,?,?,?,?,?)');
  let g = 1000;
  const shipped = [];
  for (let d = 21; d >= 1; d--) {
    drops.forEach(([, , base, trend], di) => {
      let n = base;
      if (trend === 'caida' && d === 1) n = 4;                    // TiendaNova collapses yesterday (FR-7 demo)
      if (trend === 'baja') n = Math.round(base * (d <= 3 ? 0.55 : 1)); // 45% drop: below threshold, no alert
      if (trend === 'sube') n = Math.round(base * (1 + (21 - d) / 25));
      for (let k = 0; k < n; k++) {
        const pid = 1 + ((k * 7 + d + di) % NP), guia = `GD-${++g}`, ch = k % 3 ? 'dropi' : 'mercadolibre';
        const id = ins.run(di + 1, pid, 1, ch, 'despachado', guia, `H${g}`, iso(d, 8 + (k % 10), k % 60), iso(d, 18)).lastInsertRowid;
        mov.run(pid, -1, 'despacho', 'pedido', String(id), 3, iso(d, 18));
        shipped.push({ id: Number(id), pid, d });
      }
    });
    // inbound: a couple of ingestas per week
    if (d % 3 === 0) { const ing = db.prepare('INSERT INTO ingestas (user_id, opened_at, closed_at) VALUES (2,?,?)').run(iso(d, 14), iso(d, 15)).lastInsertRowid;
      for (let k = 0; k < 4; k++) db.prepare("INSERT INTO stock_movements (product_id, qty, type, via, ingesta_id, user_id, created_at) VALUES (?,?,?,?,?,2,?)").run(1 + ((k + d) % NP), 20 + k * 5, 'ingreso', k === 3 ? 'manual' : 'escaneo', ing, iso(d, 14, k)); }
  }
  // 45 historical returns: 12% sin detalle (manual), rest linked by guide; most already typed.
  const causas = Object.keys(CAUSAS);
  for (let i = 0; i < 45; i++) {
    const s = shipped[(i * 53) % shipped.length]; if (shipped.indexOf(s) < 0) continue;
    const sd = i % 8 === 0, d = Math.max(1, s.d - 1 - (i % 3));
    const o = db.prepare('SELECT * FROM orders WHERE id = ?').get(s.id);
    if (db.prepare('SELECT 1 FROM return_units WHERE order_id = ?').get(s.id)) continue;
    const r = db.prepare('INSERT INTO returns (guia_retorno, guia_origen, sin_detalle, status, user_id, created_at) VALUES (?,?,?,?,4,?)').run(`RT-${5000 + i}`, sd ? null : o.guia_despacho, sd ? 1 : 0, 'cerrada', iso(d, 10));
    const pending = i >= 41; // last few stay untyped for the operator screen
    const causa = pending ? null : pick(causas, i);
    db.prepare('INSERT INTO return_units (return_id, order_id, product_id, qty, match, causa, restocked, closed_at, created_at) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(r.lastInsertRowid, s.id, s.pid, 1, sd ? 'manual' : 'guia', causa, causa && CAUSAS[causa] ? 1 : 0, causa ? iso(d, 11) : null, iso(d, 10));
    if (pending) db.prepare("UPDATE returns SET status='abierta' WHERE id = ?").run(r.lastInsertRowid);
    if (causa) { db.prepare("UPDATE orders SET status='devuelto' WHERE id = ?").run(s.id); if (CAUSAS[causa]) mov.run(s.pid, 1, 'devolucion', 'devolucion', String(r.lastInsertRowid), 5, iso(d, 11)); }
  }
  // Open orders today (reserve stock).
  for (let k = 0; k < 8; k++) ins.run(1 + (k % 6), 1 + ((k * 5) % NP), 1 + (k % 2), k % 2 ? 'dropi' : 'mercadolibre', 'pendiente', null, `P${k}${Date.now()}`, new Date().toISOString(), null);
});
console.log('Sembrado:', runAlerts(db), demo ? '| DEMO: PIN 123456 para todos' : '| PIN inicial 123456, se exige cambio en el primer login');
