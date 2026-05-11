# Delta for field-vet-visit-workflow-v1

## MODIFIED Requirements

### Requirement: Registro de visita offline-first e idempotente

(Previously: Offline-first visit with `animalUuid` + `operationId`)

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

### Requirement: Protocolo y seguimiento con veterinario por visita

(Previously: Protocol status `STARTED`, `FOLLOW_UP`, or `CLOSED` with basic nextDueAt)

The system MUST support extended lifecycle: `PROGRAMADA` → `ATENDIDA` → `REPROGRAMADA` | `FINALIZADA` | `CANCELADA`. Each visit in the chain MUST store its own `veterinarianId` and MAY store `atencionNotas`. The system SHALL derive follow-up status as `ACTIVE` when estado is not in a terminal state and `CLOSED` when FINALIZADA or CANCELADA.

#### Scenario: Seguimiento con veterinario diferente

- GIVEN a visit chain: Visit1 (vet=Dr.A, estado=ATENDIDA) → Visit2 (vet=Dr.B, estado=PROGRAMADA)
- WHEN the chain status is queried
- THEN each visit retains its own veterinarianId independently
- AND the chain status is ACTIVE because Visit2 is PROGRAMADA

#### Scenario: Cerrar cadena de seguimiento

- GIVEN a visit in estado ATENDIDA
- WHEN the user marks the chain as FINALIZADA
- THEN the visit estado becomes FINALIZADA
- AND derived chain status becomes CLOSED

### Requirement: Listados por animal y visita

(Previously: Visit listings by animalUuid and visitId filter)

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

## REMOVED Requirements

### Requirement: Exclusiones explícitas V1

The system MUST NOT include billing/costing, advanced analytics, complex prescription rules, or multimedia attachments in this workflow.

(Reason: V2 explicitly addresses multimedia and analytics scope expansion; these were too broad to remove entirely from the system, just no longer excluded from the workflow spec)