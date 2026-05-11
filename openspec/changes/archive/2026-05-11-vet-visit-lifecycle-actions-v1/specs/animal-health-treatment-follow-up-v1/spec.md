# Delta for animal-health-treatment-follow-up-v1

## MODIFIED Requirements

### Requirement: Continuidad de tratamiento sin updates destructivos

The system MUST model treatment lifecycle using appended events. Visit chain lifecycle (`PROGRAMADA` → `ATENDIDA` → `REPROGRAMADA` | `FINALIZADA` | `CANCELADA`) is tracked per visit independently. A visit chain is considered ACTIVE when any visit in the chain has estado not in a terminal state. A chain is CLOSED when all visits are FINALIZADA or CANCELADA, or when an explicit chain-close event is recorded. A visit with parentVisitId set MUST be considered part of the parent chain. Timeline queries MUST expose linked visit notes over time by following parentVisitId chains.

(Previously: parentVisitId linkage and timeline visibility not specified)

#### Scenario: Cadena activa con visita vinculada

- GIVEN Visit1 (estado=ATENDIDA) and Visit2 with parentVisitId=Visit1.id (estado=PROGRAMADA)
- WHEN the chain status is derived
- THEN the chain is ACTIVE
- AND Visit2 is displayed in the timeline as a follow-up linked to Visit1

#### Scenario: Cerrar cadena via attend flow

- GIVEN a visit in estado=ATENDIDA
- WHEN the user selects "Finalizar" from the attend flow
- THEN estado becomes FINALIZADA
- AND chain derived status becomes CLOSED

#### Scenario: Timeline muestra historial de visitas vinculadas

- GIVEN an animal with VisitA (específica, estado=ATENDIDA) and VisitB (parentVisitId=VisitA.id, estado=ATENDIDA)
- WHEN the animal health timeline is queried
- THEN both visits appear in chronological order
- AND each entry is linked via parentVisitId reference

## ADDED Requirements

### Requirement: parentVisitId chain projection in timeline

The system MUST project follow-up visits into the animal timeline by resolving parentVisitId chains, showing the full clinical narrative over time. Each linked visit entry SHOULD display its own veterinarian, findings, notes, cost, and treatment plan.

#### Scenario: Campaña global con visitas vinculadas en historia animal

- GIVEN a GLOBAL visit (modo=GLOBAL, estado=ATENDIDA) with no parentVisitId
- AND a subsequent GLOBAL visit with parentVisitId pointing to the first visit
- WHEN the animal timeline is projected
- THEN both visits appear as CAMPAIGN entries linked by parentVisitId
- AND each shows its own clinical notes, cost, and treatment plan
