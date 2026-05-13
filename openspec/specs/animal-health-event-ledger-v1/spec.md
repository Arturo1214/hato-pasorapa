# animal-health-event-ledger-v1 Specification

## Purpose

Definir un ledger sanitario append-only por animal para vacunaciones, desparasitaciones, enfermedades y tratamientos, separado del ledger operativo.

## Requirements

### Requirement: Registro sanitario tipado y auditable

The system MUST persist each health event as append-only in the unified `animal_event_log` with `eventCategory=HEALTH`. Required fields: `animalUuid`, `healthEventType`, `occurredAt`, `performedByUserId`, `sourceChannel`, `operationId`, and typed `metadata`; `notes` MAY be empty. The underlying persistence MAY be a unified table; the health event ledger contract is preserved.
(Previously: append-only audit; now also served offline)

#### Scenario: Alta válida de vacunación

- GIVEN un animal existente y un payload `VACCINATION` con campos obligatorios y metadata tipada
- WHEN se registra el evento
- THEN el sistema crea una nueva entrada inmutable en unified log with `eventCategory=HEALTH`
- AND conserva trazabilidad por `performedByUserId`, `sourceChannel` y `operationId`

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

#### Scenario: Rechazo por metadata inválida

- GIVEN un payload `DEWORMING` sin estructura de metadata esperada
- WHEN se valida el evento
- THEN el sistema MUST reject la operación con error de contrato

### Requirement: Metadata tipada para visita veterinaria de campo

The system MUST accept `FIELD_VET_VISIT` events with typed metadata blocks for: `visit` (visitId, modo, veterinarianId, atencionNotas, estado, parentVisitId, nextControlAt), `checklist`, `clinicalNote` (reason, findings — findings required when estado=`ATENDIDA`), `protocol`, `cost` (optional, FIELD_VET_VISIT only), `treatmentPlan` (optional), and `cancelReason` (required when estado=`CANCELADA`). The `visit.estado` field MUST accept `PROGRAMADA`, `ATENDIDA`, and `CANCELADA` only; `FINALIZADA` and `REPROGRAMADA` are not valid estado values for ledger events.

#### Scenario: FIELD_VET_VISIT with ATENDIDA and parentVisitId

- GIVEN a payload `FIELD_VET_VISIT` with estado=`ATENDIDA` and parentVisitId set
- WHEN the event is validated
- THEN it is accepted and persisted

#### Scenario: Cancel without cancelReason rejected

- GIVEN a `FIELD_VET_VISIT` with estado=`CANCELADA` and no cancelReason
- WHEN the event is validated
- THEN the system MUST reject with ANIMAL_HEALTH_EVENT_VET_CANCEL_REASON_REQUIRED

#### Scenario: FINALIZADA estado rejected

- GIVEN a `FIELD_VET_VISIT` with estado=`FINALIZADA`
- WHEN the event is validated
- THEN the system MUST reject — finalization is a chain closure flag, not a visit estado

### Requirement: Cost block solo para FIELD_VET_VISIT

The system MUST reject any non-`FIELD_VET_VISIT` event containing a `cost`, `costo`, `price`, `billing`, or `amount` key in metadata. `FIELD_VET_VISIT` events are exempt from this exclusion to allow visit cost tracking.

#### Scenario: VACCINATION con cost rechazado

- GIVEN a VACCINATION payload with metadata.cost.amount
- WHEN the event is validated
- THEN the system MUST reject the event for out-of-scope attachment

#### Scenario: FIELD_VET_VISIT con cost aceptado

- GIVEN a FIELD_VET_VISIT payload with metadata.cost: { amount: 200; currency: "BOB" }
- WHEN the event is validated
- THEN the cost is persisted

### Requirement: Tipos V1 y exclusiones explícitas

The system SHALL accept `FIELD_VET_VISIT` with modo GLOBAL (animalUuid=NULL) or ESPECIFICA (animalUuid required). The system MUST NOT store reproduction events, image/attachment payloads, or billing/costing payloads in this ledger.

#### Scenario: Evento GLOBAL sin animal

- GIVEN a `FIELD_VET_VISIT` payload with modo=GLOBAL and animalUuid=NULL
- WHEN the event is processed
- THEN the system accepts and persists the global visit
- AND the visit is queryable via global listing but NOT via per-animalUuid filter

#### Scenario: Evento fuera de alcance

- GIVEN a payload with multimedia attachment block
- WHEN the system evaluates it for V1
- THEN the event MUST be rejected by explicit exclusion

### Requirement: Listado sanitario por animal

The system MUST provide a health timeline by `animalUuid` filtering by `eventCategory=HEALTH` and specific health event types. GLOBAL visits MUST appear as CAMPAIGN entries in per-animal timelines when linked.

#### Scenario: Timeline animal con campaña global

- GIVEN a GLOBAL visit (modo=GLOBAL, estado=ATENDIDA) linked to animals
- WHEN animalUuid=A's timeline is queried
- THEN the visit appears as a CAMPAIGN entry
- AND reflects the veterinarian and notes from that specific visit event

#### Scenario: Filtro por visit identifier en animal específica

- GIVEN multiple FIELD_VET_VISIT events (específica) linked to animal A
- WHEN querying with animalUuid=A and visitId filter
- THEN only matching specific visits are returned
