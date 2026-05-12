# Delta for animal-health-event-ledger-v1

## MODIFIED Requirements

### Requirement: Registro sanitario tipado y auditable

The system MUST persist each health event as append-only in the unified `animal_event_log` with `eventCategory=HEALTH`. Required fields: `animalUuid`, `healthEventType`, `occurredAt`, `performedByUserId`, `sourceChannel`, `operationId`, and typed `metadata`; `notes` MAY be empty. The underlying persistence MAY be a unified table; the health event ledger contract is preserved.

(Previously: persist in `animal_health_events` table)

#### Scenario: Alta válida de vacunación

- GIVEN un animal existente y un payload `VACCINATION` con campos obligatorios y metadata tipada
- WHEN se registra el evento
- THEN el sistema crea una nueva entrada inmutable en unified log with `eventCategory=HEALTH`
- AND conserva trazabilidad por `performedByUserId`, `sourceChannel` y `operationId`

#### Scenario: Rechazo por metadata inválida

- GIVEN un payload `DEWORMING` sin estructura de metadata esperada
- WHEN se valida el evento
- THEN el sistema MUST reject la operación con error de contrato

### Requirement: Metadata tipada para visita veterinaria de campo

The system MUST accept `FIELD_VET_VISIT` events with typed metadata blocks for `visit`, `checklist`, `clinicalNote`, `protocol`, `cost`, `treatmentPlan`, and `cancelReason` — all preserved verbatim in the unified log with `eventCategory=HEALTH`. Validation rules for `modo`, `veterinarianId`, `atencionNotas`, `estado`, `parentVisitId`, `nextControlAt`, `clinicalNote.findings` when `estado=ATENDIDA`, and `cancelReason` when `estado=CANCELADA` MUST NOT be weakened.

(Previously: stored in `animal_health_events`)

#### Scenario: Evento FIELD_VET_VISIT con metadata extendida

- GIVEN a payload `FIELD_VET_VISIT` with all visit blocks including modo, veterinarianId, atencionNotas, estado
- WHEN the event is validated
- THEN the system accepts and persists the record in unified log with `eventCategory=HEALTH`

#### Scenario: Campo modo ausente

- GIVEN a `FIELD_VET_VISIT` without the `modo` field in visit block
- WHEN the event is validated
- THEN the system MUST reject the operation for incomplete contract

#### Scenario: Cancel sin cancelReason

- GIVEN a FIELD_VET_VISIT with estado=CANCELADA and no cancelReason
- WHEN the event is validated
- THEN the system MUST reject with ANIMAL_HEALTH_EVENT_VET_CANCEL_REASON_REQUIRED

#### Scenario: Attend sin findings

- GIVEN a FIELD_VET_VISIT with estado=ATENDIDA and missing clinicalNote.findings
- WHEN the event is validated
- THEN the system MUST reject the operation

### Requirement: Cost block solo para FIELD_VET_VISIT

The system MUST reject any non-`FIELD_VET_VISIT` event containing a `cost` block. `FIELD_VET_VISIT` events are exempt.

#### Scenario: VACCINATION con cost rechazado

- GIVEN a VACCINATION payload with metadata.cost.amount
- WHEN the event is validated
- THEN the system MUST reject the event for out-of-scope attachment

#### Scenario: FIELD_VET_VISIT con cost aceptado

- GIVEN a FIELD_VET_VISIT payload with metadata.cost: { amount: 200; currency: "BOB" }
- WHEN the event is validated
- THEN the cost is persisted

### Requirement: Tipos V1 y exclusiones explícitas

The system SHALL accept `FIELD_VET_VISIT` with modo GLOBAL (animalUuid=NULL) or ESPECIFICA (animalUuid required). The system MUST NOT store reproduction events in this category.

#### Scenario: Evento GLOBAL sin animal

- GIVEN a `FIELD_VET_VISIT` payload with modo=GLOBAL and animalUuid=NULL
- WHEN the event is processed
- THEN the system accepts and persists the global visit

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
