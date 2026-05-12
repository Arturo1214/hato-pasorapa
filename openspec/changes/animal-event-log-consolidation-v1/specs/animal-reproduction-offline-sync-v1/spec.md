# Delta for animal-reproduction-offline-sync-v1

## MODIFIED Requirements

### Requirement: Queue-first con estados de sincronización

The system MUST aceptar altas offline, guardarlas primero en cola y marcarlas `PENDING_SYNC` hasta confirmación. The queued payload MUST include `eventCategory=REPRODUCTION` alongside existing reproduction metadata.

(Previously: payload typed as `ANIMAL_REPRODUCTION_EVENT`)

#### Scenario: Alta offline y falla de push

- GIVEN un dispositivo sin conectividad
- WHEN se registra un evento reproductivo válido
- THEN el evento se guarda en cola local with `eventCategory=REPRODUCTION`
- AND si el push falla, SHALL mantenerse en cola sin pérdida

### Requirement: Idempotencia por operationId

The system MUST usar `operationId` como clave idempotente en push para evitar duplicados en reintentos across the unified log, and MUST support conflict outcome handling before replaying blocked operations.

(Previously: idempotency scoped to `animal_reproduction_events` table)

#### Scenario: Reintento de operación ya aplicada

- GIVEN una operación previamente aplicada con `operationId` conocido
- WHEN el cliente reenvía la misma operación
- THEN el servidor responde sin crear duplicados

#### Scenario: Operación bloqueada por conflicto exige decisión

- GIVEN operación reproductiva con conflicto de estado
- WHEN se solicita replay sin decisión
- THEN el sistema deniega replay y exige resolución manual permitida

### Requirement: Pull incremental por cursor y alcance acotado

The system MUST soportar pull por cursor y devolver solo cambios with `eventCategory=REPRODUCTION`.

#### Scenario: Pull incremental e inicial

- GIVEN un cursor de sincronización válido
- WHEN el cliente ejecuta pull incremental
- THEN recibe solo cambios posteriores del dominio reproductivo
- AND sin cursor previo, MAY recibir snapshot inicial y nuevo cursor

#### Scenario: Pull excludes non-reproduction events

- GIVEN existing general and health events in unified log
- WHEN reproduction pull executes
- THEN only events with `eventCategory=REPRODUCTION` are returned
