import { h, api, act, toast, live, debounce } from '../core.js';

const CAUSAS = [['Compra Falsa', 'No reingresa'], ['Rechazo Cliente', 'Reingresa a stock'], ['Retraso Bodega', 'Reingresa a stock'], ['Daño Transportadora', 'No reingresa']];

// FR-5: tap cause + "Finalizar" (2 taps, within the 3-tap budget).
export async function render(v) {
  const body = h('div');
  v.append(h('h2', {}, 'Tipificar devoluciones'), body);
  const card = (u) => {
    let causa = null;
    const fin = h('button', { class: 'big ok', disabled: true, style: 'width:100%', onclick: () => act(async () => { const r = await api('PATCH', '/devoluciones/tipificar', { unit_id: u.id, causa }); toast(r.reingresa_stock ? `Cerrada · stock +${u.qty}` : 'Cerrada · no reingresa a stock'); load(); }) }, 'Finalizar Registro');
    const opts = CAUSAS.map(([c, hint]) => h('button', { class: 'big ghost', 'aria-pressed': 'false', onclick: (e) => { causa = c; opts.forEach((b) => b.classList.remove('sel')); e.currentTarget.classList.add('sel'); fin.disabled = false; } }, h('span', {}, c, h('div', { class: 'small mut', style: 'font-weight:500' }, hint))));
    return h('div', { class: 'card' }, h('div', { class: 'row between' }, h('b', { style: 'font-size:20px' }, `${u.qty}× ${u.product}`), h('span', { class: 'pill ' + (u.match === 'guia' ? 'verde' : 'amarillo') }, u.match === 'guia' ? 'VINCULADA POR GUÍA' : 'ASIGNACIÓN MANUAL')),
      h('p', { class: 'mut small' }, `${u.dropshipper} · retorno ${u.guia_retorno} · despacho ${u.guia_despacho}`), h('div', { class: 'grid g2', style: 'margin:14px 0' }, opts), fin);
  };
  const load = () => act(async () => {
    const units = await api('GET', '/devoluciones/pendientes');
    body.replaceChildren(...(units.length ? units.map(card) : [h('div', { class: 'card empty' }, 'Nada por tipificar 🎉')]));
  });
  await load();
  return live(debounce(() => {}, 1000));
}
