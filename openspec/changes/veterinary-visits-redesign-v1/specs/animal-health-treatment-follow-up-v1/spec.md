# Delta for animal-health-treatment-follow-up-v1

## MODIFIED Requirements

### Requirement: Continuidad de tratamiento sin updates destructivos

(Previously: TREATMENT_STARTED → TREATMENT_FOLLOW_UP → TREATMENT_CLOSED as appended events)

The system MUST model treatment lifecycle using appended events. Visit chain lifecycle (`PROGRAMADA` → `ATENDIDA` → `REPROGRAMADA` | `FINALIZADA` | `CANCELADA`) is tracked per visit independently. A visit chain is considered ACTIVE when any visit in the chain has estado not in a terminal state. A chain is CLOSED when all visits are FINALIZADA or CANCELADA, or when an explicit chain-close event is recorded.

#### Scenario: Seguimiento con reprogramación

- GIVEN Visit1 (estado=ATENDIDA) and Visit2 created as a reprogrammed follow-up
- WHEN the chain is queried
- THEN the chain status is ACTIVE
- AND both visits are retained with their respective veterinarianIds

#### Scenario: Cerrar cadena explícitamente

- GIVEN a chain with multiple visits in ATENDIDA/REPROGRAMADA states
- WHEN the user marks the chain as FINALIZADA
- THEN the final visit's estado becomes FINALIZADA
- AND chain derived status becomes CLOSED

### Requirement: Metadata mínima tipada para tratamiento

(Previously: regimen/medication reference and status note per treatment event)

The system MUST require typed treatment metadata at least for regimen/medication reference and status note per treatment event type. For FIELD_VET_VISIT follow-ups, the metadata MUST also include `veterinarianId` and `atencionNotas`.

#### Scenario: Seguimiento de visita con notas

- GIVEN a `TREATMENT_FOLLOW_UP` linked to a FIELD_VET_VISIT
- WHEN the event is validated
- THEN the metadata includes veterinarianId and atencionNotas

### Requirement: Seguimiento básico alineado a protocolo de visita

(Previously: Derive follow-up state from protocol lifecycle)

The system MUST derive follow-up state from visit chain lifecycle (non-terminal states → ACTIVE; FINALIZADA/CANCELADA → CLOSED). The system SHALL expose `nextControlAt` as upcoming control when present on any ACTIVE visit in the chain.

#### Scenario: Estado activo con próximo control

- GIVEN a chain with Visit1 (estado=ATENDIDA, nextControlAt=2026-06-01) and Visit2 (estado=PROGRAMADA)
- WHEN the chain follow-up is queried
- THEN the derived status is ACTIVE
- AND nextControlAt reflects Visit2's scheduled date

### Requirement: Vista básica de seguimiento por animal

(Previously: Basic per-animal treatment timeline)

The system SHOULD expose a per-animal treatment timeline including visit events (FIELD_VET_VISIT) with their states and veterinarians, and campaign entries for GLOBAL visits linked to the animal. The system MAY include filtering by visit identifier.

#### Scenario: Timeline con visitas específicas y campañas globales

- GIVEN an animal with: VisitA (específica, vet=Dr.X, estado=ATENDIDA) and CampaignB (global, vet=Dr.Y, estado=ATENDIDA)
- WHEN the animal timeline is queried
- THEN both appear — VisitA as SPECIFIC and CampaignB as CAMPAIGN
- AND each shows its own veterinarian and notes