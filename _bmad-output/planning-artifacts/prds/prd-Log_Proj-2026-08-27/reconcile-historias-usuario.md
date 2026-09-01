---
title: "Reconciliación: historias de usuario.xlsx vs PRD final + addendum"
created: 2026-08-27
---

# Reconciliación — `docs/historias de usisario.xlsx` vs `prd.md` (§4 FR-1 a FR-8) + `addendum.md`

## Método

Se extrajo el contenido completo (todas las columnas: ID, Historia de Usuario, Descripción del Proceso Operativo y Técnico, Herramientas y Hardware Conectados, Resultado de Salida Técnico y Datos Generados) de las 3 hojas del Excel — "Módulo 1 Control de Inventario" (HU-01, HU-02), "Trazabilidad y Gestión de Devoluciones" (HU-03, HU-04) y "Gestión Comercial (CRM Preventivo)" (HU-05) — vía `openpyxl`, y se comparó celda por celda contra `prd.md` §4 (FR-1–FR-8) y `addendum.md` (tabla "Endpoints y modelo de datos por historia" y sección "Dependencias entre historias").

## Cobertura general

La gran mayoría del contenido de las 5 historias originales SÍ está reflejado: los 4 endpoints REST (`POST /inventario/ingesta`, `GET /inventario/stock`, `POST /devoluciones/vincular`, `PATCH /devoluciones/tipificar`), los campos clave (`Ingesta_ID`, `guia_origen`/`guia_retorno`/`ID_Pedido`), el hardware (pistola Bluetooth/USB), las integraciones (Dropi, Mercado Libre, API Transportadoras — explícitamente marcada fuera de MVP), y las dos dependencias entre historias (FR-3 depende de FR-1 y FR-5; FR-5 depende de FR-4 o FR-6) están todos correctamente trazados en el addendum.

## Gaps encontrados (4)

### Gap 1 — Mecanismo técnico de actualización del tablero (Web Sockets/Polling)

**Fuente (Excel, HU-02, columna D):** `'• PWA/UI: Tablero Semafórico Táctil (Web Sockets/Pooling).'`

El Excel especifica el mecanismo técnico candidato para la actualización en tiempo real del tablero (WebSockets o polling). Ni `prd.md` FR-3 ni `addendum.md` mencionan este detalle — el PRD solo declara el efecto observable ("el tablero refleja un ingreso o una devolución sin que el usuario recargue manualmente", con `[ASSUMPTION]` de latencia ≤5s) sin capturar la pista técnica original sobre el mecanismo de transporte. Relevante para el siguiente paso de arquitectura.

### Gap 2 — Actualización del estado de la orden de venta en la tipificación

**Fuente (Excel, HU-04, columna C):** *"...el sistema guarda la tipificación, **actualiza el estado de la orden** y actualiza el stock centralizado (si el producto volvió a stock disponible)."*
**Fuente (Excel, HU-04, columna D16):** `'• DB Maestra: Actualización de orden de venta y stock.'`

El Excel describe dos efectos de la tipificación: (a) actualización del **estado de la orden de venta** (incondicional) y (b) actualización del stock (condicional, "si aplica"). `prd.md` FR-5 solo recoge el efecto (b) — "si la causa indica producto reutilizable, el stock se actualiza automáticamente" — y cierra la devolución con "causa, guía vinculada y timestamp", pero no menciona el cambio de estado de la orden de venta asociada como consecuencia verificable. `addendum.md` tampoco lo recoge en la fila FR-5 de la tabla de endpoints.

### Gap 3 — Calificador temporal "en 7 días" del umbral HU-05 no reconciliado

**Fuente (Excel, HU-05, columna C):** *"...cae por debajo de un umbral parametrizado (ej. de 200 pedidos promedio a solo 20 **en 7 días**)."*

`addendum.md` tiene una sección dedicada ("Discrepancia de umbral HU-05/FR-7 — resuelta") que reconcilia dos fuentes: el addendum del brief (que registraba el ejemplo como semanal) y la transcripción de la reunión (cita textual de Hugo, diaria) — concluyendo que la cifra correcta es diaria. Pero esa reconciliación no cita ni considera la redacción del propio Excel, que es una tercera fuente con una formulación distinta ("200 pedidos promedio... en 7 días", no "200 pedidos/día" limpio). El Excel no quedó incorporado al análisis de discrepancia, aunque es justamente el documento de origen de HU-05/FR-7 que el addendum lista como fuente.

### Gap 4 — Existencia de una base de datos separada para CRM ("DB CRM Light")

**Fuente (Excel, HU-05, columna D6):** `'• DB CRM Light: Base transaccional de ventas y clientes.'`

El Excel nombra explícitamente una base de datos distinta para el módulo comercial ("DB CRM Light"), separada de la `DB_Maestra_Logística` usada por HU-01 a HU-04. `addendum.md`, al recomendar el modelo de datos ("`ID_Guía_Origen`/`ID_Guía_Retorno`... como base del modelo de datos de `DB_Maestra_Logística` para FR-4 y FR-6"), no menciona en ningún punto la existencia de esta segunda base de datos ni su relación (separada vs. integrada) con la base logística — dato relevante para el diseño de arquitectura de datos del siguiente paso (`bmad-architecture`).

## Notas (no clasificadas como gap)

- El orden de escaneo en HU-03 (el Excel describe que el analista escanea primero la guía de **retorno**, y el sistema luego pide la guía **original**) coincide con `prd.md` UJ-3/FR-4, pero **contradice** el flujo de wireframe de `evidencias.docx` citado en `addendum.md` ("1. Escanear Guía Origen, 2. Escanear Guía Retorno" — orden inverso). No es un gap Excel-vs-PRD (el PRD sí refleja el Excel), pero es una inconsistencia entre las dos fuentes técnicas citadas en el addendum, que UX debería resolver al diseñar la pantalla real.
