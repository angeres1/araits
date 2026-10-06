// Log_Proj MVP — vanilla PWA. All user text is rendered with textContent (no innerHTML) to avoid XSS.
const $ = (s) => document.querySelector(s);
let session = JSON.parse(localStorage.getItem('session') || 'null');
let es = null;

const h = (tag, attrs = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (v !== false && v != null) el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
  return el;
};

function toast(msg, err = false) {
  const t = $('#toast'); t.textContent = msg; t.className = 'show' + (err ? ' err' : '');
  clearTimeout(toast.t); toast.t = setTimeout(() => (t.className = ''), 2600);
}

async function api(method, path, body) {
  const res = await fetch('/api' + path, { method, headers: { 'Content-Type': 'application/json', ...(session ? { Authorization: 'Bearer ' + session.token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && session) { logout(); throw Object.assign(new Error('Sesión expirada'), { status: 401 }); }
  if (!res.ok) throw Object.assign(new Error(data.message || data.error || 'Error'), { status: res.status, code: data.error });
  return data;
}
const act = async (fn) => { try { return await fn(); } catch (e) { toast(e.message, true); } };

// ---------- shell ----------
const TABS = {
  admin: ['tablero', 'pedidos', 'ingreso', 'devolver', 'tipificar', 'alertas'],
  bodega: ['ingreso', 'tablero'], alistamiento: ['tablero', 'pedidos'], devoluciones: ['devolver', 'tablero'],
  operador: ['tipificar', 'tablero'], comercial: ['alertas', 'tablero'],
};
const LABEL = { tablero: 'Stock', pedidos: 'Pedidos', ingreso: 'Ingresar Mercancía', devolver: 'Registrar Devolución', tipificar: 'Tipificar', alertas: 'Alertas' };
const VIEWS = {};
let current = null;

function logout() { localStorage.removeItem('session'); session = null; es?.close(); boot(); }

function go(tab) {
  current = tab;
  document.querySelectorAll('#nav button').forEach((b) => b.classList.toggle('on', b.dataset.t === tab));
  const v = $('#view'); v.replaceChildren();
  VIEWS[tab](v);
}

function liveStock(onChange) {
  es?.close();
  es = new EventSource('/api/events?t=' + session.token);
  es.addEventListener('stock', () => onChange());
}

function boot() {
  const top = $('#top'), v = $('#view');
  if (!session) { top.hidden = true; return loginView(v); }
  top.hidden = false;
  $('#who').textContent = session.user.name;
  const nav = $('#nav'); nav.replaceChildren(...TABS[session.user.role].map((t) => h('button', { 'data-t': t, onclick: () => go(t) }, LABEL[t])));
  go(TABS[session.user.role][0]);
}
$('#logout').onclick = logout;

async function loginView(v) {
  v.replaceChildren(h('h2', {}, 'Ingresar'));
  const users = await api('GET', '/users').catch(() => []);
  const sel = h('select', {}, users.map((u) => h('option', { value: u.id }, u.name)));
  const pin = h('input', { type: 'password', inputmode: 'numeric', placeholder: 'PIN', autocomplete: 'current-password' });
  const doLogin = () => act(async () => {
    session = await api('POST', '/login', { user_id: sel.value, pin: pin.value });
    localStorage.setItem('session', JSON.stringify(session)); boot();
  });
  pin.addEventListener('keydown', (e) => e.key === 'Enter' && doLogin());
  v.append(h('div', { class: 'card' }, h('label', {}, 'Usuario'), sel, h('label', {}, 'PIN'), pin, h('p', {}, h('button', { class: 'big ok', onclick: doLogin }, 'Entrar'))));
}

// ---------- scanner input: keeps focus, Enter submits (barcode guns type + Enter) ----------
function scanBox(placeholder, onScan) {
  const i = h('input', { placeholder, autocomplete: 'off', autocapitalize: 'off', inputmode: 'text', 'aria-label': placeholder });
  i.addEventListener('keydown', (e) => { if (e.key === 'Enter' && i.value.trim()) { const val = i.value.trim(); i.value = ''; onScan(val); } });
  setTimeout(() => i.focus(), 50);
  return i;
}

// ---------- FR-3 tablero ----------
VIEWS.tablero = (v) => {
  const list = h('div', { class: 'card' });
  const q = h('input', { placeholder: 'Buscar producto…', 'aria-label': 'Buscar producto' });
  const load = () => act(async () => {
    const rows = await api('GET', '/inventario/stock?q=' + encodeURIComponent(q.value));
    list.replaceChildren(...rows.map((p) => h('div', { class: 'item' },
      h('div', {}, h('strong', {}, p.name), h('div', { class: 'mut' }, `Físico ${p.stock} · Reservado ${p.reserved}`)),
      h('div', { class: 'row' }, h('span', { class: 'big-num' }, p.available), h('span', { class: 'pill ' + p.semaforo }, p.semaforo.toUpperCase())))));
    if (!rows.length) list.replaceChildren(h('p', { class: 'mut' }, 'Sin resultados'));
  });
  let t; q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(load, 200); });
  v.append(h('h2', {}, 'Stock disponible (en vivo)'), q, h('p'), list);
  liveStock(() => current === 'tablero' && load());
  load();
};

// ---------- FR-3 pedidos ----------
VIEWS.pedidos = (v) => {
  const list = h('div', { class: 'card' });
  const load = () => act(async () => {
    const rows = await api('GET', '/pedidos');
    list.replaceChildren(...rows.map((o) => h('div', { class: 'item' },
      h('div', {}, h('strong', {}, `${o.qty}× ${o.product}`), h('div', { class: 'mut' }, `${o.dropshipper} · ${o.channel}`)),
      h('button', { class: 'ok', onclick: () => act(async () => { const r = await api('POST', `/pedidos/${o.id}/despachar`); toast('Despachado · guía ' + r.guia_despacho); load(); }) }, 'Despachar'))));
    if (!rows.length) list.replaceChildren(h('p', { class: 'mut' }, 'Sin pedidos pendientes'));
  });
  const kids = [h('h2', {}, 'Pedidos pendientes')];
  if (session.user.role === 'admin') kids.push(h('button', { class: 'ghost', onclick: () => act(async () => { const r = await api('POST', '/sync'); toast(`Sync (${r.mode}): ${r.imported} pedidos`); load(); }) }, 'Sincronizar canales (mock)'), h('p'));
  v.append(...kids, list);
  liveStock(() => current === 'pedidos' && load());
  load();
};

// ---------- FR-1 / FR-2 ingreso ----------
VIEWS.ingreso = (v) => {
  let ingesta = null, mult = 1, total = 0, manualN = 0;
  const log = h('div', { class: 'card' }, h('p', { class: 'mut' }, 'Escanea un código para empezar.'));
  const status = h('div', { class: 'card', id: 'rec' }, h('div', { class: 'mut' }, 'Esperando escaneo…'));
  const counter = h('span', { class: 'big-num' }, '0');
  const m1 = h('button', { class: 'sel', onclick: () => setMult(1) }, '+1'), m10 = h('button', { class: 'ghost', onclick: () => setMult(10) }, '+10');
  const setMult = (n) => { mult = n; m1.className = n === 1 ? 'sel' : 'ghost'; m10.className = n === 10 ? 'sel' : 'ghost'; };
  const ensure = async () => ingesta ??= (await api('POST', '/inventario/ingesta')).ingesta_id;
  const addLog = (txt) => { if (log.firstChild?.className === 'mut') log.replaceChildren(); log.prepend(h('div', { class: 'item' }, txt)); };

  const onScan = (code) => act(async () => {
    const id = await ensure();
    try {
      const r = await api('POST', '/inventario/scan', { barcode: code, qty: mult, ingesta_id: id });
      total += mult; counter.textContent = total;
      status.replaceChildren(h('div', { class: 'row flash' }, h('span', { class: 'pill verde' }, 'PRODUCTO RECONOCIDO'), h('strong', {}, r.product.name), h('span', { class: 'mut' }, `stock ${r.product.stock}`)));
      addLog(`+${mult} ${r.product.name}`);
    } catch (e) {
      if (e.status === 404) { status.replaceChildren(h('div', { class: 'row' }, h('span', { class: 'pill rojo' }, 'NO RECONOCIDO'), h('span', {}, code), h('button', { class: 'warn', onclick: () => manual(code) }, 'Sin código de barras'))); }
      else throw e;
    }
  });
  const scan = scanBox('Escanea con la pistola…', onScan);

  const manualBox = h('div');
  const manual = (barcode) => {
    const q = h('input', { placeholder: 'Buscar o crear producto por nombre…' });
    const res = h('div'); const photo = h('input', { type: 'file', accept: 'image/*', capture: 'environment' });
    const qty = h('input', { type: 'number', min: 1, value: 1, 'aria-label': 'Cantidad' });
    const add = (body) => act(async () => {
      const id = await ensure();
      const r = await api('POST', '/inventario/manual', { ...body, qty: Number(qty.value), ingesta_id: id, barcode });
      total += Number(qty.value); manualN += Number(qty.value); counter.textContent = total; addLog(`+${qty.value} ${r.product.name} (manual)`);
      toast('Registrado'); manualBox.replaceChildren(); scan.focus();
    });
    const search = async () => { const rows = q.value.trim() ? await api('GET', '/productos?q=' + encodeURIComponent(q.value)) : []; res.replaceChildren(...rows.map((p) => h('button', { class: 'ghost', style: 'margin:4px', onclick: () => add({ product_id: p.id }) }, `${p.name} (${p.stock})`))); };
    let t; q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => act(search), 250); });
    const create = () => act(async () => {
      if (!q.value.trim()) throw new Error('Escribe el nombre');
      let img; if (photo.files[0]) img = await shrink(photo.files[0]);
      await add({ name: q.value, photo: img });
    });
    manualBox.replaceChildren(h('div', { class: 'card' }, h('h3', {}, 'Producto sin código de barras'), q, res, h('label', {}, 'Foto (opcional)'), photo, h('label', {}, 'Cantidad'), qty,
      h('p', {}, h('button', { class: 'ok', onclick: create }, 'Crear referencia y sumar'), ' ', h('button', { class: 'ghost', onclick: () => manualBox.replaceChildren() }, 'Cancelar'))));
    q.focus();
  };

  const save = () => act(async () => {
    if (!ingesta) throw new Error('No hay escaneos que guardar');
    const r = await api('POST', `/inventario/ingesta/${ingesta}/cerrar`);
    toast(`Ingesta #${r.ingesta_id} guardada: ${r.unidades} unidades`);
    v.replaceChildren(); VIEWS.ingreso(v);
  });
  v.append(h('h2', {}, 'Ingresar Mercancía'), h('div', { class: 'card' }, h('div', { class: 'row' }, scan, ), h('div', { class: 'row', style: 'margin-top:10px' }, m1, m10, h('span', { class: 'mut' }, 'Unidades en esta ingesta:'), counter)), status, h('button', { class: 'warn', onclick: () => manual('') }, 'Sin código de barras'), manualBox, h('h3', {}, 'Registro'), log,
    h('button', { class: 'big ok', onclick: save }, 'Guardar Ingesta'));
};

function shrink(file, max = 480) {
  return new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => { const s = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = img.width * s; c.height = img.height * s; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', 0.7)); };
    img.onerror = () => rej(new Error('Foto inválida')); img.src = url;
  });
}

// ---------- FR-4 / FR-6 devolución ----------
VIEWS.devolver = (v) => {
  const body = h('div');
  v.append(h('h2', {}, 'Registrar Devolución'), body);
  const step1 = () => {
    const sc = scanBox('1) Escanea la GUÍA DE RETORNO', (code) => step2(code));
    body.replaceChildren(h('div', { class: 'card' }, h('p', { class: 'mut' }, 'Estás registrando una guía de RETORNO (la nueva, de la transportadora).'), sc));
    // pending returns for follow-up
    act(async () => { const open = await api('GET', '/devoluciones?status=abierta'); const sd = open.filter((r) => r.sin_detalle); if (sd.length) body.append(h('div', { class: 'card' }, h('h3', {}, 'Bultos sin detalle abiertos'), sd.map((r) => h('div', { class: 'item' }, h('span', {}, r.guia_retorno), h('button', { onclick: () => assignView(r.id) }, 'Continuar'))))); });
  };
  const step2 = (gr) => {
    const sc = scanBox('2) Escanea la GUÍA DE DESPACHO original', (go) => act(async () => {
      try {
        const r = await api('POST', '/devoluciones/vincular', { guia_retorno: gr, guia_origen: go });
        body.replaceChildren(h('div', { class: 'card' }, h('span', { class: 'pill verde' }, 'VINCULADA'), h('p', {}, `${gr} ↔ ${go}`), h('p', {}, `${r.units[0].qty}× ${r.units[0].product} · ${r.units[0].dropshipper}`), h('p', { class: 'mut' }, 'Lista para tipificar.'), h('button', { class: 'big', onclick: step1 }, 'Siguiente devolución')));
      } catch (e) {
        if (e.status === 404) toast('Guía de despacho no encontrada. ¿Bulto sin detalle?', true); else throw e;
      }
    }));
    body.replaceChildren(h('div', { class: 'card' }, h('p', {}, 'Retorno: ', h('strong', {}, gr)), sc,
      h('p', { class: 'mut' }, 'La guía original está impresa en el paquete o en Dropi.'),
      h('div', { class: 'row' }, h('button', { class: 'warn', onclick: () => act(async () => { const r = await api('POST', '/devoluciones/sin-detalle', { guia_retorno: gr }); assignView(r.id); }) }, 'Bulto sin detalle'), h('button', { class: 'ghost', onclick: step1 }, 'Atrás'))));
  };
  const assignView = (id) => act(async () => {
    const r = await api('GET', '/devoluciones/' + id);
    const q = h('input', { placeholder: 'Filtrar candidatos: dropshipper, producto o guía…' });
    const cands = h('div');
    const loadC = () => act(async () => { const rows = await api('GET', `/devoluciones/${id}/candidatos?q=${encodeURIComponent(q.value)}`); cands.replaceChildren(...rows.map((o) => h('div', { class: 'item' }, h('div', {}, h('strong', {}, `${o.qty}× ${o.product}`), h('div', { class: 'mut' }, `${o.dropshipper} · ${o.guia_despacho}`)), h('button', { onclick: () => act(async () => { await api('POST', `/devoluciones/${id}/asignar`, { order_id: o.id }); assignView(id); }) }, 'Asignar')))); });
    let t; q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(loadC, 250); });
    body.replaceChildren(
      h('div', { class: 'card' }, h('span', { class: 'pill amarillo' }, 'RETORNO SIN DETALLE'), h('p', {}, r.guia_retorno), h('h3', {}, 'Unidades asignadas'),
        r.units.length ? r.units.map((u) => h('div', { class: 'item' }, h('span', {}, `${u.qty}× ${u.product} — ${u.dropshipper} (${u.guia_despacho}) `, h('span', { class: 'pill amarillo' }, 'probable')), u.causa ? h('span', { class: 'mut' }, u.causa) : h('button', { class: 'bad', onclick: () => act(async () => { await api('DELETE', '/devoluciones/unidades/' + u.id); assignView(id); }) }, 'Deshacer'))) : h('p', { class: 'mut' }, 'Ninguna todavía.'),
        h('p', {}, h('button', { class: 'ok', onclick: () => act(async () => { await api('POST', `/devoluciones/${id}/cerrar`); toast('Bulto cerrado'); step1(); }) }, 'Cerrar bulto'), ' ', h('button', { class: 'ghost', onclick: step1 }, 'Salir (queda abierto)'))),
      h('div', { class: 'card' }, h('h3', {}, 'Asignar unidad a su pedido'), q, cands));
    loadC();
  });
  step1();
};

// ---------- FR-5 tipificar ----------
VIEWS.tipificar = (v) => {
  const body = h('div');
  v.append(h('h2', {}, 'Tipificar Devolución'), body);
  const load = () => act(async () => {
    const rets = await api('GET', '/devoluciones?status=abierta');
    const units = [];
    for (const r of rets) for (const u of (await api('GET', '/devoluciones/' + r.id)).units) if (!u.causa) units.push({ ...u, guia_retorno: r.guia_retorno });
    if (!units.length) return body.replaceChildren(h('div', { class: 'card' }, h('p', { class: 'mut' }, 'Nada por tipificar. 🎉')));
    body.replaceChildren(...units.map(unitCard));
  });
  const unitCard = (u) => {
    let causa = null;
    const fin = h('button', { class: 'big ok', disabled: true, onclick: () => act(async () => { const r = await api('PATCH', '/devoluciones/tipificar', { unit_id: u.id, causa }); toast(r.reingresa_stock ? 'Cerrada · stock +' + u.qty : 'Cerrada · no reingresa'); load(); }) }, 'Finalizar Registro');
    const opts = ['Compra Falsa', 'Rechazo Cliente', 'Retraso Bodega', 'Daño Transportadora'].map((c) => h('button', { class: 'big ghost', onclick: (e) => { causa = c; opts.forEach((b) => b.classList.remove('sel')); e.currentTarget.classList.add('sel'); fin.disabled = false; } }, c));
    return h('div', { class: 'card' }, h('strong', {}, `${u.qty}× ${u.product}`), h('div', { class: 'mut' }, `${u.dropshipper} · retorno ${u.guia_retorno} · ${u.match === 'guia' ? 'vinculada por guía' : 'asignación manual (probable)'}`),
      h('div', { class: 'grid', style: 'margin:12px 0' }, opts), fin);
  };
  load();
};

// ---------- FR-7 / FR-8 alertas ----------
VIEWS.alertas = (v) => {
  const list = h('div'); const ficha = h('div');
  const load = () => act(async () => {
    const rows = await api('GET', '/alertas');
    list.replaceChildren(...rows.map((a) => h('div', { class: 'card' }, h('div', { class: 'row' }, h('span', { class: 'pill rojo' }, 'ALTA'), h('strong', {}, a.dropshipper), h('span', { class: 'big-num' }, '−' + Math.round(a.drop_pct) + '%')),
      h('p', { class: 'mut' }, `${a.day}: ${a.volume} pedidos vs línea base ${a.baseline.toFixed(1)}/día`),
      h('div', { class: 'row' }, h('button', { onclick: () => showFicha(a.dropshipper_id) }, 'Ver ficha'),
        h('a', { href: `https://wa.me/${a.phone}?text=${encodeURIComponent('Hola ' + a.dropshipper + ', ¿cómo va todo con tus pedidos? Notamos un cambio y queremos ayudarte.')}`, target: '_blank', rel: 'noopener' }, h('button', { class: 'ok' }, 'WhatsApp')),
        h('button', { class: 'ghost', onclick: () => act(async () => { await api('POST', `/alertas/${a.id}/atender`); load(); }) }, 'Marcar atendida')))));
    if (!rows.length) list.replaceChildren(h('p', { class: 'mut' }, 'Sin alertas nuevas.'));
  });
  const showFicha = (id) => act(async () => {
    const d = await api('GET', '/dropshippers/' + id); const max = Math.max(1, ...d.history.map((x) => x.pedidos));
    const pct = h('input', { type: 'number', min: 1, max: 100, value: d.umbral_pct, 'aria-label': 'Umbral de caída %' });
    ficha.replaceChildren(h('div', { class: 'card' }, h('h3', {}, d.name), h('p', { class: 'mut' }, `${d.totals.pedidos} pedidos · ${d.totals.devueltos || 0} devueltos · ${d.phone}`),
      h('div', { class: 'spark', title: 'Pedidos por día (30d)' }, d.history.map((x) => h('i', { style: `height:${(x.pedidos / max) * 100}%`, title: `${x.day}: ${x.pedidos}` }))),
      h('label', {}, 'Umbral de caída que dispara alerta (%)'), pct, h('p', {}, h('button', { onclick: () => act(async () => { await api('PATCH', '/dropshippers/' + id, { umbral_pct: Number(pct.value) }); toast('Umbral guardado'); }) }, 'Guardar umbral'))));
    ficha.scrollIntoView({ behavior: 'smooth' });
  });
  v.append(h('h2', {}, 'Alertas comerciales'), h('p', {}, h('button', { class: 'ghost', onclick: () => act(async () => { const r = await api('POST', '/alertas/run', {}); toast(`Análisis ${r.day}: ${r.created.length} alertas nuevas`); load(); }) }, 'Ejecutar análisis ahora')), list, ficha);
  load();
};

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
boot();
