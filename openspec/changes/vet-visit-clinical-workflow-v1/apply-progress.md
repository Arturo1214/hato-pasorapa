# Apply Progress: vet-visit-clinical-workflow-v1

**Change**: vet-visit-clinical-workflow-v1
**Mode**: Strict TDD
**Artifact store**: hybrid
**PR boundary**: PR 1 complete; PR 2 complete; PR 3 / Phase 3 `vet-visit-fe-detail` complete; Phase 4 bugfix regressions applied for BE list projection and FE table refresh/action state.
**Review strategy**: chained PR slice, `stacked-to-main`; PR 3 targets the PR 2 branch.

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
- [x] 2.13 Add mapper specs for scheduled, attended-now, and linked follow-up payload mapping
- [x] 2.14 Verify focused FE tests with Node 20.19.6
- [x] 3.1 Create read-only `VetVisitDetailDialogComponent` for state, mode, dates, veterinarian, motive/description, findings, notes, cost, treatment plan, cancel reason, chain/protocol status, and next scheduled visit
- [x] 3.2 Add detail-dialog specs for parent clinical detail plus canceled and pending linked children
- [x] 3.3 Add central `Ver` action to every visit row without terminal guard
- [x] 3.4 Implement `openDetailVisitDialog(row)` using `VetVisitsService.getVetVisitChain(row.visitId)` and `MatDialog`
- [x] 3.5 Update cancel guard so `CANCELED` and `chainStatus === 'CLOSED'` are terminal
- [x] 3.6 Update attend guard so only `PENDING`/Programada rows can be attended and closed-chain rows are blocked
- [x] 3.7 Remove `RESCHEDULED` and `FINALIZED` from visible status labels/options
- [x] 3.8 Remove direct row `Reprogramar`; follow-up child creation remains only in attend flow
- [x] 3.9 Keep cancel event protocol status as `CLOSED` on cancel
- [x] 3.10 Add page specs for `Ver` visibility, terminal guards, detail fetch/dialog open, and absent `Reprogramar`
- [x] 3.11 Verify focused FE tests with Node 20.19.6
- [x] 4.6 Fix BE vet visit list projection so grouped GLOBAL rows prefer the latest lifecycle state (`ATTENDED`/`CLOSED`) over stale scheduled fan-out rows for the same `visitId`
- [x] 4.7 Fix FE attend flow so schedule-next actions reload and render canonical backend rows instead of merging local optimistic parent/child rows; attended parents with active follow-up now expose only `Ver`, while pending child rows remain `Ver`/`Atender`/`Cancelar`

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
| 3.1–3.2 | `hato-fe/src/app/features/admin/vet-visits/vet-visit-detail-dialog.component.spec.ts` | Angular component | ✅ 44/44 baseline passing | ✅ Compile failed on missing detail component and `findings` contract | ✅ 49/49 focused tests passed | ✅ Parent clinical detail + canceled child + pending child | ✅ Kept view read-only and feature-scoped |
| 3.3–3.8, 3.10 | `hato-fe/src/app/features/admin/vet-visits/vet-visits-page.component.spec.ts` | Angular component/page | ✅ 44/44 baseline passing | ✅ Specs expected always-visible `Ver`, no `Reprogramar`, terminal guards, and detail fetch before code | ✅ 49/49 focused tests passed | ✅ Pending, attended/open, canceled, and attended/closed rows | ✅ Removed stale direct follow-up row branch |
| 3.4 + service detail fetch | `hato-fe/src/app/features/admin/vet-visits/data-access/vet-visits.service.spec.ts` | Angular service unit | ✅ 44/44 baseline passing | ✅ Compile failed on missing `getVetVisitChain` and `findings` mapping | ✅ 49/49 focused tests passed | ✅ Attended parent, canceled child, pending child response mapping | ✅ Shared existing DTO mapper for list and chain detail |
| 3.9 | `hato-fe/src/app/features/admin/vet-visits/vet-visits-page.component.spec.ts` | Angular component/page | ✅ 44/44 baseline passing | ✅ Existing cancel spec asserts `protocol.status=CLOSED`; preserved while changing guards | ✅ 49/49 focused tests passed | ✅ Cancel row still writes cancelReason and closes protocol | ➖ No refactor needed |
| 3.11 | Focused Angular command | Verification | ✅ 44/44 baseline passing | N/A | ✅ 49 tests passing | N/A | N/A |
| 4.6 | `hato-be/src/test/java/bo/pasorapa/hato/service/AnimalHealthEventServiceTest.java` | Service integration | ✅ 41/41 focused BE baseline passing | ✅ Failed with `expected: <ATTENDED> but was: <PENDING>` | ✅ 42/42 focused BE tests passed | ✅ Global fan-out has stale future scheduled rows + later closed attended rows; status filter excludes stale `PENDING` and includes `ATTENDED` | ✅ Extracted lifecycle comparator and distinct-animal target count fallback |
| 4.7 | `hato-fe/src/app/features/admin/vet-visits/vet-visits-page.component.spec.ts` | Angular component/page | ✅ 49/49 focused FE baseline passing | ✅ 3 failing assertions: attended active parent still showed `Cancelar`, and schedule-next merge inserted local follow-up beside backend rows | ✅ 51/51 focused FE tests passed | ✅ Backend child replacement + attended active parent actions + pending child actions | ✅ Removed unused optimistic attend-row projections; create flow keeps existing stale-list fallback |

## Test Summary
- **Total tests written this PR3 slice**: 5
- **Total tests written this PR3 slice**: 5; **Phase 4 bugfix regression tests**: 3 (1 BE, 2 FE)
- **Total focused FE tests passing**: 51; **Total focused BE tests passing after bugfix**: 42
- **Layers used**: Angular component/page (6 new cases), Angular service unit (1 new case), BE service integration (1 regression)
- **Approval tests**: None — behavior change, not pure refactor
- **Pure functions created**: 2 (`normalizeVetVisitCollection`, `normalizeNestedClinicalFindings`)

## Exact Tests Run
1. Baseline safety net: `PATH="$HOME/.nvm/versions/node/v20.19.6/bin:$PATH" npm test -- --include src/app/features/admin/vet-visits --watch=false` from `hato-fe/` → ✅ 44 tests passing
2. RED run after tests: same command → ✅ expected compilation failure for missing `VetVisitDetailDialogComponent`, `getVetVisitChain`, and `findings` contract
3. GREEN/final run: same command → ✅ 49 tests passing
4. Phase 4 BE baseline safety net: `JAVA_HOME=$(/usr/libexec/java_home -v 21) ./mvnw -Dtest=AnimalHealthEventServiceTest,VetVisitResourceTest,AnimalHealthEventMapperTest test` from `hato-be/` → ✅ 41 tests passing
5. Phase 4 RED run: `JAVA_HOME=$(/usr/libexec/java_home -v 21) ./mvnw -Dtest=AnimalHealthEventServiceTest test` from `hato-be/` → ❌ expected failure: global projection returned stale `PENDING` instead of `ATTENDED`
6. Phase 4 GREEN run: `JAVA_HOME=$(/usr/libexec/java_home -v 21) ./mvnw -Dtest=AnimalHealthEventServiceTest test` from `hato-be/` → ✅ 16 tests passing
7. Phase 4 required focused BE run: `JAVA_HOME=$(/usr/libexec/java_home -v 21) ./mvnw -Dtest=AnimalHealthEventServiceTest,VetVisitResourceTest,AnimalHealthEventMapperTest test` from `hato-be/` → ✅ 42 tests passing
8. Phase 4 FE safety net: `PATH="$HOME/.nvm/versions/node/v20.19.6/bin:$PATH" npm test -- --include src/app/features/admin/vet-visits --watch=false` from `hato-fe/` → ✅ 49 tests passing
9. Phase 4 FE RED run: same command after regression specs → ❌ expected failures: attended active parent exposed `Cancelar`; schedule-next local merge inserted a generated follow-up row alongside backend rows
10. Phase 4 FE GREEN run: same command → ✅ 51 tests passing

## Files Changed
- `hato-fe/src/app/features/admin/vet-visits/vet-visit-detail-dialog.component.ts` — created read-only chain/history dialog for clinical details and linked child follow-ups.
- `hato-fe/src/app/features/admin/vet-visits/vet-visit-detail-dialog.component.spec.ts` — added rendering tests for parent clinical detail and attended/canceled/pending chain distinctions.
- `hato-fe/src/app/features/admin/vet-visits/data-access/vet-visits.service.ts` — added `findings` mapping and `getVetVisitChain(visitId)` backed by `/api/vet-visits/{visitId}/chain`.
- `hato-fe/src/app/features/admin/vet-visits/data-access/vet-visits.service.spec.ts` — covered chain endpoint fetch and chain DTO mapping.
- `hato-fe/src/app/features/admin/vet-visits/vet-visits-page.component.ts` — added always-visible `Ver`, removed direct `Reprogramar`, opened detail dialog from fetched chain, and tightened terminal guards.
- `hato-fe/src/app/features/admin/vet-visits/vet-visits-page.component.spec.ts` — covered action visibility, terminal guards, detail fetch/dialog open, and removed `Reprogramar`/`RESCHEDULED` options.
- `hato-be/src/main/java/bo/pasorapa/hato/service/AnimalHealthEventService.java` — added lifecycle-aware representative selection for grouped vet visits and chain-detail root resolution; target count fallback now counts distinct animals instead of rows.
- `hato-be/src/test/java/bo/pasorapa/hato/service/AnimalHealthEventServiceTest.java` — added regression for GLOBAL fan-out rows where scheduled rows must not override later attended/closed lifecycle state.
- `hato-fe/src/app/features/admin/vet-visits/vet-visits-page.component.ts` — attend flow now reloads canonical backend rows without optimistic local merge; cancel guard is restricted to pending rows.
- `hato-fe/src/app/features/admin/vet-visits/vet-visits-page.component.spec.ts` — added FE regressions for backend-row replacement after scheduling follow-up and active-parent/pending-child action visibility.
- `openspec/changes/vet-visit-clinical-workflow-v1/tasks.md` — marked Phase 3 complete with focused FE test command.
- `openspec/changes/vet-visit-clinical-workflow-v1/apply-progress.md` — persisted cumulative apply progress through PR3.

## Deviations / Notes
- FE keeps the backend `ACTIVE` chain status normalized as `OPEN`, continuing the PR2 contract.
- `canAttend` blocks closed chains and only allows `PENDING`; pending rows with missing chain status remain attendable for legacy compatibility.
- No direct row `Finalizar` or `Reprogramar` action remains in the page action list.
- BE grouping now treats visit lifecycle rank as the representative selector before occurrence timestamp, so a scheduled future occurrence cannot mask an attended/closed append-only row with the same `visitId`.
- FE attend/schedule-next no longer overlays local generated follow-up IDs onto a successful backend reload; this prevents stale action visibility when the API already returns the canonical parent/child chain.

## Remaining Tasks
- Phase 4 full BE suite, full FE suite, and manual smoke remain pending for a later run; focused BE and FE regressions are complete.
