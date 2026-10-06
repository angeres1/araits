import { h, api, act, toast } from '../core.js';

export async function render(v) {
  const list = h('div'), ficha = h('div');
  const load = () => act(async () => {
    const rows = await api('GET', '/alertas');
    list.replaceChildren(...(rows.length ? rows.map((a) => h('div', { class: 'card' }, h('div', { class: 'row between' }, h('div', { class: 'row' }, h('span', { class: 'pill rojo' }, 'PRIORIDAD ALTA'), h('b', { style: 'font-size:20px' }, a.dropshipper)), h('span', { class: 'bignum', style: 'color:var(--bad)' }, '−' + Math.round(a.drop_pct) + '%')),
      h('p', { class: 'mut' }, `${a.day}: ${a.volume} pedidos vs línea base ${a.baseline.toFixed(1)}/día (promedio 7 días)`),
      h('div', { class: 'row' }, h('button', { onclick: () => showFicha(a.dropshipper_id) }, 'Ver ficha'),
        h('a', { class: 'btn ok', href: `https://wa.me/${a.phone}?text=${encodeURIComponent('Hola ' + a.dropshipper + ', ¿cómo va todo con tus pedidos? Notamos un cambio y queremos ayudarte.')}`, target: '_blank', rel: 'noopener' }, 'WhatsApp'),
        h('button', { class: 'ghost', onclick: () => act(async () => { await api('POST', `/alertas/${a.id}/atender`); load(); }) }, 'Marcar atendida')))) : [h('div', { class: 'card empty' }, 'Sin alertas nuevas. Todo estable. ✅')]));
  });
  const showFicha = (id) => act(async () => {
    const d = await api('GET', '/dropshippers/' + id), max = Math.max(1, ...d.history.map((x) => x.pedidos));
    const pct = h('input', { type: 'number', min: 1, max: 100, value: d.umbral_pct, 'aria-label': 'Umbral de caída %' });
    ficha.replaceChildren(h('div', { class: 'card' }, h('h3', {}, d.name), h('p', { class: 'mut' }, `${d.totals.pedidos} pedidos · ${d.totals.devueltos || 0} devueltos · ${d.phone}`),
      h('div', { class: 'spark', role: 'img', 'aria-label': 'Pedidos por día, últimos 30 días' }, d.history.map((x) => h('i', { style: `height:${(x.pedidos / max) * 100}%`, title: `${x.day}: ${x.pedidos}` }))),
      h('label', {}, 'Caída que dispara alerta (% bajo el promedio de 7 días)'), pct,
      h('p', { style: 'margin-top:12px' }, h('button', { onclick: () => act(async () => { await api('PATCH', '/dropshippers/' + id, { umbral_pct: Number(pct.value) }); toast('Umbral guardado'); }) }, 'Guardar umbral'))));
    ficha.scrollIntoView({ behavior: 'smooth' });
  });
  v.append(h('div', { class: 'row between' }, h('h2', {}, 'Alertas comerciales'), h('button', { class: 'ghost sm', onclick: () => act(async () => { const r = await api('POST', '/alertas/run', {}); toast(`Análisis ${r.day}: ${r.created.length} alertas nuevas`); load(); }) }, 'Ejecutar análisis ahora')), list, ficha);
  await load();
}
