# animal-health-treatment-follow-up-v1 Specification

## Purpose

Definir seguimiento básico de tratamientos por eventos append-only de inicio, continuidad y cierre.

## Requirements

### Requirement: Continuidad de tratamiento sin updates destructivos

The system MUST model treatment lifecycle using appended events. Visit chain lifecycle (`PROGRAMADA` → `ATENDIDA` → child `PROGRAMADA` via `parentVisitId` | chain=`CLOSED`) is tracked per visit independently. A visit chain is `ACTIVE` when a child visit with matching `parentVisitId` and estado=`PROGRAMADA` exists. A chain is `CLOSED` when the parent visit is in `ATENDIDA` with chain=`CLOSED` or when all visits are `CANCELADA`. A visit with `parentVisitId` set MUST be considered part of the parent chain. Timeline queries MUST expose the complete chain: estados, cancel reasons, hallazgos, notas, treatment plans, and next visits with their attended/canceled descendants.

#### Scenario: Cadena activa via child visit

- GIVEN Visit1 (estado=`ATENDIDA`, chain=`ACTIVE`) and Visit2 (parentVisitId=Visit1.id, estado=`PROGRAMADA`)
- WHEN the chain status is derived
- THEN chain is `ACTIVE`

#### Scenario: Cerrar cadena via attend flow

- GIVEN Visit1 in estado=`ATENDIDA` and user selected "Finalizar"
- THEN chain status becomes `CLOSED`; estado remains `ATENDIDA`

#### Scenario: Child canceled preserves parent as ATENDIDA

- GIVEN Visit1 (estado=`ATENDIDA`, no child) and Visit2 (parentVisitId=Visit1.id, estado=`CANCELADA`, cancelReason set)
- WHEN the chain is projected
- THEN Visit1 remains `ATENDIDA`
- AND Visit2 shows as `CANCELADA` with cancelReason in the chain view

#### Scenario: Timeline muestra historial de visitas vinculadas con razones de cancelación

- GIVEN VisitA (específica, estado=`ATENDIDA`) and VisitB (parentVisitId=VisitA.id, estado=`CANCELADA`, cancelReason="Animal vendido")
- WHEN the animal health timeline is queried
- THEN both appear in chronological order
- AND VisitB shows estado=`CANCELADA` with cancelReason

### Requirement: Metadata mínima tipada para tratamiento

The system MUST require typed treatment metadata at least for regimen/medication reference and status note per treatment event type. For FIELD_VET_VISIT follow-ups, the metadata MUST also include `veterinarianId` and `atencionNotas`.

#### Scenario: Seguimiento de visita con notas

- GIVEN a `TREATMENT_FOLLOW_UP` linked to a FIELD_VET_VISIT
- WHEN the event is validated
- THEN the metadata includes veterinarianId and atencionNotas

### Requirement: Seguimiento básico alineado a protocolo de visita

The system MUST derive follow-up state from visit chain lifecycle (non-terminal states → ACTIVE; FINALIZADA/CANCELADA → CLOSED). The system SHALL expose `nextControlAt` as upcoming control when present on any ACTIVE visit in the chain.

#### Scenario: Estado activo con próximo control

- GIVEN a chain with Visit1 (estado=ATENDIDA, nextControlAt=2026-06-01) and Visit2 (estado=PROGRAMADA)
- WHEN the chain follow-up is queried
- THEN the derived status is ACTIVE
- AND nextControlAt reflects Visit2's scheduled date

### Requirement: Vista básica de seguimiento por animal

The system SHOULD expose a per-animal treatment timeline including visit events (FIELD_VET_VISIT) with their states and veterinarians, and campaign entries for GLOBAL visits linked to the animal. The system MAY include filtering by visit identifier.

#### Scenario: Timeline con visitas específicas y campañas globales

- GIVEN an animal with: VisitA (específica, vet=Dr.X, estado=ATENDIDA) and CampaignB (global, vet=Dr.Y, estado=ATENDIDA)
- WHEN the animal timeline is queried
- THEN both appear — VisitA as SPECIFIC and CampaignB as CAMPAIGN
- AND each shows its own veterinarian and notes

### Requirement: parentVisitId chain projection in timeline

The system MUST project follow-up visits into the animal timeline by resolving parentVisitId chains, showing the full clinical narrative over time. Each linked visit entry SHOULD display its own veterinarian, findings, notes, cost, and treatment plan.

#### Scenario: Campaña global con visitas vinculadas en historia animal

- GIVEN a GLOBAL visit (modo=GLOBAL, estado=ATENDIDA) with no parentVisitId
- AND a subsequent GLOBAL visit with parentVisitId pointing to the first visit
- WHEN the animal timeline is projected
- THEN both visits appear as CAMPAIGN entries linked by parentVisitId
- AND each shows its own clinical notes, cost, and treatment plan
