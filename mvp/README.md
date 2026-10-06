# Log_Proj MVP — Mini ERP (WMS + CRM Light)

Cero dependencias: Node ≥ 22.5 (`node:sqlite`) + PWA vanilla (módulos ES). Sin `npm install`.

```bash
node src/seed.js --demo      # datos demo; PIN 123456 para todos (sin --demo se exige cambiar el PIN al primer ingreso)
PORT=3111 node src/server.js # http://localhost:3111
node --test test/*.test.js   # 13 tests de API
```
En tablet/celular de la misma red: abrir `http://<IP-del-equipo>:3111` y "Agregar a pantalla de inicio".
La pistola de escaneo (USB/BT en modo teclado) escribe en el campo enfocado + Enter: funciona sin configurar nada.

## Pantallas por rol
| Usuario | Rol | Pantallas |
|---|---|---|
| Marta | bodega | Inicio, **Ingresar mercancía** (FR-1/2, cola offline), Stock |
| Camilo | alistamiento | Inicio, **Stock semáforo en vivo** (FR-3), Pedidos (despachar/cancelar), Reportes |
| Sofía | devoluciones | Inicio, **Registrar devolución**: vincular guías (FR-4) / bulto sin detalle (FR-6) |
| Diego | operador | Inicio, **Tipificar** (FR-5) |
| Laura | comercial | Inicio, **Alertas** + ficha + WhatsApp + umbral (FR-7/8), Reportes |
| Admin | admin | todo + Administración (usuarios, catálogo CSV, umbrales/ubicación, canales y log de sync) |

Inicio = dashboard: KPIs accionables, movimiento 14 días, salud del proceso (contra-métricas SM-C1, trazabilidad SM-2) y volumen por dropshipper.
Guías demo: despacho `GD-1001`…; el seed deja a **TiendaNova** con caída 40→4 pedidos/día (alerta −90%).

## Qué incluye la v2
- **Escaneo resistente a fallas de red:** cada escaneo lleva `client_id` (idempotente), la ingesta se identifica con `ingesta_ref` creado en el cliente, y una cola local reenvía al reconectar. Probado: respuesta perdida tras commit no duplica unidades.
- **Seguridad:** PIN 6–10 dígitos (sin repetidos/consecutivos), cambio forzado con PIN temporal, límite de intentos por IP+usuario, logout real, usuarios activables/desactivables, sesión 12h, rutas por rol, ingesta con dueño, SSE con tope por usuario, CSV a prueba de inyección de fórmulas, sin `innerHTML`.
- **Datos:** día de negocio en zona Bogotá (`TZ_OFFSET_MIN=-300`), devoluciones parciales por unidad, alertas sin repetirse, importación de catálogo CSV, reportes CSV (movimientos, devoluciones), auditoría de acciones admin.
- **Canales (mock honesto):** `src/adapters.js` define la interfaz (`fetchOrders`, `pushStock`). El mock genera pedidos y cancelaciones idempotentes por `(canal, external_id)` y registra en `channel_sync_log` qué stock se *enviaría* a Dropi/ML tras cada movimiento.

## Supuestos del PRD implementados (validar con socios)
- Causa → reingresa: Rechazo Cliente y Retraso Bodega sí; Compra Falsa y Daño Transportadora no.
- Disponible = físico − pedidos pendientes (ambos canales). Semáforo: rojo ≤0, amarillo ≤ umbral por producto.
- Alerta: volumen de ayer vs promedio de los 7 días previos; dispara si caída ≥ umbral del dropshipper (90%).
- Commit de stock por escaneo; "Guardar Ingesta" solo cierra la sesión. Guía de retorno primero, luego despacho.

## Brechas conocidas antes de producción
- Integraciones reales Dropi/ML (credenciales, push de stock, webhooks de cancelación): hoy mock.
- Hosting con HTTPS (poner detrás de proxy TLS), backups de `data/app.db`, SQLite → Postgres si crece la concurrencia.
- `/api/users` es público (selector de login): aceptable en LAN de bodega, no en internet abierta.
- Foto de producto solo se guarda (no se muestra aún). Sin pruebas E2E automáticas de UI (verificado manualmente en navegador).
- UX formal y arquitectura (BMAD) siguen pendientes por decisión del plan.
