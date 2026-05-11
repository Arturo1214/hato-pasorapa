# Delta for animal-health-event-ledger-v1

## MODIFIED Requirements

### Requirement: Metadata tipada para visita veterinaria de campo

The system MUST accept `FIELD_VET_VISIT` events with typed metadata blocks for `visit` (containing visitId, modo, veterinarianId, atencionNotas, estado, parentVisitId, nextControlAt), `checklist`, `clinicalNote` (reason, findings, plan — findings required when estado=ATENDIDA), `protocol`, `cost` (optional, { amount: number; currency: string }, FIELD_VET_VISIT only), `treatmentPlan` (optional, array of { description: string; order: number }), and `cancelReason` (required when estado=CANCELADA). Every block SHALL satisfy schema validation.

(Previously: cost not accepted; findings optional; cancelReason not defined)

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

## ADDED Requirements

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
