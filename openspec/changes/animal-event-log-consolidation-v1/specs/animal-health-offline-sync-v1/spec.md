# Delta for animal-health-offline-sync-v1

## MODIFIED Requirements

### Requirement: Queue-first para altas sanitarias

The client MUST enqueue health-event create operations locally before network sync and MAY expose pending status in UI. The queued payload MUST include `eventCategory=HEALTH` alongside the existing typed health metadata.

(Previously: payload typed as `ANIMAL_HEALTH_EVENT`)

#### Scenario: Alta sin conectividad

- GIVEN el dispositivo offline
- WHEN el usuario registra una vacunación válida
- THEN la operación queda en cola local as `ANIMAL_HEALTH_EVENT` with `eventCategory=HEALTH`
- AND el registro aparece como pendiente de sincronización

#### Scenario: Reintento automático al recuperar conectividad

- GIVEN operaciones sanitarias pendientes en cola
- WHEN vuelve la conectividad
- THEN el sistema intenta sincronizarlas sin intervención manual

### Requirement: Idempotencia por operationId

The sync service MUST treat `operationId` as idempotency key for push and replay safety across all event categories. Duplicate `operationId` values MUST NOT create duplicate rows in the unified log.

(Previously: idempotency scoped to `animal_health_events` table)

#### Scenario: Replay del mismo evento

- GIVEN un evento sanitario ya aceptado con `operationId` X
- WHEN el cliente lo vuelve a enviar por reintento
- THEN el backend MUST NOT duplicar entradas en el ledger

#### Scenario: Conflicto en replay requiere resolución válida

- GIVEN una operación sanitaria en `CONFLICT`
- WHEN cliente intenta reintentar sin decisión manual válida
- THEN backend rechaza reintento y mantiene conflicto activo

#### Scenario: operationId faltante

- GIVEN una operación de sync sin `operationId`
- WHEN se valida en backend
- THEN el sistema MUST reject la operación por incumplir contrato de idempotencia

### Requirement: Pull incremental sanitario

The system SHALL support incremental pull for health events filtering by `eventCategory=HEALTH` so each client receives only unseen server events since its last cursor.

#### Scenario: Pull con cursor previo

- GIVEN un cliente con cursor de última sincronización
- WHEN ejecuta pull incremental
- THEN recibe solo eventos sanitarios posteriores al cursor

#### Scenario: Primer pull sin cursor

- GIVEN un cliente sin cursor sanitario previo
- WHEN ejecuta pull
- THEN el sistema retorna un lote inicial consistente y un nuevo cursor

#### Scenario: Pull excludes non-health events

- GIVEN existing general and reproduction events in unified log
- WHEN health event pull executes
- THEN only events with `eventCategory=HEALTH` are returned
