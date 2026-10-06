// Shared helpers. User-provided text is always rendered via textContent (h() never uses innerHTML).
export const $ = (s, el = document) => el.querySelector(s);

export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (v !== false && v != null) el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
  return el;
}

export const svg = (inner, cls = '') => { const t = document.createElement('template'); t.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="${cls}">${inner}</svg>`; return t.content.firstChild; };
export const ICON = {
  home: '<path d="M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10"/>',
  box: '<path d="M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8"/>',
  stock: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16"/>',
  truck: '<path d="M2 6h12v10H2zM14 10h4l3 3v3h-7"/><circle cx="6" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
  ret: '<path d="M9 14l-5-5 5-5"/><path d="M4 9h11a5 5 0 010 10h-3"/>',
  tag: '<path d="M20 12l-8 8-9-9V3h8z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  bell: '<path d="M6 8a6 6 0 0112 0c0 7 3 8 3 8H3s3-1 3-8M10 20a2 2 0 004 0"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 00-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 00-2-1.2L14 3h-4l-.6 2.7a7 7 0 00-2 1.2l-2.3-1-2 3.4 2 1.5a7 7 0 000 2.4l-2 1.5 2 3.4 2.3-1a7 7 0 002 1.2L10 21h4l.6-2.7a7 7 0 002-1.2l2.3 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z"/>',
};

export function toast(msg, err = false) {
  const t = $('#toast'); t.textContent = msg; t.className = 'show' + (err ? ' err' : '');
  clearTimeout(toast.t); toast.t = setTimeout(() => (t.className = ''), 3000);
}

// ---------- session + api ----------
export const S = { session: JSON.parse(localStorage.getItem('session') || 'null'), onLogout: () => {} };
export const saveSession = (s) => { S.session = s; s ? localStorage.setItem('session', JSON.stringify(s)) : localStorage.removeItem('session'); };

export async function api(method, path, body) {
  let res;
  try {
    res = await fetch('/api' + path, { method, headers: { 'Content-Type': 'application/json', ...(S.session ? { Authorization: 'Bearer ' + S.session.token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  } catch { throw Object.assign(new Error('Sin conexión con el servidor'), { network: true }); }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && S.session && path !== '/login') { S.onLogout(true); throw Object.assign(new Error('Sesión expirada'), { status: 401 }); }
  if (!res.ok) throw Object.assign(new Error(data.message || data.error || 'Error'), { status: res.status, code: data.error });
  return data;
}
export const act = async (fn) => { try { return await fn(); } catch (e) { if (e.status !== 401) toast(e.message, true); } };

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36));
export const fmt = (n) => new Intl.NumberFormat('es-CO').format(n ?? 0);
export const debounce = (fn, ms = 250) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

// ---------- live updates (SSE) ----------
let es = null; const listeners = new Set();
export function live(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function startLive() {
  es?.close();
  if (!S.session) return;
  es = new EventSource('/api/events?t=' + S.session.token);
  es.addEventListener('stock', (e) => listeners.forEach((f) => f(e)));
}
export const stopLive = () => { es?.close(); es = null; };
