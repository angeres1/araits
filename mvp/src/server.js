import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EventEmitter } from 'node:events';
import { openDb } from './db.js';
import * as L from './logic.js';
import { login, userFromToken, publicUsers, can } from './auth.js';
import { syncOrders, mode } from './adapters.js';

const PUBLIC = join(fileURLToPath(import.meta.url), '../../public');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };

export function createApp(db = openDb()) {
  const bus = new EventEmitter();
  bus.setMaxListeners(200);

  // [method, regex, permission|null(public)|'auth', handler(ctx)]
  const routes = [];
  const r = (method, path, perm, fn) => routes.push([method, new RegExp(`^${path.replace(/:(\w+)/g, '(?<$1>[^/]+)')}$`), perm, fn]);

  r('GET', '/api/users', null, () => publicUsers(db));
  r('POST', '/api/login', null, ({ body }) => login(db, body));
  r('GET', '/api/me', 'auth', ({ user }) => ({ ...user, channels: mode() }));

  r('GET', '/api/inventario/stock', 'stock', ({ query }) => L.listStock(db, query.get('q') || ''));
  r('GET', '/api/productos', 'stock', ({ query }) => L.searchProducts(db, query.get('q') || ''));
  r('POST', '/api/inventario/ingesta', 'ingreso', ({ user }) => L.openIngesta(db, user.id));
  r('POST', '/api/inventario/scan', 'ingreso', ({ body, user }) => L.scan(db, body, user.id, bus));
  r('POST', '/api/inventario/manual', 'ingreso', ({ body, user }) => L.manualIngreso(db, body, user.id, bus));
  r('POST', '/api/inventario/ingesta/:id/cerrar', 'ingreso', ({ params }) => L.closeIngesta(db, Number(params.id)));

  r('GET', '/api/pedidos', 'pedidos', ({ query }) => L.listOrders(db, query.get('status') || 'pendiente'));
  r('POST', '/api/pedidos/:id/despachar', 'pedidos', ({ params }) => L.dispatchOrder(db, Number(params.id), bus));
  r('POST', '/api/sync', 'admin', () => syncOrders(db, bus));

  r('GET', '/api/devoluciones', 'devoluciones_ver', ({ query }) => L.listReturns(db, query.get('status') || 'abierta'));
  r('GET', '/api/devoluciones/:id', 'devoluciones_ver', ({ params }) => L.getReturn(db, Number(params.id)));
  r('POST', '/api/devoluciones/vincular', 'vincular', ({ body, user }) => L.vincular(db, body, user.id));
  r('POST', '/api/devoluciones/sin-detalle', 'vincular', ({ body, user }) => L.sinDetalle(db, body, user.id));
  r('GET', '/api/devoluciones/:id/candidatos', 'vincular', ({ params, query }) => L.candidatos(db, Number(params.id), query.get('q') || ''));
  r('POST', '/api/devoluciones/:id/asignar', 'vincular', ({ params, body }) => L.asignar(db, Number(params.id), Number(body.order_id)));
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
    try { return JSON.parse(Buffer.concat(chunks).toString()); } catch { throw new L.HttpError(400, 'json_invalido'); }
  }

  async function handleApi(req, res, url) {
    const token = (req.headers.authorization || '').replace(/^Bearer /, '') || url.searchParams.get('t');
    for (const [method, re, perm, fn] of routes) {
      const m = req.method === method && re.exec(url.pathname);
      if (!m) continue;
      let user = null;
      if (perm) {
        user = userFromToken(db, token);
        if (!user) throw new L.HttpError(401, 'no_autenticado');
        if (perm !== 'auth' && !(perm === 'admin' ? user.role === 'admin' : can(user, perm))) throw new L.HttpError(403, 'sin_permiso');
      }
      const body = ['POST', 'PATCH', 'PUT'].includes(method) ? await readBody(req) : {};
      return send(res, 200, await fn({ params: m.groups || {}, query: url.searchParams, body, user }));
    }
    if (url.pathname === '/api/events' && req.method === 'GET') {
      if (!userFromToken(db, token)) throw new L.HttpError(401, 'no_autenticado');
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      res.write('retry: 2000\n\n');
      const on = (d) => res.write(`event: stock\ndata: ${JSON.stringify(d)}\n\n`);
      bus.on('stock', on);
      const ka = setInterval(() => res.write(': ka\n\n'), 25000);
      req.on('close', () => { bus.off('stock', on); clearInterval(ka); });
      return;
    }
    throw new L.HttpError(404, 'no_encontrado');
  }

  const send = (res, status, data) => {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(data));
  };

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    try {
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
    const key = d.toISOString().slice(0, 10);
    if (d.getHours() >= 3 && last !== key) { last = key; console.log('[worker] alertas', L.runAlerts(db)); }
  }, 3600_000);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { server, db } = createApp();
  startWorker(db);
  const port = Number(process.env.PORT || 3000);
  server.listen(port, () => console.log(`Log_Proj MVP en http://localhost:${port}  (canales: ${mode()})`));
}
