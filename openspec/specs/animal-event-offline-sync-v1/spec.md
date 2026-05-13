# animal-event-offline-sync-v1 Specification

## Purpose
Definir creación/listado offline-first de eventos V1 con sincronización idempotente.

## Requirements

### Requirement: Queue-first create and local listing

The system MUST support queue-first creation of `ANIMAL_EVENT` (`CREATE`) when offline and MUST provide local history listing by `animalUuid` while disconnected. The queued payload MUST include `eventCategory=GENERAL` and the client-side type discriminator.
(Previously: queue-first create with local listing)

#### Scenario: Alta offline con visibilidad local

- GIVEN dispositivo sin conectividad
- WHEN usuario registra evento `LOST` locally
- THEN la operación se encola locally with `eventCategory=GENERAL`
- AND el evento aparece en historial local del animal

### Requirement: Transparent sync replay without user blocking

The system MUST replay queued `ANIMAL_EVENT` operations automatically on reconnect in the background, without showing progress dialogs or blocking GANADERO navigation.

#### Scenario: Background replay does not block UI
- GIVEN the device is offline and has 3 pending animal events
- WHEN connectivity is restored
- THEN sync replays in background
- AND the GANADERO can continue navigating without waiting

### Requirement: Inline conflict display on event rows

The system MUST display conflict badges directly on event rows when replay returns `CONFLICT`, without requiring the GANADERO to open a separate conflict resolution screen.

#### Scenario: Conflict badge on pending event
- GIVEN an `ANIMAL_EVENT` operation in `CONFLICT` state after replay
- WHEN the GANADERO views the animal history
- THEN the event row displays a conflict badge
- AND the event details remain accessible

### Requirement: Idempotent sync replay

The system MUST sync queued events through existing push/pull channel, MUST emit conflict metadata when replay cannot be applied, and MUST enforce idempotency by `operationId` so duplicate replays do not create duplicated ledger rows nor duplicated projection effects. The `operationId` scope is global across categories.

#### Scenario: Replay duplicado

- GIVEN el mismo `operationId` enviado más de una vez
- WHEN backend procesa reintentos
- THEN existe una sola inserción efectiva y una sola proyección resultante

#### Scenario: Replay en conflicto requiere hook de resolución

- GIVEN una operación en replay rechazada por estado servidor incompatible
- WHEN backend responde el ciclo de sync
- THEN retorna `status=CONFLICT` con metadata mínima para diff y resolución manual

### Requirement: Offline audit and compatibility boundaries

The system MUST preserve `sourceChannel` (`offline|online`) and `performedByUserId` across sync reconciliation. The sync payload MUST include `eventCategory` without requiring redesign of the offline foundation.

#### Scenario: Reconciliación conserva auditoría

- GIVEN evento creado offline por usuario autenticado
- WHEN sync reconcilia con servidor
- THEN se conservan canal, autor y operación en el ledger remoto

#### Scenario: Push payload includes eventCategory

- GIVEN queued general event operation
- WHEN push executes
- THEN payload includes `eventCategory=GENERAL`
- AND backend routes to unified log correctly
