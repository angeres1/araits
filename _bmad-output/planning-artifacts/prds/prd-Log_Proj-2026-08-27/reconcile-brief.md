---
title: "Reconciliación: Brief vs PRD — [Nombre por definir]"
created: 2026-08-27
---

# Reconciliación: Brief de Producto vs PRD Final

Comparación de contenido (no de redacción/estructura) entre:
- **Brief:** `_bmad-output/planning-artifacts/briefs/brief-Log_Proj-2026-07-05/brief.md` + `addendum.md`
- **PRD:** `_bmad-output/planning-artifacts/prds/prd-Log_Proj-2026-08-27/prd.md` + `addendum.md`

## Resultado general

La cobertura es alta. Los 5 elementos originales del problema, la solución (WMS + CRM Light), los 5 roles de usuario piloto, las 6 capacidades del MVP (HU-01 a HU-06 → FR-1 a FR-8), los criterios de éxito cualitativos, el alcance dentro/fuera del MVP (incluyendo Fase 2), los supuestos `[SUPUESTO]`, y las preguntas abiertas del brief están todos reflejados en el PRD — en varios casos ampliados con research adicional (competitivo, hallazgos de transcripción) que no contradice al brief.

Se encontraron **1 gap claro** y **1 contradicción/ambigüedad real** que ameritan validación con los socios, más 3 observaciones menores sin impacto material.

---

## 1. GAP — Datos históricos disponibles (no reflejado en el PRD)

**Brief (`addendum.md`, sección "Datos históricos disponibles"):**
> "La empresa piloto conserva respaldos de facturación, manifiestos y registros operativos desde 2022, aunque dispersos y sin estructurar. Podría ser insumo valioso para poblar el sistema o para reportes futuros (fuera del MVP)."

**PRD:** No hay ninguna mención de estos datos históricos ni en `prd.md` ni en su `addendum.md` — ni como fuente de migración/seed, ni como nota "fuera de alcance", ni como pregunta abierta.

**Por qué importa:** es información operativa concreta que el equipo técnico necesitará al diseñar el modelo de datos y el plan de puesta en marcha (¿se parte de cero o se migra algo?). Al no estar ni siquiera mencionada como "fuera de alcance" o como pregunta abierta, se pierde en la cadena brief → PRD → arquitectura.

**Recomendación:** agregar una línea en `prd.md` §9 (Preguntas Abiertas) o en el `addendum.md` técnico, del tipo: "¿Se usarán los respaldos históricos desde 2022 de la Empresa Piloto para poblar el sistema en el arranque, o el MVP parte de inventario en cero?" — así no se pierde antes de llegar a arquitectura.

---

## 2. CONTRADICCIÓN / AMBIGÜEDAD — Alcance de la API de transportadoras en el MVP

**Brief (`addendum.md`, "Propuesta de arquitectura"):**
Lista como integración externa de la arquitectura propuesta (sin marcarla explícitamente como Fase 2):
> "**API(s) de transportadoras** — tracking en tiempo real y vinculación de guías reemplazatorias."

Es decir, el propio documento de arquitectura de origen (`evidencias.docx`) sugiere que una integración con la API de transportadoras sirve directamente a la vinculación de guías reemplazatorias — que es HU-03/FR-4, una capacidad **dentro** del MVP.

Por otro lado, el brief principal (`brief.md`, "Fuera del MVP") sí pospone a Fase 2: "Integraciones más profundas / bidireccionales con transportadoras" y "Seguimiento automático de guías y conciliaciones operativas" — pero califica esas integraciones como "más profundas", dejando abierto si una integración *básica* (no "profunda") podría ser parte del MVP.

**PRD (`prd.md` §5.3):**
Resuelve esto de forma tajante en una dirección:
> "**API(s) de transportadoras** — **no forma parte del MVP.** FR-4 y FR-6 operan sobre escaneo o ingreso manual de la guía, no sobre integración API en tiempo real con las transportadoras; esa integración más profunda queda explícitamente en Fase 2."

**Por qué importa:** el PRD interpreta "más profundas" del brief como "cualquier integración con transportadoras", cerrando una puerta que el documento de arquitectura original (`evidencias.docx`, citado en el propio addendum del brief) dejaba entreabierta para el MVP. No es necesariamente un error — es una decisión de alcance razonable y bien documentada — pero es una interpretación, no una confirmación explícita de los socios. El propio PRD lo reconoce parcialmente con el `[NOTE FOR PM]` en §4.5 y §5.3 ("si se confirman las dos transportadoras específicas de FR-6, vale la pena evaluar si una integración puntual... adelanta valor"), lo cual sugiere que el equipo ya intuye esta tensión pero no la ha resuelto formalmente con los socios.

**Recomendación:** confirmar explícitamente con los socios que "cero integración con transportadoras en el MVP" (incluida cualquier integración básica de tracking) es la decisión correcta, no solo una inferencia del PRD sobre el alcance del brief.

---

## 3. Observaciones menores (sin acción requerida / ya resueltas)

- **Umbral de caída de volumen (200→20): diario vs semanal.** El `addendum.md` del brief registró el ejemplo como "de 200/semana a 20 en 7 días" (semanal); el PRD (`prd.md` FR-7, y su propio `addendum.md`) corrige a diario, citando confirmación directa del usuario el 2026-08-27 y la transcripción original de Hugo. **Esto ya es una contradicción explícitamente detectada y resuelta dentro del propio PRD** — no requiere acción adicional, se documenta aquí solo para que quede registrada en la reconciliación.

- **Inconsistencia interna del propio brief ("cinco" vs "seis" capacidades).** La sección "Criterios de Éxito" del `brief.md` todavía dice "las cinco capacidades del MVP" (lista solo HU-01 a HU-05), mientras que su propia sección "Alcance" (actualizada tras el feedback de Hugo) ya incluye HU-06 como sexta capacidad — es una inconsistencia dentro del brief mismo, no del PRD. El PRD la resuelve correctamente usando "6 capacidades" en SM-3.

- **Base de datos `DB_CRM_Light` no mapeada explícitamente en el PRD.** El brief nombra dos bases de datos en su propuesta de arquitectura: `DB_Maestra_Logística` y `DB_CRM_Light`. El `addendum.md` del PRD solo mapea endpoints/campos de datos para FR-1, FR-3, FR-4, FR-5 (todos sobre `DB_Maestra_Logística`); no hay mapeo de datos para FR-7/FR-8 (CRM Light) ni mención de `DB_CRM_Light`. Es previsible que esto se resuelva en la fase de arquitectura (`bmad-architecture`), pero vale la pena verificar que no se pierda.

- **Pregunta abierta genérica del brief no trasladada literalmente.** El brief addendum incluye como pregunta abierta: "cualquier información adicional del cliente piloto o de los socios que no esté todavía en docs/". El PRD no repite esta pregunta genérica, pero la reemplaza con preguntas abiertas más específicas y accionables (OQ4–OQ9) derivadas de una relectura de la transcripción — funcionalmente es una mejora, no una pérdida de contenido.

---

## Conclusión

El PRD es fiel y consistente con el brief en la gran mayoría del contenido, y en varios puntos lo mejora (corrige el umbral 200→20, resuelve la inconsistencia interna "5 vs 6 capacidades", amplía la investigación competitiva). Los dos puntos que sí requieren atención de los socios antes de pasar a arquitectura son: (1) los datos históricos desde 2022, ausentes del PRD; y (2) la decisión implícita de excluir toda integración con transportadoras del MVP, que el PRD infiere pero no confirma explícitamente contra la arquitectura propuesta en el brief.
