---
title: "Reconciliación — Transcripción de reunión vs. PRD final"
created: 2026-08-27
input: "docs/Transcripción depurada y optimizada de reunion.docx"
compared_against:
  - "_bmad-output/planning-artifacts/prds/prd-Log_Proj-2026-08-27/prd.md"
  - "_bmad-output/planning-artifacts/prds/prd-Log_Proj-2026-08-27/addendum.md"
---

# Reconciliación: Transcripción de reunión vs. PRD final

## Método

Se extrajo el texto completo de `docs/Transcripción depurada y optimizada de reunion.docx` (486 líneas, 8 partes + resumen de "Posibles prioridades identificadas") vía `textutil -convert txt`. Se comparó línea por línea contra `prd.md` (317 líneas) y `addendum.md` (99 líneas), excluyendo explícitamente:

- Lo ya resuelto: el umbral de FR-7 es diario (200→20 pedidos/día) — confirmado por el usuario 2026-08-27, documentado en `addendum.md` §"Discrepancia de umbral HU-05/FR-7 — resuelta".
- Lo ya clasificado como fuera de alcance en `prd.md` §6/§7.2 o en `addendum.md` §"Hallazgos de la transcripción de reunión no traducidos a FR": precios/márgenes, conciliación de devoluciones por período, reclamación formal a transportadora, slotting/ubicaciones, catálogo de productos, nómina/facturación, medición de tiempos de despacho.

## Gaps genuinos encontrados (3)

### Gap 1 — Otras líneas de negocio del grupo, más allá de Dropi y Mercado Libre

**Cita (línea 52):** Representante de la empresa: "Sí. No solamente trabajamos con Dropi. También tenemos operaciones relacionadas con Mercado Libre y **otras empresas del grupo**."

El PRD (Visión §1, Glosario §3, Integraciones §5.3) circunscribe explícitamente el alcance a Dropi + Mercado Libre. La mención de "otras empresas del grupo" como una tercera fuente de operaciones/inventario no aparece en ningún punto del PRD ni del addendum, ni como supuesto, ni como pregunta abierta (§9), ni como fuera de alcance explícito (§6/§7.2). No se sabe si esas otras empresas comparten el mismo inventario/bodega que se está modelando o si son operaciones independientes — es una ambigüedad de alcance no resuelta.

**Recomendación:** agregar a §9 Preguntas Abiertas: "¿Las 'otras empresas del grupo' mencionadas en la reunión de diagnóstico comparten el mismo inventario/bodega del MVP, o son operaciones independientes fuera de alcance?"

### Gap 2 — Preferencia explícita por atención NO automatizada/personalizada (sin bot) en WhatsApp

**Citas (líneas 7-13):**
- Hugo: "¿Tienen configurado algún mensaje automático de bienvenida?" — Representante: "No. Las respuestas automáticas requieren activarse mediante comandos."
- Hugo: "¿Y utilizan mensajes automáticos fuera del horario laboral?" — Representante: "No me gusta hacerlo porque siento que algunos mensajes pueden quedarse sin atención."
- Representante: "Buscamos que la atención sea más personalizada y que el cliente no sienta que está hablando con un bot."

Esta es una restricción de diseño explícita y deliberada del socio/representante de la empresa piloto sobre cómo debe (o no debe) comportarse cualquier funcionalidad relacionada con WhatsApp. FR-8 (§4.6) usa un "enlace directo a WhatsApp para contacto inmediato" — que de hecho es *coherente* con esta preferencia (abre una conversación manual, no envía mensajes automáticos) — pero el PRD no documenta la preferencia en sí ni el razonamiento detrás de por qué FR-8 se diseñó como enlace manual y no como mensaje automático disparado por el sistema. No aparece en NFRs (§5.1), en el Glosario, ni en el addendum. Si en una fase futura se considerara automatizar el contacto (p. ej., mensaje automático al Dropshipper en vez de solo alertar al Coordinador Comercial), este matiz sería el criterio de diseño relevante y hoy no está registrado en ningún documento.

**Recomendación:** agregar una nota en §5.1 (NFRs) o en la descripción de FR-8: "El contacto con el Dropshipper es siempre iniciado manualmente por el Coordinador Comercial (enlace a WhatsApp, no mensaje automático) — refleja preferencia explícita de la empresa piloto por atención personalizada, sin bot (reunión de diagnóstico)."

### Gap 3 — Archivo histórico existente desde 2022 (manifiestos, facturación, registros operativos)

**Citas (líneas 377-390):**
- Representante: "También administramos archivos relacionados con manifiestos, documentación logística y soportes operativos."
- Ronhal: "¿Qué información tienen actualmente documentada y almacenada?" — Representante: "Tenemos respaldos de facturación, manifiestos, registros históricos y diferentes archivos operativos."
- Hugo: "¿Desde cuándo conservan esa información?" — Representante: "Tenemos registros históricos **desde 2022**." — Ronhal: "Eso representa una base de información bastante valiosa." — Hugo: "Entonces existe una oportunidad para digitalizar y explotar mejor esos datos."

Este es un hallazgo concreto y aislado: existe un activo de datos históricos de ~4 años (2022–2026) ya almacenado (aunque no estructurado), y los tres participantes coinciden en que representa valor potencial ("base de información bastante valiosa", "oportunidad para digitalizar y explotar"). No aparece mencionado en ningún lugar del PRD ni del addendum — ni como fuera de alcance, ni como pregunta abierta, ni como supuesto de migración/carga inicial de datos para el MVP. Es relevante porque toca dos decisiones que sí importan al MVP: (a) si hay que migrar/importar este histórico al lanzar el producto, y (b) si el diseño del modelo de datos (`DB_Maestra_Logística`, mencionado en el addendum) debería contemplar la ingesta de este archivo histórico o tratarlo como fuera de alcance de forma explícita.

**Recomendación:** agregar a §9 Preguntas Abiertas: "¿El histórico de registros desde 2022 (manifiestos, facturación, soportes operativos) requiere migración/carga inicial al MVP, o el producto arranca con inventario en cero sin heredar ese archivo?"

## Notas menores (no contadas como gaps — cobertura razonable existente)

- La lista de "Fase 2" del cierre de la transcripción (líneas 469-475) incluye "Conciliaciones operativas" como ítem separado de "Conciliaciones financieras y de cartera". El PRD §7.2 solo nombra explícitamente esta última y la "Conciliación de devoluciones formalizada por período" (ya en el addendum) — se interpreta razonablemente como la misma conciliación operativa mencionada en la transcripción, por lo que no se cuenta como gap adicional.
- La idea de un chatbot de proveeduría alimentado por Dropi (líneas 15-19), descartada en la misma conversación por las restricciones de acceso de Dropi, no se tradujo a FR — pero fue una idea explorada y abandonada dentro de la propia reunión, no un requisito pendiente.
- La ambigüedad terminológica "proveedor" vs. "dropshipper" en la línea 98 (Ronhal) se interpreta en contexto como referencia al mismo concepto de FR-7/FR-8 (caída de volumen de un Dropshipper), no como un actor distinto sin cubrir.
