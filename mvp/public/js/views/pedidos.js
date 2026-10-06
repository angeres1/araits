import { h, api, act, toast, live, debounce, fmt, S } from '../core.js';

export async function render(v) {
  const list = h('div', { class: 'card' });
  const load = () => act(async () => {
    const rows = await api('GET', '/pedidos');
    list.replaceChildren(...(rows.length ? rows.map((o) => h('div', { class: 'item' },
      h('div', { class: 't' }, h('b', {}, `${o.qty}× ${o.product}`), h('span', { class: 'mut small' }, `${o.dropshipper} · ${o.channel === 'dropi' ? 'Dropi' : 'Mercado Libre'}`)),
      h('div', { class: 'row' },
        h('button', { class: 'ok', onclick: () => act(async () => { const r = await api('POST', `/pedidos/${o.id}/despachar`); toast('Despachado · guía ' + r.guia_despacho); load(); }) }, 'Despachar'),
        h('button', { class: 'ghost sm', onclick: () => act(async () => { await api('POST', `/pedidos/${o.id}/cancelar`); toast('Pedido cancelado'); load(); }) }, 'Cancelar')))) : [h('div', { class: 'empty' }, 'Sin pedidos pendientes 🎉')]));
  });
  const kids = [h('h2', {}, 'Pedidos por despachar')];
  if (S.session.user.role === 'admin') kids.push(h('p', {}, h('button', { class: 'ghost', onclick: () => act(async () => { const r = await api('POST', '/sync'); toast(`Sync ${r.mode}: ${fmt(r.imported)} nuevos, ${fmt(r.cancelled)} cancelados`); load(); }) }, 'Sincronizar canales (mock)')));
  v.append(...kids, list);
  await load();
  return live(debounce(load, 400));
}
