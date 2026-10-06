import { h, api, act, fmt, live } from '../core.js';

const NS = 'http://www.w3.org/2000/svg';
const el = (t, a = {}, ...k) => { const e = document.createElementNS(NS, t); for (const [x, y] of Object.entries(a)) e.setAttribute(x, y); k.forEach((c) => e.append(c)); return e; };

// Grouped bars: ingresos / despachos / devoluciones per day (14d).
function barChart(series) {
  const W = 700, H = 190, pad = { l: 34, b: 24, t: 8 }, innerH = H - pad.b - pad.t;
  const max = Math.max(1, ...series.flatMap((s) => [s.ingreso, s.despacho, s.devolucion]));
  const gw = (W - pad.l) / series.length, bw = Math.min(14, gw / 4);
  const colors = { ingreso: 'var(--ok)', despacho: 'var(--acc)', devolucion: 'var(--warn)' };
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': 'Movimientos de los últimos 14 días: ingresos, despachos y devoluciones' });
  for (let i = 0; i <= 4; i++) {
    const y = pad.t + innerH - (innerH * i) / 4;
    svg.append(el('line', { x1: pad.l, x2: W, y1: y, y2: y, stroke: 'var(--line)', 'stroke-width': 1 }));
    const t = el('text', { x: 0, y: y + 4, fill: 'var(--mut)', 'font-size': 11 }); t.textContent = fmt(Math.round((max * i) / 4)); svg.append(t);
  }
  series.forEach((s, i) => {
    const x0 = pad.l + i * gw + gw / 2 - (bw * 3 + 4) / 2;
    ['ingreso', 'despacho', 'devolucion'].forEach((k, j) => {
      const bh = (s[k] / max) * innerH;
      const r = el('rect', { x: x0 + j * (bw + 2), y: pad.t + innerH - bh, width: bw, height: Math.max(bh, s[k] ? 2 : 0), rx: 2, fill: colors[k] });
      const tt = el('title'); tt.textContent = `${s.day} · ${k}: ${s[k]}`; r.append(tt); svg.append(r);
    });
    if (i % 2 === 0) { const t = el('text', { x: pad.l + i * gw + gw / 2, y: H - 6, 'text-anchor': 'middle', fill: 'var(--mut)', 'font-size': 11 }); t.textContent = s.day.slice(5); svg.append(t); }
  });
  return svg;
}

const pctTxt = (v) => (v == null ? '—' : v + '%');

export async function render(v, { go, user }) {
  const body = h('div');
  v.append(h('h2', {}, 'Inicio'), body);
  const load = () => act(async () => {
    const d = await api('GET', '/dashboard');
    const kpi = (val, label, cls, to) => h('button', { class: `kpi ${cls ? 'k-' + cls : ''}`, onclick: () => to && go(to) }, h('div', { class: 'v' }, fmt(val)), h('div', { class: 'l' }, label));
    const canGo = (t) => (['admin', 'bodega', 'alistamiento', 'devoluciones', 'operador', 'comercial'].includes(user.role) ? t : null);
    const q = d.calidad;
    body.replaceChildren(
      h('div', { class: 'grid g4' },
        kpi(d.stock.rojo, 'Productos agotados', d.stock.rojo ? 'bad' : 'ok', 'stock'),
        kpi(d.stock.amarillo, 'Stock bajo', d.stock.amarillo ? 'warn' : 'ok', 'stock'),
        kpi(d.pedidos_pendientes, 'Pedidos por despachar', '', ['admin', 'alistamiento'].includes(user.role) ? 'pedidos' : null),
        kpi(d.unidades_por_tipificar, 'Devoluciones por tipificar', d.unidades_por_tipificar ? 'warn' : 'ok', ['admin', 'operador'].includes(user.role) ? 'tipificar' : null),
        kpi(d.devoluciones_abiertas, 'Devoluciones abiertas', '', ['admin', 'devoluciones'].includes(user.role) ? 'devolver' : null),
        kpi(d.alertas_nuevas, 'Alertas comerciales', d.alertas_nuevas ? 'bad' : 'ok', ['admin', 'comercial'].includes(user.role) ? 'alertas' : null)),
      h('div', { class: 'card', style: 'margin-top:16px' }, h('div', { class: 'row between' }, h('h3', {}, 'Movimiento de unidades · 14 días'),
        h('div', { class: 'legend' }, [['--ok', 'Ingresos'], ['--acc', 'Despachos'], ['--warn', 'Devoluciones']].map(([c, l]) => h('span', {}, h('i', { style: `background:var(${c})` }), l)))), barChart(d.series)),
      h('div', { class: 'grid g2' },
        h('div', { class: 'card' }, h('h3', {}, 'Salud del proceso · 30 días'),
          [['Trazabilidad por guía (cierta)', q.trazabilidad_por_guia_pct, 'ok'], ['Ingresos sin código de barras', q.ingreso_manual_pct, 'warn'], ['Devoluciones sin detalle', q.devolucion_sin_detalle_pct, 'warn']].map(([l, val]) => h('div', { style: 'margin:12px 0' },
            h('div', { class: 'row between small' }, h('span', {}, l), h('b', { class: 'num' }, pctTxt(val))), h('div', { class: 'bar' }, h('i', { style: `width:${val || 0}%` })))),
          h('p', { class: 'mut small tight' }, 'Si los dos últimos suben sin control, el problema de origen (mercancía sin código, transportadoras sin detalle) es mayor de lo estimado.')),
        h('div', { class: 'card' }, h('h3', {}, 'Pedidos por dropshipper · 7 días'),
          h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, 'Dropshipper'), h('th', { class: 'r' }, '7d'), h('th', { class: 'r' }, 'vs previa'))),
            h('tbody', {}, d.dropshippers.map((x) => { const ch = x.previa ? Math.round(((x.semana - x.previa) / x.previa) * 100) : null;
              return h('tr', {}, h('td', {}, x.name), h('td', { class: 'r num' }, fmt(x.semana)), h('td', { class: 'r' }, ch == null ? '—' : h('span', { class: 'pill ' + (ch <= -50 ? 'rojo' : ch < -15 ? 'amarillo' : 'verde') }, (ch > 0 ? '+' : '') + ch + '%'))); }))))));
  });
  await load();
  return live(() => load());
}
