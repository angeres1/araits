import { tx } from './db.js';

export class HttpError extends Error {
  constructor(status, code, msg) { super(msg || code); this.status = status; this.code = code; }
}
const now = () => new Date().toISOString();
// Business timezone as fixed UTC offset in minutes (default Bogotá, UTC-5, no DST). Days are cut at LOCAL midnight.
export const TZ_OFFSET_MIN = Number(process.env.TZ_OFFSET_MIN ?? -300);
export const localDay = (d) => new Date(d.getTime() + TZ_OFFSET_MIN * 60000).toISOString().slice(0, 10);
const dayStart = (dayStr) => new Date(Date.parse(dayStr + 'T00:00:00Z') - TZ_OFFSET_MIN * 60000);
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

// FR-5 assumption: causa -> reingresa a stock (to validate with socios).
export const CAUSAS = { 'Compra Falsa': false, 'Rechazo Cliente': true, 'Retraso Bodega': true, 'Daño Transportadora': false };

const clean = (s, max = 200) => (typeof s === 'string' ? s.trim().slice(0, max) : '');
const posInt = (n, def = 1) => { const v = Number(n ?? def); if (!Number.isInteger(v) || v < 1 || v > 10000) throw new HttpError(400, 'cantidad_invalida'); return v; };

// ---------- Inventory (FR-1, FR-2, FR-3) ----------
const reservedSql = `COALESCE((SELECT SUM(qty) FROM orders o WHERE o.product_id = p.id AND o.status = 'pendiente'), 0)`;

export function semaforo(available, low) {
  if (available <= 0) return 'rojo';
  if (available <= low) return 'amarillo';
  return 'verde';
}

// Paged, urgency-first stock list. estado: rojo|amarillo|verde filters on available vs per-product threshold.
export function listStock(db, { q = '', estado = '', limit = 50, offset = 0 } = {}) {
  const like = `%${clean(q, 60)}%`;
  const lim = Math.min(Math.max(Number(limit) || 50, 1), 200), off = Math.max(Number(offset) || 0, 0);
  const est = ['rojo', 'amarillo', 'verde'].includes(estado) ? estado : '';
  const base = `WITH s AS (
      SELECT p.id, p.sku, p.barcode, p.name, p.photo IS NOT NULL AS has_photo, p.stock, p.low_threshold, p.source, p.location,
             ${reservedSql} AS reserved FROM products p WHERE (p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ?)),
    t AS (SELECT *, stock - reserved AS available,
             CASE WHEN stock - reserved <= 0 THEN 'rojo' WHEN stock - reserved <= low_threshold THEN 'amarillo' ELSE 'verde' END AS semaforo FROM s)`;
  const where = est ? 'WHERE semaforo = ?' : '';
  const args = est ? [like, like, like, est] : [like, like, like];
  const total = db.prepare(`${base} SELECT COUNT(*) AS n FROM t ${where}`).get(...args).n;
  const items = db.prepare(`${base} SELECT * FROM t ${where}
    ORDER BY CASE semaforo WHEN 'rojo' THEN 0 WHEN 'amarillo' THEN 1 ELSE 2 END, name LIMIT ? OFFSET ?`).all(...args, lim, off)
    .map((r) => ({ ...r, has_photo: !!r.has_photo }));
  return { items, total };
}

export function openIngesta(db, user) {
  const r = db.prepare('INSERT INTO ingestas (user_id, opened_at) VALUES (?, ?)').run(user.id, now());
  return { ingesta_id: Number(r.lastInsertRowid) };
}

// Accepts a numeric ingesta_id (online flow) or a client-generated ingesta_ref (offline-capable flow: created on first use).
function resolveIngesta(db, { ingesta_id, ingesta_ref }, user) {
  let ing;
  if (typeof ingesta_ref === 'string' && /^[\w-]{8,64}$/.test(ingesta_ref)) {
    ing = db.prepare('SELECT * FROM ingestas WHERE ref = ?').get(ingesta_ref);
    if (!ing) {
      const r = db.prepare('INSERT INTO ingestas (user_id, opened_at, ref) VALUES (?,?,?)').run(user.id, now(), ingesta_ref);
      ing = db.prepare('SELECT * FROM ingestas WHERE id = ?').get(r.lastInsertRowid);
    }
  } else if (Number.isInteger(ingesta_id)) {
    ing = db.prepare('SELECT * FROM ingestas WHERE id = ?').get(ingesta_id);
  } else throw new HttpError(400, 'ingesta_requerida');
  if (!ing) throw new HttpError(404, 'ingesta_no_existe');
  if (ing.user_id !== user.id && user.role !== 'admin') throw new HttpError(403, 'ingesta_ajena');
  if (ing.closed_at) throw new HttpError(409, 'ingesta_cerrada');
  return ing;
}

function addStock(db, product, qty, { via, ingestaId, userId, type = 'ingreso', ref = null, clientId = null }) {
  db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(qty, product.id);
  db.prepare('INSERT INTO stock_movements (product_id, qty, type, via, ref, ingesta_id, user_id, client_id, created_at) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(product.id, qty, type, via, ref, ingestaId ?? null, userId ?? null, clientId, now());
}

const cid = (v) => (typeof v === 'string' && /^[\w-]{8,64}$/.test(v) ? v : null);

// FR-1: commit per scan (not per batch) so a network drop loses nothing. client_id makes retries idempotent.
export function scan(db, body, user, bus) {
  const code = clean(body.barcode, 64);
  if (!code) throw new HttpError(400, 'codigo_requerido');
  const n = posInt(body.qty);
  const clientId = cid(body.client_id);
  return tx(db, () => {
    if (clientId && db.prepare('SELECT 1 FROM stock_movements WHERE client_id = ?').get(clientId)) return { reconocido: true, duplicate: true };
    const ing = resolveIngesta(db, body, user);
    const p = db.prepare('SELECT * FROM products WHERE barcode = ?').get(code);
    if (!p) throw new HttpError(404, 'producto_no_reconocido', 'Código no reconocido. Usa "Sin código de barras".');
    addStock(db, p, n, { via: 'escaneo', ingestaId: ing.id, userId: user.id, clientId });
    bus?.emit('stock', { product_id: p.id });
    return { reconocido: true, ingesta_id: ing.id, product: { id: p.id, name: p.name, stock: p.stock + n } };
  });
}

// FR-2: manual fallback; creates the reference on the spot if it doesn't exist.
export function manualIngreso(db, body, user, bus) {
  const { product_id, name, photo } = body;
  const n = posInt(body.qty);
  const clientId = cid(body.client_id);
  return tx(db, () => {
    if (clientId && db.prepare('SELECT 1 FROM stock_movements WHERE client_id = ?').get(clientId)) return { duplicate: true };
    const ing = resolveIngesta(db, body, user);
    let p;
    if (product_id) {
      p = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id);
      if (!p) throw new HttpError(404, 'producto_no_existe');
    } else {
      const nm = clean(name, 120);
      if (!nm) throw new HttpError(400, 'nombre_requerido');
      if (photo && (typeof photo !== 'string' || !/^data:image\/(jpeg|png|webp);base64,/.test(photo) || photo.length > 600_000)) throw new HttpError(400, 'foto_invalida');
      const sku = `MAN-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`.toUpperCase();
      // FR-2 references are created without barcode (FR-1 assumption): a misread code must not poison the catalog.
      const r = db.prepare('INSERT INTO products (sku, barcode, name, photo, stock, source) VALUES (?,?,?,?,0,?)')
        .run(sku, null, nm, photo || null, 'manual');
      p = db.prepare('SELECT * FROM products WHERE id = ?').get(r.lastInsertRowid);
    }
    addStock(db, p, n, { via: 'manual', ingestaId: ing.id, userId: user.id, clientId });
    bus?.emit('stock', { product_id: p.id });
    return { ingesta_id: ing.id, product: { id: p.id, name: p.name, stock: p.stock + n } };
  });
}

export function closeIngesta(db, body, user) {
  const ing = resolveIngesta(db, body, user);
  db.prepare('UPDATE ingestas SET closed_at = ? WHERE id = ?').run(now(), ing.id);
  const s = db.prepare(`SELECT COUNT(*) AS movimientos, COALESCE(SUM(qty),0) AS unidades,
    COALESCE(SUM(CASE WHEN via='manual' THEN qty END),0) AS manual FROM stock_movements WHERE ingesta_id = ?`).get(ing.id);
  return { ingesta_id: ing.id, ...s };
}

export function searchProducts(db, q) {
  const like = `%${clean(q, 60)}%`;
  return db.prepare('SELECT id, sku, barcode, name, stock FROM products WHERE name LIKE ? OR sku LIKE ? ORDER BY name LIMIT 20').all(like, like);
}

// ---------- Orders (FR-3 reservations) ----------
export function listOrders(db, status = 'pendiente') {
  return db.prepare(`SELECT o.id, o.qty, o.channel, o.status, o.guia_despacho, o.created_at, p.name AS product, p.id AS product_id, d.name AS dropshipper
    FROM orders o JOIN products p ON p.id = o.product_id JOIN dropshippers d ON d.id = o.dropshipper_id
    WHERE o.status = ? ORDER BY o.created_at DESC LIMIT 100`).all(clean(status, 20));
}

export function dispatchOrder(db, id, bus) {
  return tx(db, () => {
    const o = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
    if (!o) throw new HttpError(404, 'pedido_no_existe');
    if (o.status !== 'pendiente') throw new HttpError(409, 'pedido_no_pendiente');
    const p = db.prepare('SELECT * FROM products WHERE id = ?').get(o.product_id);
    if (p.stock < o.qty) throw new HttpError(409, 'stock_insuficiente', `Stock físico ${p.stock}, pedido ${o.qty}`);
    const guia = o.guia_despacho || `GD-${o.id}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?').run(o.qty, p.id);
    db.prepare("UPDATE orders SET status='despachado', guia_despacho=?, shipped_at=? WHERE id=?").run(guia, now(), id);
    db.prepare('INSERT INTO stock_movements (product_id, qty, type, via, ref, created_at) VALUES (?,?,?,?,?,?)')
      .run(p.id, -o.qty, 'despacho', 'pedido', String(id), now());
    bus?.emit('stock', { product_id: p.id });
    return { id, status: 'despachado', guia_despacho: guia };
  });
}

export function cancelOrder(db, id, bus) {
  const r = db.prepare("UPDATE orders SET status='cancelado' WHERE id = ? AND status='pendiente'").run(id);
  if (!r.changes) throw new HttpError(409, 'pedido_no_pendiente');
  bus?.emit('stock', {});
  return { id, status: 'cancelado' };
}

// ---------- Returns (FR-4, FR-5, FR-6) ----------
function unitsOf(db, returnId) {
  return db.prepare(`SELECT u.*, p.name AS product, d.name AS dropshipper, o.guia_despacho
    FROM return_units u JOIN orders o ON o.id = u.order_id JOIN products p ON p.id = u.product_id
    JOIN dropshippers d ON d.id = o.dropshipper_id WHERE u.return_id = ? ORDER BY u.id`).all(returnId);
}

export function getReturn(db, id) {
  const r = db.prepare('SELECT * FROM returns WHERE id = ?').get(id);
  if (!r) throw new HttpError(404, 'devolucion_no_existe');
  return { ...r, units: unitsOf(db, id) };
}

export function listReturns(db, status = 'abierta') {
  return db.prepare('SELECT * FROM returns WHERE status = ? ORDER BY created_at DESC LIMIT 100').all(clean(status, 20));
}

// qty = physical units coming back (FR-6 is one-by-one); never more than what was shipped minus what is already registered.
function addUnit(db, returnId, order, match, qty = order.qty) {
  if (!['despachado', 'devuelto'].includes(order.status)) throw new HttpError(409, 'pedido_no_despachado');
  const done = db.prepare('SELECT COALESCE(SUM(qty),0) AS n FROM return_units WHERE order_id = ?').get(order.id).n;
  if (done + qty > order.qty) throw new HttpError(409, 'pedido_ya_devuelto', 'Ese pedido ya tiene todas sus unidades devueltas.');
  const r = db.prepare('INSERT INTO return_units (return_id, order_id, product_id, qty, match, created_at) VALUES (?,?,?,?,?,?)')
    .run(returnId, order.id, order.product_id, qty, match, now());
  return Number(r.lastInsertRowid);
}

// FR-4: scan return guide (selected manually as "retorno") + original dispatch guide.
export function vincular(db, { guia_retorno, guia_origen }, userId) {
  const gr = clean(guia_retorno, 64), go = clean(guia_origen, 64);
  if (!gr || !go) throw new HttpError(400, 'guias_requeridas');
  if (gr === go) throw new HttpError(400, 'guias_iguales', 'La guía de retorno y la de despacho no pueden ser iguales.');
  return tx(db, () => {
    const order = db.prepare('SELECT * FROM orders WHERE guia_despacho = ?').get(go);
    if (!order) throw new HttpError(404, 'guia_origen_no_encontrada', 'No hay pedido con esa guía de despacho. Si el bulto no trae detalle, usa "Sin detalle".');
    const r = db.prepare('INSERT INTO returns (guia_retorno, guia_origen, sin_detalle, user_id, created_at) VALUES (?,?,0,?,?)').run(gr, go, userId, now());
    addUnit(db, r.lastInsertRowid, order, 'guia');
    return getReturn(db, Number(r.lastInsertRowid));
  });
}

export function sinDetalle(db, { guia_retorno }, userId) {
  const gr = clean(guia_retorno, 64);
  if (!gr) throw new HttpError(400, 'guia_requerida');
  const existing = db.prepare("SELECT id FROM returns WHERE guia_retorno = ? AND sin_detalle = 1 AND status = 'abierta'").get(gr);
  if (existing) return getReturn(db, existing.id);
  const r = db.prepare('INSERT INTO returns (guia_retorno, sin_detalle, user_id, created_at) VALUES (?,1,?,?)').run(gr, userId, now());
  return getReturn(db, Number(r.lastInsertRowid));
}

// FR-6 suggestions: shipped orders without a return yet, optionally filtered by text.
export function candidatos(db, returnId, q = '') {
  getReturn(db, returnId);
  const like = `%${clean(q, 60)}%`;
  return db.prepare(`SELECT o.id, o.guia_despacho, o.qty, o.shipped_at, p.name AS product, d.name AS dropshipper
    FROM orders o JOIN products p ON p.id = o.product_id JOIN dropshippers d ON d.id = o.dropshipper_id
    WHERE o.status = 'despachado' AND o.qty > (SELECT COALESCE(SUM(u.qty),0) FROM return_units u WHERE u.order_id = o.id)
      AND (p.name LIKE ? OR d.name LIKE ? OR o.guia_despacho LIKE ? OR CAST(o.id AS TEXT) = ?)
    ORDER BY o.shipped_at DESC LIMIT 25`).all(like, like, like, clean(q, 20));
}

export function asignar(db, returnId, orderId, qty = 1) {
  const n = posInt(qty);
  return tx(db, () => {
    const r = getReturn(db, returnId);
    if (!r.sin_detalle) throw new HttpError(409, 'devolucion_con_detalle');
    if (r.status !== 'abierta') throw new HttpError(409, 'devolucion_cerrada');
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!order) throw new HttpError(404, 'pedido_no_existe');
    addUnit(db, returnId, order, 'manual', n);
    return getReturn(db, returnId);
  });
}

export function revertirAsignacion(db, unitId) {
  return tx(db, () => {
    const u = db.prepare('SELECT * FROM return_units WHERE id = ?').get(unitId);
    if (!u) throw new HttpError(404, 'unidad_no_existe');
    if (u.match !== 'manual') throw new HttpError(409, 'solo_asignacion_manual');
    if (u.causa) throw new HttpError(409, 'unidad_ya_tipificada');
    db.prepare('DELETE FROM return_units WHERE id = ?').run(unitId);
    return getReturn(db, u.return_id);
  });
}

export function tipificar(db, { unit_id, causa }, userId, bus) {
  if (!(causa in CAUSAS)) throw new HttpError(400, 'causa_invalida');
  return tx(db, () => {
    const u = db.prepare('SELECT * FROM return_units WHERE id = ?').get(unit_id);
    if (!u) throw new HttpError(404, 'unidad_no_existe');
    if (u.causa) throw new HttpError(409, 'unidad_ya_tipificada');
    const reingresa = CAUSAS[causa];
    db.prepare('UPDATE return_units SET causa = ?, restocked = ?, closed_at = ? WHERE id = ?').run(causa, reingresa ? 1 : 0, now(), unit_id);
    const ord = db.prepare('SELECT qty FROM orders WHERE id = ?').get(u.order_id);
    const closedQty = db.prepare('SELECT COALESCE(SUM(qty),0) AS n FROM return_units WHERE order_id = ? AND causa IS NOT NULL').get(u.order_id).n;
    if (closedQty >= ord.qty) db.prepare("UPDATE orders SET status = 'devuelto' WHERE id = ?").run(u.order_id);
    if (reingresa) {
      const p = db.prepare('SELECT * FROM products WHERE id = ?').get(u.product_id);
      addStock(db, p, u.qty, { via: 'devolucion', userId, type: 'devolucion', ref: String(u.return_id) });
      bus?.emit('stock', { product_id: p.id });
    }
    const open = db.prepare('SELECT COUNT(*) AS n FROM return_units WHERE return_id = ? AND causa IS NULL').get(u.return_id).n;
    const pendingManual = db.prepare('SELECT sin_detalle FROM returns WHERE id = ?').get(u.return_id).sin_detalle;
    // A sin-detalle return stays open until the analyst closes it (more units may come from the same bulto).
    if (open === 0 && !pendingManual) db.prepare("UPDATE returns SET status='cerrada' WHERE id = ?").run(u.return_id);
    return { unit_id, causa, reingresa_stock: reingresa, return_id: u.return_id };
  });
}

export function cerrarDevolucion(db, id) {
  const r = getReturn(db, id);
  if (!r.units.length) throw new HttpError(409, 'sin_unidades', 'Asigna al menos una unidad antes de cerrar.');
  if (r.units.some((u) => !u.causa)) throw new HttpError(409, 'unidades_sin_tipificar');
  db.prepare("UPDATE returns SET status='cerrada' WHERE id = ?").run(id);
  return getReturn(db, id);
}

// ---------- CRM Light (FR-7, FR-8) ----------
// Volume of `target` day vs mean of the 7 days before it (zero days count). Alert if drop >= dropshipper's umbral_pct.
export function runAlerts(db, targetDay) {
  const target = targetDay || localDay(new Date(Date.now() - 86400000));
  if (!DAY_RE.test(target) || Number.isNaN(Date.parse(target))) throw new HttpError(400, 'dia_invalido');
  const iso = (d) => d.toISOString();
  const start = dayStart(target);
  const from = iso(new Date(start.getTime() - 7 * 86400000));
  const next = iso(new Date(start.getTime() + 86400000));
  const tStart = iso(start);
  const created = [];
  for (const d of db.prepare('SELECT * FROM dropshippers').all()) {
    const base = db.prepare('SELECT COUNT(*) AS n FROM orders WHERE dropshipper_id = ? AND created_at >= ? AND created_at < ?').get(d.id, from, tStart).n / 7;
    const vol = db.prepare('SELECT COUNT(*) AS n FROM orders WHERE dropshipper_id = ? AND created_at >= ? AND created_at < ?').get(d.id, tStart, next).n;
    if (base < 1) continue; // no meaningful baseline
    // Alert-fatigue guard (SM-C2): skip while an alert is open or one was raised in the last 3 days.
    const recent = db.prepare("SELECT 1 FROM alerts WHERE dropshipper_id = ? AND (status = 'nueva' OR day >= ?)").get(d.id, localDay(new Date(start.getTime() - 3 * 86400000)));
    if (recent) continue;
    const drop = Math.max(0, (1 - vol / base) * 100);
    if (drop >= d.umbral_pct) {
      const r = db.prepare('INSERT OR IGNORE INTO alerts (dropshipper_id, day, baseline, volume, drop_pct, created_at) VALUES (?,?,?,?,?,?)')
        .run(d.id, target, base, vol, drop, now());
      if (r.changes) created.push(Number(r.lastInsertRowid));
    }
  }
  return { day: target, created };
}

export function listAlerts(db, status = 'nueva') {
  return db.prepare(`SELECT a.*, d.name AS dropshipper, d.phone FROM alerts a JOIN dropshippers d ON d.id = a.dropshipper_id
    WHERE a.status = ? ORDER BY a.drop_pct DESC, a.day DESC LIMIT 100`).all(clean(status, 20));
}

export function atenderAlerta(db, id) {
  const r = db.prepare("UPDATE alerts SET status='atendida' WHERE id = ?").run(id);
  if (!r.changes) throw new HttpError(404, 'alerta_no_existe');
  return { id, status: 'atendida' };
}

export function dropshipperFicha(db, id) {
  const d = db.prepare('SELECT * FROM dropshippers WHERE id = ?').get(id);
  if (!d) throw new HttpError(404, 'dropshipper_no_existe');
  const history = db.prepare(`SELECT substr(datetime(created_at, '${TZ_OFFSET_MIN} minutes'),1,10) AS day, COUNT(*) AS pedidos FROM orders WHERE dropshipper_id = ?
    GROUP BY day ORDER BY day DESC LIMIT 30`).all(id).reverse();
  const totals = db.prepare("SELECT COUNT(*) AS pedidos, SUM(status='devuelto') AS devueltos FROM orders WHERE dropshipper_id = ?").get(id);
  return { ...d, history, totals };
}

export function setUmbral(db, id, pct) {
  const v = Number(pct);
  if (!(v > 0 && v <= 100)) throw new HttpError(400, 'umbral_invalido');
  const r = db.prepare('UPDATE dropshippers SET umbral_pct = ? WHERE id = ?').run(v, id);
  if (!r.changes) throw new HttpError(404, 'dropshipper_no_existe');
  return { id, umbral_pct: v };
}

export function listDropshippers(db) {
  return db.prepare('SELECT id, name, phone, umbral_pct FROM dropshippers ORDER BY name').all();
}

// Units waiting for tipificación across all open returns (single query for the operator screen).
export function pendingUnits(db) {
  return db.prepare(`SELECT u.id, u.return_id, u.qty, u.match, r.guia_retorno, r.sin_detalle, p.name AS product, d.name AS dropshipper, o.guia_despacho
    FROM return_units u JOIN returns r ON r.id = u.return_id JOIN orders o ON o.id = u.order_id
    JOIN products p ON p.id = u.product_id JOIN dropshippers d ON d.id = o.dropshipper_id
    WHERE u.causa IS NULL ORDER BY u.created_at LIMIT 100`).all();
}
