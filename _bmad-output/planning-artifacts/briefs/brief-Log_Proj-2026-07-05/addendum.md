---
title: "Addendum — [Nombre por definir]"
created: 2026-07-05
updated: 2026-08-27
---

# Addendum: Detalle Técnico y Contexto de Origen

Contenido de apoyo para el PRD/arquitectura — no forma parte del brief ejecutivo, pero se preserva porque los socios y el equipo técnico lo necesitarán en el siguiente paso.

## Fuentes de este brief

- `docs/Transcripción depurada y optimizada de reunion.docx` — reunión de diagnóstico entre Hugo, Ronhal y el representante de la empresa piloto.
- `docs/evidencias.docx` — matriz de evidencias, problema raíz y propuesta de arquitectura técnica.
- `docs/historias de usisario.xlsx` — 5 historias de usuario ya redactadas (HU-01 a HU-05) en 3 módulos.
- `docs/Feedback Hugo Brief 13-7-2026.txt` — feedback de Hugo (socio) sobre el primer draft del brief (2026-07-13), origen de HU-06 y del ajuste a HU-01.

## Historias de usuario del MVP (detalle completo)

**Módulo 1 — Control de Inventario**
- **HU-01 — Registro de Stock mediante Escaneo Único con Pistola.** Como Auxiliar de Bodega, quiero escanear el código de barras de un producto entrante con mi pistola, para incrementar su stock automáticamente sin digitar datos manuales. Salida: existencias actualizadas (+N) en `DB_Maestra_Logística`, registro de auditoría (`Ingesta_ID`). **Ajuste (feedback Hugo, 13-07-2026):** parte de la mercancía importada no trae código de barras — el flujo debe contemplar un fallback manual (buscar/crear referencia en el sistema) para ese subconjunto de productos, sin romper el "cero fricción" del resto.
- **HU-02 — Tablero Operativo de Stock Real-Time.** Como Personal de Alistamiento, quiero visualizar un tablero táctil simplificado de existencias, para saber qué está disponible para despacho, sincronizado con Dropi y Mercado Libre. UI semafórica (verde/amarillo/rojo).

**Módulo 2 — Trazabilidad y Gestión de Devoluciones**
- **HU-03 — Vinculación Inteligente de Guías.** Como Analista de Devoluciones, quiero vincular secuencialmente la guía de retorno con la guía de despacho original, para recuperar la trazabilidad comercial perdida. El sistema detecta que es una guía de retorno y pide escanear la guía original.
- **HU-04 — Tipificación Táctil Rápida de Causas de Devolución.** Como Operador de Bodega, quiero clasificar el motivo de la devolución presionando un botón gigante de opción única (Compra Falsa / Rechazo Cliente / Retraso Bodega / Daño Transportadora) tras abrir el paquete, en menos de 3 clics. Actualiza stock si el producto vuelve a estar disponible.

- **HU-06 — Asignación Manual de Devoluciones sin Detalle.** Como Analista de Devoluciones, quiero registrar en el sistema una guía de retorno que llega sin detalle de contenido (mercancía consolidada por la transportadora, sin indicar a qué pedido pertenece cada unidad), para poder asignar manualmente cada unidad física a su pedido de origen y así dar de baja el inventario correcto. Nace de feedback de Hugo (13-07-2026): al menos dos transportadoras devuelven mercancía de esta forma, sin cruce automático posible. Flujo: el operador ingresa/escanea la guía de la transportadora, el sistema la marca como "retorno sin detalle" y presenta una pantalla de asignación uno-a-uno (unidad recibida asignada a pedido/orden), en vez del cruce automático de HU-03. **[SUPUESTO]** El sistema propondrá candidatos de pedido probable (por dropshipper, fecha, referencia) para agilizar la asignación manual — a validar en diseño técnico, no confirmado en el feedback.

**Módulo 3 — Gestión Comercial (CRM Preventivo)**
- **HU-05 — Disparador de Alertas por Caída Crítica de Volumen.** Un worker diario analiza el volumen transaccional de cada dropshipper (Dropi + Mercado Libre). Si cae por debajo de un umbral parametrizado (ej. de 200/semana a 20 en 7 días), inyecta una alerta de alta prioridad al asesor comercial con datos de contacto y enlace directo a WhatsApp.

## Propuesta de arquitectura (de `evidencias.docx`, a validar en la fase de arquitectura)

- **Frontend:** PWA (Progressive Web App), multiplataforma, interfaz táctil "cero fricción".
- **Hardware:** pistola de escaneo de códigos de barras/QR, Bluetooth/USB.
- **Backend:** API REST para la lógica de negocio.
- **Bases de datos:**
  - `DB_Maestra_Logística` — inventario, movimientos, ubicaciones, guías, trazabilidad (fuente única de verdad).
  - `DB_CRM_Light` — clientes, historial de interacciones, alertas comerciales.
- **Integraciones externas:**
  - Dropi API — sincronización bidireccional de inventario y estados de orden.
  - Mercado Libre API — centralización de ventas y stock multicanal.
  - API(s) de transportadoras — tracking en tiempo real y vinculación de guías reemplazatorias.

## Roles de proyecto mencionados en `evidencias.docx`

- Diseñador UX/UI (interfaces minimalistas para personal con baja alfabetización digital).
- Ingeniero Backend y de Integraciones (DBs + APIs Dropi/Mercado Libre/Transportadoras).
- Ingeniero Frontend (PWA táctil, integración con periféricos de escaneo).
- Ingeniero QA (pruebas funcionales end-to-end simulando ritmo de bodega).

**[SUPUESTO]** No se ha confirmado quién cubre cada rol dentro del equipo de los 3 socios — validar con ellos si se cubren internamente o se contratan.

## Fase 2 (pospuesta, fuera del MVP)

Identificada explícitamente en la reunión como "segunda etapa", después de validar la base operativa:
- Automatización de cierres logísticos.
- Integraciones más profundas con transportadoras.
- Seguimiento automático de guías.
- Conciliaciones operativas y financieras/de cartera.
- Automatizaciones avanzadas de seguimiento.

## Datos históricos disponibles

La empresa piloto conserva respaldos de facturación, manifiestos y registros operativos desde 2022, aunque dispersos y sin estructurar. Podría ser insumo valioso para poblar el sistema o para reportes futuros (fuera del MVP).

## Panorama competitivo (research digest)

- **Dropi** se promociona con un módulo "WMS" y fulfillment propio ("Multibodegas"), pero orientado a su propia red de fulfillment, no a un inventario unificado Dropi + Mercado Libre. Las devoluciones parecen gestionarse directamente por la transportadora, consistente con la queja de pérdida de trazabilidad del cliente piloto.
- **Zoho Inventory** tiene escaneo de código de barras y manejo de devoluciones — el más cercano a "listo para usar", pero sin integración Dropi/transportadoras LatAm ni CRM de alertas por caída de volumen.
- **Odoo** es flexible pero requiere desarrollo a la medida — en la práctica se convierte en un proyecto de construcción, no en una compra directa.
- **ShipHero** es un WMS/3PL robusto usado por operaciones LatAm, pero de nivel empresarial y sin manejo nativo de guías reemplazatorias.
- No se encontró evidencia pública de que algún agregador de transporte regional (Enviame, Envíoclick, Shiptify) resuelva la reconciliación guía-original/guía-retorno — brecha real, no verificable como "ya resuelta en algún lado".
- Las alertas de caída de volumen tienen precedente conceptual en análisis RFM (Recency/Frequency/Monetary), un patrón común en CRM B2B/mayorista, aunque no específico de dropshipping.

*(Nota: esta sección es un digest de investigación rápida, no un estudio de mercado exhaustivo — para eso está `bmad-market-research`.)*

## Preguntas abiertas para los socios

- Nombre del producto / marca.
- Métrica de negocio cuantitativa para declarar éxito del piloto (más allá de los criterios cualitativos ya definidos).
- Quién cubre cada rol técnico (UX/UI, Backend, Frontend, QA) dentro del equipo actual.
- Cualquier información adicional del cliente piloto o de los socios que no esté todavía en `docs/` (señalado explícitamente como posible brecha por el usuario).
- Cuáles son exactamente las dos transportadoras que devuelven mercancía sin detalle (HU-06) — necesario para diseño técnico y para saber si aplica a todas las devoluciones o solo a esas dos.
- Si la mercancía sin código de barras (HU-01) tiene alguna referencia interna/SKU propio, o si hay que generarla desde cero en el sistema.
