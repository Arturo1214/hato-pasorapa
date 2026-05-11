# Proposal: Vet Visit Clinical Workflow V1

## Intent

Replace the incrementally patched vet-visit UX with one canonical clinical workflow: schedule-only creation for future visits, immediate attendance for visits being handled now, explicit attend/cancel rules, and read-only clinical history for every visit chain.

## Scope

### In Scope
- Split creation modes: `Programada` shows only scheduling fields (`Fecha de visita`); `Atendida inmediata` defaults date to now and opens clinical attendance fields.
- Canonical attend flow for scheduled/existing visits: hallazgos/descripción, notas, optional treatment plan behind `Tiene tratamiento`, and mandatory choice between finalizing or scheduling next visit.
- Follow-up scheduling creates a child `PROGRAMADA` visit with `parentVisitId`; parent remains `ATENDIDA` with its clinical data.
- Cancel flow for non-terminal visits only, with required cancellation reason; terminal visits cannot be attended/canceled again.
- Add central `Ver` action opening read-only history/detail with state, clinical data, treatment plan, cancellation facts, next visit, and linked chain.
- Preserve Spanish UI labels, online-only admin operations, no direct row `Finalizar`, and strict TDD.

### Out of Scope
- Offline sync implementation changes for admin vet visits.
- New billing/cost semantics beyond existing visit metadata.
- Replacing the animal health ledger model.

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- `admin-veterinary-visits-v1`: canonical creation/attendance/cancel/detail UX and row-action rules.
- `field-vet-visit-workflow-v1`: clarify parent/child follow-up lifecycle and terminal transition constraints.
- `animal-health-treatment-follow-up-v1`: ensure chain projection distinguishes attended parent, scheduled/attended/canceled child, and cancellation reason.
- `animal-health-event-ledger-v1`: expose any missing top-level `parentVisitId`/chain data required by detail/history projections.

## Approach

Drive from tests first. Refactor the FE vet visit feature around explicit modes and terminal-state guards, reuse the attend form for immediate/existing attendance, and add a read-only detail projection. Update BE DTO/service only if current responses do not expose chain data needed by FE.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `hato-fe/src/app/features/admin/vet-visits/**` | Modified | Forms, list actions, attend/cancel flows, read-only detail/history. |
| `hato-fe/src/app/features/**/animal*/**` | Modified | Animal Salud timeline only if chain/detail data is missing there. |
| `hato-be/**/vet*`, `hato-be/**/animal-health*` | Modified | DTO/service projections for `parentVisitId`, child status, cancel reason if needed. |
| `openspec/changes/vet-visit-clinical-workflow-v1/specs/**` | New | Delta specs for modified capabilities. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| State semantics conflict with existing `FINALIZADA/REPROGRAMADA` wording | Med | Specs must define canonical transitions before implementation. |
| Chain projection missing in API | Med | Add minimal DTO/service projection with endpoint tests. |
| UX regression in patched dialogs | Med | Strict TDD over mode-specific form visibility and actions. |

## Rollback Plan

Revert FE vet-visit changes and any minimal BE projection changes together; keep existing specs unchanged until archive. No data migration is planned.

## Dependencies

- Existing specs: `admin-veterinary-visits-v1`, `field-vet-visit-workflow-v1`, `animal-health-treatment-follow-up-v1`, `animal-health-event-ledger-v1`.

## Success Criteria

- [ ] Programada creation never shows clinical/finalization fields.
- [ ] Immediate/existing attendance share clinical options and require finalization or next visit.
- [ ] Follow-up cancellation preserves parent as `ATENDIDA` and shows child as `CANCELADA` with reason.
- [ ] Every visit row has `Ver`; terminal rows cannot be attended/canceled.
