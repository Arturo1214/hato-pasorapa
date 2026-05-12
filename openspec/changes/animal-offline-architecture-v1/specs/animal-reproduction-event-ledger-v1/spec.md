# Delta for animal-reproduction-event-ledger-v1

## ADDED Requirements

### Requirement: Reproduction history available offline in animal context

The system MUST serve reproduction event history from local IndexedDB snapshots when offline, allowing the GANADERO to view service, pregnancy, and birth events without network access.

#### Scenario: Reproduction timeline loads offline
- GIVEN the device is offline
- WHEN the GANADERO opens the Reproducción tab on an animal profile
- THEN the reproduction event timeline renders from the local snapshot
- AND all event details remain fully readable

## MODIFIED Requirements

### Requirement: Registro append-only de eventos reproductivos

The system MUST registrar asientos inmutables para `SERVICE`, `PREGNANCY_CONFIRMED`, `PREGNANCY_LOSS` y `BIRTH`.
(Previously: append-only reproduction ledger; now also served offline)

#### Scenario: Alta válida y bloqueo de edición
- GIVEN un `animalUuid` existente y una fecha de evento válida
- WHEN se registra un evento `SERVICE` con metadata mínima requerida
- THEN el sistema crea un nuevo asiento reproductivo
- AND SHALL rechazar edición o borrado de asientos existentes

## REMOVED Requirements

None.
