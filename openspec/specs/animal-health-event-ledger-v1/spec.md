# animal-health-event-ledger-v1 Specification

## Purpose

Definir un ledger sanitario append-only por animal para vacunaciones, desparasitaciones, enfermedades y tratamientos, separado del ledger operativo.

## Requirements

### Requirement: Registro sanitario tipado y auditable

The system MUST persist each health event as append-only with required fields: `animalUuid`, `healthEventType`, `occurredAt`, `performedByUserId`, `sourceChannel`, `operationId`, and typed `metadata`; `notes` MAY be empty.

#### Scenario: Alta válida de vacunación

- GIVEN un animal existente y un payload `VACCINATION` con campos obligatorios y metadata tipada
- WHEN se registra el evento
- THEN el sistema crea una nueva entrada inmutable en `animal_health_events`
- AND conserva trazabilidad por `performedByUserId`, `sourceChannel` y `operationId`

#### Scenario: Rechazo por metadata inválida

- GIVEN un payload `DEWORMING` sin estructura de metadata esperada
- WHEN se valida el evento
- THEN el sistema MUST reject la operación con error de contrato

### Requirement: Metadata tipada para visita veterinaria de campo

The system MUST accept `FIELD_VET_VISIT` events with typed metadata blocks for `visit` (containing visitId, modo, veterinarianId, atencionNotas, estado, parentVisitId, nextControlAt), `checklist`, `clinicalNote` (reason, findings, plan — findings required when estado=ATENDIDA), `protocol`, `cost` (optional, { amount: number; currency: string }, FIELD_VET_VISIT only), `treatmentPlan` (optional, array of { description: string; order: number }), and `cancelReason` (required when estado=CANCELADA). Every block SHALL satisfy schema validation.

#### Scenario: Evento FIELD_VET_VISIT con metadata extendida

- GIVEN a payload `FIELD_VET_VISIT` with all visit blocks including modo, veterinarianId, atencionNotas, estado
- WHEN the event is validated
- THEN the system accepts and persists the record in the ledger

#### Scenario: Campo modo ausente

- GIVEN a `FIELD_VET_VISIT` without the `modo` field in visit block
- WHEN the event is validated
- THEN the system MUST reject the operation for incomplete contract

#### Scenario: FIELD_VET_VISIT completo con cost y treatmentPlan

- GIVEN a FIELD_VET_VISIT payload with all required visit blocks, cost block, and treatmentPlan
- WHEN the event is validated
- THEN the system accepts and persists all blocks

#### Scenario: Cancel sin cancelReason

- GIVEN a FIELD_VET_VISIT with estado=CANCELADA and no cancelReason
- WHEN the event is validated
- THEN the system MUST reject with ANIMAL_HEALTH_EVENT_VET_CANCEL_REASON_REQUIRED

#### Scenario: Attend sin findings

- GIVEN a FIELD_VET_VISIT with estado=ATENDIDA and missing clinicalNote.findings
- WHEN the event is validated
- THEN the system MUST reject the operation

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

### Requirement: Listado por visita dentro del animal

The system MUST allow filtering the per-animal health timeline by visit identifier for ESPECIFICA visits only. GLOBAL visits MUST NOT appear in per-animalUuid filtered queries unless the animal is explicitly linked via a campaign association.

#### Scenario: Filtro por visit identifier en animal específica

- GIVEN multiple FIELD_VET_VISIT events (específica) linked to animal A
- WHEN querying with animalUuid=A and visitId filter
- THEN only matching specific visits are returned

#### Scenario: GLOBAL visit en historia animal

- GIVEN a GLOBAL visit with nextControlAt
- WHEN the animal history is projected
- THEN the GLOBAL visit appears as a CAMPAIGN entry in the animal's timeline
- AND is distinguishable from ESPECIFICA entries by modo flag

### Requirement: Listado sanitario por animal

The system MUST provide a health timeline by `animalUuid` for ESPECIFICA visits, and MUST project GLOBAL campaign visits into every animal's timeline as CAMPAIGN entries.

#### Scenario: Timeline animal con campaña global

- GIVEN a GLOBAL visit (modo=GLOBAL, estado=ATENDIDA)
- WHEN animalUuid=A's timeline is queried
- THEN the visit appears as a CAMPAIGN entry
- AND reflects the veterinarian and notes from that specific visit event

#### Scenario: Timeline animal sin global visits si no está vinculada

- GIVEN a GLOBAL visit with no animal association
- WHEN an animal's timeline is queried
- THEN the global visit does NOT automatically appear unless explicitly linked
