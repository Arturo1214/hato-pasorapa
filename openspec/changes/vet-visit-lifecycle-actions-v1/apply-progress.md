# Apply Progress: vet-visit-lifecycle-actions-v1

**Mode**: Strict TDD
**Artifact store**: hybrid (OpenSpec + Engram)
**Delivery strategy**: auto-chain
**Chain strategy**: feature-branch-chain
**Current PR slice**: PR 1 — Backend foundation: cost, cancel reason, structured treatment plan validation/projection

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

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1 Mapper validation | `AnimalHealthEventMapperTest.java` | Unit | ✅ 28/28 focused baseline passed before production changes | ✅ RED run failed at test compile for missing `readCost/readTreatmentPlan/readCancelReason` and DTO accessors | ✅ Focused tests passed: 36/36 | ✅ Cost accept/reject, cancel reason, findings, treatment plan valid/invalid, legacy plan | ✅ Extracted helper methods for cost, plan, reason, length and finite-number validation |
| 1.2 DTO extension | `AnimalHealthEventServiceTest.java`, `VetVisitResourceTest.java` | Unit + REST integration | ✅ 28/28 baseline | ✅ RED referenced missing DTO accessors `costo()`, `costCurrency()`, `treatmentPlan()` | ✅ Focused tests passed: 36/36 | ✅ Null legacy cost and non-null cost/currency response cases | ➖ Record field extension only |
| 1.3 Service projection | `AnimalHealthEventServiceTest.java`, `VetVisitResourceTest.java` | Unit + REST integration | ✅ 28/28 baseline | ✅ RED compile/runtime expectations failed before projection existed | ✅ Focused tests passed: 36/36 | ✅ Cost amount/currency, null legacy cost, array plan, legacy string plan, REST response projection | ✅ Reused mapper helpers from service projection |
| 1.4 Mapper helper API | `AnimalHealthEventMapperTest.java` | Unit | ✅ 28/28 baseline | ✅ RED compile failed for missing public helper methods | ✅ Focused tests passed: 36/36 | ✅ Present/absent cost, visit/top-level cancel reason, structured/legacy treatment plan | ✅ Helper methods centralize normalization for service reuse |

## Test Summary

- **Safety net**: `JAVA_HOME=$(/usr/libexec/java_home -v 21) ./mvnw -Dtest=AnimalHealthEventMapperTest,AnimalHealthEventServiceTest,VetVisitResourceTest test` → 28 tests passing before production changes.
- **RED**: Same focused command after writing tests first → compilation failure on missing DTO/helper API, proving tests led implementation.
- **GREEN/REFACTOR**: Same focused command after implementation and small test expectation fix for new findings requirement → 36 tests passing, 0 failures, 0 errors.
- **Total tests written/updated**: 8 new focused scenarios plus one existing mapper scenario updated to include required findings under the new contract.
- **Layers used**: Unit (mapper/service), REST integration (`VetVisitResourceTest`).
- **Production build**: Not run, per instruction.

## Files Changed

| File | Action | What Was Done |
|------|--------|---------------|
| `hato-be/src/main/java/bo/pasorapa/hato/service/mapper/AnimalHealthEventMapper.java` | Modified | Added type-aware cost rejection/validation, cancel reason and findings requirements, treatment plan normalization/validation, and public read helpers. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/AnimalHealthEventService.java` | Modified | Projected `costo`, `costCurrency`, and `treatmentPlan` into vet visit list items. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/dto/vetvisit/VetVisitItemDto.java` | Modified | Added backend API fields for cost and treatment plan. |
| `hato-be/src/test/java/bo/pasorapa/hato/service/mapper/AnimalHealthEventMapperTest.java` | Modified | Added validation/helper coverage for PR1 contract. |
| `hato-be/src/test/java/bo/pasorapa/hato/service/AnimalHealthEventServiceTest.java` | Modified | Added service projection coverage for cost and treatment plan. |
| `hato-be/src/test/java/bo/pasorapa/hato/web/rest/VetVisitResourceTest.java` | Modified | Added list response projection assertions for cost/currency/treatment plan. |
| `openspec/changes/vet-visit-lifecycle-actions-v1/tasks.md` | Modified | Marked PR1 backend tasks complete. |
| `openspec/changes/vet-visit-lifecycle-actions-v1/apply-progress.md` | Created | Persisted PR1 apply progress and TDD evidence. |

## Deviations from Design

- None for backend PR1 intent. Implementation supports `clinicalNote.plan` as `String`/`List<String>` per design and also supports top-level structured `treatmentPlan` ordered maps from the delta spec as a fallback.

## Discoveries

- `animal_health_events.metadata_json` is `CLOB`; no DB migration is required for cost/treatment plan metadata.
- Existing tests had an attended visit accepted without findings; under the new spec this is invalid, so the fixture was updated to include findings.

## Remaining Tasks

- [ ] Phase 2: Frontend Contracts — Types, Service, Mapper (2.1.1–2.3.6).
- [ ] Phase 3: Frontend Dialogs — Cancel + Attend Forms (3.1.1–3.3.3).
- [ ] Phase 4: Frontend Page — Actions Wiring + Follow-up Chain (4.1.1–4.2.2).
- [ ] Phase 5.1: Backend tests listed in the original testing phase are functionally covered for PR1, but the OpenSpec Phase 5 checklist remains unchecked because it is the final cross-cutting PR slice.
- [ ] Phase 5.2: Frontend tests (5.2.1–5.2.4).

## Workload / PR Boundary

- **Mode**: chained PR slice.
- **Boundary**: Backend foundation only — DTO, mapper validation/helpers, service/list projection, focused backend tests.
- **Excluded**: All frontend changes, UI actions/dialogs, and final cross-cutting FE verification.
- **Review budget impact**: PR1 backend foundation is focused, but implementation plus tests is still a meaningful backend slice; later PRs should remain chained.

## Status

18/18 PR1 backend tasks complete. Ready for PR2 FE contracts/mapper slice or SDD verify for this backend slice.
