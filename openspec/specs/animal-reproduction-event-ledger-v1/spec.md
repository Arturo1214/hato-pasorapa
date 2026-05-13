# animal-reproduction-event-ledger-v1 Specification

## Purpose

Ledger reproductivo V1 append-only para servicio, preñez y parto, consultable por animal.

## Requirements

### Requirement: Registro append-only de eventos reproductivos

The system MUST registrar asientos inmutables para `SERVICE`, `PREGNANCY_CONFIRMED`, `PREGNANCY_LOSS` y `BIRTH` in the unified `animal_event_log` with `eventCategory=REPRODUCTION`. The underlying storage MAY be a unified table; the reproduction event ledger contract is preserved.
(Previously: append-only reproduction ledger; now also served offline)

#### Scenario: Alta válida y bloqueo de edición

- GIVEN un `animalUuid` existente y una fecha de evento válida
- WHEN se registra un evento `SERVICE` con metadata mínima requerida
- THEN el sistema crea un nuevo asiento reproductivo inmutable en unified log with `eventCategory=REPRODUCTION`
- AND SHALL rechazar edición o borrado de asientos existentes

### Requirement: Reproduction history available offline in animal context

The system MUST serve reproduction event history from local IndexedDB snapshots when offline, allowing the GANADERO to view service, pregnancy, and birth events without network access.

#### Scenario: Reproduction timeline loads offline
- GIVEN the device is offline
- WHEN the GANADERO opens the Reproducción tab on an animal profile
- THEN the reproduction event timeline renders from the local snapshot
- AND all event details remain fully readable

### Requirement: Append-only guarantees preserved

The system MUST maintain the append-only guarantee: once a reproduction event is inserted with `eventCategory=REPRODUCTION`, it MUST NOT be modified or deleted. Rollback of reproduction entries MUST NOT be possible through any API path.

#### Scenario: Intento de modificación rechazado

- GIVEN un evento reproductivo existente con `eventCategory=REPRODUCTION`
- WHEN se intenta actualizar o eliminar
- THEN el sistema MUST reject la operación

### Requirement: Metadata mínima tipada por tipo de evento

The system MUST exigir metadata mínima: `SERVICE.serviceMethod`, `PREGNANCY_CONFIRMED.confirmationDate`, `PREGNANCY_LOSS.lossReason`, `BIRTH.birthDate` y `BIRTH.offspringCount`. These validation rules are unchanged.

#### Scenario: Validación de metadata por tipo

- GIVEN un `animalUuid` existente
- WHEN se registra `PREGNANCY_CONFIRMED` con `confirmationDate` y `BIRTH` sin `offspringCount`
- THEN el primero se acepta y el segundo MUST rechazarse

### Requirement: Listado por animal y exclusiones de dominio

The system MUST listar eventos por `animalUuid` en fecha descendente filtering by `eventCategory=REPRODUCTION`. It MUST NOT cross-contaminate with general or health events when queried through the reproduction ledger interface.

#### Scenario: Consulta por animal con alcance V1

- GIVEN múltiples eventos reproductivos para un mismo `animalUuid`
- WHEN se consulta el ledger reproductivo por ese animal
- THEN se devuelven solo eventos V1 ordenados
- AND KPIs, predicción y adjuntos SHALL quedar excluidos
