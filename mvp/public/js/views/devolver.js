import { h, api, act, toast, debounce } from '../core.js';

// FR-4 (vincular guía de retorno ↔ despacho) and FR-6 (bulto sin detalle, asignación manual unidad a unidad).
export async function render(v) {
  const body = h('div');
  v.append(h('h2', {}, 'Registrar devolución'), body);

  const scanInput = (ph, onScan) => {
    const i = h('input', { placeholder: ph, autocomplete: 'off', autocapitalize: 'off', 'aria-label': ph, style: 'font-size:22px;min-height:64px' });
    i.addEventListener('keydown', (e) => { if (e.key === 'Enter' && i.value.trim()) { const x = i.value.trim(); i.value = ''; onScan(x); } });
    setTimeout(() => i.focus(), 50); return i;
  };

  const step1 = () => {
    body.replaceChildren(h('div', { class: 'card' }, h('span', { class: 'pill info' }, 'Paso 1 de 2'), h('p', { style: 'margin-top:10px' }, 'Escanea la guía de ', h('b', {}, 'RETORNO'), ' (la nueva, emitida por la transportadora).'),
      scanInput('Escanea la guía de retorno…', step2)));
    act(async () => {
      const open = (await api('GET', '/devoluciones?status=abierta')).filter((r) => r.sin_detalle);
      if (open.length) body.append(h('div', { class: 'card' }, h('h3', {}, 'Bultos sin detalle abiertos'), open.map((r) => h('div', { class: 'item' }, h('b', {}, r.guia_retorno), h('button', { class: 'sm', onclick: () => assignView(r.id) }, 'Continuar')))));
    });
  };

  const step2 = (gr) => {
    const linked = (r, go) => body.replaceChildren(h('div', { class: 'card' }, h('span', { class: 'pill verde' }, 'VINCULADA'), h('p', { style: 'margin-top:10px' }, `${gr} ↔ ${go}`),
      h('p', {}, h('b', {}, `${r.units[0].qty}× ${r.units[0].product}`), ` · ${r.units[0].dropshipper}`), h('p', { class: 'mut' }, 'Lista para tipificar.'), h('button', { class: 'big', onclick: step1 }, 'Siguiente devolución')));
    body.replaceChildren(h('div', { class: 'card' }, h('span', { class: 'pill info' }, 'Paso 2 de 2'), h('p', { style: 'margin-top:10px' }, 'Retorno: ', h('b', {}, gr)), h('p', {}, 'Ahora escanea la guía de ', h('b', {}, 'DESPACHO'), ' original.'),
      scanInput('Escanea la guía de despacho…', (go) => act(async () => {
        try { linked(await api('POST', '/devoluciones/vincular', { guia_retorno: gr, guia_origen: go }), go); }
        catch (e) { if (e.status === 404) toast('Guía de despacho no encontrada. ¿Es un bulto sin detalle?', true); else throw e; }
      })),
      h('p', { class: 'mut small' }, 'La guía original viene impresa en el paquete o se consulta en Dropi.'),
      h('div', { class: 'row' }, h('button', { class: 'warn', onclick: () => act(async () => assignView((await api('POST', '/devoluciones/sin-detalle', { guia_retorno: gr })).id)) }, 'Bulto sin detalle'), h('button', { class: 'ghost', onclick: step1 }, 'Atrás'))));
  };

  const assignView = (id) => act(async () => {
    const r = await api('GET', '/devoluciones/' + id);
    const q = h('input', { placeholder: 'Filtrar: dropshipper, producto, guía o #pedido…', 'aria-label': 'Filtrar candidatos' }), cands = h('div');
    const loadC = () => act(async () => {
      const rows = await api('GET', `/devoluciones/${id}/candidatos?q=${encodeURIComponent(q.value)}`);
      cands.replaceChildren(...(rows.length ? rows.map((o) => h('div', { class: 'item' }, h('div', { class: 't' }, h('b', {}, `${o.qty}× ${o.product}`), h('span', { class: 'mut small' }, `${o.dropshipper} · ${o.guia_despacho}`)),
        h('button', { class: 'sm', onclick: () => act(async () => { await api('POST', `/devoluciones/${id}/asignar`, { order_id: o.id }); assignView(id); }) }, 'Asignar'))) : [h('div', { class: 'empty' }, 'Sin candidatos con ese filtro')]));
    });
    q.addEventListener('input', debounce(loadC));
    body.replaceChildren(
      h('div', { class: 'card' }, h('span', { class: 'pill amarillo' }, 'RETORNO SIN DETALLE'), h('p', { style: 'margin-top:10px' }, h('b', {}, r.guia_retorno)), h('h3', {}, 'Unidades asignadas'),
        ...(r.units.length ? r.units.map((u) => h('div', { class: 'item' }, h('div', { class: 't' }, h('b', {}, `${u.qty}× ${u.product}`), h('span', { class: 'mut small' }, `${u.dropshipper} · ${u.guia_despacho} `), h('span', { class: 'pill amarillo' }, 'probable')),
          u.causa ? h('span', { class: 'mut' }, u.causa) : h('button', { class: 'bad sm', onclick: () => act(async () => { await api('DELETE', '/devoluciones/unidades/' + u.id); assignView(id); }) }, 'Deshacer'))) : [h('div', { class: 'empty' }, 'Ninguna todavía.')]),
        h('div', { class: 'row', style: 'margin-top:14px' }, h('button', { class: 'ok', onclick: () => act(async () => { await api('POST', `/devoluciones/${id}/cerrar`); toast('Bulto cerrado'); step1(); }) }, 'Cerrar bulto'), h('button', { class: 'ghost', onclick: step1 }, 'Salir (queda abierto)'))),
      h('div', { class: 'card' }, h('h3', {}, 'Asignar unidad a su pedido de origen'), q, h('div', { style: 'height:8px' }), cands));
    loadC();
  });
  step1();
}
