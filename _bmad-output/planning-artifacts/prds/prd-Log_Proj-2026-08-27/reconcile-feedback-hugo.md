---
title: "Reconciliación — Feedback Hugo (13-7-2026) vs. PRD final"
created: 2026-08-27
---

# Reconciliación: `docs/Feedback Hugo Brief 13-7-2026.txt` vs. `prd.md` (FR-2, FR-6, UJ-1, UJ-5) + `addendum.md`

## Fuente

Feedback textual de Hugo (transcripción de audio/nota de voz), dos puntos:

1. Mercancía importada "no tiene ni siquiera código de barras".
2. "Esa información o esa guía que generan las transportadoras no dice qué es esto cruzando al otro lado" (dos transportadoras específicas) → propone darle a la persona la opción de leer la información, meterla al sistema, y "decirle, esto se lo va a asignar a este, esto se lo va a asignar a este" — para que "puedan ir bajando el inventario de devoluciones más fácil".

## Punto 1 — Mercancía sin código de barras: cobertura ✔️

Capturado sin brechas relevantes en UJ-1 (§2.3) y FR-2 (§4.1): origen "importada", ausencia de "código de barras de fábrica", flujo manual guiado (buscar/crear referencia por nombre/foto), sin bloquear el ingreso. `addendum.md` registra correctamente que el flujo exacto de búsqueda/creación no está especificado (Open Question 5, Índice de Supuestos §10). No se identifican matices perdidos de este punto.

## Punto 2 — Guías sin detalle / asignación manual: cobertura con 2 matices no capturados

UJ-5, FR-6 (§4.5) y el Glosario ("Guía de Retorno sin Detalle") capturan correctamente el mecanismo central que pidió Hugo: registrar/leer la guía, marcarla "sin detalle", y una pantalla de asignación **uno-a-uno** ("esto se lo asigna a este, esto se lo asigna a este" → "presenta una pantalla de asignación uno-a-uno"). También capturan bien que son "al menos dos transportadoras" (Open Question 4) y que no hay cruce automático posible.

Dos matices del feedback original no quedaron reflejados:

### Gap A — "Consolidación de múltiples pedidos" es una inferencia no marcada como supuesto

El PRD define y reafirma repetidamente (Glosario, descripción de FR-6, UJ-5, §4.3 Fuera de Alcance de FR-4, §7.1) que el problema es una guía que **"consolida mercancía de múltiples pedidos"** o llega como **"paquete consolidado"**. Hugo, en el texto literal, solo dice que la guía "no dice qué es esto cruzando al otro lado" — nunca menciona explícitamente que se trate de varios pedidos empacados juntos en un solo bulto. Podría tratarse igualmente de devoluciones de un solo pedido cuya guía simplemente no describe el contenido. La lectura de "consolidación multi-pedido" es plausible (y probablemente correcta, dado el contexto de negocio), pero en el PRD aparece como hecho definitorio sin la marca `[ASSUMPTION]` que sí se usó para otros puntos no confirmados por Hugo (p. ej. "sugiere pedidos candidatos"). Recomendación: marcar explícitamente esta lectura de "consolidación multi-pedido" como supuesto heredado de otra fuente (transcripción/evidencias, no del feedback de Hugo) o confirmarla con Hugo directamente junto con la Open Question 4.

### Gap B — Motivación explícita de Hugo ("bajar el inventario de devoluciones más fácil") no aparece como consecuencia ni métrica de FR-6

Hugo cierra el punto 2 explicando el *para qué*: que la asignación manual permite "ir bajando el inventario de devoluciones más fácil" — es decir, la velocidad/facilidad de procesar el backlog de devoluciones pendientes, no solo restaurar la trazabilidad. Las "Consecuencias (verificables)" de FR-6 y la métrica asociada (SM-2) están redactadas en términos de trazabilidad ("cero pérdida de trazabilidad... vinculadas o asignadas manualmente"), no en términos de velocidad/reducción de backlog de devoluciones pendientes por procesar. Es un matiz de motivación de negocio, no un requisito funcional adicional, pero no quedó explícito en ninguna consecuencia verificable ni nota de FR-6.

## Matiz menor (no listado como gap principal)

Hugo introduce el punto 2 con "hasta donde tengo entendido" — un calificador de incertidumbre sobre la premisa misma (no solo sobre cuáles transportadoras). El PRD solo abre una Open Question (#4) sobre identificar las transportadoras específicas, no sobre si la premisa general ("las guías no dicen contenido") está confirmada por Hugo o es su impresión. Bajo impacto — el diseño técnico ya deriva de validar con los socios (Open Question 4), lo cual cubriría implícitamente este matiz.

## Resumen

- Punto 1 (código de barras): sin brechas.
- Punto 2 (asignación manual): 2 matices no capturados — (A) la "consolidación multi-pedido" se presenta como hecho sin marca de supuesto, y (B) la motivación explícita de Hugo (velocidad de reducir el backlog de devoluciones) no está reflejada en consecuencias/métricas de FR-6.
