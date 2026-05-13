# Delta for animal-health-offline-sync-v1

## ADDED Requirements

### Requirement: Transparent replay for health events without blocking

The system MUST replay queued health event operations in the background on reconnect without blocking the GANADERO's navigation or showing manual retry prompts.

#### Scenario: Health event replay in background
- GIVEN pending health events in the outbox
- WHEN connectivity is restored
- THEN sync replays automatically in background
- AND the GANADERO can view animal health data without interruption

### Requirement: Inline conflict badge on health events

The system MUST display conflict badges directly on health event rows in the timeline when replay returns `CONFLICT`, visible without accessing a separate resolution screen.

#### Scenario: Conflict badge on health event row
- GIVEN a health event in `CONFLICT` state
- WHEN the GANADERO views the animal health timeline
- THEN the event row displays a conflict badge
- AND the event details remain accessible

## MODIFIED Requirements

### Requirement: Queue-first para altas sanitarias

The client MUST enqueue health-event create operations locally before network sync and MAY expose pending status in UI.
(Previously: queue-first with pending status; now transparent background replay)

#### Scenario: Alta sin conectividad
- GIVEN el dispositivo offline
- WHEN el usuario registra una vacunación válida
- THEN la operación queda en cola local como `ANIMAL_HEALTH_EVENT`
- AND el registro aparece como pendiente de sincronización

#### Scenario: Reintento automático al recuperar conectividad
- GIVEN operaciones sanitarias pendientes en cola
- WHEN vuelve la conectividad
- THEN el sistema intenta sincronizarlas sin intervención manual

## REMOVED Requirements

None.
