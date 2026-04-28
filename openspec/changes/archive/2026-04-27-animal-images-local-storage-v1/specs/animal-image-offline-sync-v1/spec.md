# animal-image-offline-sync-v1 Specification

## Purpose
Definir sincronización offline-first V1 para `ANIMAL_IMAGE` con cola local, replay idempotente y reconciliación de estado.

## Requirements

### Requirement: Queue-first offline image capture
The system MUST enqueue image operations locally when offline and SHALL persist temporary binary + metadata in local storage before sync. Queue entries MUST be keyed by `operationId` for idempotent replay.

#### Scenario: Carga offline pendiente
- GIVEN usuario sin conectividad
- WHEN agrega 2 imágenes al mismo `animalUuid`
- THEN ambas quedan en cola local con estado `PENDING`
- AND sus binarios permanecen disponibles en almacenamiento temporal local

#### Scenario: Reintento de la misma operación
- GIVEN una operación en cola con `operationId=abc`
- WHEN el cliente reintenta encolar `operationId=abc`
- THEN no se crea duplicado en la cola

### Requirement: Incremental push/pull reconciliation
The system MUST push pending `ANIMAL_IMAGE` operations when connectivity is restored and MUST reconcile local status to `SYNCED` only after server acknowledgment for the same `operationId`. It MAY keep failed operations as `FAILED` for retry and MUST NOT block other entity sync flows.

#### Scenario: Reconciliación exitosa post-conectividad
- GIVEN operaciones `PENDING` en cola
- WHEN el push recibe confirmación del servidor
- THEN las operaciones quedan `SYNCED`
- AND el listado local refleja estado reconciliado

#### Scenario: Falla parcial de sincronización
- GIVEN 3 operaciones pendientes
- WHEN 1 falla validación y 2 son aceptadas
- THEN 2 pasan a `SYNCED` y 1 queda `FAILED`
