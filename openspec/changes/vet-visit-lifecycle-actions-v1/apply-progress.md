# Apply Progress: vet-visit-lifecycle-actions-v1

**Mode**: Strict TDD
**Artifact store**: hybrid (OpenSpec + Engram)
**Delivery strategy**: auto-chain
**Chain strategy**: feature-branch-chain
**Current PR slice**: PR 2 — Frontend contracts/mapper: offline types, vet visit list DTO parsing, form mapper payload contract

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

## Test Summary

- **Safety net**: `PATH="$HOME/.nvm/versions/node/v20.19.6/bin:$PATH" npm test -- --include src/app/features/admin/vet-visits/data-access/vet-visit-form.mapper.spec.ts --include src/app/features/admin/vet-visits/data-access/vet-visits.service.spec.ts` → 7 tests passing before PR2 production changes.
- **RED**: Same focused command after writing PR2 tests first → expected TypeScript compile failures for missing mapper API/types/service fields.
- **GREEN/REFACTOR**: Same focused command after implementation → 14 tests passing, 0 failures.
- **Additional compile safety**: `PATH="$HOME/.nvm/versions/node/v20.19.6/bin:$PATH" npm test -- --include src/app/features/admin/vet-visits/vet-visits-page.component.spec.ts` → 6 tests passing after updating `VetVisitItem` fixture defaults.
- **Total PR2 tests written/updated**: 7 focused data-access scenarios added; page spec fixtures adjusted for extended DTO shape.
- **Layers used**: FE unit tests (mapper/service) plus page spec compile coverage.
- **Production build**: Not run, per instruction.

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
| `openspec/changes/vet-visit-lifecycle-actions-v1/tasks.md` | Modified | Marked PR2 frontend contracts/mapper tasks complete. |
| `openspec/changes/vet-visit-lifecycle-actions-v1/apply-progress.md` | Modified | Merged PR1 progress with PR2 progress and TDD evidence. |

## Deviations from Design

- None for the PR2 boundary. UI dialogs/page actions were intentionally not implemented.
- `createVetVisitEvent()` / `updateVetVisitEvent()` do not exist as methods in the current FE service; the payload contract is owned by `mapVetVisitFormToCreateInput()` and `AnimalsHealthEventsService.createEvent()`, so PR2 extended the mapper contract instead of inventing service methods.

## Discoveries

- Current FE vet visit creation routes through `mapVetVisitFormToCreateInput()` → `AnimalsHealthEventsService.createEvent()`; there are no dedicated `createVetVisitEvent()` or `updateVetVisitEvent()` methods in `VetVisitsService`.
- Updating `VetVisitItem` requires local page merge objects/fixtures to carry null defaults for new API fields, even though PR2 does not implement display/actions yet.
- The correct local Node for strict FE testing is `$HOME/.nvm/versions/node/v20.19.6/bin`; default shell `node` is v26.0.0.

## Remaining Tasks

- [ ] Phase 3: Frontend Dialogs — Cancel + Attend Forms (3.1.1–3.3.3).
- [ ] Phase 4: Frontend Page — Actions Wiring + Follow-up Chain (4.1.1–4.2.2).
- [ ] Phase 5.1: Backend tests checklist remains unchecked for the final cross-cutting PR slice, though PR1 added focused backend coverage.
- [ ] Phase 5.2: Frontend tests checklist remains for final cross-cutting PR slice; PR2 added focused mapper/service tests only.

## Workload / PR Boundary

- **Mode**: chained PR slice.
- **Boundary**: Frontend contracts/mapper only — offline metadata types, vet visit list DTO parsing, mapper payload support, focused data-access tests.
- **Excluded**: Cancel dialog, attend dialog UI, row action wiring, linked follow-up creation, history/list display enhancements, production build.
- **Review budget impact**: PR2 is a focused FE contract slice, but it touches shared `VetVisitItem` shape and mapper tests; later slices should remain chained.

## Status

31/31 PR1+PR2 tasks complete for assigned slices. Ready for PR3 FE dialogs slice or SDD verify for PR2.
