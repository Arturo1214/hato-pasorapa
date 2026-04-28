# animal-event-offline-sync-v1 Specification

## Purpose
Definir creación/listado offline-first de eventos V1 con sincronización idempotente.

## Requirements

### Requirement: Queue-first create and local listing
The system MUST support queue-first creation of `ANIMAL_EVENT` (`CREATE`) when offline and MUST provide local history listing by `animalUuid` while disconnected.

#### Scenario: Alta offline con visibilidad local
- GIVEN dispositivo sin conectividad
- WHEN usuario registra evento `LOST`
- THEN la operación se encola localmente y el evento aparece en historial local del animal

### Requirement: Idempotent sync replay
The system MUST sync queued events through existing push/pull channel, MUST emit conflict metadata when replay cannot be applied, and MUST enforce idempotency by `operationId` so duplicate replays do not create duplicated ledger rows nor duplicated projection effects.

#### Scenario: Replay duplicado
- GIVEN el mismo `operationId` enviado más de una vez
- WHEN backend procesa reintentos
- THEN existe una sola inserción efectiva y una sola proyección resultante

#### Scenario: Replay en conflicto requiere hook de resolución
- GIVEN una operación en replay rechazada por estado servidor incompatible
- WHEN backend responde el ciclo de sync
- THEN retorna `status=CONFLICT` con metadata mínima para diff y resolución manual

### Requirement: Offline audit and compatibility boundaries
The system MUST preserve `sourceChannel` (`offline|online`) and `performedByUserId` across sync reconciliation. It SHOULD remain backward-compatible with existing sync contracts and MUST NOT require redesign of the offline foundation in V1.

#### Scenario: Reconciliación conserva auditoría
- GIVEN evento creado offline por usuario autenticado
- WHEN sync reconcilia con servidor
- THEN se conservan canal, autor y operación en el ledger remoto
