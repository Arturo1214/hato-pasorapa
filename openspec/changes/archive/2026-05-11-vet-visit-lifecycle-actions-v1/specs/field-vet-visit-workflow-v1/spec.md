# Delta for field-vet-visit-workflow-v1

## MODIFIED Requirements

### Requirement: Protocolo y seguimiento con veterinario por visita

The system MUST support extended lifecycle: `PROGRAMADA` → `ATENDIDA` → `REPROGRAMADA` | `FINALIZADA` | `CANCELADA`. Each visit in the chain MUST store its own `veterinarianId` and SHALL store `atencionNotas`. When status transitions to `CANCELADA`, the metadata MUST include `cancelReason` (non-empty string). When status transitions to `ATENDIDA`, the metadata MUST include `clinicalNote.findings` (non-empty string). The system SHALL derive follow-up status as `ACTIVE` when estado is not in a terminal state and `CLOSED` when FINALIZADA or CANCELADA.

(Previously: clinicalNote.findings was optional, cancelReason not mentioned)

#### Scenario: Cancelar visita requiere reason

- GIVEN a field visit with status transitioning to CANCELADA
- WHEN the payload is validated without cancelReason or with empty cancelReason
- THEN the system MUST reject the operation with ANIMAL_HEALTH_EVENT_VET_CANCEL_REASON_REQUIRED

#### Scenario: Atender requiere findings

- GIVEN a field visit with status transitioning to ATENDIDA
- WHEN the payload lacks clinicalNote.findings or it is empty
- THEN the system MUST reject the operation

#### Scenario: Seguimiento activo con próximo control

- GIVEN a chain with Visit1 (estado=ATENDIDA, nextControlAt set) and Visit2 (estado=PROGRAMADA, parentVisitId=Visit1.id)
- WHEN the chain status is queried
- THEN the chain is ACTIVE
- AND nextControlAt reflects the scheduled follow-up date
- AND Visit2 links to Visit1 via parentVisitId

## ADDED Requirements

### Requirement: Cost and treatment plan in visit metadata

The system MUST accept `FIELD_VET_VISIT` events with an optional `cost` block containing `{ amount: number; currency: string }` and an optional `treatmentPlan` block containing an ordered array of `{ description: string; order: number }` steps. Cost acceptance is restricted to `FIELD_VET_VISIT` events only; other event types MUST reject cost payloads.

#### Scenario: FIELD_VET_VISIT con costo válido

- GIVEN a FIELD_VET_VISIT payload with cost: { amount: 150; currency: "BOB" }
- WHEN the event is validated
- THEN the cost block is accepted and persisted in metadata

#### Scenario: Non-vet event con costo rechazado

- GIVEN a VACCINATION payload with cost block
- WHEN the event is validated
- THEN the system MUST reject the event for out-of-scope attachment

#### Scenario: Treatment plan steps

- GIVEN a FIELD_VET_VISIT attend payload with treatmentPlan: [{ description: "Apply antibiotic"; order: 1 }, { description: "Recheck in 7 days"; order: 2 }]
- WHEN the event is validated
- THEN treatmentPlan is persisted as an ordered array in metadata
