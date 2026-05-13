# Delta: admin-veterinary-visits-v1

## MODIFIED Requirements

### Requirement: Visit lifecycle state machine

The system MUST support visit lifecycle states: `PROGRAMADA`, `ATENDIDA`, `CANCELADA`; transitions MUST be explicit. A visit in `ATENDIDA` has a derived chain status: `ACTIVE` when a child `PROGRAMADA` visit exists with `parentVisitId` referencing this visit, or `CLOSED` when the user selected "Finalizar" in the attend flow. Terminal states (`CANCELADA`, `ATENDIDA` with chain=`CLOSED`) MUST block all further transitions. Finalization SHALL ONLY be reachable through the attend flow — it MUST NOT appear as a direct row action.

(Previously: states included FINALIZADA and REPROGRAMADA with explicit transitions)

#### Scenario: Programar nueva visita (Programada mode)

- GIVEN a new visit dialog is submitted in "Programada" mode
- WHEN the form is valid with `Fecha de visita` filled
- THEN the visit is created with estado=`PROGRAMADA`
- AND only scheduling fields are visible; clinical fields and finalization controls are hidden

#### Scenario: Crear atendidos inmediata con fecha actual

- GIVEN a new visit dialog is submitted in "Atendida inmediata" mode
- WHEN the form is valid
- THEN the visit is created with estado=`PROGRAMADA` and `fecha` set to the current moment
- AND clinical fields are visible

#### Scenario: Atender visita con hallazgos

- GIVEN a visit in estado=`PROGRAMADA`
- WHEN the user marks it as `ATENDIDA` with hallazgos (required), notas, costo (optional BOB), and Plan de tratamiento (behind "Tiene tratamiento" toggle)
- THEN estado changes to `ATENDIDA` and clinical fields are persisted
- AND the user MUST choose "Finalizar" (chain=CLOSED) or "Programar próxima visita"

#### Scenario: Atender sin hallazgos blocked

- GIVEN a visit in estado=`PROGRAMADA`
- WHEN the user attempts to mark as `ATENDIDA` without hallazgos
- THEN the system MUST reject with validation error

#### Scenario: Finalizar closes chain without state change

- GIVEN a visit in estado=`ATENDIDA` and user selected "Finalizar"
- THEN chain status becomes `CLOSED`; estado remains `ATENDIDA`
- AND no row-level "Finalizar" action exists

#### Scenario: Programar próxima visita creates child

- GIVEN a visit in estado=`ATENDIDA` and user selected "Programar próxima visita"
- WHEN scheduling form is submitted
- THEN a new visit is created with estado=`PROGRAMADA` and `parentVisitId` referencing the parent
- AND the parent remains `ATENDIDA` with clinical data intact

#### Scenario: Child canceled preserves parent as ATENDIDA

- GIVEN Visit1 (estado=`ATENDIDA`) and Visit2 (parentVisitId=Visit1.id, estado=`PROGRAMADA`)
- WHEN Visit2 is canceled with reason
- THEN Visit1 remains `ATENDIDA`
- AND Visit2 becomes `CANCELADA` with cancelReason persisted

#### Scenario: Cancel blocked for terminal states

- GIVEN a visit in estado=`CANCELADA` or chain=`CLOSED`
- WHEN any cancel action is attempted
- THEN the system MUST block it

#### Scenario: Ver action on all rows including terminal

- GIVEN any visit row regardless of estado
- WHEN the row is rendered
- THEN a `Ver` action is shown
- AND no direct `Finalizar` row action exists

### Requirement: Attend flow with clinical capture and mandatory choice

The system MUST expose an attend flow that captures: hallazgos/descripción (required), notas de atención, costo (optional BOB), and Plan de tratamiento behind a "Tiene tratamiento" toggle. Upon submission the user MUST choose between "Finalizar" (closes chain) or "Programar próxima visita". The choice is mandatory.

(Previously: finalize or schedule was presented but chain closure semantics were unclear)

#### Scenario: Attend choice is mandatory

- GIVEN a user completes clinical capture
- WHEN submitting without selecting "Finalizar" or "Programar próxima visita"
- THEN the system MUST reject submission

#### Scenario: Attend flow preloads child visit with parent data

- GIVEN a child visit (parentVisitId set) in estado=`PROGRAMADA`
- WHEN the user opens the attend flow
- THEN parent fecha, animal, and veterinarian data are preloaded