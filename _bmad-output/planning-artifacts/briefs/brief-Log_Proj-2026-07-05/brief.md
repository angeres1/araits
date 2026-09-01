---
title: "Brief de Producto: [Nombre por definir] — Mini ERP (WMS + CRM Light) para Dropshipping"
status: draft
created: 2026-07-05
updated: 2026-08-27
---

# Brief de Producto: [Nombre por definir]

## Resumen Ejecutivo

Las operaciones de dropshipping y logística en Latinoamérica que trabajan con Dropi, Mercado Libre y transportadoras tercerizadas no tienen una fuente única de verdad sobre su inventario: cuentan cajas a mano, registran ingresos por WhatsApp y Excel, y pierden la trazabilidad de una devolución en cuanto la transportadora emite una "guía reemplazatoria". Además, nadie se entera cuando un dropshipper reduce drásticamente sus pedidos hasta que ya es tarde para retenerlo.

**[Nombre por definir]** es un Mini ERP — WMS (control de inventario y devoluciones) + CRM Light (alertas comerciales preventivas) — con una interfaz táctil de "cero fricción": pistola de escaneo, botones gigantes, colores semafóricos, un escaneo = una acción. Nace de un problema real detectado por uno de los socios fundadores (revendedor de Dropi) en uno de sus propios clientes, y se construye primero como MVP para ese cliente piloto, con la intención explícita de, una vez validado, venderlo a otras operaciones similares.

## El Problema

- **Inventario sin certeza:** "No existe información confiable y actualizada sobre el inventario... muchas veces toca ir a contarlas físicamente." El ingreso de mercancía se anuncia en un grupo de WhatsApp ("Bodega de ingresos") y no llega a un sistema central.
- **Devoluciones sin trazabilidad:** cuando una transportadora reemplaza la guía original por una de retorno, se pierde la relación entre ambas. Cruzar esa información con Dropi manualmente "consume horas operativas críticas", y con cientos o miles de devoluciones diarias el costo operativo escala rápido.
- **Gestión comercial reactiva:** "Nadie recibe una alerta cuando un dropshipper disminuye significativamente sus pedidos... nos damos cuenta demasiado tarde." No existe CRM ni regla de negocio que vigile caídas de volumen.
- **Datos fragmentados entre canales:** la operación no vive solo en Dropi — también hay ventas en Mercado Libre y otras empresas del grupo. "La información existe, pero queda encerrada dentro de ciertos procesos." Dropi se usa como si fuera un WMS, pero no lo es: no ofrece una reconciliación cruzada de canales ni resuelve el problema de las guías reemplazatorias.
- **Mercancía sin código de barras:** parte de la mercancía que el cliente piloto importa no trae código de barras de fábrica, lo que rompe el flujo de "un escaneo = una acción" para ese subconjunto de productos.
- **Devoluciones masivas sin detalle:** al menos dos transportadoras devuelven mercancía sin indicar en la guía qué contiene el paquete — llega el bulto físico, pero la información de la transportadora no dice a qué pedido u orden pertenece cada unidad.

El costo del status quo: horas operativas perdidas en conteos y cruces manuales, decisiones comerciales tardías, y una operación que "funciona mientras el volumen es manejable" pero no escala.

## La Solución

Un Mini ERP centralizado con dos módulos que comparten una única fuente de verdad operativa:

- **WMS (Control de Inventario y Devoluciones):** registro de ingreso de mercancía por escaneo (sin digitación), con alternativa manual guiada para productos sin código de barras; tablero de stock en tiempo real visible para todo el equipo logístico; vinculación guiada de guía original ↔ guía de retorno; tipificación de devoluciones en máximo 3 clics (Compra Falsa / Rechazo Cliente / Retraso Bodega / Daño Transportadora); y una pantalla de asignación manual para devoluciones masivas sin detalle, donde el operador registra la guía de la transportadora y va asignando cada unidad devuelta a su pedido de origen.
- **CRM Light (Alertas Comerciales Preventivas):** monitoreo automático (worker diario) del volumen de pedidos por dropshipper; si cae por debajo de un umbral, se dispara una alerta priorizada al asesor comercial con un enlace directo a WhatsApp para contacto de retención inmediato.

Todo bajo una interfaz táctil pensada para personal operativo de bodega, no para "power users": pistola de escaneo Bluetooth/USB, botones gigantes, semáforo de colores, cero campos de texto libre donde se pueda evitar.

## Qué Nos Hace Diferentes

- **El problema de la guía reemplazatoria no está resuelto en el mercado.** Ni Dropi, ni herramientas de inventario livianas (Zoho Inventory, Odoo), ni agregadores de transporte en la región (Enviame, Envíoclick) documentan una solución a la reconciliación guía-original/guía-retorno. Es una brecha real, no una ventaja inventada.
- **Distribución ya existe, no hay que construirla desde cero.** Uno de los socios ya revende Dropi y tiene relación directa con operaciones de dropshipping similares a la piloto — el canal de venta para "vender en masa" ya está parcialmente construido antes de que exista el producto.
- **Diseño para el usuario real de bodega, no para un analista.** La mayoría de herramientas de inventario asumen un usuario administrativo tecleando en un escritorio; esta se diseña desde cero para "personal operativo con baja alfabetización digital", en una pistola de escaneo, no en un teclado.
- **[SUPUESTO]** No competimos por ser más baratos o más completos que un ERP grande (Odoo, ShipHero): competimos por resolver *este* problema específico más rápido de adoptar para una PyME de dropshipping.

## A Quién Sirve

**Piloto (ahora):** el personal operativo de la empresa cliente que originó el problema —
- *Auxiliar de Bodega* — necesita registrar ingreso de mercancía sin digitar cantidades.
- *Personal de Alistamiento* — necesita ver stock disponible real, sincronizado entre Dropi y Mercado Libre.
- *Analista de Devoluciones* — necesita recuperar la trazabilidad entre guía original y guía de retorno.
- *Operador de Bodega* — necesita tipificar una devolución en segundos, no en minutos.
- *Coordinador Comercial* — necesita saber, sin tener que preguntar, cuándo un dropshipper está a punto de irse.

**Mercado (después, si el piloto valida):** otras operaciones de dropshipping/logística en LatAm con el mismo perfil — venden por Dropi y/o Mercado Libre, dependen de WhatsApp/Excel para inventario, y no tienen CRM de retención. Canal de entrada: la red de clientes del socio revendedor de Dropi.

## Criterios de Éxito

Para el MVP con la empresa piloto, esto funciona si:

- La bodega deja de contar físicamente el inventario para saber cuánto stock real hay.
- Cero pérdidas de trazabilidad entre guía original y guía de retorno en las devoluciones procesadas por el sistema.
- El equipo operativo usa el sistema a diario, de forma sostenida, sin resistencia ni quejas — señal de que el diseño "cero fricción" realmente elimina fricción y no la mueve de lugar.
- Las cinco capacidades del MVP (ingreso de stock, tablero en tiempo real, vinculación de guías, tipificación de devoluciones, alertas de caída de volumen) están en uso activo, no solo instaladas.

**[SUPUESTO]** No hay todavía una métrica numérica de negocio (ej. % de reducción de horas operativas, tiempo de respuesta a clientes) — se recomienda definirla con la empresa piloto una vez el MVP esté en sus manos, para tener una base cuantitativa que respalde la venta a nuevos clientes.

## Alcance

**Dentro del MVP** (las 5 historias de usuario originales + HU-06, incorporada tras feedback de socio sobre devoluciones sin detalle — ver `addendum.md`):

1. Registro de stock mediante escaneo único con pistola, con fallback manual para mercancía sin código de barras (HU-01).
2. Tablero operativo de stock en tiempo real, sincronizado con Dropi y Mercado Libre (HU-02).
3. Vinculación inteligente de guías — trazabilidad recuperada entre guía origen y guía de retorno (HU-03).
4. Tipificación táctil rápida de causas de devolución, en menos de 3 clics (HU-04).
5. Disparador de alertas por caída crítica de volumen de un dropshipper (HU-05).
6. Asignación manual de devoluciones sin detalle, para transportadoras que devuelven mercancía en bulto sin indicar a qué pedido pertenece cada unidad (HU-06).

El MVP debe quedar **ejecutable en la nube**, listo para que la empresa piloto lo use en su operación real.

**Fuera del MVP (explícitamente pospuesto — "Fase 2" según la reunión de diagnóstico):**

- Automatización de cierres logísticos.
- Integraciones más profundas / bidireccionales con transportadoras.
- Seguimiento automático de guías y conciliaciones operativas.
- Conciliaciones financieras y de cartera.
- Reportes e indicadores de negocio (rotación, desempeño, ingresos/salidas) — mencionados en la reunión pero no traducidos aún en historias de usuario; candidatos para una siguiente iteración, no para este MVP.

**[SUPUESTO]** Dado el presupuesto acotado y autofinanciado por los tres socios, se asume que el MVP se construye con el mínimo de infraestructura en la nube necesaria para sostener el piloto (no arquitectura de escala desde el día uno) — a validar con los socios.

## Visión

Si el piloto valida el problema y la solución, **[Nombre por definir]** se convierte en el sistema operativo estándar de bodega para PyMEs de dropshipping en LatAm: la fuente única de verdad que reemplaza WhatsApp + Excel + conteos físicos en cualquier operación que venda por Dropi, Mercado Libre y transportadoras tercerizadas. La ventaja de distribución ya existente (red de clientes Dropi del socio revendedor) es el motor inicial de "venta en masa"; el producto crece después por la marca que se gane resolviendo un problema — las guías reemplazatorias — que hoy nadie más resuelve.
