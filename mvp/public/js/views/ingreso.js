import { h, api, act, toast, uid, fmt, S } from '../core.js';
import { push, flush, onQueue, queued, rejected, dismissRejected } from '../queue.js';

const REF_KEY = 'ingestaRef';
const newRef = () => { const r = uid(); localStorage.setItem(REF_KEY, r); return r; };

function shrink(file, max = 480) {
  return new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => { const s = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', 0.65)); };
    img.onerror = () => rej(new Error('Foto inválida')); img.src = url;
  });
}

export function render(v) {
  let ref = localStorage.getItem(REF_KEY) || newRef(), mult = 1, total = 0, manualN = 0;
  const counter = h('span', { class: 'bignum' }, '0');
  const status = h('div', { class: 'card recog' }, h('span', { class: 'mut' }, 'Esperando escaneo…'));
  const log = h('div', { class: 'card' }, h('div', { class: 'empty' }, 'Escanea un código para empezar.'));
  const qbox = h('div'), manualBox = h('div');
  const addLog = (txt, cls = '') => { if (log.firstChild?.className === 'empty') log.replaceChildren(); log.prepend(h('div', { class: 'item ' + cls }, h('span', {}, txt))); };
  const bump = (n, manual) => { total += n; if (manual) manualN += n; counter.textContent = fmt(total); };

  const scan = h('input', { placeholder: 'Escanea con la pistola…', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-label': 'Campo de escaneo' });
  const refocus = () => { if (!manualBox.hasChildNodes()) scan.focus(); };
  const m1 = h('button', { class: 'sel', onclick: () => setMult(1) }, '+1'), m10 = h('button', { class: 'ghost', onclick: () => setMult(10) }, '+10');
  const setMult = (n) => { mult = n; m1.className = n === 1 ? 'sel' : 'ghost'; m10.className = n === 10 ? 'sel' : 'ghost'; refocus(); };

  const queueScan = (barcode, qty) => { push({ client_id: uid(), kind: 'scan', body: { barcode, qty, ingesta_ref: ref } }); bump(qty); status.replaceChildren(h('span', { class: 'pill warn' }, 'EN COLA'), h('b', {}, barcode), h('span', { class: 'mut small' }, 'Se enviará al reconectar')); addLog(`+${qty} ${barcode} (en cola)`, 'mut'); };

  const onScan = async (code) => {
    const qty = mult;
    if (!navigator.onLine || queued().length) { queueScan(code, qty); if (navigator.onLine) flush(); return; }
    try {
      const r = await api('POST', '/inventario/scan', { barcode: code, qty, ingesta_ref: ref, client_id: uid() });
      bump(qty);
      status.className = 'card recog flash'; status.replaceChildren(h('span', { class: 'pill verde' }, 'PRODUCTO RECONOCIDO'), h('b', {}, r.product.name), h('span', { class: 'mut small' }, `stock ${fmt(r.product.stock)}`));
      addLog(`+${qty} ${r.product.name}`);
    } catch (e) {
      if (e.network) return queueScan(code, qty);
      if (e.status === 404) { status.replaceChildren(h('span', { class: 'pill rojo' }, 'NO RECONOCIDO'), h('b', {}, code), h('button', { class: 'warn sm', onclick: () => manual() }, 'Sin código de barras')); return; }
      toast(e.message, true);
    }
  };
  scan.addEventListener('keydown', (e) => { if (e.key === 'Enter' && scan.value.trim()) { const val = scan.value.trim(); scan.value = ''; onScan(val).finally(refocus); } });

  // FR-2: manual fallback (search existing or create new reference)
  function manual() {
    const q = h('input', { placeholder: 'Buscar o crear producto por nombre…', 'aria-label': 'Nombre del producto' });
    const res = h('div', { class: 'row', style: 'margin:8px 0' }), photo = h('input', { type: 'file', accept: 'image/*', capture: 'environment' });
    const qty = h('input', { type: 'number', min: 1, value: 1, inputmode: 'numeric', 'aria-label': 'Cantidad' });
    const submit = async (extra, label) => {
      const n = Number(qty.value); if (!Number.isInteger(n) || n < 1) return toast('Cantidad inválida', true);
      const body = { ...extra, qty: n, ingesta_ref: ref };
      const cid = uid(); // same id for the live call and the queued retry, so a lost response can't double count
      try { await api('POST', '/inventario/manual', { ...body, client_id: cid }); }
      catch (e) { if (!e.network) throw e; push({ client_id: cid, kind: 'manual', body, label }); }
      bump(n, true); addLog(`+${n} ${label} (sin código)`); toast('Registrado'); manualBox.replaceChildren(); refocus();
    };
    const search = async () => { const rows = q.value.trim().length > 1 ? await api('GET', '/productos?q=' + encodeURIComponent(q.value)).catch(() => []) : []; res.replaceChildren(...rows.map((p) => h('button', { class: 'ghost sm', onclick: () => act(() => submit({ product_id: p.id }, p.name)) }, `${p.name} (${fmt(p.stock)})`))); };
    let t; q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(search, 250); });
    const create = () => act(async () => { if (!q.value.trim()) throw new Error('Escribe el nombre'); const img = photo.files[0] ? await shrink(photo.files[0]) : undefined; await submit({ name: q.value, photo: img }, q.value.trim()); });
    manualBox.replaceChildren(h('div', { class: 'card' }, h('h3', {}, 'Producto sin código de barras'), q, res, h('label', {}, 'Foto (opcional)'), photo, h('label', {}, 'Cantidad'), qty,
      h('div', { class: 'row', style: 'margin-top:14px' }, h('button', { class: 'ok', onclick: create }, 'Crear referencia y sumar'), h('button', { class: 'ghost', onclick: () => { manualBox.replaceChildren(); refocus(); } }, 'Cancelar'))));
    q.focus();
  }

  const save = () => act(async () => {
    if (!total) throw new Error('No hay escaneos que guardar');
    await flush();
    if (queued().length) throw new Error(`Hay ${queued().length} escaneos sin sincronizar. Revisa la conexión.`);
    const r = await api('POST', '/inventario/ingesta/cerrar', { ingesta_ref: ref });
    toast(`Ingesta guardada: ${fmt(r.unidades)} unidades${r.manual ? ` (${fmt(r.manual)} sin código)` : ''}`);
    ref = newRef(); total = 0; manualN = 0; counter.textContent = '0'; log.replaceChildren(h('div', { class: 'empty' }, 'Ingesta guardada. Escanea para iniciar otra.')); status.replaceChildren(h('span', { class: 'mut' }, 'Esperando escaneo…'));
  });

  const unsub = onQueue(() => {
    const r = rejected();
    qbox.replaceChildren(...r.map((i) => h('div', { class: 'card', style: 'border-color:var(--bad)' }, h('div', { class: 'row between' }, h('div', {}, h('b', {}, 'Escaneo rechazado'), h('div', { class: 'mut small' }, `${i.body.barcode || i.body.name}: ${i.error}`)), h('button', { class: 'ghost sm', onclick: () => dismissRejected(i.client_id) }, 'Descartar')))));
  });
  // Any keystroke outside an input (e.g. after tapping a button) goes back to the scan box so the gun never "loses" a code.
  const kc = (e) => { if (!manualBox.hasChildNodes() && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA' && e.key.length === 1) scan.focus(); };
  document.addEventListener('keydown', kc);
  const vc = () => setTimeout(refocus, 0);
  v.addEventListener('click', vc);

  v.append(h('h2', {}, 'Ingresar mercancía'),
    h('div', { class: 'scanwrap' }, scan, h('div', { class: 'row', style: 'margin-top:12px' }, m1, m10, h('span', { class: 'mut' }, 'Unidades en esta ingesta:'), counter)),
    h('div', { style: 'height:12px' }), status, qbox, h('button', { class: 'warn', onclick: () => manual() }, 'Sin código de barras'), manualBox,
    h('h3', { style: 'margin-top:18px' }, 'Registro'), log, h('button', { class: 'big ok', style: 'width:100%', onclick: save }, 'Guardar Ingesta'));
  setTimeout(() => scan.focus(), 50);
  return () => { document.removeEventListener('keydown', kc); v.removeEventListener('click', vc); unsub(); };
}
