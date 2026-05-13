# animal-image-offline-sync-v1 Specification

## Purpose
Definir sincronización offline-first V1 para `ANIMAL_IMAGE` con cola local, replay idempotente y reconciliación de estado.

## Requirements

### Requirement: Queue-first offline image capture
The system MUST enqueue image operations locally when offline and SHALL persist temporary binary + metadata in local storage before sync. Queue entries MUST be keyed by `operationId` for idempotent replay.
(Previously: queue-first with metadata; now includes blob persistence)

#### Scenario: Carga offline pendiente
- GIVEN usuario sin conectividad
- WHEN agrega 2 imágenes al mismo `animalUuid`
- THEN ambas quedan en cola local con estado `PENDING`
- AND sus binarios permanecen disponibles en almacenamiento temporal local

#### Scenario: Reintento de la misma operación
- GIVEN una operación en cola con `operationId=abc`
- WHEN el cliente reintenta encolar `operationId=abc`
- THEN no se crea duplicado en la cola

### Requirement: Local blob persistence before sync

The system MUST persist image binary blobs locally in IndexedDB before attempting server upload, and MUST keep the blob available for retry if upload fails.

#### Scenario: Blob persisted before upload attempt
- GIVEN a new image capture while offline
- WHEN the image is queued for sync
- THEN the binary blob is stored in IndexedDB
- AND remains available for retry after reconnect

### Requirement: Local-only badge on photo cards

The system MUST display a `local-only` badge on photo thumbnails that exist only in local storage and have not been confirmed by the server.

#### Scenario: Photo card shows local-only badge
- GIVEN an image entry with `syncStatus=PENDING` or `local-only`
- WHEN the animal image gallery renders
- THEN the thumbnail displays a `local-only` badge

### Requirement: Incremental push/pull reconciliation
The system MUST push pending `ANIMAL_IMAGE` operations when connectivity is restored, MUST reconcile local status to `SYNCED` only after server acknowledgment for the same `operationId`, MAY keep failed operations as `FAILED` for retry, and MUST expose manual conflict resolution for image-specific failures according to policy exclusions.

#### Scenario: Reconciliación exitosa post-conectividad
- GIVEN operaciones `PENDING` en cola
- WHEN el push recibe confirmación del servidor
- THEN las operaciones quedan `SYNCED`
- AND el listado local refleja estado reconciliado

#### Scenario: Falla parcial de sincronización
- GIVEN 3 operaciones pendientes
- WHEN 1 falla validación y 2 son aceptadas
- THEN 2 pasan a `SYNCED` y 1 queda `FAILED`

#### Scenario: Conflicto de imagen excluido de resolución manual
- GIVEN una falla de imagen marcada como exclusión explícita por policy
- WHEN usuario intenta `accept_server` o `retry_local`
- THEN el sistema MUST NOT aceptar la resolución manual y deja conflicto para manejo estándar
