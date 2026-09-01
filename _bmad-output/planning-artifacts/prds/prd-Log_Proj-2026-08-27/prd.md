---
title: "PRD: [Nombre por definir] — Mini ERP (WMS + CRM Light) para Dropshipping"
status: draft
created: 2026-08-27
updated: 2026-08-27
---

# PRD: [Nombre por definir]
*Working title — confirmar con los socios (ver §9, Open Question 1).*

## 0. Propósito del Documento

Este PRD traduce el brief de producto ya validado por los tres socios (`_bmad-output/planning-artifacts/briefs/brief-Log_Proj-2026-07-05/brief.md` + `addendum.md`, con el feedback de Hugo del 2026-07-13 ya incorporado) en requisitos funcionales accionables para arquitectura, UX y desarrollo. Está dirigido a los tres socios fundadores (como dueños de producto) y al equipo técnico que construya el MVP. Estructura: vocabulario anclado en el Glosario (§3), features agrupadas con FRs anidados y numerados globalmente (§4), supuestos marcados inline con `[ASSUMPTION]` e indexados en §10. El detalle técnico de wireframes, endpoints y modelo de datos vive en `addendum.md` de esta misma carpeta — este documento no lo duplica.

## 1. Visión

**[Nombre por definir]** es un Mini ERP — WMS (control de inventario y devoluciones) + CRM Light (alertas comerciales preventivas) — para operaciones de dropshipping en LatAm que venden por Dropi y Mercado Libre, dependen de transportadoras tercerizadas, y hoy sostienen su inventario a punta de conteos físicos, WhatsApp y Excel.

El producto resuelve dos problemas que hoy nadie en el mercado resuelve bien: la pérdida de trazabilidad cuando una transportadora reemplaza la guía de despacho original por una "guía reemplazatoria" al devolver mercancía, y la ausencia de una alerta temprana cuando un dropshipper reduce drásticamente su volumen de pedidos. La investigación de mercado para este PRD confirma la brecha de forma directa: incluso un jugador maduro como Extensiv/Skubana documenta en su propia ayuda que "los sister-documents no conectan la orden de salida con la de retorno" y recomienda hojas de cálculo como workaround manual — el mismo síntoma que sufre la empresa piloto.

Nace de un problema real detectado por uno de los socios fundadores (revendedor de Dropi) en un cliente propio, y se construye primero como MVP para ese cliente piloto — con interfaz táctil de cero fricción (pistola de escaneo, botones gigantes, semáforo de colores) — antes de venderse a otras operaciones similares a través de la red de clientes Dropi que el socio ya tiene.

## 2. Usuario Objetivo

### 2.1 Trabajos por Resolver (Jobs To Be Done)

- Como **Auxiliar de Bodega**, necesito registrar el ingreso de mercancía sin digitar cantidades, aunque el producto no traiga código de barras.
- Como **Personal de Alistamiento**, necesito ver cuánto stock hay realmente disponible, sin tener que preguntar ni cruzar Dropi con Mercado Libre a mano.
- Como **Analista de Devoluciones**, necesito recuperar la relación entre una guía de retorno y su guía de despacho original, incluso cuando la transportadora la reemplaza o cuando el paquete que llega no trae ningún detalle de a qué pedido pertenece.
- Como **Operador de Bodega**, necesito clasificar el motivo de una devolución en segundos, no en minutos.
- Como **Coordinador Comercial**, necesito enterarme de que un dropshipper está a punto de irse antes de que sea tarde para retenerlo.

### 2.2 No-Usuarios (v1)

- Personal administrativo/financiero (nómina, facturación multi-línea de negocio) — mencionado en la reunión de diagnóstico como proceso manual, pero sin relación funcional con el WMS/CRM de este MVP (ver §6, §9 Open Question 8).
- Un analista que solo necesita reportes/indicadores agregados (rotación, desempeño) — explícitamente Fase 2 (§7.2).

### 2.3 Recorridos Clave del Usuario

- **UJ-1. Marta registra 40 unidades importadas, la mitad sin código de barras.**
  - **Persona + contexto:** Marta, Auxiliar de Bodega, recibe un lote mixto: productos con código de barras de fábrica y productos importados sin código, anunciados hasta ahora por WhatsApp.
  - **Estado de entrada:** autenticada en la PWA desde la tablet de bodega, pantalla "Ingresar Mercancía".
  - **Camino:** escanea con la pistola cada unidad con código — la app suma +1 automáticamente y confirma "Producto Reconocido"; para las unidades sin código, usa el fallback manual: busca o crea la referencia por nombre/foto, y confirma cantidad con los botones grandes (+1/+10).
  - **Clímax:** presiona "Guardar Ingesta" — el stock sube de inmediato y ve la confirmación visual en pantalla, para ambos tipos de producto.
  - **Resolución:** el tablero de Personal de Alistamiento (UJ-2) refleja el nuevo stock sin que Marta tenga que avisar a nadie por WhatsApp.
  - **Caso borde:** si Marta no encuentra la referencia sin código de barras en el fallback manual, el sistema le permite crearla ahí mismo con foto y nombre en vez de bloquear el ingreso. *(Realiza FR-1, FR-2.)*

- **UJ-2. Camilo alista un pedido sin llamar a bodega para confirmar stock.**
  - **Persona + contexto:** Camilo, Personal de Alistamiento, recibe una orden de Mercado Libre y necesita saber si hay unidades disponibles antes de prometerle fecha de despacho al cliente.
  - **Estado de entrada:** autenticado, tablero táctil abierto en su estación de trabajo.
  - **Camino:** busca el producto, ve el semáforo (verde = disponible, amarillo = bajo, rojo = agotado), sincronizado en tiempo real con Dropi y Mercado Libre.
  - **Clímax:** confirma el pedido para despacho sin llamar ni caminar hasta bodega a contar físicamente.
  - **Resolución:** el pedido queda alistado con certeza de stock real. *(Realiza FR-3.)*

- **UJ-3. Sofía recupera la trazabilidad de una guía reemplazatoria.**
  - **Persona + contexto:** Sofía, Analista de Devoluciones, recibe un paquete devuelto cuya guía ya no es la original — la transportadora emitió una guía de retorno nueva.
  - **Estado de entrada:** autenticada, pantalla "Registrar Devolución".
  - **Camino:** registra la guía de retorno, indicando en pantalla que es una guía de retorno; el sistema le pide entonces escanear (o buscar) la guía de despacho original —que puede estar impresa en el paquete o consultarse en Dropi.
  - **Clímax:** el sistema vincula ambas guías y restaura la trazabilidad comercial perdida, sin que Sofía tenga que cruzar manualmente contra Dropi.
  - **Resolución:** la devolución queda lista para tipificación (UJ-4). *(Realiza FR-4.)*
  - **Caso borde:** si el paquete devuelto no trae ninguna guía identificable de pedido individual (llega consolidado con otros), Sofía deriva a la Asignación Manual de Devoluciones sin Detalle (UJ-5) en vez de este flujo.

- **UJ-4. Diego tipifica una devolución en menos de 3 clics.**
  - **Persona + contexto:** Diego, Operador de Bodega, abre un paquete ya vinculado a su guía original (tras UJ-3).
  - **Estado de entrada:** autenticado, devolución con guías ya vinculadas, pantalla de tipificación abierta.
  - **Camino:** revisa el contenido físico y presiona uno de los 4 botones gigantes de opción única: Compra Falsa / Rechazo Cliente / Retraso Bodega / Daño Transportadora.
  - **Clímax:** presiona "Finalizar Registro" — si el producto vuelve a estar disponible, el stock se actualiza automáticamente.
  - **Resolución:** la devolución queda cerrada y trazada de principio a fin. *(Realiza FR-5.)*

- **UJ-5. Sofía asigna manualmente un bulto de devolución sin detalle de una transportadora.**
  - **Persona + contexto:** Sofía recibe un paquete consolidado de una de las dos transportadoras que no incluyen en su guía qué contiene el envío — solo llega el bulto físico.
  - **Estado de entrada:** autenticada, ya intentó el flujo normal de vinculación (UJ-3) y el sistema no encuentra una guía de despacho asociable automáticamente.
  - **Camino:** registra/escanea la guía de la transportadora, el sistema la marca "retorno sin detalle" y presenta una pantalla de asignación uno-a-uno: por cada unidad física que Sofía identifica al abrir el bulto, la asigna al pedido de origen correspondiente. *[ASSUMPTION: el sistema sugiere pedidos candidatos por dropshipper/fecha/referencia para agilizar la asignación — no confirmado en el feedback de Hugo, a validar en diseño técnico.]*
  - **Clímax:** cada unidad queda asignada a su pedido real, en vez de perderse como "devolución genérica".
  - **Resolución:** las unidades asignadas entran al flujo de tipificación (UJ-4) igual que una devolución vinculada normalmente. *(Realiza FR-6.)*

- **UJ-6. Laura recibe la alerta de un dropshipper que está a punto de irse.**
  - **Persona + contexto:** Laura, Coordinadora Comercial, gestiona decenas de dropshippers y no tiene forma hoy de saber cuál está bajando su volumen hasta que ya es tarde.
  - **Estado de entrada:** el worker diario ya corrió en la madrugada.
  - **Camino:** abre su bandeja de alertas priorizadas, ve que un dropshipper cayó de 200 a 20 pedidos/día, con el porcentaje de caída visible.
  - **Clímax:** hace clic en la alerta, ve la ficha del Dropshipper y su historial comercial, y desde ahí un enlace directo a WhatsApp para contactarlo de inmediato.
  - **Resolución:** Laura retiene al dropshipper antes de perderlo, en vez de enterarse cuando ya se fue. *(Realiza FR-7, FR-8.)*

## 3. Glosario

- **Empresa Piloto** — el cliente real donde se valida el MVP antes de vender el producto a otras operaciones similares.
- **Dropshipper** — vendedor/cliente comercial de la Empresa Piloto cuyo volumen de pedidos monitorea el CRM Light.
- **Dropi** — plataforma de dropshipping/fulfillment que la Empresa Piloto usa hoy como si fuera un WMS, sin serlo.
- **Mercado Libre (ML)** — canal de venta adicional cuyo inventario y ventas deben reconciliarse con Dropi.
- **WMS** — módulo de Control de Inventario y Devoluciones de este producto.
- **CRM Light** — módulo de Alertas Comerciales Preventivas de este producto.
- **Auxiliar de Bodega** — rol que registra ingreso de mercancía (UJ-1).
- **Personal de Alistamiento** — rol que consulta stock disponible para despachar pedidos (UJ-2).
- **Analista de Devoluciones** — rol que vincula guía de retorno con guía de despacho, incluida la asignación manual sin detalle (UJ-3, UJ-5).
- **Operador de Bodega** — rol que tipifica la causa de una devolución (UJ-4).
- **Coordinador Comercial** — rol que recibe y actúa sobre alertas de caída de volumen (UJ-6).
- **Guía de Despacho** (también "guía original") — documento de transporte emitido al enviar un pedido al cliente final del dropshipper.
- **Guía de Retorno** — documento de transporte emitido por la transportadora al devolver un paquete a la Empresa Piloto.
- **Guía Reemplazatoria** — evento en el que la transportadora emite una Guía de Retorno con número distinto al de la Guía de Despacho original, rompiendo la trazabilidad si no se vinculan explícitamente.
- **Guía de Retorno sin Detalle** — Guía de Retorno que no indica a qué pedido pertenece la mercancía devuelta; requiere Asignación Manual (UJ-5) en vez de Vinculación Inteligente (UJ-3). `[ASSUMPTION]` se asume que puede consolidar unidades de múltiples pedidos en un solo envío — no confirmado explícitamente por el socio que reportó el problema.
- **Tipificación de Devolución** — clasificación de la causa de una devolución en una de 4 categorías: Compra Falsa, Rechazo Cliente, Retraso Bodega, Daño Transportadora. Determina si la unidad reingresa a stock (ver FR-5).
- **Umbral de Caída de Volumen** — porcentaje de caída parametrizable del volumen diario de pedidos de un Dropshipper respecto a su línea base (promedio móvil de 7 días), por debajo del cual se dispara una alerta (ejemplo de referencia: caída de ~90%, equivalente a pasar de 200 a 20 pedidos/día — ver FR-7). `[ASSUMPTION]` mecanismo de caída relativa contra línea base móvil, no piso absoluto fijo — no confirmado por los socios.
- **PWA** — Progressive Web App, la interfaz táctil multiplataforma del producto.
- **Pedido** — unidad de venta de un Dropshipper en Dropi o Mercado Libre; se asocia a una Guía de Despacho al enviarse. `[ASSUMPTION]` "Pedido" y "Orden de Venta" (usado en FR-5) se tratan como el mismo concepto en este documento — no confirmado formalmente con los socios que no sean entidades distintas.
- **Tablero Operativo** — nombre de producto de la interfaz de FR-3 (§4.2); consultado por el Personal de Alistamiento para ver stock disponible en tiempo real.
- **Ingesta** — término técnico/UI para un "ingreso de mercancía" (FR-1, FR-2); `Ingesta_ID` identifica una sesión de ingreso completa.

## 4. Features

### 4.1 Registro de Stock por Escaneo

**Descripción:** El Auxiliar de Bodega incrementa el stock de un producto escaneando su código de barras con una pistola Bluetooth/USB, sin digitar cantidades. Para mercancía importada sin código de barras de fábrica, existe un flujo manual guiado como excepción deliberada al "cero fricción". Realiza UJ-1.

**Requisitos Funcionales:**

#### FR-1: Ingreso de stock por escaneo único

El Auxiliar de Bodega puede escanear el código de barras de un producto entrante para incrementar su stock en +N sin digitación manual.

**Consecuencias (verificables):**
- Cada escaneo suma 1 unidad (o el valor del botón +1/+10 presionado) al stock del producto reconocido, y el commit al stock del sistema ocurre por escaneo individual (no en lote al presionar "Guardar Ingesta") — más seguro ante conectividad inestable de bodega: una caída de red a mitad de un lote no pierde las unidades ya escaneadas. `[ASSUMPTION]` "Guardar Ingesta" cierra la sesión de ingreso (agrupa los escaneos bajo un `Ingesta_ID` para auditoría), no es lo que sube el stock.
- Se genera un registro de auditoría (`Ingesta_ID`) por cada operación de ingreso.
- El stock actualizado se refleja en el Tablero Operativo (FR-3) sin acción adicional del usuario.
- El código de barras escaneado se resuelve contra un catálogo de productos existente. `[ASSUMPTION]` ese catálogo se sincroniza automáticamente desde Dropi vía API (§5.3); FR-1 no incluye una pantalla de creación manual de producto con código de barras — el no-objetivo de "gestión de catálogo" en §6 se refiere a no ofrecer edición de catálogo en Dropi/ML desde este producto, no a prohibir la existencia de un catálogo local de lectura sincronizado. Crear una referencia nueva sin código de barras es exclusivamente el camino de FR-2.

#### FR-2: Fallback manual para mercancía sin código de barras

El Auxiliar de Bodega puede registrar el ingreso de un producto que no tiene código de barras, buscando o creando su referencia manualmente dentro del mismo flujo de ingreso. *[ASSUMPTION: incorporado a partir del feedback de Hugo del 2026-07-13 — el flujo exacto de búsqueda/creación de referencia no está especificado, a definir en UX.]*

**Consecuencias (verificables):**
- Si la referencia no existe en el sistema, el Auxiliar de Bodega puede crearla (nombre, foto) sin bloquear el ingreso.
- El stock de la referencia sin código de barras se actualiza igual que el de un producto escaneado.
- Este flujo queda diferenciado del ingreso por escaneo en el registro de auditoría, para poder medir cuánta mercancía entra por esta vía (ver SM-C1).

**Fuera de Alcance:** *(FR-1, FR-2)*
- Generación automática de código de barras para mercancía que no lo trae (Fase 2, no mencionado por los socios).

### 4.2 Tablero Operativo de Stock en Tiempo Real

**Descripción:** El Personal de Alistamiento consulta un tablero táctil semafórico (verde/amarillo/rojo) del stock real, sincronizado con Dropi y Mercado Libre, para saber qué está disponible para despacho sin conteos físicos ni llamadas a bodega. Realiza UJ-2.

**Requisitos Funcionales:**

#### FR-3: Tablero de stock multicanal en tiempo real

El Personal de Alistamiento puede visualizar el stock disponible de cualquier producto, actualizado en tiempo real y sincronizado entre Dropi, Mercado Libre y los movimientos internos (ingresos de FR-1/FR-2, devoluciones de FR-5/FR-6).

**Consecuencias (verificables):**
- El tablero refleja un ingreso o una devolución sin que el usuario recargue manualmente. *[ASSUMPTION: latencia objetivo ≤5s tras el evento — no confirmado por los socios.]*
- El stock disponible mostrado = stock físico interno menos reservas activas por venta en cualquier canal; una venta confirmada en Dropi o Mercado Libre decrementa el stock visible del otro canal en ≤5s. `[ASSUMPTION: regla de reconciliación de sobreventa multicanal — no confirmada por los socios, alto impacto si está mal, validar antes de arquitectura.]`
- Cada producto se muestra con indicador semafórico según nivel de stock. `[ASSUMPTION: umbrales verde/amarillo/rojo pendientes de definir con la Empresa Piloto — ver §10 Índice de Supuestos.]`
- El stock mostrado no requiere consulta manual ni conteo físico para decidir si un pedido puede despacharse.

### 4.3 Vinculación Inteligente de Guías

**Descripción:** El Analista de Devoluciones recupera la trazabilidad entre una Guía de Retorno y su Guía de Despacho original, incluso cuando la transportadora emitió una Guía Reemplazatoria. Realiza UJ-3.

**Requisitos Funcionales:**

#### FR-4: Vinculación guía de retorno ↔ guía de despacho

El Analista de Devoluciones puede registrar una Guía de Retorno y el sistema le solicita la Guía de Despacho original (escaneada del paquete o consultada en Dropi) para vincularlas.

**Consecuencias (verificables):**
- El Analista de Devoluciones indica explícitamente en pantalla que está registrando una Guía de Retorno (selección manual), en vez de que el sistema infiera el tipo de guía por heurística sobre el número. `[ASSUMPTION: en el MVP la distinción es manual, no automática por patrón/prefijo del número de guía — más simple y menos propenso a error de clasificación; a confirmar con los socios antes de arquitectura.]`
- Al vincularse, ambas guías quedan asociadas de forma persistente y consultable (`ID_Guía_Origen` ↔ `ID_Guía_Retorno`, ver `addendum.md`).
- Cero pérdida de trazabilidad para devoluciones procesadas por este flujo (ver SM-2).

**Fuera de Alcance:**
- Integración API en tiempo real con transportadoras para vinculación automática sin escaneo — explícitamente Fase 2 (§7.2), esta FR opera sobre escaneo/consulta manual en el MVP.
- Guías de Retorno sin Detalle (consolidadas, sin guía de despacho identificable) — cubiertas por FR-6, no por esta FR.

### 4.4 Tipificación Táctil de Causas de Devolución

**Descripción:** El Operador de Bodega clasifica la causa de una devolución ya vinculada (FR-4) o asignada manualmente (FR-6) en menos de 3 clics, y el sistema actualiza el stock si el producto vuelve a estar disponible. Realiza UJ-4.

**Requisitos Funcionales:**

#### FR-5: Tipificación de causa de devolución en 3 clics

El Operador de Bodega puede clasificar una devolución presionando un botón de opción única: Compra Falsa / Rechazo Cliente / Retraso Bodega / Daño Transportadora. El conteo de "3 clics" empieza con la pantalla de tipificación ya abierta (posterior a FR-4/FR-6): 1 tap para la causa, 1 tap para "Finalizar Registro", con margen para un tercero.

**Consecuencias (verificables):**
- La tipificación completa toma un máximo de 3 interacciones táctiles.
- El stock se actualiza automáticamente según la causa: **Retraso Bodega** y **Rechazo Cliente** reingresan el producto a stock (se asume producto en condición vendible); **Compra Falsa** y **Daño Transportadora** no reingresan. `[ASSUMPTION: tabla causa→reingresa a validar con los socios antes de desarrollo — no estaba definida en ninguna fuente original.]`
- El estado de la orden de venta asociada se actualiza junto con la devolución, como entidad interna del producto — no implica escritura de vuelta hacia Dropi o Mercado Libre en el MVP, consistente con la exclusión de integraciones bidireccionales de §7.2. `[ASSUMPTION]`
- La devolución queda cerrada con causa, guía vinculada y timestamp asociados.

### 4.5 Asignación Manual de Devoluciones sin Detalle

**Descripción:** El Analista de Devoluciones registra guías de retorno que no identifican a qué pedido pertenece la mercancía devuelta, y asigna cada unidad manualmente a su pedido de origen. Nace del feedback de Hugo (2026-07-13): al menos dos transportadoras devuelven mercancía de esta forma, sin cruce automático posible — según sus propias palabras, para que el equipo pueda "ir bajando el inventario de devoluciones más fácil" (agilizar el procesamiento del backlog, no solo recuperar trazabilidad). `[ASSUMPTION]` que estas guías consolidan mercancía de *múltiples* pedidos en un solo envío — Hugo describió que la guía "no dice qué está cruzando", sin confirmar explícitamente que sea siempre multi-pedido; a validar con los socios. Realiza UJ-5.

**Requisitos Funcionales:**

#### FR-6: Registro y asignación manual de retorno sin detalle

El Analista de Devoluciones puede registrar una guía marcada "retorno sin detalle" y asignar, uno a uno, cada unidad física recibida a su pedido de origen probable.

**Consecuencias (verificables):**
- El sistema permite marcar explícitamente una guía como "sin detalle" cuando la Vinculación Inteligente (FR-4) no encuentra una guía de despacho asociable.
- Cada unidad asignada queda vinculada a un `ID_Pedido` específico, igual que si hubiera pasado por FR-4 — pero marcada internamente como asignación manual (probable), no como vinculación por guía (cierta), para distinguir la confianza del dato.
- El Analista de Devoluciones puede corregir o revertir una asignación manual hecha por error antes de que la unidad entre a Tipificación (FR-5). `[ASSUMPTION]` sin este mecanismo, una asignación equivocada se contabilizaría como trazabilidad recuperada en SM-2 sin serlo realmente.
- Las unidades asignadas entran al flujo de Tipificación (FR-5) como cualquier otra devolución vinculada.

**Notas:** *[ASSUMPTION: el sistema sugiere pedidos candidatos por dropshipper/fecha/referencia para acelerar la asignación — no confirmado, validar en diseño UX.]* `[NOTE FOR PM]` Confirmar con los socios cuáles son las dos transportadoras específicas (ver §9, Open Question 4) — puede cambiar si conviene una integración puntual con esas dos en vez de un flujo 100% manual.

### 4.6 Alertas Comerciales Preventivas por Caída de Volumen

**Descripción:** Un worker diario analiza el volumen transaccional de cada Dropshipper (Dropi + Mercado Libre) y, si cae por debajo de un Umbral de Caída de Volumen parametrizado, dispara una alerta priorizada al Coordinador Comercial con acceso directo a la ficha del Dropshipper y a WhatsApp. Realiza UJ-6.

**Requisitos Funcionales:**

#### FR-7: Detección diaria de caída de volumen por Dropshipper

El sistema compara diariamente el volumen de pedidos de cada Dropshipper contra su propia línea base histórica, y detecta cuándo cae por debajo de un porcentaje de caída parametrizado.

**Consecuencias (verificables):**
- La línea base de cada Dropshipper es el promedio móvil de sus pedidos diarios de los últimos 7 días; la alerta se dispara cuando el volumen del día cae por debajo de un % configurable de esa línea base (referencia: ~90% de caída, consistente con el ejemplo de 200/día cayendo a 20/día). `[ASSUMPTION: algoritmo de caída relativa contra promedio móvil — no confirmado por los socios; la fuente original solo daba el ejemplo numérico, no el mecanismo de cálculo. Alternativa a validar: piso absoluto fijo por Dropshipper en vez de % relativo.]`
- El porcentaje de caída (o, alternativamente, el piso absoluto) es parametrizable por Dropshipper, no un valor fijo global.
- El análisis corre una vez al día sin intervención manual.

#### FR-8: Alerta priorizada con acceso a ficha del Dropshipper

El Coordinador Comercial recibe una alerta de alta prioridad cuando se detecta una caída de volumen, con el porcentaje de caída, acceso a la ficha e historial comercial del Dropshipper, y un enlace directo a WhatsApp para contacto inmediato.

**Consecuencias (verificables):**
- La alerta incluye el porcentaje de caída detectado como dato explícito, no solo un aviso genérico.
- Un clic en la alerta lleva a la ficha del Dropshipper con su historial comercial.
- El enlace de WhatsApp abre una conversación directa con los datos de contacto del Dropshipper precargados, para contacto humano del Coordinador Comercial — no un bot automatizado. La Empresa Piloto expresó preferencia explícita por atención personalizada en este canal.

## 5. NFRs Transversales, Restricciones e Integraciones

### 5.1 NFRs Transversales

- **Interacción nativa con periféricos de escaneo** — la PWA debe operar de forma fluida con pistolas de escaneo de códigos de barras/QR conectadas por Bluetooth/USB, sin fricción adicional de configuración por parte del usuario operativo. *(Heredado de `evidencias.docx`, RNF-01 — ver mapeo de IDs en `addendum.md`.)*
- **PWA multiplataforma** — la interfaz debe ejecutarse igual en los dispositivos de bodega sin depender de una app nativa instalada. *(RNF-02.)*
- **Integridad de la vinculación de guías** — la operación de vincular Guía de Retorno ↔ Guía de Despacho (FR-4) y la de asignación manual (FR-6) deben ser transaccionales: ninguna vinculación parcial o corrupta ante una caída de red, dado que la conectividad en bodega puede ser inestable. `[ASSUMPTION]` no confirmado explícitamente por los socios.
- **Cero campos de texto libre salvo excepción deliberada** — el fallback sin código de barras (FR-2) y la asignación manual sin detalle (FR-6) son las únicas excepciones intencionales al principio de "cero fricción / cero digitación" del resto del producto, dado el bajo nivel de alfabetización digital del personal operativo.
- **Control de acceso por rol** — cada uno de los 5 roles (§2) solo debe operar las pantallas de su función; en particular, el Coordinador Comercial accede a datos comerciales de Dropshippers (FR-8) que el personal operativo de bodega no necesita ver. `[ASSUMPTION]` mecanismo de autenticación/autorización no especificado por ninguna fuente original — mínimo viable a definir en arquitectura (login por usuario, roles fijos por dispositivo, u otro).
- **Seguridad** — más allá del control de acceso por rol: credenciales de integración con Dropi/Mercado Libre (API keys/tokens) gestionadas de forma segura (no embebidas en el cliente PWA), datos en tránsito cifrados, y ningún campo de texto libre (FR-2, FR-6) sin sanitizar antes de persistir. *(Confirmado por el usuario 2026-08-27 — "la plataforma debe ser... segura".)* `[ASSUMPTION]` nivel de rigor exacto (p. ej. si aplica algún cumplimiento normativo de datos comerciales/personales en el país de la Empresa Piloto) no especificado; a definir en arquitectura.
- **Diseño extensible para automatización con IA futura** — el MVP no incluye ninguna automatización de IA (no hay FR de este tipo en §4; ver también §6 No-Objetivos). *(Confirmado por el usuario 2026-08-27 — "escalable a todo nivel incluyendo automatizaciones de IA".)* Se interpreta como principio de diseño, no como una capacidad a construir ahora: el modelo de datos y las APIs (§5.3, `addendum.md`) deben quedar en forma estructurada y consultable (no en texto libre suelto) para que una futura capa de IA — p. ej. sugerir automáticamente el pedido candidato en FR-6 (ya marcado `[ASSUMPTION]` en §4.5), o detectar anomalías de stock en FR-3 — pueda construirse sobre datos limpios sin rediseñar el sistema. `[NOTE FOR PM]` no confirmar como alcance del MVP sin conversarlo con los 3 socios; es una restricción sobre *cómo* se construye el MVP, no una historia de usuario nueva.
- **Mantenibilidad** — arquitectura modular por dominio (WMS y CRM Light como módulos separados sobre una única fuente de verdad, consistente con la Visión §1), APIs y modelo de datos documentados, sin abstracciones prematuras que un equipo pequeño no pueda sostener. *(Confirmado por el usuario 2026-08-27 — "fácil de mantener".)* Especialmente relevante dado que los roles técnicos (backend, frontend, UX, QA) aún no están asignados dentro del equipo de los 3 socios (§9, Open Question 3).

### 5.2 Restricciones y Guardarraíles

- **Costo:** el MVP es autofinanciado por los tres socios. `[ASSUMPTION]` heredado del brief — se despliega con el mínimo de infraestructura en la nube necesaria para sostener el piloto (no sobre-provisionar desde el día uno). Esto es una restricción de **costo de despliegue inicial**, no de diseño: el usuario confirmó el 2026-08-27 que la plataforma debe ser "escalable a todo nivel" — se reconcilian ambas así: el equipo técnico elige patrones de arquitectura (módulos desacoplados, modelo de datos limpio, sin atajos que bloqueen crecer) que permitan escalar carga, integraciones y automatizaciones de IA futuras sin reescritura, mientras el tamaño/costo de la infraestructura desplegada para el piloto se mantiene mínimo. `[ASSUMPTION]` esta lectura concilia ambas instrucciones pero no fue confirmada palabra por palabra con los socios — si "escalable a todo nivel" implicaba también sobre-provisionar infraestructura ya para el piloto, hay que decirlo explícitamente antes de `bmad-architecture`.

### 5.3 Integraciones y Dependencias

- **API de Dropi** — sincronización de inventario y estados de orden, requerida para FR-3 (tablero) y como fuente de consulta de la Guía de Despacho original en FR-4.
- **API de Mercado Libre** — centralización de ventas y stock multicanal, requerida para FR-3.
- **API(s) de transportadoras** — **no forma parte del MVP.** FR-4 y FR-6 operan sobre escaneo o ingreso manual de la guía, no sobre integración API en tiempo real con las transportadoras; esa integración más profunda queda explícitamente en Fase 2 (§7.2). `[NOTE FOR PM]` si se confirman las dos transportadoras específicas de FR-6 (§9, Open Question 4), vale la pena evaluar si una integración puntual con esas dos adelanta valor antes de Fase 2 — **cualquier integración con transportadoras específicas, por puntual que sea, requiere aprobación explícita de los 3 socios antes de iniciarse**, no es una decisión que arquitectura tome por su cuenta bajo presión de tiempo.

### 5.4 Restricciones de Hardware

- Pistola de escaneo de códigos de barras/QR, Bluetooth/USB, como periférico principal de ingreso (FR-1) y de escaneo de guías (FR-4).
- `[ASSUMPTION]` dispositivo host de bodega: tablet o smartphone Android — no confirmado explícitamente por los socios.

### 5.5 Plataforma

- PWA (Progressive Web App), multiplataforma, sin instalación nativa requerida.

## 6. No-Objetivos (Explícitos)

- No somos un ERP financiero/contable: nómina, afiliaciones a seguridad social y facturación multi-línea de negocio, mencionadas en la reunión de diagnóstico, quedan completamente fuera de este producto (ver §9, Open Question 8).
- No gestionamos catálogo de productos ni creación/edición de referencias en Dropi o Mercado Libre en el MVP.
- No gestionamos ubicaciones ni slotting dentro de la bodega en el MVP.
- No gestionamos precios ni márgenes por producto — mencionado en la reunión como un frente operativo real, pero sin historia de usuario asociada (ver §9, Open Question 6).
- No competimos por ser el ERP más completo o más barato del mercado (Odoo, ShipHero): competimos por resolver el problema específico de trazabilidad de guías y devoluciones sin detalle, más rápido de adoptar para una PyME de dropshipping. `[ASSUMPTION]` heredado del brief, no verificado con estudio de mercado exhaustivo.

## 7. Alcance del MVP

### 7.1 Dentro de Alcance

- Registro de stock por escaneo, con fallback manual para mercancía sin código de barras (FR-1, FR-2).
- Tablero operativo de stock en tiempo real, sincronizado con Dropi y Mercado Libre (FR-3).
- Vinculación inteligente de guías de despacho ↔ retorno, incluida la Guía Reemplazatoria (FR-4).
- Tipificación táctil de causas de devolución en menos de 3 clics (FR-5).
- Asignación manual de devoluciones sin detalle, para transportadoras que devuelven mercancía consolidada (FR-6).
- Disparador diario de alertas por caída crítica de volumen de un Dropshipper, con acceso a ficha del Dropshipper (FR-7, FR-8).

*Condición de entrega (no es una 7ª capacidad funcional):* el MVP debe quedar ejecutable en la nube, listo para uso real de la Empresa Piloto.

### 7.2 Fuera de Alcance para el MVP

- Automatización de cierres logísticos. *(Fase 2 según reunión de diagnóstico.)*
- Integraciones API en tiempo real / bidireccionales con transportadoras (tracking automático, vinculación sin escaneo). *(Fase 2; el MVP opera sobre escaneo o consulta manual — ver FR-4, FR-6.)*
- Conciliaciones financieras y de cartera.
- Conciliación de devoluciones formalizada por período (hoy se hace cruzando un "archivo de control" con Dropi al cierre del período) — el MVP resuelve la vinculación en el momento, no automatiza el ciclo de cierre completo.
- Proceso formal de reclamación a la transportadora cuando el contenido de un paquete no corresponde a su guía.
- Reportes e indicadores de negocio (rotación, desempeño, ingresos/salidas, tiempos por etapa de despacho) — mencionados en la reunión pero no traducidos a historias de usuario.
- Gestión de precios/márgenes por producto. `[NOTE FOR PM]` frente operativo real mencionado en la reunión, candidato a evaluar para una fase futura (ver §9, Open Question 6).
- Ubicaciones/slotting de bodega y creación de catálogo de productos. `[NOTE FOR PM]` mencionados como "en gran parte manual" en la reunión, sin HU asociada (ver §9, Open Question 7).
- Procesos administrativos (nómina, facturación multi-línea de negocio) — fuera del dominio de este producto.

`[ASSUMPTION]` Dado el presupuesto acotado y autofinanciado por los tres socios, se asume que el MVP se despliega con el mínimo de infraestructura en la nube necesaria para sostener el piloto — sin que eso implique una arquitectura que no pueda crecer después; ver la reconciliación completa con el requisito de escalabilidad en §5.2.

## 8. Métricas de Éxito

*Para el MVP con la Empresa Piloto, sin métrica cuantitativa de negocio todavía definida — ver §9, Open Question 2.*

**Primarias**
- **SM-1**: La bodega deja de contar físicamente el inventario para saber cuánto stock real hay. Instrumento de medición: `[ASSUMPTION]` cero solicitudes de conteo físico registradas, verificado por entrevista quincenal con el equipo operativo durante las primeras 8 semanas de uso — no confirmado con los socios. Valida FR-1, FR-2, FR-3.
- **SM-2**: Cero pérdidas de trazabilidad entre guía de despacho y guía de retorno en las devoluciones procesadas por el sistema (vinculadas o asignadas manualmente). Valida FR-4, FR-6.
- **SM-3**: Las 6 capacidades del MVP están en uso activo diario y sostenido por el equipo operativo, sin escalamientos formales de un usuario operativo durante 4 semanas consecutivas de uso. `[ASSUMPTION]` umbral operativo del "sin resistencia ni quejas" original — no confirmado. Valida FR-1 a FR-8.

**Contra-métricas (no optimizar)**
- **SM-C1**: Proporción de ingresos que pasan por el fallback manual sin código de barras (FR-2) o de devoluciones que terminan en Asignación Manual sin Detalle (FR-6) no debería crecer sin control — si supera una porción significativa del volumen total, es señal de que el problema de origen (mercancía sin código, transportadoras sin detalle) es más grande de lo estimado, no que el fallback esté funcionando bien. Contrapesa SM-1, SM-2.
- **SM-C2**: Volumen de alertas de caída de Dropshipper (FR-7, FR-8) no debería optimizarse para "más alertas" — un umbral demasiado sensible genera fatiga de alerta en el Coordinador Comercial y hace que las alertas reales se ignoren. Contrapesa SM-3.
- **SM-C3**: SM-2 solo mide devoluciones que efectivamente pasan por el sistema — no vigila qué proporción de las devoluciones totales de la Empresa Piloto se sigue resolviendo por fuera (papel, WhatsApp, como hoy), lo cual inflaría SM-2 artificialmente mientras la adopción real cae. Contrapesa SM-2.

## 9. Preguntas Abiertas

1. Nombre del producto / marca.
2. Métrica de negocio cuantitativa para declarar éxito del piloto (más allá de los criterios cualitativos ya definidos en §8).
3. Quién cubre cada rol técnico (UX/UI, Backend, Frontend, QA) dentro del equipo de los 3 socios — o si se contratan.
4. Cuáles son exactamente las dos transportadoras que devuelven mercancía sin detalle (FR-6) — necesario para diseño técnico y para decidir si conviene una integración puntual con esas dos.
5. La mercancía sin código de barras (FR-2) — ¿tiene ya una referencia interna/SKU propia, o hay que generarla desde cero en el sistema?
6. Gestión de precios/márgenes por producto, mencionada en la reunión de diagnóstico sin historia de usuario asociada — ¿entra en una fase futura o queda fuera del alcance de este producto de forma permanente?
7. Ubicaciones/slotting de bodega y creación de catálogo de productos, mencionados como "en gran parte manual" — ¿candidatos a Fase 2?
8. Procesos administrativos (nómina, facturación multi-línea de negocio) mencionados en la reunión — ¿tienen alguna relación con este producto o son completamente independientes?
9. Medición de tiempos por etapa de despacho (pedido explícito de Ronhal en la reunión) — ¿se convierte en una futura historia de reportes/indicadores, ya anotada como Fase 2?
10. Datos históricos de la Empresa Piloto desde 2022 (facturación, manifiestos, registros operativos, dispersos y sin estructurar) — valorados por los tres socios en la reunión como activo aprovechable. ¿Se migran/importan al lanzar el MVP, o quedan fuera de este alcance?
11. "Otras empresas del grupo" mencionadas en el brief además de Dropi y Mercado Libre — ¿necesitan cobertura de inventario/CRM en este MVP, o quedan fuera de alcance?
12. La arquitectura del brief original listaba "API(s) de transportadoras" dentro de la propuesta técnica general; este PRD (§5.3) la excluye del MVP y la difiere a Fase 2, consistente con el Alcance del brief ("Integraciones más profundas / bidireccionales con transportadoras" ya listada como Fase 2). Confirmar con los socios que esta lectura es correcta.

## 10. Índice de Supuestos

- §2.3 UJ-1 / §4.1 FR-2 — el flujo exacto de búsqueda/creación de referencia para mercancía sin código de barras no está especificado; a definir en UX.
- §2.3 UJ-5 / §4.5 FR-6 (Notas) — el sistema sugiere pedidos candidatos por dropshipper/fecha/referencia para agilizar la asignación manual; no confirmado por los socios.
- §4.2 FR-3 — latencia objetivo de ≤5s entre un evento (ingreso/devolución) y su reflejo en el tablero; no confirmado.
- §6 No-Objetivos — "no competimos por ser el ERP más completo/barato" heredado del brief sin estudio de mercado exhaustivo que lo respalde.
- §5.2 / §7.2 — infraestructura cloud mínima para sostener el piloto, reconciliada con el requisito de escalabilidad del usuario (2026-08-27): restricción de costo de despliegue, no de diseño arquitectónico — a validar que esta lectura sea correcta.
- §3 Glosario / §4.5 FR-6 — que la Guía de Retorno sin Detalle consolida mercancía de múltiples pedidos en un solo envío; Hugo solo confirmó que "no dice qué está cruzando", no el caso multi-pedido explícitamente.
- §4.1 FR-1 — commit de stock por escaneo individual (no por lote al "Guardar Ingesta"); no confirmado por los socios.
- §4.1 FR-1 — catálogo de productos con código de barras se sincroniza automáticamente desde Dropi vía API; FR-1 no incluye creación manual de producto con barcode.
- §4.2 FR-3 — regla de reconciliación de sobreventa multicanal (stock disponible = físico menos reservas activas por canal, decremento cruzado ≤5s); **alto impacto si está mal, validar con prioridad antes de arquitectura.**
- §4.2 FR-3 — umbrales verde/amarillo/rojo del semáforo, pendientes de definir con la Empresa Piloto.
- §4.3 FR-4 — distinción Guía de Retorno vs. Guía de Despacho es selección manual del usuario en el MVP, no heurística automática por patrón del número de guía.
- §4.4 FR-5 — tabla causa→reingresa a stock (Retraso Bodega y Rechazo Cliente reingresan; Compra Falsa y Daño Transportadora no) — no estaba definida en ninguna fuente original, **validar con los socios antes de desarrollo.**
- §4.4 FR-5 — "orden de venta" es entidad interna sin escritura de vuelta hacia Dropi/Mercado Libre en el MVP.
- §4.5 FR-6 — mecanismo de corrección/reversión de una asignación manual errónea antes de Tipificación; no confirmado.
- §4.6 FR-7 / §3 Glosario — algoritmo del Umbral de Caída de Volumen como caída relativa (%) contra un promedio móvil de 7 días, no un piso absoluto fijo; **alto impacto si está mal — es el motor entero del CRM Light, validar con prioridad.**
- §5.1 — integridad transaccional de la vinculación de guías (FR-4/FR-6) ante caída de red.
- §5.1 — mecanismo de control de acceso por rol; no especificado por ninguna fuente original.
- §5.4 — dispositivo host de bodega: tablet o smartphone Android.
- §8 SM-1 — instrumento de medición (entrevista quincenal, 8 semanas) para "deja de contar físicamente".
- §8 SM-3 — umbral operativo de "sin resistencia ni quejas" (sin escalamientos formales en 4 semanas).
- §5.1 — nivel de rigor de seguridad exacto (p. ej. cumplimiento normativo de datos comerciales/personales aplicable al país de la Empresa Piloto); no especificado.
- §5.1 / §5.2 — que "escalable a todo nivel incluyendo automatizaciones de IA" es un principio de diseño de arquitectura (datos/APIs estructurados, sin rediseño futuro) y no una capacidad de IA a construir dentro de este MVP.
