import { h, api, act, toast, debounce, fmt } from '../core.js';

const ROLES = [['bodega', 'Auxiliar de Bodega'], ['alistamiento', 'Alistamiento'], ['devoluciones', 'Analista de Devoluciones'], ['operador', 'Operador de Bodega'], ['comercial', 'Coordinador Comercial'], ['admin', 'Administrador']];

export function render(v) {
  const tabs = ['Usuarios', 'Productos', 'Canales'];
  const body = h('div');
  let tab = 0;
  const bar = h('div', { class: 'chips' }, tabs.map((t, i) => h('button', { class: 'chip', 'aria-pressed': String(i === 0), onclick: () => { tab = i; [...bar.children].forEach((c, j) => c.setAttribute('aria-pressed', String(i === j))); show(); } }, t)));
  const show = () => [users, products, channels][tab]();

  const users = () => act(async () => {
    const rows = await api('GET', '/admin/users');
    const name = h('input', { placeholder: 'Nombre y apellido', 'aria-label': 'Nombre' }), role = h('select', { 'aria-label': 'Rol' }, ROLES.map(([k, l]) => h('option', { value: k }, l)));
    const reveal = h('div');
    const showPin = (who, pin) => reveal.replaceChildren(h('div', { class: 'card', style: 'border-color:var(--warn)' }, h('b', {}, `PIN temporal de ${who}`), h('div', { class: 'bignum', style: 'margin:8px 0;letter-spacing:6px' }, pin), h('p', { class: 'mut small tight' }, 'Anótalo y entrégalo ahora: no se vuelve a mostrar. La persona deberá cambiarlo al entrar.')));
    body.replaceChildren(
      h('div', { class: 'card' }, h('h3', {}, 'Nuevo usuario'), h('div', { class: 'grid g2' }, h('div', {}, h('label', {}, 'Nombre'), name), h('div', {}, h('label', {}, 'Rol'), role)),
        h('p'), h('button', { onclick: () => act(async () => { const r = await api('POST', '/admin/users', { name: name.value, role: role.value }); showPin(r.name, r.temp_pin); users(); showPinAfter = [r.name, r.temp_pin]; }) }, 'Crear usuario')), reveal,
      h('div', { class: 'card' }, h('h3', {}, 'Usuarios'), rows.map((u) => h('div', { class: 'item' },
        h('div', { class: 't' }, h('b', {}, u.name), h('span', { class: 'mut small' }, ROLES.find((r) => r[0] === u.role)?.[1] || u.role), ' ', !u.active && h('span', { class: 'pill info' }, 'INACTIVO'), u.must_change_pin ? h('span', { class: 'pill warn' }, 'DEBE CAMBIAR PIN') : null),
        h('div', { class: 'row' }, h('button', { class: 'ghost sm', onclick: () => act(async () => { const r = await api('POST', `/admin/users/${u.id}/reset-pin`); showPin(u.name, r.temp_pin); }) }, 'Reiniciar PIN'),
          h('button', { class: 'ghost sm', onclick: () => act(async () => { await api('PATCH', `/admin/users/${u.id}`, { active: !u.active }); users(); }) }, u.active ? 'Desactivar' : 'Activar'))))));
    if (showPinAfter) { showPin(...showPinAfter); showPinAfter = null; }
  });
  let showPinAfter = null;

  const products = () => act(async () => {
    const csv = h('textarea', { placeholder: 'sku,barcode,name,stock,low_threshold\nSKU-200,7701000000200,Producto nuevo,50,10', 'aria-label': 'CSV de productos' });
    const q = h('input', { type: 'search', placeholder: 'Buscar producto para editar…', 'aria-label': 'Buscar producto' }), list = h('div');
    const loadList = () => act(async () => {
      const r = await api('GET', `/inventario/stock?q=${encodeURIComponent(q.value)}&limit=30`);
      list.replaceChildren(...r.items.map((p) => { const low = h('input', { type: 'number', min: 0, value: p.low_threshold, style: 'width:90px;min-height:42px', 'aria-label': 'Umbral de stock bajo' }), loc = h('input', { value: p.location || '', placeholder: 'Ubicación', style: 'width:110px;min-height:42px', 'aria-label': 'Ubicación' });
        return h('div', { class: 'item' }, h('div', { class: 't' }, h('b', {}, p.name), h('span', { class: 'mut small' }, `${p.sku} · físico ${fmt(p.stock)}`)),
          h('div', { class: 'row' }, h('label', { class: 'small', style: 'margin:0' }, 'Bajo ≤'), low, loc, h('button', { class: 'sm', onclick: () => act(async () => { await api('PATCH', '/productos/' + p.id, { low_threshold: Number(low.value), location: loc.value }); toast('Guardado'); }) }, 'Guardar'))); }));
    });
    q.addEventListener('input', debounce(loadList));
    body.replaceChildren(
      h('div', { class: 'card' }, h('h3', {}, 'Importar catálogo (CSV)'), h('p', { class: 'mut small' }, 'Simula la sincronización del catálogo de Dropi. Cabecera mínima: sku,name. Opcionales: barcode, stock, low_threshold. Actualiza por SKU; el stock inicial solo aplica a productos nuevos.'), csv,
        h('p'), h('button', { onclick: () => act(async () => { const r = await api('POST', '/productos/import', { csv: csv.value }); toast(`${r.created} nuevos, ${r.updated} actualizados${r.errors.length ? `, ${r.errors.length} con error: ${r.errors[0]}` : ''}`, r.errors.length > 0); loadList(); }) }, 'Importar')),
      h('div', { class: 'card' }, h('h3', {}, 'Umbral de stock bajo y ubicación'), q, h('div', { style: 'height:8px' }), list));
    loadList();
  });

  const channels = () => act(async () => {
    const [me, log] = await Promise.all([api('GET', '/me'), api('GET', '/sync/log')]);
    body.replaceChildren(h('div', { class: 'card' }, h('div', { class: 'row between' }, h('div', {}, h('h3', {}, 'Canales Dropi y Mercado Libre'), h('span', { class: 'pill ' + (me.channels === 'mock' ? 'warn' : 'info') }, 'Modo: ' + me.channels.toUpperCase())),
      h('button', { onclick: () => act(async () => { const r = await api('POST', '/sync'); toast(`Entrada: ${r.imported} nuevos, ${r.cancelled} cancelados`); channels(); }) }, 'Sincronizar pedidos ahora')),
      h('p', { class: 'mut small' }, 'Sin credenciales reales: los pedidos se simulan y el log muestra lo que se enviaría a cada canal (stock disponible tras cada movimiento).')),
      h('div', { class: 'card' }, h('h3', {}, 'Actividad de sincronización'), log.length ? h('table', {}, h('thead', {}, h('tr', {}, ['Hora', 'Canal', 'Sentido', 'Detalle'].map((x) => h('th', {}, x)))),
        h('tbody', {}, log.map((l) => h('tr', {}, h('td', {}, new Date(l.created_at).toLocaleTimeString('es-CO')), h('td', {}, l.channel), h('td', {}, l.direction === 'out' ? '↑ salida' : '↓ entrada'), h('td', {}, `${l.product ? l.product + ': ' : ''}${l.detail}`))))) : h('div', { class: 'empty' }, 'Sin actividad todavía')));
  });

  v.append(h('h2', {}, 'Administración'), bar, body);
  show();
}
