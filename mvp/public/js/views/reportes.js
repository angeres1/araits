import { h, api, act, toast } from '../core.js';

const today = () => new Date().toISOString().slice(0, 10);
const ago = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

export function render(v) {
  const from = h('input', { type: 'date', value: ago(30), 'aria-label': 'Desde' }), to = h('input', { type: 'date', value: today(), 'aria-label': 'Hasta' });
  const download = (kind, name) => act(async () => {
    const r = await api('GET', `/reportes/${kind}?from=${from.value}&to=${to.value}`);
    const url = URL.createObjectURL(new Blob(['﻿' + r.csv], { type: 'text/csv;charset=utf-8' }));
    const a = h('a', { href: url, download: `${name}_${from.value}_${to.value}.csv` }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Reporte descargado');
  });
  v.append(h('h2', {}, 'Reportes'), h('div', { class: 'card' }, h('div', { class: 'grid g2' }, h('div', {}, h('label', {}, 'Desde'), from), h('div', {}, h('label', {}, 'Hasta'), to))),
    h('div', { class: 'grid g2' },
      h('div', { class: 'card' }, h('h3', {}, 'Movimientos de inventario'), h('p', { class: 'mut small' }, 'Ingresos, despachos, devoluciones y ajustes con usuario, canal de ingreso (escaneo/manual) e ingesta.'), h('button', { onclick: () => download('movimientos', 'movimientos') }, 'Descargar CSV')),
      h('div', { class: 'card' }, h('h3', {}, 'Devoluciones y trazabilidad'), h('p', { class: 'mut small' }, 'Guía de retorno ↔ despacho, tipo de vínculo (cierto/probable), causa y reingreso a stock.'), h('button', { onclick: () => download('devoluciones', 'devoluciones') }, 'Descargar CSV'))));
}
