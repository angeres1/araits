// Dashboard KPIs, CSV reports, product admin and channel sync log.
import { HttpError, TZ_OFFSET_MIN, localDay, listStock } from './logic.js';
import { tx } from './db.js';

const off = `'${TZ_OFFSET_MIN} minutes'`;
const ldate = (col) => `substr(datetime(${col}, ${off}),1,10)`;

export function dashboard(db) {
  const stockCounts = { rojo: 0, amarillo: 0, verde: 0 };
  for (const k of Object.keys(stockCounts)) stockCounts[k] = listStock(db, { estado: k, limit: 1 }).total;
  const one = (sql, ...a) => db.prepare(sql).get(...a);
  const days = Array.from({ length: 14 }, (_, i) => localDay(new Date(Date.now() - (13 - i) * 86400000)));
  const since = new Date(Date.now() - 15 * 86400000).toISOString();
  const rows = db.prepare(`SELECT ${ldate('created_at')} AS day, type, SUM(ABS(qty)) AS n FROM stock_movements WHERE created_at >= ? GROUP BY day, type`).all(since);
  const series = days.map((d) => ({ day: d, ingreso: 0, despacho: 0, devolucion: 0 }));
  for (const r of rows) { const s = series.find((x) => x.day === r.day); if (s && r.type in s) s[r.type] = r.n; }

  const d30 = new Date(Date.now() - 30 * 86400000).toISOString();
  const ing = one("SELECT COALESCE(SUM(qty),0) AS tot, COALESCE(SUM(CASE WHEN via='manual' THEN qty END),0) AS man FROM stock_movements WHERE type='ingreso' AND created_at >= ?", d30);
  const ret = one('SELECT COUNT(*) AS tot, COALESCE(SUM(sin_detalle),0) AS sd FROM returns WHERE created_at >= ?', d30);
  const units = one("SELECT COUNT(*) AS tot, COALESCE(SUM(match='guia'),0) AS guia FROM return_units WHERE created_at >= ?", d30);
  const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : null);
  const w1 = new Date(Date.now() - 7 * 86400000).toISOString(), w2 = new Date(Date.now() - 14 * 86400000).toISOString();
  const drops = db.prepare(`SELECT d.id, d.name,
      SUM(o.created_at >= ?) AS semana, SUM(o.created_at < ? AND o.created_at >= ?) AS previa
    FROM dropshippers d LEFT JOIN orders o ON o.dropshipper_id = d.id AND o.created_at >= ? GROUP BY d.id ORDER BY semana DESC LIMIT 8`).all(w1, w1, w2, w2)
    .map((r) => ({ ...r, semana: r.semana || 0, previa: r.previa || 0 }));
  return {
    stock: stockCounts,
    pedidos_pendientes: one("SELECT COUNT(*) AS n FROM orders WHERE status='pendiente'").n,
    devoluciones_abiertas: one("SELECT COUNT(*) AS n FROM returns WHERE status='abierta'").n,
    unidades_por_tipificar: one('SELECT COUNT(*) AS n FROM return_units WHERE causa IS NULL').n,
    alertas_nuevas: one("SELECT COUNT(*) AS n FROM alerts WHERE status='nueva'").n,
    series,
    calidad: {
      ingreso_manual_pct: pct(ing.man, ing.tot),            // SM-C1
      devolucion_sin_detalle_pct: pct(ret.sd, ret.tot),     // SM-C1
      trazabilidad_por_guia_pct: pct(units.guia, units.tot), // SM-2 (certain vs probable)
    },
    dropshippers: drops,
  };
}

// CSV-injection safe: cells starting with = + - @ are prefixed so spreadsheets don't execute them.
const cell = (v) => { let s = v == null ? '' : String(v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const toCsv = (cols, rows) => [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\n') + '\n';

function range(q) {
  const f = q.get('from') || localDay(new Date(Date.now() - 30 * 86400000)), t = q.get('to') || localDay(new Date());
  const ok = (x) => /^\d{4}-\d{2}-\d{2}$/.test(x);
  if (!ok(f) || !ok(t)) throw new HttpError(400, 'rango_invalido');
  return [new Date(Date.parse(f + 'T00:00:00Z') - TZ_OFFSET_MIN * 60000).toISOString(), new Date(Date.parse(t + 'T00:00:00Z') + 86400000 - TZ_OFFSET_MIN * 60000).toISOString()];
}

export function reportCsv(db, kind, q) {
  const [from, to] = range(q);
  if (kind === 'movimientos') {
    const rows = db.prepare(`SELECT m.created_at AS fecha, p.sku, p.name AS producto, m.type AS tipo, m.via, m.qty AS cantidad, u.name AS usuario, m.ingesta_id, m.ref
      FROM stock_movements m JOIN products p ON p.id = m.product_id LEFT JOIN users u ON u.id = m.user_id
      WHERE m.created_at >= ? AND m.created_at < ? ORDER BY m.created_at`).all(from, to);
    return toCsv(['fecha', 'sku', 'producto', 'tipo', 'via', 'cantidad', 'usuario', 'ingesta_id', 'ref'], rows);
  }
  if (kind === 'devoluciones') {
    const rows = db.prepare(`SELECT r.created_at AS fecha, r.guia_retorno, o.guia_despacho, d.name AS dropshipper, p.name AS producto, u.qty AS cantidad,
        u.match AS vinculo, COALESCE(u.causa,'(pendiente)') AS causa, CASE u.restocked WHEN 1 THEN 'si' ELSE 'no' END AS reingreso, u.closed_at AS cerrada
      FROM return_units u JOIN returns r ON r.id = u.return_id JOIN orders o ON o.id = u.order_id JOIN products p ON p.id = u.product_id
      JOIN dropshippers d ON d.id = o.dropshipper_id WHERE r.created_at >= ? AND r.created_at < ? ORDER BY r.created_at`).all(from, to);
    return toCsv(['fecha', 'guia_retorno', 'guia_despacho', 'dropshipper', 'producto', 'cantidad', 'vinculo', 'causa', 'reingreso', 'cerrada'], rows);
  }
  throw new HttpError(404, 'reporte_no_existe');
}

// ---------- product admin ----------
export function updateProduct(db, id, body) {
  const p = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!p) throw new HttpError(404, 'producto_no_existe');
  const name = body.name != null ? String(body.name).trim().slice(0, 120) : p.name;
  const low = body.low_threshold != null ? Number(body.low_threshold) : p.low_threshold;
  const loc = body.location != null ? String(body.location).trim().slice(0, 40) || null : p.location;
  if (!name || !Number.isInteger(low) || low < 0 || low > 100000) throw new HttpError(400, 'datos_invalidos');
  db.prepare('UPDATE products SET name = ?, low_threshold = ?, location = ? WHERE id = ?').run(name, low, loc, id);
  return { id, name, low_threshold: low, location: loc };
}

// CSV import (simulates the Dropi catalog sync): sku,barcode,name[,stock,low_threshold]. Upsert by sku; stock only set for NEW rows.
export function importProducts(db, csv, userId) {
  if (typeof csv !== 'string' || csv.length > 500_000) throw new HttpError(400, 'csv_invalido');
  const lines = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const head = lines.shift()?.toLowerCase().split(',').map((x) => x.trim());
  if (!head || !['sku', 'name'].every((k) => head.includes(k))) throw new HttpError(400, 'cabecera_invalida', 'Cabecera mínima: sku,name (opcional barcode,stock,low_threshold)');
  const idx = (k) => head.indexOf(k);
  let created = 0, updated = 0; const errors = [];
  tx(db, () => {
    lines.forEach((line, i) => {
      const c = line.split(',').map((x) => x.trim());
      const sku = c[idx('sku')], name = c[idx('name')];
      const barcode = idx('barcode') >= 0 ? c[idx('barcode')] || null : null;
      const low = idx('low_threshold') >= 0 && c[idx('low_threshold')] ? Number(c[idx('low_threshold')]) : 10;
      const stock = idx('stock') >= 0 && c[idx('stock')] ? Number(c[idx('stock')]) : 0;
      if (!sku || !name || !Number.isInteger(low) || !Number.isInteger(stock) || stock < 0 || low < 0) { errors.push(`línea ${i + 2}: datos inválidos`); return; }
      const ex = db.prepare('SELECT id FROM products WHERE sku = ?').get(sku.slice(0, 40));
      try {
        if (ex) { db.prepare('UPDATE products SET name = ?, barcode = COALESCE(?, barcode), low_threshold = ? WHERE id = ?').run(name.slice(0, 120), barcode, low, ex.id); updated++; }
        else {
          const r = db.prepare("INSERT INTO products (sku, barcode, name, stock, low_threshold, source) VALUES (?,?,?,?,?, 'dropi')").run(sku.slice(0, 40), barcode, name.slice(0, 120), stock, low);
          if (stock > 0) db.prepare("INSERT INTO stock_movements (product_id, qty, type, via, user_id, created_at) VALUES (?,?, 'ajuste','importacion',?,?)").run(r.lastInsertRowid, stock, userId, new Date().toISOString());
          created++;
        }
      } catch (e) { errors.push(`línea ${i + 2}: ${String(e.message).includes('UNIQUE') ? 'código de barras duplicado' : 'error'}`); }
    });
  });
  return { created, updated, errors };
}

// ---------- channel sync log ----------
export function listSyncLog(db) {
  return db.prepare(`SELECT l.id, l.channel, l.direction, l.detail, l.mode, l.created_at, p.name AS product
    FROM channel_sync_log l LEFT JOIN products p ON p.id = l.product_id ORDER BY l.id DESC LIMIT 60`).all();
}

export const audit = (db, userId, action, detail) =>
  db.prepare('INSERT INTO audit_log (user_id, action, detail, created_at) VALUES (?,?,?,?)').run(userId ?? null, action, detail ? String(detail).slice(0, 300) : null, new Date().toISOString());
