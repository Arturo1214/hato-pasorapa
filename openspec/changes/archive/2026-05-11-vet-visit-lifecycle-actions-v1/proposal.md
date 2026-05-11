# Proposal: Vet Visit Lifecycle Actions V1

## Intent

Make vet visit actions match the real clinical lifecycle: cancellation requires a reason, attendance captures clinical outcome/cost/treatment plan, and follow-up or closure is chosen from the attendance flow instead of a direct list finalization.

## Scope

### In Scope
- Remove direct `Finalizar` action from the vet visits list.
- Add `Cancelar` modal with required cancellation reason.
- Add `Atender` flow with descripción/hallazgos, notas de atención, costo, and `Plan de tratamiento` as ordered steps.
- Let attendance either schedule a linked follow-up (`parentVisitId`) or finalize the treatment chain.
- Update backend DTOs, validation, projection, and metadata storage for cost and structured treatment plan.
- Ensure animal/global campaign histories can show linked visit notes over time.

### Out of Scope
- Billing/ledger accounting beyond visit cost display.
- Calendar reminder redesign beyond existing next-control projection.

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- `admin-veterinary-visits-v1`: list actions, Spanish modals, attend/cancel/follow-up UX.
- `field-vet-visit-workflow-v1`: lifecycle contract, cancel reason, structured clinical note/plan, follow-up creation.
- `animal-health-event-ledger-v1`: FIELD_VET_VISIT metadata accepts validated cost and treatment plan steps.
- `animal-health-treatment-follow-up-v1`: chain close/follow-up behavior and linked timeline visibility.

## Approach

Refine the Angular Material visit actions into dedicated modal flows. Keep `plan`, renamed `Plan de tratamiento`, as a structured list of treatment steps distinct from findings/notes. Persist cost under typed visit metadata, relax cost rejection only for FIELD_VET_VISIT, validate cancel reason and attended clinical fields, and project new fields through list/history DTOs.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `hato-fe/src/app/features/admin/vet-visits/` | Modified | Actions, dialogs/forms, mapper/service/types/specs |
| `hato-fe/src/app/core/offline/offline-types.ts` | Modified | Cost, cancel reason, plan step typing |
| `hato-be/src/main/java/bo/pasorapa/hato/service/mapper/AnimalHealthEventMapper.java` | Modified | Metadata validation and storage rules |
| `hato-be/src/main/java/bo/pasorapa/hato/service/dto/vetvisit/` | Modified | DTO projection for cost/plan/history |
| `hato-be/src/main/java/bo/pasorapa/hato/service/AnimalHealthEventService.java` | Modified | Visit list/history projection and chain handling |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Cost conflicts with ledger exclusions | Medium | Allow only namespaced FIELD_VET_VISIT cost; keep other billing payloads rejected |
| Structured plan exceeds JSON/text assumptions | Medium | Validate type/size and adjust storage if metadata column is constrained |
| Follow-up creation duplicates visits | Medium | Preserve operationId/idempotency and require parentVisitId linkage |

## Rollback Plan

Revert FE action/dialog changes and BE DTO/mapper/service changes together; existing visit metadata remains readable because added fields are optional for older records.

## Dependencies

- Existing `parentVisitId`, `nextControlAt/nextDueAt`, and lifecycle states.
- User decision: keep `plan` as `Plan de tratamiento` with treatment steps.

## Success Criteria

- [ ] `Finalizar` no longer appears as a direct row action.
- [ ] Cancel requires and persists a reason.
- [ ] Attend persists findings, notes, cost, and treatment plan steps.
- [ ] Attend can create a linked follow-up or close the chain.
- [ ] Animal/global history shows linked visit notes over time.
