import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EventEmitter } from 'node:events';
import { openDb } from './db.js';
import * as L from './logic.js';
import { login, logout, userFromToken, publicUsers, can, changePin, listUsers, createUser, resetUserPin, setUserActive } from './auth.js';
import { syncOrders, mode, startStockPush } from './adapters.js';
import * as X from './extra.js';

const PUBLIC = join(fileURLToPath(import.meta.url), '../../public');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };

export function createApp(db = openDb()) {
  const bus = new EventEmitter();
  const sseCount = new Map();
  bus.setMaxListeners(200);

  // [method, regex, permission|null(public)|'auth', handler(ctx)]
  const routes = [];
  const r = (method, path, perm, fn) => routes.push([method, new RegExp(`^${path.replace(/:(\w+)/g, '(?<$1>[^/]+)')}$`), perm, fn]);

  r('GET', '/api/users', null, () => publicUsers(db));
  r('POST', '/api/login', null, ({ body, ip }) => login(db, body, ip));
  r('POST', '/api/logout', 'auth', ({ token }) => logout(db, token));
  r('GET', '/api/me', 'auth', ({ user }) => ({ ...user, must_change_pin: !!user.must_change_pin, channels: mode() }));
  r('POST', '/api/pin', 'auth', ({ user, token, body }) => changePin(db, user, token, body));
  r('GET', '/api/dashboard', 'dashboard', () => X.dashboard(db));
  r('GET', '/api/reportes/:kind', 'reportes', ({ params, query }) => ({ csv: X.reportCsv(db, params.kind, query) }));
  r('PATCH', '/api/productos/:id', 'admin', ({ params, body, user }) => { const r = X.updateProduct(db, Number(params.id), body); X.audit(db, user.id, 'producto.editar', params.id); return r; });
  r('POST', '/api/productos/import', 'admin', ({ body, user }) => { const r = X.importProducts(db, body.csv, user.id); X.audit(db, user.id, 'productos.importar', `${r.created} nuevos, ${r.updated} actualizados`); bus.emit('stock', {}); return r; });
  r('GET', '/api/admin/users', 'admin', () => listUsers(db));
  r('POST', '/api/admin/users', 'admin', ({ body, user }) => { const r = createUser(db, body); X.audit(db, user.id, 'usuario.crear', `${r.name}/${r.role}`); return r; });
  r('POST', '/api/admin/users/:id/reset-pin', 'admin', ({ params, user }) => { const r = resetUserPin(db, Number(params.id)); X.audit(db, user.id, 'usuario.reset_pin', params.id); return r; });
  r('PATCH', '/api/admin/users/:id', 'admin', ({ params, body, user }) => { const r = setUserActive(db, Number(params.id), !!body.active, user.id); X.audit(db, user.id, 'usuario.activo', `${params.id}=${body.active}`); return r; });
  r('GET', '/api/sync/log', 'admin', () => X.listSyncLog(db));

  r('GET', '/api/inventario/stock', 'stock', ({ query }) => L.listStock(db, { q: query.get('q') || '', estado: query.get('estado') || '', limit: query.get('limit'), offset: query.get('offset') }));
  r('GET', '/api/productos', 'stock', ({ query }) => L.searchProducts(db, query.get('q') || ''));
  r('POST', '/api/inventario/ingesta', 'ingreso', ({ user }) => L.openIngesta(db, user));
  r('POST', '/api/inventario/scan', 'ingreso', ({ body, user }) => L.scan(db, body, user, bus));
  r('POST', '/api/inventario/manual', 'ingreso', ({ body, user }) => L.manualIngreso(db, body, user, bus));
  r('POST', '/api/inventario/ingesta/cerrar', 'ingreso', ({ body, user }) => L.closeIngesta(db, body, user));
  r('POST', '/api/inventario/ingesta/:id/cerrar', 'ingreso', ({ params, user }) => L.closeIngesta(db, { ingesta_id: Number(params.id) }, user));

  r('GET', '/api/pedidos', 'pedidos', ({ query }) => L.listOrders(db, query.get('status') || 'pendiente'));
  r('POST', '/api/pedidos/:id/despachar', 'pedidos', ({ params }) => L.dispatchOrder(db, Number(params.id), bus));
  r('POST', '/api/pedidos/:id/cancelar', 'pedidos', ({ params }) => L.cancelOrder(db, Number(params.id), bus));
  r('POST', '/api/sync', 'admin', () => syncOrders(db, bus));

  r('GET', '/api/devoluciones', 'devoluciones_ver', ({ query }) => L.listReturns(db, query.get('status') || 'abierta'));
  r('GET', '/api/devoluciones/pendientes', 'devoluciones_ver', () => L.pendingUnits(db));
  r('GET', '/api/devoluciones/:id', 'devoluciones_ver', ({ params }) => L.getReturn(db, Number(params.id)));
  r('POST', '/api/devoluciones/vincular', 'vincular', ({ body, user }) => L.vincular(db, body, user.id));
  r('POST', '/api/devoluciones/sin-detalle', 'vincular', ({ body, user }) => L.sinDetalle(db, body, user.id));
  r('GET', '/api/devoluciones/:id/candidatos', 'vincular', ({ params, query }) => L.candidatos(db, Number(params.id), query.get('q') || ''));
  r('POST', '/api/devoluciones/:id/asignar', 'vincular', ({ params, body }) => L.asignar(db, Number(params.id), Number(body.order_id), body.qty ?? 1));
  r('POST', '/api/devoluciones/:id/cerrar', 'vincular', ({ params }) => L.cerrarDevolucion(db, Number(params.id)));
  r('DELETE', '/api/devoluciones/unidades/:uid', 'vincular', ({ params }) => L.revertirAsignacion(db, Number(params.uid)));
  r('PATCH', '/api/devoluciones/tipificar', 'tipificar', ({ body, user }) => L.tipificar(db, body, user.id, bus));

  r('GET', '/api/alertas', 'crm', ({ query }) => L.listAlerts(db, query.get('status') || 'nueva'));
  r('POST', '/api/alertas/run', 'crm', ({ body }) => L.runAlerts(db, body?.day));
  r('POST', '/api/alertas/:id/atender', 'crm', ({ params }) => L.atenderAlerta(db, Number(params.id)));
  r('GET', '/api/dropshippers', 'crm', () => L.listDropshippers(db));
  r('GET', '/api/dropshippers/:id', 'crm', ({ params }) => L.dropshipperFicha(db, Number(params.id)));
  r('PATCH', '/api/dropshippers/:id', 'crm', ({ params, body }) => L.setUmbral(db, Number(params.id), body.umbral_pct));

  async function readBody(req) {
    const chunks = []; let size = 0;
    for await (const c of req) { size += c.length; if (size > 1_000_000) throw new L.HttpError(413, 'payload_grande'); chunks.push(c); }
    if (!chunks.length) return {};
    try { const b = JSON.parse(Buffer.concat(chunks).toString()); return b && typeof b === 'object' && !Array.isArray(b) ? b : {}; } catch { throw new L.HttpError(400, 'json_invalido'); }
  }

  async function handleApi(req, res, url) {
    // ?t= is only honoured for the SSE stream (EventSource cannot send headers).
    const token = (req.headers.authorization || '').replace(/^Bearer /, '') || (url.pathname === '/api/events' ? url.searchParams.get('t') : null);
    for (const [method, re, perm, fn] of routes) {
      const m = req.method === method && re.exec(url.pathname);
      if (!m) continue;
      let user = null;
      if (perm) {
        user = userFromToken(db, token);
        if (!user) throw new L.HttpError(401, 'no_autenticado');
        if (user.must_change_pin && !['/api/me', '/api/pin', '/api/logout'].includes(url.pathname)) throw new L.HttpError(403, 'cambiar_pin', 'Debes cambiar tu PIN antes de continuar.');
        if (perm !== 'auth' && !(perm === 'admin' ? user.role === 'admin' : can(user, perm))) throw new L.HttpError(403, 'sin_permiso');
      }
      const body = ['POST', 'PATCH', 'PUT'].includes(method) ? await readBody(req) : {};
      return send(res, 200, await fn({ params: m.groups || {}, query: url.searchParams, body, user, token, ip: req.socket.remoteAddress }));
    }
    if (url.pathname === '/api/events' && req.method === 'GET') {
      const su = userFromToken(db, token);
      if (!su) throw new L.HttpError(401, 'no_autenticado');
      if ((sseCount.get(su.id) || 0) >= 5) throw new L.HttpError(429, 'demasiadas_conexiones');
      sseCount.set(su.id, (sseCount.get(su.id) || 0) + 1);
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      res.write('retry: 2000\n\n');
      const on = (d) => res.write(`event: stock\ndata: ${JSON.stringify(d)}\n\n`);
      bus.on('stock', on);
      const ka = setInterval(() => { if (!userFromToken(db, token)) return res.end(); res.write(': ka\n\n'); }, 25000);
      req.on('close', () => { bus.off('stock', on); clearInterval(ka); sseCount.set(su.id, (sseCount.get(su.id) || 1) - 1); });
      return;
    }
    throw new L.HttpError(404, 'no_encontrado');
  }

  const send = (res, status, data) => {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(data));
  };

  const server = createServer(async (req, res) => {
    try {
      let url;
      try { url = new URL(req.url, 'http://x'); } catch { throw new L.HttpError(400, 'url_invalida'); }
      if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
      const rel = normalize(url.pathname === '/' ? '/index.html' : url.pathname).replace(/^(\.\.[/\\])+/, '');
      const file = join(PUBLIC, rel);
      if (!file.startsWith(PUBLIC)) throw new L.HttpError(403, 'prohibido');
      const buf = await readFile(file).catch(() => null);
      if (!buf) throw new L.HttpError(404, 'no_encontrado');
      res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' });
      res.end(buf);
    } catch (e) {
      if (e instanceof L.HttpError) return send(res, e.status, { error: e.code, message: e.message });
      if (String(e.message).includes('UNIQUE')) return send(res, 409, { error: 'duplicado', message: e.message });
      console.error(e);
      send(res, 500, { error: 'error_interno' });
    }
  });

  return { server, db, bus };
}

// Daily worker (FR-7): checks hourly, runs once per day at/after 03:00 local.
export function startWorker(db) {
  let last = '';
  return setInterval(() => {
    const d = new Date();
    const key = L.localDay(d);
    const local = new Date(d.getTime() + L.TZ_OFFSET_MIN * 60000);
    if (local.getUTCHours() >= 3 && last !== key) { last = key; console.log('[worker] alertas', L.runAlerts(db)); }
  }, 3600_000);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { server, db, bus } = createApp();
  process.on('unhandledRejection', (e) => console.error('[unhandledRejection]', e));
  process.on('uncaughtException', (e) => console.error('[uncaughtException]', e));
  startWorker(db);
  startStockPush(db, bus);
  const port = Number(process.env.PORT || 3000);
  server.listen(port, () => console.log(`Log_Proj MVP en http://localhost:${port}  (canales: ${mode()})`));
}
