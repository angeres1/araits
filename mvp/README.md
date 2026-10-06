# Log_Proj MVP — Mini ERP (WMS + CRM Light)

Cero dependencias: Node ≥ 22.5 (`node:sqlite`) + PWA vanilla. Sin `npm install`.

```bash
node src/seed.js          # datos demo (PIN de todos los usuarios: 1234)
PORT=3111 node src/server.js
node --test test/*.test.js
```

Abrir http://localhost:3111 — en tablet/celular de la misma red usar la IP del equipo ("Agregar a pantalla de inicio" instala la PWA).
La pistola de escaneo (USB/BT en modo teclado) escribe en el campo enfocado y envía Enter: funciona sin configuración.

## Usuarios demo → pantallas
| Usuario | Rol | Pantallas |
|---|---|---|
| Marta | bodega | Ingresar Mercancía (FR-1/2), Stock |
| Camilo | alistamiento | Stock semáforo en vivo, Pedidos/Despachar (FR-3) |
| Sofía | devoluciones | Registrar Devolución: vincular guías (FR-4) / bulto sin detalle (FR-6) |
| Diego | operador | Tipificar (FR-5) |
| Laura | comercial | Alertas, ficha, umbral, WhatsApp (FR-7/8) |
| Admin | admin | todo + "Sincronizar canales (mock)" |

Guías demo para probar: despacho `GD-1001`…; el seed deja a **TiendaNova** con caída 40→4 pedidos/día (alerta −90%).

## Qué es real y qué es mock
- **Mock:** Dropi y Mercado Libre (`src/adapters.js`). No hay credenciales; generan pedidos falsos con la misma interfaz que usarán los clientes reales. Catálogo sembrado en lugar de sync Dropi.
- **Real:** inventario, reservas, devoluciones, tipificación, alertas, auth por rol (scrypt + sesiones 12h), SSE para stock en vivo, worker diario (03:00) + botón manual.

## Supuestos del PRD implementados tal cual (validar con socios)
- Causa → reingresa: Rechazo Cliente y Retraso Bodega sí; Compra Falsa y Daño Transportadora no.
- Disponible = físico − pedidos pendientes (reservas, ambos canales). Semáforo: rojo ≤0, amarillo ≤ umbral por producto (10 por defecto).
- Alerta: volumen de ayer vs promedio de los 7 días previos; dispara si caída ≥ umbral del dropshipper (90% por defecto).
- Commit de stock por escaneo; "Guardar Ingesta" solo cierra la sesión.
- Guía de retorno vs despacho: selección manual (primero retorno, luego despacho).

## Fuera de este MVP (siguiente fase)
UX formal y arquitectura (BMAD), integraciones reales Dropi/ML, Postgres/hosting cloud, backups, HTTPS (poner detrás de proxy TLS), PINs reales, reportes, conciliación por período.

## Revisión adversarial (Opus) — estado
Corregido: crash por URL inválida, lockout remoto de usuarios (límite por IP+usuario), logout real y `?t=` solo en SSE, devoluciones parciales (qty), día de negocio en zona Bogotá (`TZ_OFFSET_MIN`), supresión de alertas repetidas, validaciones 400, fotos solo jpeg/png/webp, refoco del escáner y carrera al abrir ingesta, bultos sin detalle (duplicados/vacíos), SW sin cachear errores, cancelar pedido pendiente.

**Brechas conocidas (no bloquean piloto interno, sí antes de producción):**
- PIN de 4 dígitos y `1234` de semilla: cambiar y usar PIN ≥6 / cambio forzado. `/api/users` es público (selector de login).
- Sin idempotencia/cola offline de escaneos (un reintento tras caída de red puede duplicar unidades).
- FR-3 multicanal: no se empuja stock de vuelta a Dropi/ML ni se reciben cancelaciones de canal (hoy solo cancelación manual).
- Sin dueño por ingesta, sin límite de conexiones SSE, tablero limitado a 200 productos, Tipificar hace N consultas.
