# Design: Vet Visit Clinical Workflow V1

## Technical Approach

Refactor the existing admin vet-visit feature around explicit workflow state, not patched row actions. The FE keeps Angular standalone components, signals for page state, Reactive Forms for dialogs, and RxJS for create/attend fan-out. The BE remains append-only over `FIELD_VET_VISIT` animal-health events, with `/api/vet-visits` projecting one latest row per `visitId` plus chain fields needed by the central `Ver` action.

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|---|---|---|---|
| Creation modes | Add dialog `creationMode: 'scheduled' | 'attendedNow'`; scheduled maps to `PENDING`, attended-now maps to attend fields and `ATTENDED`/`FINALIZED` depending follow-up choice. | Keep status selector Programada/Atendida. | Mode communicates intent and prevents clinical fields leaking into scheduled creation. |
| Attend reuse | Existing scheduled attendance and immediate attended creation share one clinical form fragment/model. | Duplicate dialogs. | Same validation for findings, notes, treatment, and follow-up decision; fewer divergent bugs. |
| Finalization | `followUpChoice` exists only for attend flows: `schedule` creates child `PENDING`; `finalize` closes current visit. | Row-level Finalizar action. | Proposal explicitly removes direct Finalizar and makes closure a clinical decision. |
| Chain read model | List rows expose `parentVisitId`; detail/history groups rows by root visit and renders parent + children read-only. | Build history only from current page. | Central `Ver` must be stable under pagination/filtering and preserve canceled child context. |
| Canceled child | Cancel writes only child visit as `CANCELED` with reason; parent remains `ATTENDED`. | Mutate parent back to canceled/finalized. | Append-only ledger must preserve original clinical attendance. |
| Date handling | Scheduled uses selected visit date at local-day midnight UTC; attended-now defaults `occurredAt` to `new Date().toISOString()` via injectable/testable clock. | Current datepicker-only local date. | Immediate attendance needs current moment, not just current date. |

## Data Flow

```text
Nueva Visita ── scheduled ──> form scheduling only ──> create FIELD_VET_VISIT(PENDING)
             └─ attendedNow ─> clinical form ────────> create FIELD_VET_VISIT(ATTENDED/FINALIZED)

Atender row ──> clinical form ──> create parent ATTENDED
                         └──────> if schedule: create child PENDING(parentVisitId=parent.visitId)

Ver row ──> /api/vet-visits?chainRoot/visitId ──> read-only chain detail
```

## File Changes

| File | Action | Description |
|---|---|---|
| `hato-fe/src/app/features/admin/vet-visits/vet-visit-form-dialog.component.ts` | Modify | Replace status selector with explicit creation mode; extract/drive clinical controls; hide treatment plan until `Tiene tratamiento`; default attended-now to current ISO moment. |
| `hato-fe/src/app/features/admin/vet-visits/vet-visits-page.component.ts` | Modify | Add always-visible `Ver`; remove row `Reprogramar`; enforce terminal guards; create child follow-up only from attend flow. |
| `hato-fe/src/app/features/admin/vet-visits/vet-visit-detail-dialog.component.ts` | Create | Read-only chain/history display: state, clinical fields, treatment, cancellation facts, next visit, linked parent/children. |
| `hato-fe/src/app/features/admin/vet-visits/data-access/vet-visits.service.ts` | Modify | Add `parentVisitId`, `cancelReason`, clinical findings, chain/root fields and optional detail query. |
| `hato-fe/src/app/features/admin/vet-visits/data-access/vet-visit-form.mapper.ts` | Modify | Map attended-now/current attend payloads consistently; no follow-up fields for scheduled creation. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/dto/vetvisit/VetVisitItemDto.java` | Modify | Expose `parentVisitId`, `cancelReason`, findings/clinical reason, and chain key/root if needed. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/AnimalHealthEventService.java` | Modify | Projection/grouping deduplicates latest lifecycle event per `visitId`, keeps parent/child rows distinct, and can return chain detail. |
| `hato-be/src/main/java/bo/pasorapa/hato/repository/AnimalHealthEventRepository.java` | Modify | Add reusable filtering by `visit.parentVisitId`/root when service needs chain expansion. |

## Interfaces / Contracts

FE form state:
```ts
type VetVisitCreationMode = 'scheduled' | 'attendedNow';
type VetVisitAttendOutcome = 'schedule' | 'finalize';
```

BE list/detail item MUST include top-level `parentVisitId: string | null`. Chain detail SHOULD return latest item per `visitId` ordered parent then children by `occurredAt`, with `CANCELED` child retaining `cancelReason` and parent retaining `ATTENDED` data.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| FE unit | Mode-specific visibility, `Tiene tratamiento`, attended-now clock, follow-up-only attend, terminal actions, `Ver` dialog chain rendering. | Vitest/Angular specs for dialog, page, mapper/service. |
| BE unit/integration | `parentVisitId` projection, latest-event dedup, chain grouping, canceled child preserving attended parent. | Quarkus JUnit service tests plus REST-assured `/api/vet-visits`. |
| E2E | Not configured. | No new E2E unless project adds runner. |

## Migration / Rollout

No schema migration required: data remains in metadata JSON. Compatibility: accept legacy Spanish/English statuses and missing `parentVisitId`; old rows render as single-root chains. Roll out via focused TDD only; do not run production build.

## Open Questions

None.
