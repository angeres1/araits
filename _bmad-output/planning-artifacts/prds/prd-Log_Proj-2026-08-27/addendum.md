---
title: "Addendum — PRD [Nombre por definir]"
created: 2026-08-27
updated: 2026-08-27
---

# Addendum: Detalle Técnico y Contexto de Origen (PRD)

Contenido de apoyo para arquitectura/UX — no forma parte del PRD ejecutivo (`prd.md`), pero se preserva porque el equipo técnico lo necesitará en el siguiente paso (`bmad-ux`, `bmad-architecture`).

## Fuentes de este addendum

- `_bmad-output/planning-artifacts/briefs/brief-Log_Proj-2026-07-05/brief.md` + `addendum.md` — brief ya validado por los socios, con el feedback de Hugo (2026-07-13) incorporado.
- `docs/evidencias.docx` — matriz de evidencias, IDs de requisitos originales, y flujo de UI a nivel wireframe.
- `docs/Transcripción depurada y optimizada de reunion.docx` — reunión de diagnóstico entre Hugo, Ronhal y el representante de la empresa piloto.
- `docs/historias de usisario.xlsx` — 5 historias de usuario originales (HU-01 a HU-05) con endpoints y modelo de datos.
- `docs/Feedback Hugo Brief 13-7-2026.txt` — feedback de Hugo, origen de HU-06 / FR-6.
- Research de landscape competitivo (2026-08-27, ver sección propia más abajo).

## Mapeo de IDs: FR del PRD ↔ RF/RNF originales de `evidencias.docx`

`evidencias.docx` etiqueta los requisitos con un esquema propio (RF-01 a RF-03, RNF-01 a RNF-02). El PRD usa numeración global FR-1 a FR-8 por disciplina de documento (ver `prd.md` §0), pero se preserva el mapeo para trazabilidad hacia atrás:

| FR (PRD) | RF/RNF original (`evidencias.docx`) | Descripción |
|---|---|---|
| FR-1 | RF-01 | Guardar ingesta de stock |
| FR-4 | RF-02 | Escaneo guía de retorno |
| FR-5 | RF-03 | Finalizar registro de devolución |
| §5.1 (NFR transversal) | RNF-01 | Interacción nativa con periféricos de escaneo |
| §5.1 / §5.5 (NFR transversal / Plataforma) | RNF-02 | PWA multiplataforma |

FR-2, FR-3, FR-6, FR-7, FR-8 no tienen contraparte en `evidencias.docx` — son capacidades derivadas de `historias de usisario.xlsx` (FR-3, y los endpoints de FR-4/FR-5) o nacidas del feedback de Hugo (FR-2, FR-6) y de la historia HU-05 original (FR-7, FR-8).

## Flujo de UI a nivel wireframe (de `evidencias.docx`)

**Ingreso de stock:**
1. Botón "Ingresar Mercancía".
2. Ficha de producto + campo "Cantidad" con botones grandes (+1, +10) para sumar por escaneo consecutivo.
3. Indicador "Producto Reconocido" al escanear un código válido.
4. Botón verde "Guardar Ingesta".

**Devolución:**
1. Botón "Registrar Devolución".
2. "Escanear Guía Origen".
3. "Escanear Guía Retorno".
4. 4 botones de tipificación (opción única): Compra Falsa / Rechazo Cliente / Retraso Bodega / Daño Transportadora.
5. Botón verde "Finalizar Registro".

`[NOTE PARA UX]` Este flujo no contempla todavía las pantallas de FR-2 (fallback sin código de barras) ni FR-6 (asignación manual sin detalle) — son pantallas nuevas a diseñar desde cero, sin precedente en `evidencias.docx` ni en `historias de usisario.xlsx`.

`[NOTE PARA UX — CONTRADICCIÓN ENTRE FUENTES]` El wireframe de `evidencias.docx` lista los botones en orden "Escanear Guía Origen" → "Escanear Guía Retorno". Tanto `historias de usisario.xlsx` (HU-03 original) como `prd.md` FR-4/UJ-3 describen el orden inverso: el Analista escanea primero la Guía de Retorno, el sistema la reconoce como tal y *entonces* solicita la Guía de Despacho original (que puede estar impresa en el paquete o consultarse en Dropi) — este es el orden que gobierna el PRD, porque coincide con 2 de las 3 fuentes técnicas y con la narrativa validada por los socios en el brief. El wireframe de `evidencias.docx` puede reflejar solo la disposición visual de los botones en pantalla, no una secuencia obligatoria — a confirmar en el diseño UX antes de construir.

## Endpoints y modelo de datos por historia (de `historias de usisario.xlsx`)

| FR (PRD) | Endpoint | Campos / datos clave |
|---|---|---|
| FR-1 | `POST /inventario/ingesta` | `Ingesta_ID`, incremento de stock; sync condicional con Dropi ("si aplica") |
| FR-3 | `GET /inventario/stock` | Alimentado en tiempo real por FR-1 y FR-5; sync API Dropi/ML; mecanismo técnico sugerido en el Excel: WebSockets o polling (no decidido, a definir en arquitectura) |
| FR-4 | `POST /devoluciones/vincular` | `guia_origen`, `guia_retorno`, `ID_Pedido`; integración con "API Transportadoras" para tracking (nota: esta integración de tracking queda fuera del MVP, ver `prd.md` §5.3); la guía original "puede estar en el paquete o en Dropi" |
| FR-5 | `PATCH /devoluciones/tipificar` | Arranca tras FR-4; actualización de stock condicional ("si aplica"); también actualiza el estado de la orden de venta asociada (columna "Descripción del Proceso" del Excel, no solo el stock) |
| FR-7 / FR-8 | (Worker Service analítico, sin endpoint REST explícito en el Excel) | Output incluye "porcentaje de caída detectado"; permite click-through a ficha de cliente |

De `evidencias.docx` (matriz de evidencias), el problema raíz de devoluciones se nombra explícitamente con estos campos: **`ID_Guía_Origen`** y **`ID_Guía_Retorno`** — "desconexión relacional entre" ambos es el problema raíz técnico. Recomendado como base del modelo de datos de `DB_Maestra_Logística` para FR-4 y FR-6.

**Mapeo campo técnico ↔ término de negocio:** `guia_origen`/`ID_Guía_Origen` = **Guía de Despacho** (glosario `prd.md` §3); `guia_retorno`/`ID_Guía_Retorno` = **Guía de Retorno**. Mismo concepto, dos vocabularios (Excel/evidencias usan el técnico, PRD usa el de negocio) — se deja explícito aquí para que el modelo de datos no introduzca un tercer nombre.

**`DB_CRM_Light` (base de datos separada, no solo `DB_Maestra_Logística`):** tanto `evidencias.docx` §3 como `historias de usisario.xlsx` (HU-05) nombran explícitamente una segunda base de datos — `DB_CRM_Light` — para clientes, historial de interacciones y alertas comerciales, distinta de `DB_Maestra_Logística` (inventario/guías). Es la base de datos que soporta FR-7/FR-8. El brief original ya la mencionaba en su propio addendum técnico (sección de arquitectura); se preserva aquí explícitamente porque el primer borrador de este addendum la omitió.

**Tensión con el no-objetivo de slotting (`prd.md` §6):** el modelo de datos original de `DB_Maestra_Logística` (`evidencias.docx`) incluye un campo de ubicación/posición de bodega. El PRD excluye la gestión de slotting del MVP (§6), pero eso no impide que el modelo de datos reserve un campo de ubicación simple desde el inicio — a decidir en arquitectura si conviene incluirlo ahora (vacío/sin lógica) o agregarlo después. `[NOTE FOR PM]`

**Nota sobre `historias de usisario.xlsx`:** el Excel no tiene columnas formales de criterios de aceptación, prioridad/MoSCoW ni dependencias explícitas — todo el detalle vive embebido en las columnas de descripción de proceso y de herramientas/hardware. Las "Consecuencias (verificables)" de cada FR en `prd.md` §4 son una reconstrucción a partir de esas descripciones, no una transcripción literal de criterios de aceptación ya definidos.

## Dependencias entre historias (no explícitas en el brief original)

- FR-3 (tablero) depende de FR-1 (ingresos) y FR-5 (devoluciones) como fuentes de movimiento de stock, además de las sync API con Dropi/ML.
- FR-5 (tipificación) depende de FR-4 (vinculación de guías) o de FR-6 (asignación manual) — no puede tipificarse una devolución que no está vinculada o asignada primero.

## Hallazgos de la transcripción de reunión no traducidos a FR (candidatos a fase futura o brecha reconocida)

Referenciados como Open Questions 6-12 en `prd.md` §9:

- **Gestión de precios/márgenes:** "los precios varían bastante según la temporada, la disponibilidad y las condiciones del mercado" — no hay precio mínimo establecido ni herramienta centralizada para consultarlos. Frente operativo completo, sin HU asociada.
- **Conciliación de devoluciones por período:** hoy se escanean las guías de devolución, se guardan en un "archivo de control", y al finalizar el período se cruza esa información con Dropi para ver qué ingresó correctamente y qué queda pendiente. El MVP (FR-4/FR-6) resuelve la vinculación en el momento, no automatiza este ciclo de cierre.
- **Reclamación formal a la transportadora:** cuando el contenido de un paquete no corresponde a su guía, se identifica la inconsistencia, se documenta, y se reporta a la transportadora como novedad. No hay FR asociada.
- **Ubicaciones/slotting de bodega y creación de catálogo de productos:** mencionados como "en gran parte manual", sin HU asociada.
- **Procesos administrativos fuera de logística:** nómina y afiliaciones a seguridad social, facturación manual multi-línea de negocio — fuera del dominio de este producto.
- **Medición de tiempos por etapa de despacho:** pedido explícito de Ronhal ("entender mejor el proceso de despacho y medir los tiempos reales de cada etapa") — no traducido a FR ni a criterio de éxito; candidato a la línea de "Reportes e indicadores de negocio" ya marcada como Fase 2 en el brief.
- **Alternativa de arranque simple sugerida por Ronhal:** "Drive o una base de datos intermedia" antes de construir la solución estructurada — refuerza el supuesto de presupuesto acotado ya anotado en el brief y en `prd.md` §7.2, con esta alternativa concreta explícita si el equipo técnico necesita un punto de partida más liviano.
- **Cifras de escala mencionadas (contexto, no confirmadas como SLA):** conteos aproximados de "200 o 250 unidades disponibles, sin certeza exacta"; hipotético de Ronhal de "una operación que recibe en promedio mil devoluciones diarias" (más específico que el "cientos o miles" del brief, pero no confirmado como cifra real de la Empresa Piloto).
- **Datos históricos desde 2022:** la Empresa Piloto conserva respaldos de facturación, manifiestos y registros operativos desde 2022 — dispersos y sin estructurar, pero valorados por los tres participantes de la reunión (Hugo, Ronhal y el representante de la Empresa Piloto) como insumo aprovechable para poblar el sistema o para reportes futuros. Ver `prd.md` §9, Open Question 10.
- **"Otras empresas del grupo":** el brief menciona ventas fuera de Dropi/Mercado Libre en "otras empresas del grupo", sin detalle de qué canal o sistema usan. No traducido a integración ni a alcance explícito. Ver `prd.md` §9, Open Question 11.
- **Preferencia por atención WhatsApp humana, sin bot:** la Empresa Piloto expresó preferencia explícita por que el contacto de retención (FR-8) sea personalizado, no automatizado — ya reflejado como consecuencia verificable en `prd.md` FR-8.

## Discrepancia de umbral HU-05 / FR-7 — resuelta

Tres fuentes técnicas usan tres redacciones distintas para el mismo umbral:

- **Addendum del brief** (`brief-Log_Proj-2026-07-05/addendum.md`): "de 200/semana a 20 en 7 días".
- **Transcripción original** (cita textual de Hugo): "200 pedidos **diarios** y de repente baja a 20".
- **`historias de usisario.xlsx`** (HU-05 original): formula el umbral con su propio calificador "en 7 días", sin especificar si la base de comparación es diaria o semanal — redacción ambigua, ni confirma ni contradice directamente a las otras dos.

El usuario confirmó el 2026-08-27 que la cifra correcta es **diaria** (200/día cayendo a 20/día dispara la alerta); `prd.md` FR-7 ya refleja esta corrección. El addendum del brief original queda con la cifra desactualizada — no se modificó retroactivamente porque ese documento ya está fuera del flujo activo de edición (su rol terminó al pasar a PRD).

## Research de landscape competitivo (2026-08-27, refresh sobre el digest del brief)

Verificación dirigida a confirmar o refutar la brecha de mercado ya documentada en el brief (reconciliación guía-original/guía-retorno, y devoluciones consolidadas sin detalle):

- **Extensiv/Skubana** (heredero de Skubana, referencia en OMS/3PL de EE. UU.): su propia documentación de ayuda confirma que "los sister-documents no se usan en el proceso de devolución, lo que significa que la orden de salida original y la nueva orden de entrada no quedan conectadas" — recomienda workarounds manuales tipo hoja de cálculo para RMAs. Confirmación directa del proveedor de que el problema persiste incluso en herramientas de nivel enterprise más maduras que las evaluadas originalmente en el brief. Fuente: [Returns Management - Extensiv](https://help.extensiv.com/warehouse-manager/returns-management).
- **Zoho Inventory:** su RMA vincula devoluciones a una orden de venta específica, pero sin evidencia de manejo de paquetes consolidados de múltiples pedidos en una sola guía de retorno (el caso exacto de FR-6). Fuente: [Zoho Inventory RMA](https://www.zoho.com/us/inventory/help/sales-returns/sales-returns-overview.html).
- **ShipHero, Cin7, Linnworks:** manejo de RMA/garantías estándar, sin mención de vinculación automática guía-retorno↔guía-despacho ni de paquetes multi-pedido sin detalle.
- **Dropi — "Ecom Scanner" (hallazgo nuevo, no estaba en el digest del brief):** app reciente que agrega trazabilidad de *entrada* a bodega (escaneo, manifiesto de recepción) para la red de fulfillment propia de Dropi, pero sin evidencia de que vincule esa entrada con la guía de despacho original ni de que resuelva devoluciones consolidadas de múltiples pedidos. No cambia la conclusión de brecha real. `[NOTE PARA PM]` vale la pena que los socios validen si la Empresa Piloto ya usa o conoce esta herramienta.
- **Agregadores regionales (Enviame, Envíoclick, Shiptify):** confirman gestión de devoluciones a nivel multicourier, sin evidencia pública de reconciliación guía-original/retorno.
- **Descartado:** TradeGecko/QuickBooks Commerce fue descontinuado por Intuit en 2023 — no es alternativa viable a evaluar en futuras rondas.
- **RFM / alertas de caída de volumen (FR-7/FR-8):** patrón bien establecido en e-commerce general para 2025-2026 ("intervenir antes de perder al cliente"), consistente con el digest original del brief; sin ejemplos específicos de dropshipping B2B (vendedor→proveedor) encontrados.

**Conclusión:** no se encontró nada que refute "brecha real, nadie lo resuelve" — al contrario, se encontró confirmación directa de un proveedor maduro (Extensiv) de que el problema persiste sin resolver.
