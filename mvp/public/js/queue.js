// Offline-capable scan queue. Every scan has a client_id so replays are idempotent server-side.
// Items: { client_id, kind:'scan'|'manual', body, label, status:'pending'|'rejected', error? }
import { api, toast } from './core.js';

const KEY = 'scanQueue';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
const save = (q) => { try { localStorage.setItem(KEY, JSON.stringify(q)); } catch { toast('Almacenamiento lleno: libera espacio', true); } emit(); };
const subs = new Set();
const emit = () => subs.forEach((f) => f(load()));
export const onQueue = (f) => { subs.add(f); f(load()); return () => subs.delete(f); };
export const queued = () => load().filter((i) => i.status === 'pending');
export const rejected = () => load().filter((i) => i.status === 'rejected');
export const push = (item) => { const q = load(); q.push({ ...item, status: 'pending' }); save(q); };
export const dismissRejected = (id) => save(load().filter((i) => i.client_id !== id));

let flushing = false;
// Returns array of results for items processed this pass. Stops at the first network error (keeps order).
export async function flush() {
  if (flushing) return [];
  flushing = true;
  const done = [];
  try {
    for (const item of load().filter((i) => i.status === 'pending')) {
      try {
        const r = await api('POST', item.kind === 'manual' ? '/inventario/manual' : '/inventario/scan', { ...item.body, client_id: item.client_id });
        save(load().filter((i) => i.client_id !== item.client_id));
        done.push({ item, ok: true, r });
      } catch (e) {
        if (e.network || e.status === 401 || e.status >= 500) break;
        save(load().map((i) => (i.client_id === item.client_id ? { ...i, status: 'rejected', error: e.message } : i)));
        done.push({ item, ok: false, error: e });
      }
    }
  } finally { flushing = false; }
  return done;
}
