---
title: "Revisión Adversarial — PRD Mini ERP (WMS + CRM Light)"
target: "prd.md + addendum.md"
created: 2026-08-27
reviewer: "Adversarial Review (bmad-review-adversarial-general)"
---

# Revisión Adversarial — PRD [Nombre por definir]

Revisión cínica del PRD y su addendum, con foco en: (1) verificabilidad de las "Consecuencias" de cada FR, (2) consistencia de referencias cruzadas UJ↔FR y uso del Glosario, (3) riesgo de scope creep en §6/§7, (4) medibilidad de §8. El documento es, en general, disciplinado (marca sus propios `[ASSUMPTION]` con honestidad), pero eso no lo salva de varios huecos de fondo que un equipo de arquitectura/dev va a tropezar directamente al construir.

---

## Críticos

### C-1. FR-1 contradice §6 sobre gestión de catálogo — no se sabe de dónde sale el catálogo con códigos de barras
**Ubicación:** §4.1 FR-1 vs §6 No-Objetivos ("No gestionamos catálogo de productos ni creación/edición de referencias en Dropi o Mercado Libre en el MVP").

FR-1 asume que escanear un código de barras produce "Producto Reconocido" — es decir, presupone un catálogo ya poblado con código↔SKU. Pero §6 dice explícitamente que el MVP no gestiona catálogo de productos. FR-2 sí permite crear referencias ad hoc (sin código, por nombre/foto), pero para el camino principal de FR-1 (productos CON código) no hay ningún FR que explique cómo se puebla o mantiene ese catálogo con barcodes. ¿Viene sincronizado automáticamente desde Dropi (vía la API mencionada en §5.3)? ¿Se crea la primera vez que se escanea un código desconocido, igual que en FR-2? El texto no lo dice, y la lectura de §6 admite dos interpretaciones incompatibles: (a) "no tocamos el catálogo de Dropi/ML" (permite catálogo local propio) o (b) "no hacemos gestión de catálogo, punto" (bloquea la premisa de FR-1).

**Por qué importa:** esto no es un detalle de UX, es el modelo de datos raíz de todo el WMS. Dos equipos de arquitectura construirían esquemas de datos incompatibles.

**Fix sugerido:** agregar una Consecuencia explícita a FR-1 (o una nota en §5.3) que declare la fuente de verdad del catálogo con barcodes: p. ej. "el catálogo de productos con código de barras se sincroniza desde Dropi vía API; el sistema no permite crear productos con barcode manualmente, solo referencias sin barcode vía FR-2." Ajustar §6 para aclarar que el no-objetivo aplica solo a *edición* de catálogo en Dropi/ML, no a la existencia de un catálogo local de lectura.

---

### C-2. FR-3 no define el algoritmo de reconciliación multicanal (riesgo de sobreventa)
**Ubicación:** §4.2 FR-3.

FR-3 dice que el stock está "sincronizado entre Dropi, Mercado Libre y los movimientos internos" pero no especifica qué pasa cuando el mismo SKU se vende simultáneamente en Dropi y en ML. ¿El stock mostrado es la suma de ambos canales, el mínimo, o hay un mecanismo de reserva que decremente en ambos canales al vender en uno? Sin esta regla, dos ingenieros construirían soluciones con comportamientos de sobreventa completamente distintos — justo el escenario que el "semáforo" de FR-3 existe para prevenir.

**Por qué importa:** es el corazón de la propuesta de valor ("cero necesidad de conteo físico", SM-1). Si el algoritmo de reconciliación está mal definido, el semáforo puede mentir con confianza.

**Fix sugerido:** agregar una Consecuencia a FR-3 que defina la fuente de verdad de stock por canal y la regla de conflicto (p. ej. "el stock disponible = stock físico interno menos reservas activas en Dropi y ML; una venta en cualquier canal decrementa el stock visible en el otro en ≤Ns").

---

### C-3. FR-4: el mecanismo de "el sistema detecta automáticamente" no está especificado
**Ubicación:** §4.3 FR-4, primera Consecuencia ("El sistema distingue una Guía de Retorno de una Guía de Despacho al momento del escaneo").

No se explica *cómo* distingue el sistema una guía de retorno de una de despacho: ¿por formato/prefijo del número de guía, por consulta a la API de la transportadora o de Dropi, o porque el usuario indica explícitamente en la pantalla qué está escaneando? El addendum incluso documenta una contradicción entre fuentes sobre el orden de escaneo (Origen→Retorno vs Retorno→Origen) sin resolverla completamente ("a confirmar en el diseño UX antes de construir"), lo que confirma que el mecanismo de detección tampoco está cerrado. Un ingeniero podría construir un parser de patrones sobre el número de guía; otro, un simple selector manual "esto es una guía de retorno" — son arquitecturas distintas con distinto costo y distinta tasa de error.

**Fix sugerido:** decidir explícitamente el mecanismo de detección (o declarar como `[ASSUMPTION]` que es selección manual del usuario en el MVP, sin heurística automática) antes de pasar a arquitectura.

---

### C-4. FR-5: no está definido qué causas de devolución son "reutilizables"
**Ubicación:** §4.4 FR-5, Consecuencia "Si la causa indica producto reutilizable, el stock se actualiza automáticamente (condicional a la causa)".

El FR depende de una regla de negocio — qué combinación de las 4 causas (Compra Falsa / Rechazo Cliente / Retraso Bodega / Daño Transportadora) dispara reingreso a stock — que no aparece en ningún lugar del documento: ni en el Glosario, ni en la FR, ni en el addendum. Es razonable asumir que "Daño Transportadora" no reingresa y "Retraso Bodega" sí, pero "Compra Falsa" y "Rechazo Cliente" son ambiguos (depende de si el producto vuelve en condiciones vendibles). Sin esta tabla, no hay forma de escribir un caso de prueba objetivo para la Consecuencia tal como está redactada — "verificable" solo en apariencia.

**Fix sugerido:** agregar una tabla explícita causa→reingresa/no-reingresa (o marcarla `[ASSUMPTION]` a validar con los socios) antes de entregar a desarrollo.

---

### C-5. FR-7/FR-8 y el Glosario: el algoritmo del umbral es ambiguo entre "piso absoluto" y "caída relativa" — y la ambigüedad nace en la propia definición de Glosario
**Ubicación:** §3 Glosario ("Umbral de Caída de Volumen") + §4.6 FR-7 + FR-8.

La definición de Glosario dice: "nivel parametrizable de pedidos diarios ... **por debajo del cual** se dispara una alerta" — eso describe un piso absoluto (p. ej. "alertar si hoy < 20 pedidos"), que no requiere ningún histórico. Pero UJ-6 y FR-8 exigen mostrar "el porcentaje de caída visible" (200→20 = 90%), lo cual *sí* requiere una línea base histórica (¿promedio de los últimos N días? ¿el día anterior? ¿un valor configurado manualmente por dropshipper?). Son dos algoritmos de detección incompatibles conviviendo en el mismo documento: uno dispara por umbral fijo, el otro por caída relativa contra una base móvil. Además, "parametrizable por Dropshipper" no aclara si lo que se parametriza es el piso absoluto o el porcentaje de caída tolerado.

**Por qué importa:** es el motor entero del CRM Light. Construir el algoritmo equivocado no es un bug menor, es reconstruir el módulo.

**Fix sugerido:** reescribir la Consecuencia de FR-7 especificando explícitamente: (a) qué se compara contra qué (línea base = promedio móvil de X días vs. valor fijo configurado), y (b) si el disparador es el cruce de un piso absoluto, un % de caída, o ambos. Ajustar la entrada de Glosario para que coincida.

---

## Altos

### A-1. FR-1: contradicción entre "actualización en tiempo real por escaneo" y el flujo de "Guardar Ingesta"
**Ubicación:** UJ-1 ("Camino": "escanea... la app suma +1 automáticamente"; "Clímax": "presiona 'Guardar Ingesta' — el stock sube de inmediato") vs FR-1 Consecuencia ("Cada escaneo suma 1 unidad... al stock del producto").

UJ-1 sugiere dos momentos distintos de verdad: un contador visual que sube por cada escaneo (posiblemente solo en el estado local de la pantalla) y el stock real que solo sube al presionar "Guardar Ingesta" (según el propio texto de UJ-1: "el stock sube de inmediato" ocurre *en el clímax*, no durante el escaneo). La Consecuencia de FR-1, en cambio, afirma que el stock del sistema sube en cada escaneo individual. Esto determina si el ingreso es transaccional por lote (commit único al guardar, más seguro ante conectividad inestable en bodega — ver NFR de integridad en §5.1) o incremental en tiempo real (más simple, pero más frágil ante fallas de red a mitad de un lote de 40 unidades como en UJ-1).

**Fix sugerido:** aclarar explícitamente si el commit de stock es por escaneo individual o por lote al presionar "Guardar Ingesta", y si el `Ingesta_ID` corresponde a un escaneo o a la sesión completa de ingreso.

### A-2. FR-4: cita cruzada equivocada — "ver SM-1" debería ser "ver SM-2"
**Ubicación:** §4.3 FR-4, última Consecuencia: "Cero pérdida de trazabilidad para devoluciones procesadas por este flujo (ver SM-1)."

SM-1 (§8) es sobre dejar de contar físicamente el inventario — no tiene nada que ver con trazabilidad de guías. La métrica que sí habla de "Cero pérdidas de trazabilidad entre guía de despacho y guía de retorno" es **SM-2**. Es un error de referencia menor en esfuerzo de corrección, pero es exactamente el tipo de inconsistencia que un equipo de QA copia sin cuestionar al escribir criterios de aceptación.

**Fix sugerido:** cambiar "(ver SM-1)" por "(ver SM-2)" en FR-4.

### A-3. FR-3: la Consecuencia del semáforo no es verificable mientras los umbrales estén indefinidos
**Ubicación:** §4.2 FR-3: "Cada producto se muestra con indicador semafórico según nivel de stock (umbrales por definir con la Empresa Piloto)."

Una Consecuencia "verificable" que depende de un parámetro explícitamente no definido no es verificable todavía — es un placeholder con apariencia de criterio de aceptación. No es necesariamente un defecto del PRD (el propio Índice de Supuestos ya reconoce huecos similares), pero esta específica no está en §10 y debería estarlo, para que no se cuele a arquitectura como si fuera un requisito cerrado.

**Fix sugerido:** mover este punto a §10 Índice de Supuestos, o bloquear la entrega a UX/arquitectura hasta tener los umbrales reales de la Empresa Piloto.

### A-4. FR-6: "pedido de origen probable" no tiene criterio de corrección — la Consecuencia solo verifica que *existe* un vínculo, no que sea el correcto
**Ubicación:** §4.5 FR-6, Consecuencia "Cada unidad asignada queda vinculada a un `ID_Pedido` específico, igual que si hubiera pasado por FR-4."

El propio nombre del campo en UJ-5 es "pedido de origen **probable**" — es decir, el flujo admite de entrada que la asignación puede ser una estimación humana. Pero la Consecuencia solo comprueba que exista un vínculo a algún `ID_Pedido`, no que el vínculo sea correcto. Como la sugerencia automática de candidatos está marcada `[ASSUMPTION]` sin confirmar, en el peor caso el analista asigna a ciegas y el sistema lo registra como "trazabilidad recuperada" (alimentando SM-2) sin que realmente lo sea.

**Fix sugerido:** o bien confirmar la sugerencia automática de candidatos como parte del alcance del MVP (no solo assumption), o añadir una Consecuencia que reconozca explícitamente el riesgo de asignación incorrecta (p. ej. mecanismo de corrección/reversión de una asignación mal hecha).

### A-5. "Cliente"/"ficha del cliente" en FR-8/UJ-6 no usa el término de Glosario ("Dropshipper") y colisiona con "cliente final del dropshipper"
**Ubicación:** §4.6 FR-8, UJ-6 vs §3 Glosario.

El Glosario define formalmente "Dropshipper" como el rol cuyo volumen monitorea el CRM. Pero FR-8 y UJ-6 usan "cliente"/"ficha del cliente" en su lugar — y "cliente" ya está sobrecargado en el documento: la definición de "Guía de Despacho" habla del "cliente final del dropshipper" (el consumidor), y "Empresa Piloto" se describe informalmente como "el cliente real". Un ingeniero leyendo solo FR-8 podría modelar una entidad `Cliente` separada de `Dropshipper`, o confundir de cuál "cliente" se trata.

**Fix sugerido:** reemplazar "cliente"/"ficha del cliente" por "Dropshipper"/"ficha del Dropshipper" en FR-8 y UJ-6, consistente con el Glosario.

### A-6. FR-5 "actualiza el estado de la orden de venta asociada" puede implicar escritura hacia Dropi/ML, no cubierta explícitamente en §5.3
**Ubicación:** §4.4 FR-5 vs §5.3 Integraciones.

§5.3 describe la API de Dropi como fuente de "sincronización de inventario y estados de orden" para FR-3 (lectura hacia el tablero) y como consulta de guía para FR-4. No dice en ningún lado que el sistema escriba de vuelta hacia Dropi/ML el nuevo estado de una orden tras una devolución. Si FR-5 requiere ese write-back para que Dropi/ML reflejen la devolución, es una integración bidireccional no reconocida como tal en §5.3/§7.2 (que explícitamente excluye integraciones API "en tiempo real/bidireccionales" salvo lo indicado). Si en cambio "orden de venta" es una entidad puramente interna sin sync a Dropi/ML, la Consecuencia debería decirlo para evitar que arquitectura asuma lo contrario.

**Fix sugerido:** aclarar si "orden de venta" es una entidad interna o si implica escritura hacia Dropi/ML; si es lo segundo, agregarlo explícitamente a §5.3 como integración bidireccional del MVP (contradice hoy la exclusión de "integraciones API en tiempo real/bidireccionales" de §7.2).

---

## Medios

### M-1. FR-3: "elimina la necesidad de consulta manual o conteo físico" es una afirmación de beneficio, no una consecuencia verificable del sistema
No es un comportamiento del sistema que se pueda probar con un test — es un resultado operativo que solo se confirma observando a los usuarios semanas después del lanzamiento (se solapa, de hecho, con SM-1). Como criterio de aceptación de FR-3 es inútil para QA.
**Fix sugerido:** eliminar esta línea de "Consecuencias (verificables)" de FR-3 o reformularla como comportamiento del sistema ("el stock mostrado no requiere refresco manual ni fuente externa para decidir despacho").

### M-2. "Tablero Operativo" se usa como término propio (capitalizado) en FR-1 sin tener entrada en §3 Glosario
**Ubicación:** §4.1 FR-1 ("El stock actualizado se refleja en el Tablero Operativo (FR-3)").
Es el nombre informal de la feature de §4.2, pero al usarse como sustantivo propio en una Consecuencia de otra FR, debería estar en el Glosario junto a los demás términos de producto (WMS, CRM Light, PWA, etc.).
**Fix sugerido:** añadir "Tablero Operativo" a §3, o des-capitalizarlo y remitir solo a "§4.2 / FR-3".

### M-3. "Pedido" y "Orden de Venta" no están definidos formalmente en el Glosario pese a ser las entidades centrales del modelo de datos
Todo el documento gira sobre `ID_Pedido`, "pedido", y (en FR-5) "orden de venta" — usados aparentemente como sinónimos, pero nunca definidos, ni se aclara si son la misma entidad o dos conceptos distintos (p. ej. pedido = orden de Dropi/ML; orden de venta = registro interno).
**Fix sugerido:** agregar "Pedido" (y aclarar su relación con "Orden de Venta" si son distintos) a §3 Glosario.

### M-4. SM-1 no tiene instrumento de medición definido
**Ubicación:** §8, SM-1: "La bodega deja de contar físicamente el inventario para saber cuánto stock real hay."
Es una métrica de comportamiento humano post-lanzamiento sin método de verificación (¿encuesta? ¿observación en sitio? ¿ausencia de reportes de conteo manual?). Tal como está, no es gameable pero tampoco es verificable — nadie puede decir objetivamente "SM-1 se cumplió" sin definir cómo se mide.
**Fix sugerido:** definir el instrumento (p. ej. "cero solicitudes de conteo físico registradas en X semanas de uso, medidas por entrevista quincenal con el equipo operativo").

### M-5. SM-2 es gameable por omisión: excluye devoluciones que nunca entran al sistema
**Ubicación:** §8, SM-2: "...en las devoluciones procesadas por el sistema (vinculadas o asignadas manualmente)."
Si un caso difícil se resuelve fuera del sistema (papel, WhatsApp, como se hace hoy), automáticamente no cuenta para el denominador de SM-2 — la métrica puede lucir perfecta mientras la adopción real cae. SM-C1 vigila el volumen de fallback dentro del sistema (FR-2/FR-6), pero no vigila devoluciones que evitan el sistema por completo.
**Fix sugerido:** agregar una contra-métrica o instrumento que mida qué proporción de devoluciones totales de la Empresa Piloto pasa por el sistema (no solo qué proporción de las que sí pasan usa fallback).

### M-6. Tensión de scope: el addendum sugiere reservar un campo de "ubicación" de bodega pese al no-objetivo de slotting (§6)
**Ubicación:** `addendum.md`, "Tensión con el no-objetivo de slotting".
El propio addendum reconoce esta tensión y la deja como `[NOTE FOR PM]`, lo cual es honesto, pero es exactamente el tipo de decisión "inocente" en el modelo de datos que termina arrastrando lógica de slotting no presupuestada. Vale la pena que quede resuelta antes de arquitectura, no delegada silenciosamente a "a decidir en arquitectura".
**Fix sugerido:** que los socios decidan explícitamente sí/no sobre el campo antes de iniciar `bmad-architecture`, para que no sea una decisión unilateral del arquitecto.

### M-7. §5.3 dejó una puerta abierta a integración puntual con transportadoras que no está en §7.1 — riesgo de scope creep silencioso en la fase de arquitectura
**Ubicación:** §5.3, `[NOTE FOR PM]`: "vale la pena evaluar si una integración puntual con esas dos adelanta valor antes de Fase 2."
Está marcada como nota, no como requisito, así que no es un error del PRD — pero es una nota que un equipo de arquitectura con presión de tiempo puede leer como permiso implícito para ampliar alcance sin pasar por los socios. Vale la pena reforzar el guardarraíl.
**Fix sugerido:** agregar una línea explícita: "cualquier integración con transportadoras específicas requiere aprobación de los 3 socios antes de iniciarse, incluso si es 'puntual'."

---

## Bajos

### B-1. FR-5: qué cuenta como "interacción táctil" para el límite de 3 clics no está perfectamente acotado
UJ-4 describe 2 taps (causa + "Finalizar Registro"), dejando margen dentro del límite de 3, pero no se aclara si abrir la pantalla de tipificación o revisar el contenido físico cuenta como interacción. Riesgo bajo porque el margen (2 de 3) absorbe la ambigüedad.
**Fix sugerido:** aclarar en una nota que el conteo empieza en la pantalla de tipificación ya abierta (post FR-4/FR-6).

### B-2. Deriva terminológica: "Ingesta" (usado en `Ingesta_ID`, "Guardar Ingesta") vs "ingreso de mercancía" (usado en la prosa) sin entrada de Glosario que los una
**Fix sugerido:** agregar una línea al Glosario aclarando que "Ingesta" es el término técnico/UI equivalente a "ingreso de mercancía", o unificar el vocabulario.

### B-3. Deriva terminológica: `ID_Guía_Origen`/`guia_origen` (addendum, campo técnico) vs "Guía de Despacho" (PRD, término de negocio) no están explícitamente mapeados
**Fix sugerido:** una línea en el addendum ("`guia_origen` = Guía de Despacho") cerraría cualquier duda al construir el modelo de datos.

### B-4. SM-3: "sin resistencia ni quejas" es subjetivo y no tiene umbral
**Ubicación:** §8, SM-3.
¿Cuántas quejas son "resistencia"? ¿Una queja aislada de un usuario en la primera semana invalida la métrica? Sin umbral, es una frase de intención más que un criterio verificable — igual que M-4, pero de severidad menor porque SM-3 ya es explícitamente cualitativa por diseño del documento.
**Fix sugerido:** definir un umbral operativo mínimo (p. ej. "sin escalamientos formales de un usuario operativo en 4 semanas consecutivas de uso").

### B-5. §7.1 mezcla una capacidad de infraestructura ("Ejecutable en la nube, listo para uso real de la Empresa Piloto") con las 6 capacidades funcionales del MVP
No es incorrecto, pero rompe la homogeneidad de la lista (6 capacidades de producto + 1 estado de despliegue) y podría hacer que alguien cuente "7 capacidades" contra el "6 capacidades" de SM-3.
**Fix sugerido:** mover esa línea a NFR/§5 o marcarla aparte como "condición de entrega" distinta de las capacidades funcionales.

---

## Resumen de severidad

| Severidad | Cantidad |
|---|---|
| Crítico | 5 |
| Alto | 6 |
| Medio | 7 |
| Bajo | 5 |
| **Total** | **23** |

## Veredicto general

El PRD es honesto sobre sus propios huecos (usa `[ASSUMPTION]` de forma consistente y mantiene un Índice de Supuestos), pero eso no cubre varios problemas de fondo: FR-1 contradice al no-objetivo de catálogo de §6 sobre de dónde sale el producto reconocible por barcode, FR-3 no define cómo se reconcilia el stock entre Dropi y Mercado Libre (riesgo de sobreventa), FR-4 no dice cómo el sistema distingue una guía de retorno de una de despacho, FR-5 no define qué causas de devolución reingresan a stock, y el algoritmo de FR-7/FR-8 (piso absoluto vs. caída porcentual) es ambiguo desde la propia definición de Glosario. Ninguno de estos 5 puntos críticos está marcado como `[ASSUMPTION]` — son huecos silenciosos, no reconocidos, y cada uno puede producir arquitecturas incompatibles entre equipos distintos. Recomendación: resolver los 5 críticos y los 6 altos con los socios antes de entregar a `bmad-architecture`/`bmad-ux`; los medios y bajos pueden resolverse en paralelo durante el diseño técnico sin bloquear el arranque.
