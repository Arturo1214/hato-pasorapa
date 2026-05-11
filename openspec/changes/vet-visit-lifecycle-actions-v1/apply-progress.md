# Apply Progress: vet-visit-lifecycle-actions-v1

**Mode**: Strict TDD
**Artifact store**: hybrid (OpenSpec + Engram)
**Delivery strategy**: auto-chain
**Chain strategy**: feature-branch-chain
**Current PR slice**: PR 4 — FE page row-action wiring and follow-up chain creation

## Completed Tasks

- [x] 1.1.1 Add RED coverage for FIELD_VET_VISIT cost acceptance and non-vet cost rejection.
- [x] 1.1.2 Add RED coverage for canceled FIELD_VET_VISIT without cancel reason.
- [x] 1.1.3 Add RED coverage for attended FIELD_VET_VISIT without findings.
- [x] 1.1.4 Allow `metadata.cost` only for FIELD_VET_VISIT while preserving generic rejection for non-vet cost/billing payloads.
- [x] 1.1.5 Require cancel reason length 5..500 for `CANCELADA`/`CANCELED` visits.
- [x] 1.1.6 Require `clinicalNote.findings` for `ATENDIDA`/`ATTENDED` and `FINALIZADA`/`FINALIZED` visits.
- [x] 1.1.7 Validate structured treatment plans and legacy string plans.
- [x] 1.1.8 Reused mapper text/date/map/list helper patterns for validation.
- [x] 1.2.1 Add nullable `BigDecimal costo` to `VetVisitItemDto`.
- [x] 1.2.2 Add nullable `String costCurrency` to `VetVisitItemDto`.
- [x] 1.2.3 Add nullable `List<String> treatmentPlan` to `VetVisitItemDto`.
- [x] 1.3.1 Add RED service coverage for `costo`/`costCurrency` projection and legacy null cost.
- [x] 1.3.2 Add RED service coverage for array/string treatment plan projection.
- [x] 1.3.3 Project cost from `metadata.cost` in vet visit list DTOs.
- [x] 1.3.4 Project treatment plan from `metadata.clinicalNote.plan`, with legacy string support and top-level structured fallback.
- [x] 1.4.1 Add public `readCost(Map<String, Object>)` mapper helper.
- [x] 1.4.2 Add public `readTreatmentPlan(Map<String, Object>)` mapper helper.
- [x] 1.4.3 Add public `readCancelReason(Map<String, Object>)` mapper helper.
- [x] 2.1.1 Add `cost?: { amount: number; currency: 'BOB' }` to FE offline metadata.
- [x] 2.1.2 Add `treatmentPlan?: string[]` to FE offline metadata.
- [x] 2.1.3 Allow legacy/new `clinicalNote.plan?: string | string[]`.
- [x] 2.1.4 Add `visit.cancelReason?: string` to FE offline visit metadata.
- [x] 2.2.1 Extend `VetVisitItem` with `costo`, `costCurrency`, `treatmentPlan`.
- [x] 2.2.2 Extend form mapper input/payload contract to accept `cost`, `treatmentPlan`, and `cancelReason` for event creation payloads.
- [x] 2.2.3 Parse backend `costo`, `costCurrency`, and `treatmentPlan` list DTO fields with null defaults for legacy records.
- [x] 2.3.1 Add RED mapper coverage for cancel action and missing cancel reason.
- [x] 2.3.2 Add RED mapper coverage for attend action with findings, notes, cost, and treatment plan.
- [x] 2.3.3 Map cancel action to `visit.status='CANCELED'` plus `visit.cancelReason`.
- [x] 2.3.4 Map attend action to `visit.status='ATTENDED'`, clinical fields, cost, plan, and protocol status from follow-up choice.
- [x] 2.3.5 Normalize legacy plan string into a single-step array.
- [x] 2.3.6 Export `normalizePlan()` helper for backward-compatible plan normalization.
- [x] 3.1.1 Create standalone `VetVisitCancelDialogComponent`.
- [x] 3.1.2 Add Spanish cancel dialog template with reason textarea and dialog actions.
- [x] 3.1.3 Require cancellation reason length >= 5 and disable confirm until valid.
- [x] 3.1.4 Return `{ cancelReason }` on confirm and `null` on cancel.
- [x] 3.1.5 Add Spanish labels and min-length validation message.
- [x] 3.2.1 Add `action: 'create' | 'attend' | 'reschedule' | 'followUp'` dialog input.
- [x] 3.2.2 Add RED attend-mode dialog specs for clinical fields, cost, treatment plan, validation, and follow-up/finalize choice.
- [x] 3.2.3 Render attend-mode findings, attention notes, cost with BOB suffix, and treatment plan section.
- [x] 3.2.4 Implement dynamic treatment plan step list with add/remove controls and CDK drag handle support.
- [x] 3.2.5 Add radio choice for `Programar próximo control` vs `Finalizar tratamiento` with datepicker for follow-up.
- [x] 3.2.6 Validate findings, non-negative cost, max 20 treatment steps, and step length.
- [x] 3.2.7 Return attend dialog result with `nextDueAt` for follow-up or `null` for finalize, ready for PR4 mapper/page wiring.
- [x] 3.3.3 Keep cancel as composed standalone dialog; form dialog remains scoped to create/attend/reschedule/follow-up actions.
- [x] 5.2.1 Add cancel dialog component tests for rendering, validation, confirm result, and cancel result.
- [x] 5.2.2 Add attend form dialog component tests for clinical fields, validation, treatment plan dynamics, and follow-up/finalize choice.
- [x] 4.1.1 Add RED page coverage for `Programada` row actions: `Atender` + `Cancelar`, without direct `Finalizar`.
- [x] 4.1.2 Wire `cancel` row action to `VetVisitCancelDialogComponent` and create a canceled FIELD_VET_VISIT event with `visit.cancelReason` and closed protocol.
- [x] 4.1.3 Wire `attend` row action to `VetVisitFormDialogComponent(action='attend')` and map clinical metadata through `AnimalsHealthEventsService.createEvent()`.
- [x] 4.1.4 Create a second linked follow-up event after attend+schedule, using `parentVisitId = current visitId` and pending next-control metadata.
- [x] 4.1.5 Create a finalized clinical event after attend+finalize with `visit.status = FINALIZED` and `protocol.status = CLOSED`.
- [x] 4.1.7 Enforce row-action lifecycle visibility for PR4 scope: attend only for PENDING/RESCHEDULED, cancel for non-terminal visits, and no direct finalize action on the central list.
- [x] 5.2.3 Add page component tests for row action visibility, cancel payload, attend follow-up chain, and attend finalize chain.

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1 Mapper validation | `AnimalHealthEventMapperTest.java` | Unit | ✅ 28/28 focused baseline passed before production changes | ✅ RED run failed at test compile for missing `readCost/readTreatmentPlan/readCancelReason` and DTO accessors | ✅ Focused tests passed: 36/36 | ✅ Cost accept/reject, cancel reason, findings, treatment plan valid/invalid, legacy plan | ✅ Extracted helper methods for cost, plan, reason, length and finite-number validation |
| 1.2 DTO extension | `AnimalHealthEventServiceTest.java`, `VetVisitResourceTest.java` | Unit + REST integration | ✅ 28/28 baseline | ✅ RED referenced missing DTO accessors `costo()`, `costCurrency()`, `treatmentPlan()` | ✅ Focused tests passed: 36/36 | ✅ Null legacy cost and non-null cost/currency response cases | ➖ Record field extension only |
| 1.3 Service projection | `AnimalHealthEventServiceTest.java`, `VetVisitResourceTest.java` | Unit + REST integration | ✅ 28/28 baseline | ✅ RED compile/runtime expectations failed before projection existed | ✅ Focused tests passed: 36/36 | ✅ Cost amount/currency, null legacy cost, array plan, legacy string plan, REST response projection | ✅ Reused mapper helpers from service projection |
| 1.4 Mapper helper API | `AnimalHealthEventMapperTest.java` | Unit | ✅ 28/28 baseline | ✅ RED compile failed for missing public helper methods | ✅ Focused tests passed: 36/36 | ✅ Present/absent cost, visit/top-level cancel reason, structured/legacy treatment plan | ✅ Helper methods centralize normalization for service reuse |
| 2.1 Offline metadata types | `vet-visit-form.mapper.spec.ts` | Type compile + unit | ✅ 7/7 focused FE baseline passed with Node 20.19.6 | ✅ RED compile failed for missing `cancelReason`, `cost`, `treatmentPlan`, and `plan: string[]` typed fields | ✅ Focused mapper/service specs passed: 14/14 | ✅ Cost, cancel reason, string-array plan, and legacy string plan compile/exercise typed metadata | ➖ Structural type extension; no runtime refactor needed |
| 2.2 VetVisitsService DTO parsing | `vet-visits.service.spec.ts` | Unit | ✅ 7/7 focused FE baseline passed with Node 20.19.6 | ✅ RED compile/runtime failed before `VetVisitItem` exposed new fields and list mapping normalized them | ✅ Focused mapper/service specs passed: 14/14 | ✅ Backend DTO with cost/plan and legacy DTO without fields | ✅ Added dedicated normalization helpers for status, veterinarian, strings, and treatment plan |
| 2.3 VetVisitFormMapper payload contract | `vet-visit-form.mapper.spec.ts` | Unit | ✅ 7/7 focused FE baseline passed with Node 20.19.6 | ✅ RED compile failed for missing `action`, `normalizePlan`, `cost`, `treatmentPlan`, `cancelReason`; cancel validation missing | ✅ Focused mapper/service specs passed: 14/14 | ✅ Cancel happy/error, attend follow-up, attend finalize, legacy string plan normalization | ✅ Extracted `normalizePlan`, visit status, and protocol status helpers |
| 3.1 Cancel dialog | `vet-visit-cancel-dialog.component.spec.ts` | FE component unit | N/A (new component); existing form dialog safety net ✅ 7/7 passed with Node 20.19.6 | ✅ RED compile failed for missing `VetVisitCancelDialogComponent` | ✅ Focused dialog specs passed: 13/13 | ✅ Disabled invalid reason and confirm/cancel return paths | ✅ Kept standalone small destructive dialog with typed result |
| 3.2 Attend dialog form | `vet-visit-form-dialog.component.spec.ts` | FE component unit | ✅ 7/7 focused form dialog baseline passed with Node 20.19.6 | ✅ RED compile failed for missing `action`, `findings`, `cost`, `treatmentPlanControls`, dynamic step helpers, and follow-up choice | ✅ Focused dialog specs passed: 13/13; dialog+mapper specs passed: 23/23 | ✅ Render fields, validation, dynamic add/remove, follow-up submit, finalize submit | ✅ Conditional attend mode preserved create form behavior |
| 3.3 Cancel composition decision | `vet-visit-cancel-dialog.component.spec.ts`, `vet-visit-form-dialog.component.spec.ts` | FE component unit | ✅ 7/7 focused form dialog baseline | ✅ RED covered standalone cancel dialog instead of form `action='cancel'` | ✅ Focused dialog+mapper specs passed: 23/23 | ✅ Standalone cancel dialog + form dialog create/attend modes | ➖ Architectural boundary decision; page composition remains PR4 |
| 4.1 Page row-action wiring | `vet-visits-page.component.spec.ts` | FE component unit | ✅ 6/6 focused page baseline passed with Node 20.19.6 | ✅ RED failed for direct `Finalizar`, missing cancel dialog wiring, missing attend action mode, and missing follow-up/finalize event creation | ✅ Focused page specs passed: 9/9; focused FE vet visit specs passed: 36/36 | ✅ Row visibility, cancel payload, attend+follow-up chain, attend+finalize chain, cancel on non-terminal visits | ✅ Extracted row-action helpers and reused mapper/event service path |

## Test Summary

- **Safety net**: `PATH="$HOME/.nvm/versions/node/v20.19.6/bin:$PATH" npm test -- --include src/app/features/admin/vet-visits/data-access/vet-visit-form.mapper.spec.ts --include src/app/features/admin/vet-visits/data-access/vet-visits.service.spec.ts` → 7 tests passing before PR2 production changes.
- **RED**: Same focused command after writing PR2 tests first → expected TypeScript compile failures for missing mapper API/types/service fields.
- **GREEN/REFACTOR**: Same focused command after implementation → 14 tests passing, 0 failures.
- **Additional compile safety**: `PATH="$HOME/.nvm/versions/node/v20.19.6/bin:$PATH" npm test -- --include src/app/features/admin/vet-visits/vet-visits-page.component.spec.ts` → 6 tests passing after updating `VetVisitItem` fixture defaults.
- **Total PR2 tests written/updated**: 7 focused data-access scenarios added; page spec fixtures adjusted for extended DTO shape.
- **Layers used**: FE unit tests (mapper/service) plus page spec compile coverage.
- **Production build**: Not run, per instruction.
- **PR3 Safety net**: `PATH="$HOME/.nvm/versions/node/v20.19.6/bin:$PATH" npm test -- --include src/app/features/admin/vet-visits/vet-visit-form-dialog.component.spec.ts` → 7 tests passing before PR3 production changes.
- **PR3 RED**: `PATH="$HOME/.nvm/versions/node/v20.19.6/bin:$PATH" npm test -- --include src/app/features/admin/vet-visits/vet-visit-cancel-dialog.component.spec.ts --include src/app/features/admin/vet-visits/vet-visit-form-dialog.component.spec.ts` → expected compile failures for missing cancel component/action/attend controls/helpers.
- **PR3 GREEN/REFACTOR**: Same focused dialog command → 13 tests passing, 0 failures.
- **PR3 dialog + mapper verification**: `PATH="$HOME/.nvm/versions/node/v20.19.6/bin:$PATH" npm test -- --include src/app/features/admin/vet-visits/vet-visit-cancel-dialog.component.spec.ts --include src/app/features/admin/vet-visits/vet-visit-form-dialog.component.spec.ts --include src/app/features/admin/vet-visits/data-access/vet-visit-form.mapper.spec.ts` → 23 tests passing, 0 failures.
- **Total PR3 tests written/updated**: 6 component scenarios added (2 cancel dialog, 4 attend dialog) plus existing dialog regression coverage preserved.
- **PR4 Safety net**: `PATH="$HOME/.nvm/versions/node/v20.19.6/bin:$PATH" npm test -- --include src/app/features/admin/vet-visits/vet-visits-page.component.spec.ts` → 6 tests passing before PR4 production changes.
- **PR4 RED**: Same focused page command after writing PR4 tests first → expected failures for direct `Finalizar`, missing `VetVisitCancelDialogComponent` wiring, missing `action='attend'`, and missing lifecycle event creation.
- **PR4 GREEN/REFACTOR**: Same focused page command → 9 tests passing, 0 failures.
- **PR4 focused FE verification**: `PATH="$HOME/.nvm/versions/node/v20.19.6/bin:$PATH" npm test -- --include src/app/features/admin/vet-visits/vet-visits-page.component.spec.ts --include src/app/features/admin/vet-visits/data-access/vet-visit-form.mapper.spec.ts --include src/app/features/admin/vet-visits/data-access/vet-visits.service.spec.ts --include src/app/features/admin/vet-visits/vet-visit-cancel-dialog.component.spec.ts --include src/app/features/admin/vet-visits/vet-visit-form-dialog.component.spec.ts` → 36 tests passing, 0 failures.
- **Total PR4 tests written/updated**: 4 page action scenarios added plus service spec parentVisitId expectation updated.

## Files Changed

| File | Action | What Was Done |
|------|--------|---------------|
| `hato-fe/src/app/core/offline/offline-types.ts` | Modified | Added cost, treatmentPlan, cancelReason, and legacy/new plan typing to FIELD_VET_VISIT metadata. |
| `hato-fe/src/app/features/admin/vet-visits/data-access/vet-visits.service.ts` | Modified | Extended `VetVisitItem` and normalized backend list DTO fields for cost/currency/treatment plan with legacy null defaults. |
| `hato-fe/src/app/features/admin/vet-visits/data-access/vet-visits.service.spec.ts` | Modified | Added backend DTO parsing and legacy null-default coverage. |
| `hato-fe/src/app/features/admin/vet-visits/data-access/vet-visit-form.mapper.ts` | Modified | Added action-aware cancel/attend payload mapping, cost/plan/cancelReason fields, and `normalizePlan()`. |
| `hato-fe/src/app/features/admin/vet-visits/data-access/vet-visit-form.mapper.spec.ts` | Modified | Added cancel, attend, follow-up/finalize, and legacy plan normalization coverage. |
| `hato-fe/src/app/features/admin/vet-visits/vet-visits-page.component.ts` | Modified | Set new DTO fields to null for locally merged newly-created visits to preserve compile/runtime shape. |
| `hato-fe/src/app/features/admin/vet-visits/vet-visits-page.component.spec.ts` | Modified | Updated fixtures with null defaults for new DTO fields. |
| `hato-fe/src/app/features/admin/vet-visits/vet-visit-cancel-dialog.component.ts` | Created | Standalone Material cancel dialog with required Spanish reason validation and typed result. |
| `hato-fe/src/app/features/admin/vet-visits/vet-visit-cancel-dialog.component.spec.ts` | Created | Covers rendering, validation, disabled confirm, confirm result, and cancel result. |
| `hato-fe/src/app/features/admin/vet-visits/vet-visit-form-dialog.component.ts` | Modified | Added action-aware attend mode with clinical fields, cost, treatment plan FormArray, CDK drag handles, and follow-up/finalize choice. |
| `hato-fe/src/app/features/admin/vet-visits/vet-visit-form-dialog.component.spec.ts` | Modified | Added attend-mode tests for rendered fields, validation, dynamic plan list, and submit choices. |
| `hato-fe/src/app/features/admin/vet-visits/vet-visits-page.component.ts` | Modified | Removed direct finalize row action; wired cancel dialog, attend dialog, canceled/attended/finalized events, and linked follow-up creation through existing event service/mapper. |
| `hato-fe/src/app/features/admin/vet-visits/vet-visits-page.component.spec.ts` | Modified | Added PR4 row-action visibility, cancel payload, attend+follow-up, and attend+finalize coverage. |
| `hato-fe/src/app/features/admin/vet-visits/data-access/vet-visits.service.ts` | Modified | Added nullable `parentVisitId` parsing to preserve follow-up chain metadata in FE list items/local stale merges. |
| `hato-fe/src/app/features/admin/vet-visits/data-access/vet-visits.service.spec.ts` | Modified | Added parentVisitId parse/null expectations around existing list DTO coverage. |
| `openspec/changes/vet-visit-lifecycle-actions-v1/tasks.md` | Modified | Marked PR2 frontend contracts/mapper tasks complete. |
| `openspec/changes/vet-visit-lifecycle-actions-v1/tasks.md` | Modified | Marked PR3 dialog tasks complete, preserving PR4 page wiring as pending. |
| `openspec/changes/vet-visit-lifecycle-actions-v1/apply-progress.md` | Modified | Merged PR1+PR2 progress with PR3 dialog progress and TDD evidence. |
| `openspec/changes/vet-visit-lifecycle-actions-v1/tasks.md` | Modified | Marked PR4 page action wiring tasks complete where implemented in this slice. |
| `openspec/changes/vet-visit-lifecycle-actions-v1/apply-progress.md` | Modified | Merged PR4 progress and TDD evidence with prior PR1–PR3 progress. |

## Deviations from Design

- None for the PR2 boundary. UI dialogs/page actions were intentionally not implemented.
- `createVetVisitEvent()` / `updateVetVisitEvent()` do not exist as methods in the current FE service; the payload contract is owned by `mapVetVisitFormToCreateInput()` and `AnimalsHealthEventsService.createEvent()`, so PR2 extended the mapper contract instead of inventing service methods.
- PR3 intentionally did not implement `action='cancel'` inside `VetVisitFormDialogComponent`; the design decision prefers composition through `VetVisitCancelDialogComponent`, with page opening that dialog in PR4.
- PR3 returns attend dialog fields (`findings`, `cost`, `treatmentPlan`, `followUpChoice`) but does not wire them into page row actions; that is explicitly reserved for PR4.
- PR4 removes direct `Finalizar` from all central list row actions per the launch scope and proposal/spec intent. This leaves task 4.1.6's direct attended-row finalize wording intentionally unimplemented because it conflicts with "Finalization SHALL ONLY be reachable from the ATENDIDA state through the attend flow" and the user request to remove direct Finalizar.
- PR4 did not implement full timeline/history chain rendering (4.2.2); final broad verification/archive is reserved for PR5 and backend projection did not expose a dedicated timeline endpoint change in this slice.

## Discoveries

- Current FE vet visit creation routes through `mapVetVisitFormToCreateInput()` → `AnimalsHealthEventsService.createEvent()`; there are no dedicated `createVetVisitEvent()` or `updateVetVisitEvent()` methods in `VetVisitsService`.
- Updating `VetVisitItem` requires local page merge objects/fixtures to carry null defaults for new API fields, even though PR2 does not implement display/actions yet.
- The correct local Node for strict FE testing is `$HOME/.nvm/versions/node/v20.19.6/bin`; default shell `node` is v26.0.0.
- `VetVisitFormDialogComponent` already had an attended-create validation tied to the existing `notes` field; PR3 had to keep that behavior while allowing attend mode to validate the new `attentionNotes` field instead.
- `VetVisitItem` did not previously carry `parentVisitId`; adding the nullable field is required for FE stale/local merge state to keep follow-up chain links visible after PR4 creates a linked next-control visit.
- The existing FE create path can still be reused for row actions by adapting row/dialog data into `mapVetVisitFormToCreateInput()`; no dedicated `createVetVisitEvent()` service method exists.

## Remaining Tasks

- [x] Phase 3: Frontend Dialogs — Cancel + Attend Forms (3.1.1–3.2.7 and 3.3.3 complete; 3.3.1/3.3.2 intentionally superseded by composition decision).
- [x] Phase 4: Frontend Page — Actions Wiring + Follow-up Chain page actions (4.1.1–4.1.5, 4.1.7 complete for PR4 launch scope; 4.1.6 intentionally not implemented due direct-finalize conflict; 4.2 display/timeline remains for PR5/follow-up).
- [ ] Phase 5.1: Backend tests checklist remains unchecked for the final cross-cutting PR slice, though PR1 added focused backend coverage.
- [ ] Phase 5.2: Frontend final checklist is mostly covered for dialogs/page/mapper; final PR5 broad verification remains.

## Workload / PR Boundary

- **Mode**: chained PR slice.
- **Boundary**: Frontend page row-action wiring only — remove direct finalize, cancel modal event creation, attend modal event creation, follow-up chain creation, and stale merge parent link support.
- **Excluded**: Backend changes, production build, full timeline/history chain rendering, final broad verification/archive.
- **Review budget impact**: PR4 stays a focused FE orchestration slice; PR5 should handle final broad checks/archive.

## Status

53 cumulative checklist items complete across PR1+PR2+PR3+PR4. PR4 launch scope is complete; ready for PR5 final broad verification/archive slice.
