import { h, api, act, debounce, live, fmt } from '../core.js';

export async function render(v) {
  let estado = '', offset = 0; const LIM = 40;
  const list = h('div', { class: 'card' }), more = h('button', { class: 'ghost', hidden: true }, 'Cargar más'), count = h('span', { class: 'mut small' });
  const q = h('input', { type: 'search', placeholder: 'Buscar por nombre, SKU o código…', 'aria-label': 'Buscar producto' });
  const chipDefs = [['', 'Todos'], ['rojo', 'Agotados'], ['amarillo', 'Bajos'], ['verde', 'Disponibles']];
  const chips = h('div', { class: 'chips' }, chipDefs.map(([k, l]) => h('button', { class: 'chip', 'aria-pressed': String(k === estado), onclick: (e) => { estado = k; [...chips.children].forEach((c) => c.setAttribute('aria-pressed', 'false')); e.currentTarget.setAttribute('aria-pressed', 'true'); load(true); } }, l)));
  const row = (p) => h('div', { class: 'item' },
    h('div', { class: 't' }, h('b', {}, p.name), h('span', { class: 'mut small' }, `${p.sku}${p.location ? ' · ' + p.location : ''} · Físico ${fmt(p.stock)} · Reservado ${fmt(p.reserved)}${p.source === 'manual' ? ' · sin código' : ''}`)),
    h('div', { class: 'row' }, h('span', { class: 'bignum', style: 'font-size:34px' }, fmt(p.available)), h('span', { class: 'pill ' + p.semaforo }, p.semaforo.toUpperCase())));
  const load = (reset = true) => act(async () => {
    if (reset) { offset = 0; }
    const r = await api('GET', `/inventario/stock?q=${encodeURIComponent(q.value)}&estado=${estado}&limit=${LIM}&offset=${offset}`);
    if (reset) list.replaceChildren();
    if (!r.items.length && reset) list.append(h('div', { class: 'empty' }, 'Sin resultados'));
    list.append(...r.items.map(row)); offset += r.items.length;
    count.textContent = `${fmt(Math.min(offset, r.total))} de ${fmt(r.total)}`; more.hidden = offset >= r.total;
  });
  more.onclick = () => load(false);
  q.addEventListener('input', debounce(() => load(true)));
  v.append(h('div', { class: 'row between' }, h('h2', {}, 'Stock disponible'), h('span', { class: 'pill info' }, 'En vivo')), q, chips, count, list, h('div', { class: 'row', style: 'justify-content:center' }, more));
  await load(true);
  return live(debounce(() => { if (offset <= LIM) load(true); }, 400));
}
