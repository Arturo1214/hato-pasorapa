# field-vet-visit-workflow-v1 Specification

## Purpose

Definir el flujo funcional de visita veterinaria de campo sobre `ANIMAL_HEALTH_EVENT`, offline-first, con modo GLOBAL/ESPECIFICA, veterinario por visita, y seguimiento de cadena PROGRAMADA→ATENDIDA→REPROGRAMADA|FINALIZADA|CANCELADA.

## Requirements

### Requirement: Registro de visita offline-first e idempotente

The system MUST allow creating a field vet visit in GLOBAL or ESPECIFICA mode with `occurredAt`, `operationId`, and typed visit metadata; GLOBAL mode MAY have `animalUuid=NULL`; ESPECIFICA mode MUST reference an existing animal. The system SHALL sync without duplicates when connectivity returns.

#### Scenario: Registro offline global

- GIVEN a device without connectivity and user selects GLOBAL mode
- WHEN the veterinarian registers a visit with fecha, veterinarianId, modo=GLOBAL
- THEN the system saves the operation locally for sync
- AND upon reconnect synchronizes once per `operationId`

#### Scenario: Registro offline específica

- GIVEN a device without connectivity and user selects ESPECIFICA mode
- WHEN the veterinarian registers a visit with animalUuid, fecha, veterinarianId, modo=ESPECIFICA
- THEN the system validates the animal exists before saving
- AND syncs once per `operationId`

#### Scenario: Rechazo por timestamp inválido

- GIVEN a visit with `occurredAt` outside valid format or empty
- WHEN the create is validated
- THEN the system MUST reject the operation for invalid contract

### Requirement: Checklist y nota clínica tipadas

The system MUST require a typed checklist (boolean item value and optional per-item observation) and SHALL require typed clinical note fields (`reason`, `findings`, `plan`).

#### Scenario: Checklist y nota válidos

- GIVEN una visita con checklist completo y nota clínica tipada
- WHEN se confirma el registro
- THEN el sistema persiste ambos bloques en metadata validada

#### Scenario: Nota clínica incompleta

- GIVEN una visita sin `reason` o sin `plan`
- WHEN se valida el payload
- THEN el sistema MUST reject la operación por metadata insuficiente

### Requirement: Protocolo y seguimiento con veterinario por visita

The system MUST support visit lifecycle: `PROGRAMADA` → `ATENDIDA` → (child `PROGRAMADA` via `parentVisitId` | chain=`CLOSED`). Each visit MUST store its own `veterinarianId` and `atencionNotas`. When status transitions to `CANCELADA`, metadata MUST include `cancelReason` (non-empty string). When status transitions to `ATENDIDA`, metadata MUST include `clinicalNote.findings` (non-empty string). The system SHALL derive chain status as `ACTIVE` when a child `PROGRAMADA` with matching `parentVisitId` exists, and `CLOSED` when the user selected "Finalizar" in the attend flow.

#### Scenario: Seguimiento activo via child visit

- GIVEN Visit1 (estado=`ATENDIDA`) and Visit2 (parentVisitId=Visit1.id, estado=`PROGRAMADA`)
- WHEN the chain status is derived
- THEN chain is `ACTIVE`
- AND Visit2 is the scheduled follow-up

#### Scenario: Finalizar cierra cadena sin cambiar estado

- GIVEN Visit1 in estado=`ATENDIDA` with no child visits and user selected "Finalizar"
- THEN chain status becomes `CLOSED`
- AND estado remains `ATENDIDA`

#### Scenario: Atender requiere findings

- GIVEN a visit transitioning to `ATENDIDA`
- WHEN payload lacks `clinicalNote.findings` or it is empty
- THEN the system MUST reject

#### Scenario: Cancelar requiere reason

- GIVEN a visit transitioning to `CANCELADA`
- WHEN payload lacks `cancelReason` or it is empty
- THEN the system MUST reject with ANIMAL_HEALTH_EVENT_VET_CANCEL_REASON_REQUIRED

#### Scenario: Child visit carries parentVisitId

- GIVEN Visit1 in estado=`ATENDIDA`
- WHEN a follow-up visit is created
- THEN the new visit stores `parentVisitId=Visit1.id` and estado=`PROGRAMADA`

#### Scenario: Canceled child preserves parent ATENDIDA

- GIVEN Visit1 (estado=`ATENDIDA`) and Visit2 (parentVisitId=Visit1.id, estado=`CANCELADA`, cancelReason set)
- WHEN the chain is queried
- THEN Visit1 remains `ATENDIDA`
- AND Visit2 shows `CANCELADA` with cancelReason

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

### Requirement: Listados por animal y visita

The system MUST provide visit listings by `animalUuid` for ESPECIFICA visits, and MUST provide a global listing of ALL visits (both GLOBAL and ESPECIFICA) with filters by estado, modo, veterinarianId, and date range. The system SHOULD allow filtering by `visitId`.

#### Scenario: Listado global con filtros

- GIVEN many visits in mixed modes
- WHEN the admin queries with filters estado=PROGRAMADA, modo=GLOBAL
- THEN only matching visits are returned

#### Scenario: Listado por animal (específica)

- GIVEN many visits (global and specific)
- WHEN the user queries by animalUuid for an ESPECIFICA visit
- THEN only that animal's specific visits are returned
- AND global visits are NOT returned for that animalUuid query


