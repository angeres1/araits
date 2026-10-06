import { $, h, svg, ICON, api, act, toast, S, saveSession, startLive, stopLive } from './core.js';
import { onQueue, flush, queued } from './queue.js';

const VIEWS = {
  home: { label: 'Inicio', icon: 'home', load: () => import('./views/home.js') },
  stock: { label: 'Stock', icon: 'stock', load: () => import('./views/stock.js') },
  pedidos: { label: 'Pedidos', icon: 'truck', load: () => import('./views/pedidos.js') },
  ingreso: { label: 'Ingresar', icon: 'box', load: () => import('./views/ingreso.js') },
  devolver: { label: 'Devolución', icon: 'ret', load: () => import('./views/devolver.js') },
  tipificar: { label: 'Tipificar', icon: 'tag', load: () => import('./views/tipificar.js') },
  alertas: { label: 'Alertas', icon: 'bell', load: () => import('./views/alertas.js') },
  reportes: { label: 'Reportes', icon: 'chart', load: () => import('./views/reportes.js') },
  admin: { label: 'Admin', icon: 'gear', load: () => import('./views/admin.js') },
};
const TABS = {
  admin: ['home', 'stock', 'pedidos', 'ingreso', 'devolver', 'tipificar', 'alertas', 'reportes', 'admin'],
  bodega: ['home', 'ingreso', 'stock'], alistamiento: ['home', 'stock', 'pedidos', 'reportes'], devoluciones: ['home', 'devolver', 'stock'],
  operador: ['home', 'tipificar', 'stock'], comercial: ['home', 'alertas', 'stock', 'reportes'],
};
const ROLE_LABEL = { admin: 'Administrador', bodega: 'Auxiliar de Bodega', alistamiento: 'Alistamiento', devoluciones: 'Analista de Devoluciones', operador: 'Operador de Bodega', comercial: 'Coordinador Comercial' };

let cleanup = null, current = null;
const root = $('#app');

S.onLogout = (expired) => { logout(); if (expired) toast('Sesión expirada. Ingresa de nuevo.', true); };
function logout() {
  if (S.session) fetch('/api/logout', { method: 'POST', headers: { Authorization: 'Bearer ' + S.session.token } }).catch(() => {});
  saveSession(null); stopLive(); cleanup?.(); cleanup = null; boot();
}

// ---------- auth screens ----------
function authShell(...kids) {
  root.className = 'plain'; root.replaceChildren(h('div', { class: 'auth' }, h('div', { class: 'brand', style: 'justify-content:center;margin-bottom:6px' }, logo(), 'Log_Proj'), ...kids));
}
const logo = () => svg('<rect width="24" height="24" rx="6" fill="currentColor" stroke="none" opacity=".15"/><path d="M5 8l7-3.5L19 8v8l-7 3.5L5 16zM5 8l7 3.5L19 8M12 11.5V19.5"/>');

async function loginScreen() {
  const users = await api('GET', '/users').catch(() => []);
  let chosen = null, pin = '';
  const dots = h('div', { class: 'dots' }), msg = h('p', { class: 'mut', style: 'text-align:center;min-height:24px' }, 'Elige tu usuario');
  const paint = () => dots.replaceChildren(...Array.from({ length: Math.max(6, pin.length) }, (_, i) => h('i', { class: i < pin.length ? 'f' : '' })));
  const submit = () => act(async () => {
    if (!chosen) return toast('Elige tu usuario', true);
    try { const r = await api('POST', '/login', { user_id: chosen, pin }); saveSession(r); boot(); }
    catch (e) { pin = ''; paint(); throw e; }
  });
  const key = (d) => { if (pin.length < 10) { pin += d; paint(); } };
  const userBtns = users.map((u) => h('button', { onclick: (e) => { chosen = u.id; userBtns.forEach((b) => b.classList.remove('sel')); e.currentTarget.classList.add('sel'); msg.textContent = 'Ingresa tu PIN'; } },
    h('span', { class: 'av' }, u.name[0]), h('span', {}, u.name.replace(/ \(.*\)/, '')), h('span', { class: 'mut small' }, ROLE_LABEL[u.role] || u.role)));
  const pad = h('div', { class: 'pad' }, ['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => h('button', { onclick: () => key(d) }, d)),
    h('button', { class: 'ghost', 'aria-label': 'Borrar', onclick: () => { pin = pin.slice(0, -1); paint(); } }, '⌫'), h('button', { onclick: () => key('0') }, '0'), h('button', { class: 'ok', onclick: submit }, 'Entrar'));
  document.onkeydown = (e) => { if (/^\d$/.test(e.key)) key(e.key); else if (e.key === 'Backspace') { pin = pin.slice(0, -1); paint(); } else if (e.key === 'Enter') submit(); };
  paint();
  authShell(h('div', { class: 'users' }, userBtns), msg, dots, pad);
}

function changePinScreen(forced) {
  const o = h('input', { type: 'password', inputmode: 'numeric', autocomplete: 'current-password', 'aria-label': 'PIN actual' });
  const n = h('input', { type: 'password', inputmode: 'numeric', autocomplete: 'new-password', 'aria-label': 'PIN nuevo', placeholder: '6 a 10 dígitos' });
  const save = () => act(async () => { await api('POST', '/pin', { old_pin: o.value, new_pin: n.value }); S.session.user.must_change_pin = false; saveSession(S.session); toast('PIN actualizado'); boot(); });
  authShell(h('div', { class: 'card' }, h('h2', {}, forced ? 'Cambia tu PIN' : 'Cambiar PIN'), forced && h('p', { class: 'mut' }, 'Por seguridad debes elegir un PIN personal (6 a 10 dígitos, sin repetidos ni consecutivos).'),
    h('label', {}, 'PIN actual'), o, h('label', {}, 'PIN nuevo'), n, h('p'), h('div', { class: 'row' }, h('button', { class: 'ok', onclick: save }, 'Guardar'), !forced && h('button', { class: 'ghost', onclick: boot }, 'Cancelar'), h('button', { class: 'ghost', onclick: logout }, 'Salir'))));
  document.onkeydown = null; o.focus();
}

// ---------- shell ----------
function shell() {
  const role = S.session.user.role, tabs = TABS[role];
  const net = h('div', { id: 'net', role: 'status' }, h('i'), h('span', {}, 'En línea'));
  const nav = h('nav', { id: 'nav', 'aria-label': 'Principal' }, tabs.map((t) => h('button', { 'data-t': t, onclick: () => go(t) }, svg(ICON[VIEWS[t].icon]), h('span', {}, VIEWS[t].label))));
  root.className = '';
  root.replaceChildren(
    h('header', { id: 'top' }, h('div', { class: 'brand' }, logo(), 'Log_Proj'), h('div', { id: 'spacer' }), net,
      h('div', { id: 'who' }, h('b', {}, S.session.user.name), ROLE_LABEL[role]),
      h('button', { class: 'ghost sm', onclick: () => changePinScreen(false) }, 'PIN'), h('button', { class: 'ghost sm', onclick: logout }, 'Salir')),
    nav, h('main', { id: 'view' }));
  const paintNet = () => { const q = queued().length, off = !navigator.onLine; net.className = off ? 'off' : q ? 'q' : ''; net.lastChild.textContent = off ? `Sin conexión${q ? ` · ${q} en cola` : ''}` : q ? `Sincronizando ${q}…` : 'En línea'; };
  onQueue(paintNet); addEventListener('online', async () => { paintNet(); const r = await flush(); if (r.length) toast(`Sincronizados ${r.filter((x) => x.ok).length} escaneos`); }); addEventListener('offline', paintNet);
  document.onkeydown = null;
}

export async function go(tab) {
  current = tab; cleanup?.(); cleanup = null;
  document.querySelectorAll('#nav button').forEach((b) => b.setAttribute('aria-current', b.dataset.t === tab ? 'page' : 'false'));
  const v = $('#view'); v.replaceChildren(h('p', { class: 'mut' }, 'Cargando…'));
  try {
    const mod = await VIEWS[tab].load();
    if (current !== tab) return;
    v.replaceChildren();
    cleanup = (await mod.render(v, { go, user: S.session.user })) || null;
  } catch (e) { v.replaceChildren(h('div', { class: 'card' }, h('p', {}, 'No se pudo cargar esta pantalla.'), h('p', { class: 'mut small' }, e.message))); }
  window.scrollTo(0, 0);
}

export function boot() {
  if (!S.session) return loginScreen();
  if (S.session.user.must_change_pin) return changePinScreen(true);
  shell(); startLive(); go(TABS[S.session.user.role][0]);
  flush();
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
boot();
