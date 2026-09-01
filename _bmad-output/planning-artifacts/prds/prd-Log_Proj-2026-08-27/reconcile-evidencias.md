---
title: "Reconciliación: docs/evidencias.docx vs PRD final"
created: 2026-08-27
---

# Reconciliación: `docs/evidencias.docx` vs PRD (`prd.md` + `addendum.md`)

Input analizado: `docs/evidencias.docx` (74 líneas de texto extraídas vía `textutil -convert txt -stdout`), 5 secciones: (1) Flujograma de la Situación Actual, (2) Matriz de Evidencias y Problemas Raíz, (3) Propuesta de Arquitectura y Solución Técnica, (4) Diseño de Interfaz y Flujo de "Cero Fricción", (5) Recursos Requeridos y Roles.

Comparado contra: `prd.md` (§4 Features/FRs, §5 NFRs/Integraciones, §6 No-Objetivos, §9 Open Questions) y `addendum.md` (Mapeo de IDs, Flujo de UI a nivel wireframe, Endpoints y modelo de datos).

## Cobertura confirmada (sin gap)

- **RF-01, RF-02, RF-03** → mapeados 1:1 a FR-1, FR-4, FR-5 en `addendum.md` (tabla "Mapeo de IDs"). Correcto.
- **RNF-01, RNF-02** → mapeados a §5.1/§5.5 del PRD. Correcto.
- Matriz de evidencias (§2 del docx: problemas raíz de Inventario, Devoluciones, Comercial, Integración) → todos reflejados en Visión (§1), Glosario (§3) y JTBDs (§2.1) del PRD, incluida la cita de "Dropi se usa como WMS sin serlo".
- Flujo de ingreso de mercancía (§4 del docx: botón "Ingresar Mercancía", ficha + Cantidad +1/+10, "Guardar Ingesta") → reproducido casi literal en el wireframe del addendum.
- API Transportadoras para tracking/vinculación automática (§3 del docx) → excluida explícitamente del MVP en `prd.md` §5.3 y §7.2, decisión ya documentada y razonada (no es un gap, es una exclusión consciente).

## Gaps encontrados (4)

### 1. `DB_CRM_Light` no aparece en el addendum (arquitectura de datos)

`evidencias.docx` §3 especifica dos bases de datos como parte de la arquitectura propuesta: `DB_Maestra_Logística` (inventario/guías) **y** `DB_CRM_Light` ("Base de datos para gestionar clientes, historial de interacciones y alertas preventivas comerciales" — soporta FR-7/FR-8). El addendum solo recoge `DB_Maestra_Logística` en su sección "Endpoints y modelo de datos". `DB_CRM_Light` no se menciona en ningún lugar del PRD ni del addendum, pese a ser el componente de datos explícito para el módulo CRM Light. Recomendación: agregar a la sección de modelo de datos del addendum antes de `bmad-architecture`.

### 2. Orden de escaneo inconsistente entre el wireframe original y FR-4/UJ-3

`evidencias.docx` §4 y el wireframe que el addendum copia textualmente ("Flujo de UI a nivel wireframe") describen: **1) Escanear Guía Origen → 2) Escanear Guía Retorno**. Pero `prd.md` UJ-3 y FR-4 describen el orden invertido: el Analista **escanea primero la Guía de Retorno**, y el sistema le pide después la Guía de Despacho original. Esta es una diferencia real de flujo (probablemente una mejora deliberada del PRD sobre el caso de guía reemplazatoria), pero no está señalada ni reconciliada en ningún lado — el addendum preserva el wireframe viejo sin nota que explique el cambio de orden. Recomendación: agregar una nota en el addendum aclarando si el orden de UJ-3/FR-4 reemplaza intencionalmente el del wireframe original, para que UX no herede el flujo desactualizado.

### 3. Directriz arquitectónica "Backend: API REST robusta" no queda explícita como requisito

`evidencias.docx` §3 nombra explícitamente "API REST robusta para gestionar la lógica de negocio" como parte de la pila tecnológica. Ni `prd.md` ni `addendum.md` lo declaran como restricción/decisión — se infiere indirectamente de la tabla de endpoints (`POST /inventario/ingesta`, etc.) pero nunca se afirma como requisito de arquitectura. Gap menor: probablemente corresponde de forma natural a `bmad-architecture`, pero vale la pena que quede como insumo explícito en vez de implícito.

### 4. Tensión sin anotar: "ubicaciones" en el modelo de datos vs. no-objetivo de slotting

`evidencias.docx` §3 describe `DB_Maestra_Logística` como base para "inventario, movimientos, **ubicaciones**, guías y trazabilidad" — es decir, el diseño técnico original ya contemplaba un campo de ubicaciones en el modelo de datos. El PRD excluye explícitamente "ubicaciones ni slotting dentro de la bodega" del MVP (§6, Open Question 7), pero esa exclusión no menciona la tensión con el modelo de datos original que sí incluía ese campo. No es contradictorio (el campo puede existir sin usarse en MVP), pero no está anotado como algo a decidir en diseño de datos.

## Gap menor no listado por separado

- El principio de diseño explícito "flujo lineal, **un escaneo, una acción**" (`evidencias.docx` §3) no aparece como restricción UX nombrada en el PRD/addendum — está implícito en "cero fricción" pero no se cita textualmente. Bajo impacto, se menciona aquí por completitud pero no se cuenta como gap independiente.

## Conclusión

El addendum ya cubre la mayoría del contenido de `evidencias.docx` (matriz de evidencias, mapeo RF/RNF, wireframe de ingreso). Los gaps 1 y 2 son los más accionables antes de `bmad-architecture`/`bmad-ux`: falta el componente `DB_CRM_Light` en el modelo de datos, y hay un orden de escaneo contradictorio entre el wireframe heredado y la narrativa nueva de FR-4/UJ-3 que debería reconciliarse explícitamente.
