import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openDb, tx } from '../src/db.js';
import { createApp } from '../src/server.js';
import { hashPin } from '../src/auth.js';

let app, base, tokens = {};
const call = async (method, path, role, body) => {
  const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(role ? { Authorization: 'Bearer ' + tokens[role] } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, body: await res.json() };
};

before(async () => {
  const db = openDb(':memory:');
  for (const role of ['admin', 'bodega', 'alistamiento', 'devoluciones', 'operador', 'comercial']) {
    const { salt, hash } = hashPin('1234');
    db.prepare('INSERT INTO users (name, role, pin_hash, pin_salt) VALUES (?,?,?,?)').run(role, role, hash, salt);
  }
  db.prepare("INSERT INTO products (sku, barcode, name, stock) VALUES ('A','111','Prod A',10)").run();
  db.prepare("INSERT INTO dropshippers (name, phone) VALUES ('D1','573000000000')").run();
  const o = db.prepare("INSERT INTO orders (dropshipper_id, product_id, qty, channel, status, guia_despacho, created_at) VALUES (1,1,1,'dropi',?,?,?)");
  o.run('despachado', 'GD-1', new Date().toISOString());
  o.run('despachado', 'GD-2', new Date().toISOString());
  o.run('despachado', 'GD-3', new Date().toISOString());
  app = createApp(db);
  await new Promise((r) => app.server.listen(0, r));
  base = `http://localhost:${app.server.address().port}`;
  for (const [i, role] of ['admin', 'bodega', 'alistamiento', 'devoluciones', 'operador', 'comercial'].entries()) {
    tokens[role] = (await call('POST', '/api/login', null, { user_id: i + 1, pin: '1234' })).body.token;
  }
});
after(() => app.server.close());

test('auth: bad pin rejected, no token rejected, wrong role forbidden', async () => {
  assert.equal((await call('POST', '/api/login', null, { user_id: 2, pin: '0000' })).status, 401);
  assert.equal((await call('GET', '/api/inventario/stock')).status, 401);
  assert.equal((await call('POST', '/api/inventario/ingesta', 'comercial')).status, 403);
});

test('FR-1 scan adds stock per scan; unknown barcode 404; closed ingesta rejected', async () => {
  const { body: { ingesta_id } } = await call('POST', '/api/inventario/ingesta', 'bodega');
  assert.equal((await call('POST', '/api/inventario/scan', 'bodega', { barcode: '111', ingesta_id })).status, 200);
  assert.equal((await call('POST', '/api/inventario/scan', 'bodega', { barcode: '111', qty: 10, ingesta_id })).status, 200);
  assert.equal((await call('POST', '/api/inventario/scan', 'bodega', { barcode: 'nope', ingesta_id })).status, 404);
  const stock = (await call('GET', '/api/inventario/stock?q=Prod', 'alistamiento')).body;
  assert.equal(stock[0].stock, 21);
  const closed = await call('POST', `/api/inventario/ingesta/${ingesta_id}/cerrar`, 'bodega');
  assert.equal(closed.body.unidades, 11);
  assert.equal((await call('POST', '/api/inventario/scan', 'bodega', { barcode: '111', ingesta_id })).status, 409);
});

test('FR-2 manual creates reference without barcode and is audited as manual', async () => {
  const { body: { ingesta_id } } = await call('POST', '/api/inventario/ingesta', 'bodega');
  const r = await call('POST', '/api/inventario/manual', 'bodega', { name: 'Importado X', qty: 5, ingesta_id });
  assert.equal(r.body.product.stock, 5);
  assert.equal((await call('POST', `/api/inventario/ingesta/${ingesta_id}/cerrar`, 'bodega')).body.manual, 5);
});

test('FR-3 reservations reduce available; dispatch needs physical stock; semaforo', async () => {
  app.db.prepare("INSERT INTO products (sku, barcode, name, stock, low_threshold) VALUES ('B','222','Prod B',3,5)").run();
  app.db.prepare("INSERT INTO orders (dropshipper_id, product_id, qty, channel, status, created_at) VALUES (1,3,2,'mercadolibre','pendiente',?)").run(new Date().toISOString());
  const b = (await call('GET', '/api/inventario/stock?q=Prod B', 'alistamiento')).body[0];
  assert.deepEqual([b.stock, b.reserved, b.available, b.semaforo], [3, 2, 1, 'amarillo']);
  const orders = (await call('GET', '/api/pedidos', 'alistamiento')).body;
  const d = await call('POST', `/api/pedidos/${orders[0].id}/despachar`, 'alistamiento');
  assert.equal(d.status, 200);
  assert.ok(d.body.guia_despacho);
  assert.equal((await call('POST', `/api/pedidos/${orders[0].id}/despachar`, 'alistamiento')).status, 409);
});

test('FR-4 + FR-5: link guides, tipificar restocks per rule, order -> devuelto', async () => {
  const v = await call('POST', '/api/devoluciones/vincular', 'devoluciones', { guia_retorno: 'RET-1', guia_origen: 'GD-1' });
  assert.equal(v.status, 200);
  assert.equal(v.body.units[0].match, 'guia');
  assert.equal((await call('POST', '/api/devoluciones/vincular', 'devoluciones', { guia_retorno: 'RET-9', guia_origen: 'NOEXISTE' })).status, 404);
  assert.equal((await call('POST', '/api/devoluciones/vincular', 'devoluciones', { guia_retorno: 'RET-2', guia_origen: 'GD-1' })).status, 409, 'order already returned');
  const before = app.db.prepare('SELECT stock FROM products WHERE id=1').get().stock;
  const t = await call('PATCH', '/api/devoluciones/tipificar', 'operador', { unit_id: v.body.units[0].id, causa: 'Rechazo Cliente' });
  assert.equal(t.body.reingresa_stock, true);
  assert.equal(app.db.prepare('SELECT stock FROM products WHERE id=1').get().stock, before + 1);
  assert.equal(app.db.prepare("SELECT status FROM orders WHERE guia_despacho='GD-1'").get().status, 'devuelto');
  assert.equal((await call('GET', `/api/devoluciones/${v.body.id}`, 'operador')).body.status, 'cerrada');
  assert.equal((await call('PATCH', '/api/devoluciones/tipificar', 'operador', { unit_id: v.body.units[0].id, causa: 'Rechazo Cliente' })).status, 409, 'no double restock');
  assert.equal((await call('PATCH', '/api/devoluciones/tipificar', 'operador', { unit_id: 1, causa: 'x' })).status, 400);
});

test('FR-5 non-restock cause leaves stock unchanged', async () => {
  const v = await call('POST', '/api/devoluciones/vincular', 'devoluciones', { guia_retorno: 'RET-3', guia_origen: 'GD-2' });
  const before = app.db.prepare('SELECT stock FROM products WHERE id=1').get().stock;
  const t = await call('PATCH', '/api/devoluciones/tipificar', 'operador', { unit_id: v.body.units[0].id, causa: 'Compra Falsa' });
  assert.equal(t.body.reingresa_stock, false);
  assert.equal(app.db.prepare('SELECT stock FROM products WHERE id=1').get().stock, before);
});

test('FR-6 sin detalle: candidates, manual assign, revert, tipificar', async () => {
  const s = await call('POST', '/api/devoluciones/sin-detalle', 'devoluciones', { guia_retorno: 'RET-BULTO' });
  const id = s.body.id;
  const c = await call('GET', `/api/devoluciones/${id}/candidatos?q=GD-3`, 'devoluciones');
  assert.equal(c.body.length, 1);
  const a = await call('POST', `/api/devoluciones/${id}/asignar`, 'devoluciones', { order_id: c.body[0].id });
  assert.equal(a.body.units[0].match, 'manual');
  const rv = await call('DELETE', `/api/devoluciones/unidades/${a.body.units[0].id}`, 'devoluciones');
  assert.equal(rv.body.units.length, 0);
  const a2 = await call('POST', `/api/devoluciones/${id}/asignar`, 'devoluciones', { order_id: c.body[0].id });
  await call('PATCH', '/api/devoluciones/tipificar', 'operador', { unit_id: a2.body.units[0].id, causa: 'Daño Transportadora' });
  assert.equal((await call('DELETE', `/api/devoluciones/unidades/${a2.body.units[0].id}`, 'devoluciones')).status, 409, 'cannot revert after tipificar');
  assert.equal((await call('POST', `/api/devoluciones/${id}/cerrar`, 'devoluciones')).body.status, 'cerrada');
});

test('FR-7/FR-8 alert on >=90% drop vs 7-day baseline; ficha; umbral; idempotent', async () => {
  const db = app.db;
  const ins = db.prepare("INSERT INTO orders (dropshipper_id, product_id, qty, channel, status, created_at) VALUES (1,1,1,'dropi','despachado',?)");
  const dayStr = (d) => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
  for (let d = 8; d >= 2; d--) for (let k = 0; k < 20; k++) ins.run(dayStr(d) + 'T10:00:00.000Z');
  ins.run(dayStr(1) + 'T10:00:00.000Z'); ins.run(dayStr(1) + 'T11:00:00.000Z');
  const run = await call('POST', '/api/alertas/run', 'comercial', {});
  assert.equal(run.body.created.length, 1);
  assert.equal((await call('POST', '/api/alertas/run', 'comercial', {})).body.created.length, 0);
  const al = (await call('GET', '/api/alertas', 'comercial')).body;
  assert.ok(al[0].drop_pct >= 90 && al[0].phone);
  assert.ok((await call('GET', `/api/dropshippers/${al[0].dropshipper_id}`, 'comercial')).body.history.length > 0);
  assert.equal((await call('PATCH', '/api/dropshippers/1', 'comercial', { umbral_pct: 150 })).status, 400);
  assert.equal((await call('POST', `/api/alertas/${al[0].id}/atender`, 'comercial')).body.status, 'atendida');
});

test('review fixes: partial return qty, bad URL does not crash, day validation, svg photo rejected, ?t only on events, logout', async () => {
  const db = app.db;
  db.prepare("INSERT INTO orders (dropshipper_id, product_id, qty, channel, status, guia_despacho, created_at) VALUES (1,1,2,'dropi','despachado','GD-Q2',?)").run(new Date().toISOString());
  const s = await call('POST', '/api/devoluciones/sin-detalle', 'devoluciones', { guia_retorno: 'RET-Q' });
  assert.equal((await call('POST', '/api/devoluciones/sin-detalle', 'devoluciones', { guia_retorno: 'RET-Q' })).body.id, s.body.id, 'reuses open bulto');
  assert.equal((await call('POST', `/api/devoluciones/${s.body.id}/cerrar`, 'devoluciones')).status, 409, 'empty bulto cannot close');
  const oid = db.prepare("SELECT id FROM orders WHERE guia_despacho='GD-Q2'").get().id;
  const a = await call('POST', `/api/devoluciones/${s.body.id}/asignar`, 'devoluciones', { order_id: oid });
  assert.equal(a.body.units[0].qty, 1);
  const stock0 = db.prepare('SELECT stock FROM products WHERE id=1').get().stock;
  await call('PATCH', '/api/devoluciones/tipificar', 'operador', { unit_id: a.body.units[0].id, causa: 'Retraso Bodega' });
  assert.equal(db.prepare('SELECT stock FROM products WHERE id=1').get().stock, stock0 + 1, 'only 1 of 2 units restocked');
  assert.equal(db.prepare('SELECT status FROM orders WHERE id=?').get(oid).status, 'despachado', 'not fully returned yet');
  assert.equal((await call('POST', `/api/devoluciones/${s.body.id}/asignar`, 'devoluciones', { order_id: oid, qty: 2 })).status, 409, 'over-return blocked');
  assert.equal((await call('POST', `/api/devoluciones/${s.body.id}/asignar`, 'devoluciones', { order_id: oid })).status, 200);

  assert.equal((await call('POST', '/api/alertas/run', 'comercial', { day: 'xx' })).status, 400);
  const { body: { ingesta_id } } = await call('POST', '/api/inventario/ingesta', 'bodega');
  assert.equal((await call('POST', '/api/inventario/manual', 'bodega', { name: 'S', qty: 1, ingesta_id, photo: 'data:image/svg+xml,<svg/>' })).status, 400);
  assert.equal((await call('POST', '/api/inventario/scan', 'bodega', { barcode: '111' })).status, 400, 'missing ingesta_id -> 400 not 500');

  const raw = await new Promise((resolve) => { import('node:net').then(({ createConnection }) => { const c = createConnection(app.server.address().port, 'localhost'); let d = ''; c.on('data', (x) => (d += x)); c.on('close', () => resolve(d)); c.write('GET http://[ HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n'); }); });
  assert.match(raw, /400/);
  assert.equal((await fetch(`${base}/api/inventario/stock?t=${tokens.bodega}`)).status, 401, '?t not accepted outside SSE');

  await call('POST', '/api/logout', 'comercial');
  assert.equal((await call('GET', '/api/alertas', 'comercial')).status, 401);
});

test('login throttled after repeated failures (per ip+user)', async () => {
  for (let i = 0; i < 6; i++) await call('POST', '/api/login', null, { user_id: 3, pin: 'bad' });
  const r = await call('POST', '/api/login', null, { user_id: 3, pin: '1234' });
  assert.equal(r.status, 429); // same ip is throttled (expected); other ips unaffected by design
});
