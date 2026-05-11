# Delta: animal-health-treatment-follow-up-v1

## MODIFIED Requirements

### Requirement: Continuidad de tratamiento sin updates destructivos

The system MUST model treatment lifecycle using appended events. Visit chain lifecycle (`PROGRAMADA` → `ATENDIDA` → child `PROGRAMADA` via `parentVisitId` | chain=`CLOSED`) is tracked per visit independently. A visit chain is `ACTIVE` when a child visit with matching `parentVisitId` and estado=`PROGRAMADA` exists. A chain is `CLOSED` when the parent visit is in `ATENDIDA` with chain=`CLOSED` or when all visits are `CANCELADA`. A visit with `parentVisitId` set MUST be considered part of the parent chain. Timeline queries MUST expose the complete chain: estados, cancel reasons, hallazgos, notas, treatment plans, and next visits with their attended/canceled descendants.

(Previously: chain status derived from visit estado; cancel reason on child visit not explicitly required)

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