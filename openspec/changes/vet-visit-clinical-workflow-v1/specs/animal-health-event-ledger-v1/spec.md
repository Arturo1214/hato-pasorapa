# Delta: animal-health-event-ledger-v1

## MODIFIED Requirements

### Requirement: Metadata tipada para visita veterinaria de campo

The system MUST accept `FIELD_VET_VISIT` events with typed metadata blocks for: `visit` (visitId, modo, veterinarianId, atencionNotas, estado, parentVisitId, nextControlAt), `checklist`, `clinicalNote` (reason, findings — findings required when estado=`ATENDIDA`), `protocol`, `cost` (optional, FIELD_VET_VISIT only), `treatmentPlan` (optional), and `cancelReason` (required when estado=`CANCELADA`). The `visit.estado` field MUST accept `PROGRAMADA`, `ATENDIDA`, and `CANCELADA` only; `FINALIZADA` and `REPROGRAMADA` are not valid estado values for ledger events.

(Previously: metadata accepted FINALIZADA and REPROGRAMADA as estado values)

#### Scenario: FIELD_VET_VISIT with ATENDIDA and parentVisitId

- GIVEN a payload `FIELD_VET_VISIT` with estado=`ATENDIDA` and parentVisitId set
- WHEN the event is validated
- THEN it is accepted and persisted

#### Scenario: Cancel without cancelReason rejected

- GIVEN a `FIELD_VET_VISIT` with estado=`CANCELADA` and no cancelReason
- WHEN the event is validated
- THEN the system MUST reject with ANIMAL_HEALTH_EVENT_VET_CANCEL_REASON_REQUIRED

#### Scenario: FINALIZADA estado rejected

- GIVEN a `FIELD_VET_VISIT` with estado=`FINALIZADA`
- WHEN the event is validated
- THEN the system MUST reject — finalization is a chain closure flag, not a visit estado