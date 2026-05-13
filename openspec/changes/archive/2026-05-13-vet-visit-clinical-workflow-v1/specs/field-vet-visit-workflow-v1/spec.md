# Delta: field-vet-visit-workflow-v1

## MODIFIED Requirements

### Requirement: Protocolo y seguimiento con veterinario por visita

The system MUST support visit lifecycle: `PROGRAMADA` → `ATENDIDA` → (child `PROGRAMADA` via `parentVisitId` | chain=`CLOSED`). Each visit MUST store its own `veterinarianId` and `atencionNotas`. When status transitions to `CANCELADA`, metadata MUST include `cancelReason` (non-empty string). When status transitions to `ATENDIDA`, metadata MUST include `clinicalNote.findings` (non-empty string). The system SHALL derive chain status as `ACTIVE` when a child `PROGRAMADA` with matching `parentVisitId` exists, and `CLOSED` when the user selected "Finalizar" in the attend flow.

(Previously: lifecycle included REPROGRAMADA and FINALIZADA as explicit states; now replaced by parent/child chain and chain=CLOSED semantics)

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