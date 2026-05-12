# Delta for animal-event-offline-sync-v1

## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Queue-first create and local listing

The system MUST support queue-first creation of `ANIMAL_EVENT` (`CREATE`) when offline and MUST provide local history listing by `animalUuid` while disconnected.
(Previously: queue-first create with local listing)

#### Scenario: Alta offline con visibilidad local
- GIVEN dispositivo sin conectividad
- WHEN usuario registra evento `LOST`
- THEN la operación se encola localmente y el evento aparece en historial local del animal

## REMOVED Requirements

None.
