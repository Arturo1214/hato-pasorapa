# Delta for animal-health-event-ledger-v1

## ADDED Requirements

### Requirement: Health event data available offline in animal context

The system MUST serve health event history from local IndexedDB snapshots when offline, allowing the GANADERO to view the full health timeline including vet visits without network access.

#### Scenario: Health timeline loads offline
- GIVEN the device is offline
- WHEN the GANADERO opens the Salud tab on an animal profile
- THEN the health event timeline renders from the local snapshot
- AND vet visit details remain fully readable

### Requirement: Offline access to field vet visit metadata

The system MUST cache and serve locally all typed metadata blocks for `FIELD_VET_VISIT` events (visit, checklist, clinicalNote, protocol, cost, treatmentPlan) from IndexedDB while offline.

#### Scenario: Vet visit metadata readable offline
- GIVEN a `FIELD_VET_VISIT` event previously synced
- WHEN the GANADERO views the event details while offline
- THEN all metadata blocks (including veterinarianId, atencionNotas, cost) are displayed

## MODIFIED Requirements

### Requirement: Registro sanitario tipado y auditable

The system MUST persist each health event as append-only with required fields: `animalUuid`, `healthEventType`, `occurredAt`, `performedByUserId`, `sourceChannel`, `operationId`, and typed `metadata`; `notes` MAY be empty.
(Previously: append-only audit; now also served offline)

#### Scenario: Alta válida de vacunación
- GIVEN un animal existente y un payload `VACCINATION` con campos obligatorios y metadata tipada
- WHEN se registra el evento
- THEN el sistema crea una nueva entrada inmutable en `animal_health_events`
- AND conserva trazabilidad por `performedByUserId`, `sourceChannel` y `operationId`

## REMOVED Requirements

None.
