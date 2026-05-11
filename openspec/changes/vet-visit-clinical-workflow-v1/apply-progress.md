# Apply Progress: vet-visit-clinical-workflow-v1

**Change**: vet-visit-clinical-workflow-v1
**Mode**: Strict TDD
**Artifact store**: hybrid
**PR boundary**: PR 1 complete; PR 2 / Phase 2 `vet-visit-fe-form` complete — FE types, form dialog clinical controls, mapper, service, and focused FE tests. Central `Ver` detail dialog remains intentionally pending for PR 3.
**Review strategy**: chained PR slice, `stacked-to-main`; PR 2 targets the PR 1 branch.

## Completed Tasks
- [x] 1.1 Add `parentVisitId: String` and `cancelReason: String` fields to `VetVisitItemDto.java`
- [x] 1.2 Add `chainStatus: String` field to `VetVisitItemDto.java`
- [x] 1.3 Write failing `VetVisitResourceTest` scenarios for list response `parentVisitId`/`cancelReason`/`chainStatus` and chain endpoint
- [x] 1.4 Write failing service tests for latest event projection and chain detail preserving attended parent with canceled child
- [x] 1.5 Update `AnimalHealthEventService` projection to expose `parentVisitId` from `visit.parentVisitId`
- [x] 1.6 Add `findByParentVisitId(String parentVisitId)` to `AnimalHealthEventRepository`
- [x] 1.7 Add service method `getVisitChainDetail(String visitId)` returning parent + children ordered by parent first, then `occurredAt`
- [x] 1.8 Expose `GET /api/vet-visits/{visitId}/chain`
- [x] 1.9 Verify focused BE tests pass with Java 21
- [x] 2.1 Add `VetVisitCreationMode = 'scheduled' | 'attendedNow'` to form dialog exports
- [x] 2.2 Replace create status selector with explicit creation mode; scheduled shows scheduling fields only and attended-now shows clinical/finalization controls
- [x] 2.3 Enforce attended clinical validation for findings and attention notes through `attendedNowValidator`
- [x] 2.4 Add injectable `DateTimeClock` and default attended-now `occurredAt` to the current ISO moment
- [x] 2.5 Show next-control date only when clinical `followUpChoice === 'schedule'`
- [x] 2.6 Add `creationMode?: VetVisitCreationMode` to `VetVisitDialogData`
- [x] 2.7 Add `creationMode` and stable `findings` to `VetVisitDialogResult`
- [x] 2.8 Add `cancelReason` and normalized `chainStatus: 'OPEN' | 'CLOSED' | null` to `VetVisitItem`
- [x] 2.9 Parse backend `cancelReason` and `chainStatus`; normalize backend `ACTIVE` to FE `OPEN`
- [x] 2.10 Add `VetVisitFormValue.creationMode` and map scheduled/attended-now payloads without leaking scheduled clinical fields
- [x] 2.11 Add dialog specs for mode-specific visibility, attended-now clock, and mandatory follow-up choice/date behavior
- [x] 2.12 Add service specs for `cancelReason` and `chainStatus` mapping
- [x] 2.13 Add mapper specs for scheduled, attended-now, and linked follow-up payloads
- [x] 2.14 Verify focused FE tests with Node 20.19.6

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1–1.2 | `hato-be/src/test/java/bo/pasorapa/hato/service/AnimalHealthEventServiceTest.java`, `hato-be/src/test/java/bo/pasorapa/hato/web/rest/VetVisitResourceTest.java` | Unit/Integration | ✅ 37/37 baseline passing | ✅ Compile failed on missing DTO accessors | ✅ 41/41 focused tests passed | ✅ Parent null fields + child populated fields + chainStatus CLOSED/ACTIVE | ✅ Shared seeded metadata helper extended |
| 1.3 | `hato-be/src/test/java/bo/pasorapa/hato/web/rest/VetVisitResourceTest.java` | REST integration | ✅ 37/37 baseline passing | ✅ Test asserted missing JSON fields before implementation | ✅ 41/41 focused tests passed | ✅ List response and chain endpoint both assert fields | ✅ Kept assertions payload-visible, not implementation-coupled |
| 1.4–1.7 | `hato-be/src/test/java/bo/pasorapa/hato/service/AnimalHealthEventServiceTest.java` | Service integration | ✅ 37/37 baseline passing | ✅ Compile failed on missing service method and DTO accessors | ✅ 41/41 focused tests passed | ✅ Latest row projection plus ordered chain detail with canceled child | ✅ Extracted grouped item reuse for list and chain detail |
| 1.8 | `hato-be/src/test/java/bo/pasorapa/hato/web/rest/VetVisitResourceTest.java` | REST integration | ✅ 37/37 baseline passing | ✅ Endpoint path did not exist before implementation | ✅ 41/41 focused tests passed | ✅ Endpoint validates parent and canceled child response ordering | ✅ Resource remains thin and delegates to service |
| 1.9 | Focused Maven command | Verification | ✅ 37/37 baseline passing | N/A | ✅ 41 tests passing | N/A | N/A |
| 2.1–2.7, 2.11 | `hato-fe/src/app/features/admin/vet-visits/vet-visit-form-dialog.component.spec.ts` | Angular unit/component | ✅ 39/39 baseline passing | ✅ Compile failed on missing `DateTimeClock`, `creationMode`, and dialog contracts | ✅ 44/44 focused tests passed | ✅ Scheduled creation, attended-now creation, attend flow, follow-up choice/date branches | ✅ Removed stale status selector block and kept create/attend clinical mode helpers |
| 2.8–2.9, 2.12 | `hato-fe/src/app/features/admin/vet-visits/data-access/vet-visits.service.spec.ts` | Angular service unit | ✅ 39/39 baseline passing | ✅ Compile failed on missing `cancelReason`/`chainStatus` item fields | ✅ 44/44 focused tests passed | ✅ ACTIVE→OPEN, CLOSED passthrough, missing fields→null | ✅ Extracted `normalizeChainStatus` |
| 2.10, 2.13 | `hato-fe/src/app/features/admin/vet-visits/data-access/vet-visit-form.mapper.spec.ts` | Pure mapper unit | ✅ 39/39 baseline passing | ✅ Compile failed on missing `VetVisitFormValue.creationMode` | ✅ 44/44 focused tests passed | ✅ Scheduled, attended-now finalized, and child follow-up payloads | ✅ Centralized clinical-field inclusion based on resolved status |
| 2.14 | Focused Angular command | Verification | ✅ 39/39 baseline passing | N/A | ✅ 44 tests passing | N/A | N/A |

## Test Summary
- **Total tests written this slice**: 5
- **Total focused FE tests passing**: 44
- **Layers used**: Angular component/unit (3 new assertions/cases), service unit (1 new case + extended mapping), pure mapper unit (3 new cases)
- **Approval tests**: None — behavior change, not pure refactor
- **Pure functions created**: 1 (`normalizeChainStatus`)

## Exact Tests Run
1. Baseline safety net: `PATH="$HOME/.nvm/versions/node/v20.19.6/bin:$PATH" npm test -- --include src/app/features/admin/vet-visits --watch=false` from `hato-fe/` → ✅ 39 tests passing
2. RED run after tests: same command → ✅ expected compilation failure for missing `creationMode`, `DateTimeClock`, `cancelReason`, and `chainStatus`
3. GREEN run: same command → ✅ 44 tests passing
4. REFACTOR/final run: same command → ✅ 44 tests passing

## Files Changed
- `hato-fe/src/app/features/admin/vet-visits/vet-visit-form-dialog.component.ts` — added creation modes, injectable clock, clinical-mode validation, attended-now current moment, and follow-up-only next-control date.
- `hato-fe/src/app/features/admin/vet-visits/vet-visit-form-dialog.component.spec.ts` — added mode-specific form visibility, attended-now clock, and follow-up validation tests.
- `hato-fe/src/app/features/admin/vet-visits/data-access/vet-visits.service.ts` — added `cancelReason`/`chainStatus` fields and chain-status normalization.
- `hato-fe/src/app/features/admin/vet-visits/data-access/vet-visits.service.spec.ts` — covered cancel reason and ACTIVE/CLOSED chain-status mapping.
- `hato-fe/src/app/features/admin/vet-visits/data-access/vet-visit-form.mapper.ts` — added `creationMode` mapping so scheduled payloads do not emit clinical findings/cost/plan and attended-now maps as clinical attendance.
- `hato-fe/src/app/features/admin/vet-visits/data-access/vet-visit-form.mapper.spec.ts` — covered scheduled, attended-now, and child follow-up payload mapping.
- `hato-fe/src/app/features/admin/vet-visits/vet-visits-page.component.ts` — minimal PR2 support for new dialog/result shape, linked follow-up child payloads, and attended-finalize status remaining `ATTENDED` with closed chain.
- `hato-fe/src/app/features/admin/vet-visits/vet-visits-page.component.spec.ts` — updated fixtures/contracts for new item fields and attended-finalize payload semantics.
- `openspec/changes/vet-visit-clinical-workflow-v1/tasks.md` — marked Phase 2 complete with the exact targeted FE test command.
- `openspec/changes/vet-visit-clinical-workflow-v1/apply-progress.md` — persisted cumulative apply progress for PR 1 + PR 2.

## Deviations / Notes
- The OpenSpec task text mentioned scheduled creation showing `next control`, but the user launch prompt explicitly narrowed PR2 to “Crear Programada: no `Próximo control`”; implementation follows the launch prompt.
- FE normalizes backend `chainStatus=ACTIVE` to `OPEN` because Phase 2 task requires the FE type `OPEN | CLOSED`, while PR 1 BE currently emits `ACTIVE | CLOSED`.
- No central `Ver` detail dialog was implemented; only minimal type/page support required by PR2 was touched.

## Remaining Tasks
- Phase 3 FE detail/action/terminal-guard slice.
- Phase 4 final integration verification.
