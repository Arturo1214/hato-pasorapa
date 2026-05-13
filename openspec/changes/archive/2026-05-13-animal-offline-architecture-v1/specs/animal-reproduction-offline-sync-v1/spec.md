# Delta for animal-reproduction-offline-sync-v1

## ADDED Requirements

### Requirement: Transparent replay for reproduction events without blocking

The system MUST replay queued reproduction event operations in the background on reconnect without blocking the GANADERO's navigation or showing manual retry prompts.

#### Scenario: Reproduction event replay in background
- GIVEN pending reproduction events in the outbox
- WHEN connectivity is restored
- THEN sync replays automatically in background
- AND the GANADERO can continue using the app

### Requirement: Inline conflict badge on reproduction events

The system MUST display conflict badges directly on reproduction event rows in the timeline when replay returns `CONFLICT`, visible without accessing a separate resolution screen.

#### Scenario: Conflict badge on reproduction event row
- GIVEN a reproduction event in `CONFLICT` state
- WHEN the GANADERO views the animal reproduction timeline
- THEN the event row displays a conflict badge
- AND the event details remain accessible

## MODIFIED Requirements

### Requirement: Queue-first con estados de sincronización

The system MUST aceptar altas offline, guardarlas primero en cola y marcarlas `PENDING_SYNC` hasta confirmación.
(Previously: queue-first with PENDING_SYNC; now transparent background replay)

#### Scenario: Alta offline y falla de push
- GIVEN un dispositivo sin conectividad
- WHEN se registra un evento reproductivo válido
- THEN el evento se guarda en cola local con estado `PENDING_SYNC`
- AND si el push falla, SHALL mantenerse en cola sin pérdida

## REMOVED Requirements

None.
