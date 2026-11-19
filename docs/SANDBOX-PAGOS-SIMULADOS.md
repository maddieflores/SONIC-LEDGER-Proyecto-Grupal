# ARQUITECTURA Y ESPECIFICACIÓN — SANDBOX DE PAGOS Y REEMBOLSOS SIMULADOS
## SONIC LEDGER — PLATAFORMA DE TICKETING Y EXPERIENCIA MUSICAL

---

### 1. Resumen Ejecutivo y Objetivos

Este documento describe la arquitectura técnica, los modelos de datos, las medidas de seguridad y el comportamiento del **Sandbox de Pagos y Reembolsos Simulados** de **Sonic Ledger**.

El objetivo central es permitir la demostración y verificación de un ciclo completo de:
1. **Compra y reserva temporal de cupos** (CU20).
2. **Emisión de tickets digitales con código QR** (CU21).
3. **Validación de ingreso en puerta** (CU22).
4. **Cancelación controlada de conciertos** (CU17).
5. **Solicitud, procesamiento y reintento de reembolsos simulados** (totales y parciales).
6. **Métricas analíticas de ventas, asistencia y recaudación neta** (CU24).

Todo el sistema opera **estrictamente de forma local y ficticia**, sin conectarse a pasarelas bancarias externas, sin requerir números de tarjeta reales, sin almacenar datos financieros sensibles y sin atribuir respuestas al nombre WizPay ni a ninguna entidad financiera real.

---

### 2. Arquitectura del Sistema

```
                      +-----------------------------------+
                      |   Sonic Ledger Client (Web / App) |
                      +-----------------+-----------------+
                                        |
                 (1) Crear Orden        |  (2) Pagar / Confirmar
                                        v
                      +-----------------------------------+
                      |    Sonic Ledger Backend (NestJS)  |
                      |   - TicketingService              |
                      |   - EstadisticasService           |
                      |   - ConciertosService             |
                      +-------+-------------------+-------+
                              |                   ^
       (3) Intents / Sessions |                   | (4) Webhooks Firmados
                              v                   |     (HMAC SHA-256)
                      +---------------------------+-------+
                      |   Sandbox Gateway (Ficticio Local)|
                      |   - Merchant: SONIC_LEDGER_01     |
                      |   - API Key & Local Webhook Sec   |
                      |   - Status: Aprobado / Rechazado  |
                      +-----------------------------------+
                                        |
                                        v
                      +-----------------------------------+
                      |    PostgreSQL Database (Docker)   |
                      |   - ordenes_compra (monto_reemb)  |
                      |   - reembolsos (tabla dedicada)   |
                      |   - tickets (motivo_invalidacion) |
                      |   - conciertos (cancelacion)      |
                      +-----------------------------------+
```

#### 2.1. Componentes Clave
1. **`SandboxGatewayModule` (`backend/src/sandbox-gateway/`)**:
   - Módulo desacoplado que simula la entidad procesadora externa.
   - Maneja sesiones de pago (`SandboxPaymentSession`) y de devolución (`SandboxRefundSession`).
   - Genera y valida firmas criptográficas de webhooks mediante HMAC SHA-256 en tiempo constante (`timingSafeEqual`).
   - Bloqueado automáticamente en producción (`NODE_ENV === 'production'`).
2. **`TicketingModule` (`backend/src/ticketing/`)**:
   - Maneja la máquina de estados de las órdenes (`PENDIENTE`, `CONFIRMADA`, `EXPIRADA`, `CANCELADA`, `FALLIDA`).
   - Gestiona las solicitudes y el ciclo de vida de los reembolsos (`PENDIENTE`, `EN_PROCESO`, `COMPLETADO`, `FALLIDO`).
   - Valida la autenticidad e idempotencia de los webhooks entrantes antes de modificar órdenes o cupos.
3. **`PostgreSQL` (`TypeORM`)**:
   - Transaccionalidad estricta con bloqueos pesimistas (`pessimistic_write`) para prevenir condiciones de carrera entre compras concurrentes, cancelaciones de evento y devoluciones.

---

### 3. Credenciales Ficticias y Configuración Local

Las credenciales del entorno de pruebas son exclusivamente locales, sin valor comercial ni bancario:

| Parámetro | Configuración / Variable de Entorno | Uso / Propósito |
|---|---|---|
| **Comercio Ficticio** | `process.env.SANDBOX_MERCHANT_ID` | Identificador de comercio en el simulador |
| **Sandbox API Key** | `process.env.SANDBOX_API_KEY` (privada en `.env`) | Autenticación en endpoints del sandbox (`x-api-key`) |
| **Webhook Secret** | `process.env.SANDBOX_WEBHOOK_SECRET` (privada en `.env`) | Secreto para computar la firma HMAC SHA-256 |
| **Moneda** | `BOB` (Bolivianos) | Moneda local de la plataforma |
| **Tiempo de Reserva** | 15 minutos (900 segundos) | Expiración de reservas no pagadas |

---

### 4. Endpoints de la Pasarela Sandbox y Ticketing

#### 4.1. Pasarela Sandbox (`/api/sandbox-gateway`)
- `GET /sandbox-gateway/status`: Retorna el estado del simulador y sesiones activas.
- `POST /sandbox-gateway/payments`: Crea una intención de pago simulada (`orderId`, `amount`, `simulatedStatus`).
- `GET /sandbox-gateway/payments/:id`: Consulta el estado de una sesión de pago.
- `POST /sandbox-gateway/refunds`: Registra una intención de devolución (`orderId`, `amount`, `reason`).
- `GET /sandbox-gateway/refunds/:id`: Consulta el estado de una sesión de reembolso.
- `POST /sandbox-gateway/simulate/trigger-webhook`: Dispara un webhook HTTP firmado contra el endpoint receptor del backend.

#### 4.2. Devoluciones y Webhooks en Ticketing (`/api/ticketing`)
- `POST /ticketing/reembolsos`: Solicita una devolución total o parcial (JWT requerido; autorizado para el comprador, organizador o admin).
- `GET /ticketing/ordenes/:id/reembolsos`: Consulta el historial de devoluciones de una orden.
- `POST /ticketing/reembolsos/:id/reintentar`: Permite reintentar una devolución en estado `FALLIDO`.
- `GET /ticketing/organizador/conciertos/:id/reembolsos`: Resumen agregado de solicitudes de devolución por concierto.
- `POST /ticketing/sandbox/procesar-reembolso`: Permite al organizador o tester completar o fallar una devolución en el simulador de pruebas.
- `POST /ticketing/webhooks/sandbox`: Receptor oficial de webhooks. Requiere cabecera `X-Sandbox-Signature`.

---

### 5. Flujos Transaccionales Detallados

#### 5.1. Flujo de Compra y Emisión de Entradas
1. El usuario selecciona categoría y cantidad en el detalle del concierto.
2. `POST /ticketing/ordenes`: Se bloquea el cupo con `pessimistic_write`, se descuenta el cupo disponible y se crea la reserva temporal (15 min) en estado `PENDIENTE`.
3. El frontend muestra la pantalla de checkout con el resumen natural de compra y la advertencia: *"Modo demostración — Sin cargos ni devoluciones reales"*.
4. Al confirmar la compra (`POST /ticketing/pagos` o mediante webhook `payment.succeeded`):
   - Se verifica que el concierto siga en estado `PUBLICADO` bajo bloqueo pesimista.
   - Si el concierto fue cancelado concurrentemente: la orden pasa a `CANCELADA`, se registra obligación de devolución y **no se emite ningún ticket**.
   - Si el concierto está activo: la orden pasa a `CONFIRMADA`, se confirma la reserva definitiva y se emite exactamente un ticket QR (`TicketEstado.VIGENTE`) por cada unidad adquirida.

#### 5.2. Flujo de Cancelación y Reembolso
1. El organizador o administrador cancela el concierto (`POST /conciertos/:id/cancelar`) proporcionando un motivo obligatorio.
2. Dentro de una única transacción TypeORM:
   - El concierto pasa a `CANCELADO`.
   - Todos los tickets del evento se invalidan (`TicketEstado.INVALIDADO`, `motivoInvalidacion = 'CONCIERTO_CANCELADO'`).
   - Las reservas pendientes no pagadas se liberan de inmediato.
   - Para cada orden en estado `CONFIRMADA`:
     - La orden se actualiza a `reembolsoEstado = ReembolsoEstado.PENDIENTE_REEMBOLSO`.
     - Se genera de forma automática una solicitud en la tabla `reembolsos` en estado `PENDIENTE` (`tipo = TOTAL`, `monto = orden.total - orden.montoReembolsado`).
3. En el panel de control del organizador:
   - Se visualizan las solicitudes pendientes.
   - Se puede acceder al panel Sandbox para completar o rechazar la devolución de prueba.
4. Al completarse la devolución:
   - La solicitud pasa a `COMPLETADO` con fecha de procesamiento.
   - La orden acumula `montoReembolsado`.
   - Si `montoReembolsado >= total`, la orden pasa a `REEMBOLSADO`; si es parcial, a `REEMBOLSO_PARCIAL`.
   - En las estadísticas de CU24, `ingresosNetosBob` refleja de inmediato la deducción de los montos devueltos.

---

### 6. Seguridad y Validación de Webhooks

1. **Firma Criptográfica HMAC SHA-256**:
   - Cada carga útil de webhook se firma con el secreto local:
     `HMAC_SHA256(rawBody, WEBHOOK_SECRET)`.
   - El receptor valida la cabecera `X-Sandbox-Signature`.
   - Se utiliza `crypto.timingSafeEqual` para prevenir ataques de temporización.
2. **Idempotencia Absoluta**:
   - Si un evento `payment.succeeded` se recibe múltiples veces, el sistema verifica `orden.estado === CONFIRMADA` y responde `200 OK` sin emitir tickets duplicados.
   - Si un evento de reembolso se repite, detecta que ya se encuentra en `COMPLETADO` y no suma montos adicionales.
3. **Regla de No Superación de Importe**:
   - Ninguna solicitud ni procesamiento de reembolso puede superar el saldo pendiente:
     $$\text{montoReembolso} + \text{montoReembolsadoAcumulado} \le \text{orden.total}$$
   - Intentos de exceder el valor pagado son rechazados con `BadRequestException`.
4. **Aislamiento en Producción**:
   - Si `process.env.NODE_ENV === 'production'`, todos los endpoints del simulador devuelven `403 Forbidden`.

---

### 7. Experiencia de Usuario y Ajustes de Interfaz

Siguiendo estrictamente las directivas de presentación profesional de **Sonic Ledger**:
- **Se eliminó la palabra "simulada" / "simulado" de todas las vistas de usuario final**: Tanto en Web como en Android.
- **Se utilizan términos naturales del negocio**:
  - *"Comprar entradas"*
  - *"Resumen de compra"*
  - *"Compra confirmada"*
  - *"Mis entradas"*
  - *"Concierto cancelado"*
  - *"Estado de devolución"*
- **Aviso integrado al diseño neón**:
  - *"Modo demostración — Sin cargos ni devoluciones reales"* visible antes de confirmar compras y en los detalles de tickets/devoluciones.
- **Transparencia en devoluciones**:
  - El cliente ve en sus entradas el estado de la devolución (*"Pendiente de procesamiento"* o *"Devolución completada"* con el monto en BOB).
  - El organizador cuenta con un panel modal accesible desde la pestaña de estadísticas para gestionar y simular el procesamiento de devoluciones.

---

### 8. Pruebas Realizadas y Matriz de Verificación

Se desarrolló la suite automatizada `backend/src/ticketing/sandbox-pagos.spec.ts` complementada con las suites existentes:

| # | Caso de Prueba Verificado | Resultado | Módulo / Archivo |
|---|---|:---:|---|
| 1 | Pago aprobado y emisión de ticket en estado VIGENTE | **PASSED** | `sandbox-pagos.spec.ts` |
| 2 | Pago rechazado: orden a FALLIDA y liberación de cupo | **PASSED** | `sandbox-pagos.spec.ts` |
| 3 | Cancelación de concierto por organizador/admin | **PASSED** | `cu17-cancelacion.spec.ts` |
| 4 | Creación de solicitud de reembolso PENDIENTE al cancelar | **PASSED** | `sandbox-pagos.spec.ts` |
| 5 | Reembolso total simulado: orden a REEMBOLSADO | **PASSED** | `sandbox-pagos.spec.ts` |
| 6 | Reembolso parcial: orden a REEMBOLSO_PARCIAL | **PASSED** | `sandbox-pagos.spec.ts` |
| 7 | Reembolso fallido y reintento a PENDIENTE | **PASSED** | `sandbox-pagos.spec.ts` |
| 8 | Prevención de reembolso duplicado con clave de idempotencia | **PASSED** | `sandbox-pagos.spec.ts` |
| 9 | Webhook duplicado: respuesta idempotente sin tickets extra | **PASSED** | `sandbox-pagos.spec.ts` |
| 10 | Webhook con firma HMAC inválida: rechazo con 401 | **PASSED** | `sandbox-pagos.spec.ts` |
| 11 | Importe de devolución superior al pagado: rechazo con 400 | **PASSED** | `sandbox-pagos.spec.ts` |
| 12 | Compra durante cancelación: orden cancelada, 0 tickets | **PASSED** | `sandbox-pagos.spec.ts` / `concurrency.e2e.spec.ts` |
| 13 | Persistencia y consulta agregada de reembolsos para organizador | **PASSED** | `sandbox-pagos.spec.ts` |
| 14 | Estadísticas CU24 coherentes con devoluciones y recaudación neta | **PASSED** | `cu24-estadisticas.spec.ts` |
| 15 | Compatibilidad integral con CU17, CU20, CU21, CU22 y CU24 | **PASSED** | Suite completa (21 archivos, 138 pruebas) |

**Resultados globales de compilación y pruebas:**
- **Backend**: 21 archivos de prueba, **138/138 pruebas pasando (100%)**.
- **Frontend Web**: `npm --prefix frontend run build` completado exitosamente sin errores.
- **Mobile Expo**: `npm --prefix mobile run typecheck` completado exitosamente sin errores.

---

### 9. Limitaciones respecto a una Pasarela Real

1. **Ausencia de Procesamiento Monetario Real**:
   - No se conecta a redes interbancarias, cámaras de compensación ni pasarelas comerciales reales.
2. **Ambiente Local**:
   - Las claves de API y secretos de webhook están configurados para desarrollo y demostración local.
3. **Liquidación Inmediata de Demostración**:
   - En una pasarela real, las devoluciones a tarjetas de crédito o débito pueden demorar entre 24 horas y 15 días hábiles según la entidad emisora; en el Sandbox, la confirmación ocurre en tiempo real al simular la aprobación.
4. **Protocolo PCI-DSS**:
   - Dado que Sonic Ledger no solicita, transmite ni almacena números de tarjeta bancaria reales, el sistema no requiere certificación PCI-DSS en esta fase de demostración.
