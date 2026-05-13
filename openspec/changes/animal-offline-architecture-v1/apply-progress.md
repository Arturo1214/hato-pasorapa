# Apply Progress: Animal Offline Architecture V1

**Change**: animal-offline-architecture-v1
**Mode**: Strict TDD
**Artifact store**: hybrid
**PR boundary**: PR2 / Phase 3 — animal feature data services consume shared offline status mappers. No header/sidebar UX, route cleanup, or page/table badge rendering in this run.

## Completed Tasks
- [x] 1.1 Add `AnimalOfflineUiStatus`, `AnimalOfflineBadge`, and `AnimalMediaLocalMeta` contracts to `offline-types.ts`
- [x] 1.2 Add `mapAnimalOfflineUiStatus(outboxStatus, imageState): AnimalOfflineUiStatus`
- [x] 1.3 Add `mapAnimalMediaUiStatus(imageSnapshot): AnimalOfflineUiStatus`
- [x] 1.4 Add mapper unit specs covering `synced`, `pending`, `conflict`, `failed`, and `local_only`
- [x] 2.1 Reviewed `offline-store.service.ts`; no changes required for this slice because existing animal scoped outbox/snapshot helpers are sufficient
- [x] 2.2 Add optional `thumbnailRef` and `compressed` metadata to image binary records and backup entries
- [x] 2.3 Document and test that image binaries are purged only on server ack, not conflict/error paths
- [x] 2.4 Add unit specs for image binary metadata backup/restore and conflict binary retention
- [x] 3.1 Modify `animals.service.ts` to derive animal `syncStatus` through `mapAnimalOfflineUiStatus()`
- [x] 3.2 Modify `animals-images.service.ts`/image adapter to expose image `uiStatus` through `mapAnimalMediaUiStatus()`
- [x] 3.3 Modify animal event, health event, and reproduction event data adapters to derive snapshot `syncStatus` through `mapAnimalOfflineUiStatus()`
- [x] 3.4 Add animal service coverage for offline update → ack/reconnect → `synced` badge state; existing create coverage remains green

## TDD Cycle Evidence
| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1-1.4 | `hato-fe/src/app/core/offline/offline-types.spec.ts` | Unit | ✅ 16 files / 77 tests baseline passed | ✅ Missing exports failed compile | ✅ 3 mapper/contract tests passed in targeted run | ✅ Covers outbox, image fallback, and media-local branches | ✅ Pure mapper functions added |
| 2.1 | Existing `hato-fe/src/app/core/offline/offline-store.service.spec.ts` | Unit review | ✅ 16 files / 77 tests baseline passed | ➖ Review-only; no production change | ✅ Existing store helpers sufficient | ➖ Structural review, no new branch | ➖ None needed |
| 2.2, 2.4 | `hato-fe/src/app/core/offline/offline-image-binary-store.service.spec.ts` | Unit | ✅ 16 files / 77 tests baseline passed | ✅ Metadata fields failed compile | ✅ Targeted binary store spec passed | ✅ Backup export + restore verifies metadata round-trip | ✅ Optional fields preserve legacy records |
| 2.3 | `hato-fe/src/app/core/offline/sync-orchestrator.service.spec.ts` | Unit | ✅ 16 files / 77 tests baseline passed | ✅ Conflict retention test written before code comment/verification | ✅ Targeted orchestrator spec passed | ✅ Conflicting image operation hydrates payload and does not purge binary | ✅ Added lifecycle comment only; behavior already correct |
| 3.1 | `hato-fe/src/app/features/admin/animals/data-access/animals.service.spec.ts` | Unit/integration-style service | ✅ 5 files / 40 tests baseline passed | ✅ Failed animal status expected `failed`, existing code returned `synced` | ✅ 46 targeted data-access tests passed | ✅ Pending/conflict existing coverage plus failed and acked update→synced coverage | ✅ Shared priority/message helper keeps legacy `syncStatus` API shape |
| 3.2 | `hato-fe/src/app/features/admin/animals/data-access/animals-images.service.spec.ts` | Unit/integration-style service | ✅ 5 files / 40 tests baseline passed | ✅ Image `uiStatus` expected `local_only/synced/failed`, existing code did not expose it | ✅ 46 targeted data-access tests passed | ✅ Local-only, synced, and failed branches covered | ✅ Image adapter delegates UI status to shared media mapper |
| 3.3 | `hato-fe/src/app/features/admin/animals/data-access/animals-events.service.spec.ts`, `animals-health-events.service.spec.ts`, `animals-reproduction-events.service.spec.ts` | Unit/integration-style service | ✅ 5 files / 40 tests baseline passed | ✅ Failed event statuses expected `failed`, existing adapters returned `synced` | ✅ 46 targeted data-access tests passed | ✅ General, health, reproduction, conflict/pending existing coverage plus failed branches | ✅ Event adapters preserve event-specific fields while using shared mapper |
| 3.4 | `hato-fe/src/app/features/admin/animals/data-access/animals.service.spec.ts` | Unit/integration-style service | ✅ 5 files / 40 tests baseline passed | ➖ Existing create ack→synced behavior already covered; added update ack→synced regression | ✅ 46 targeted data-access tests passed | ✅ Create and update ack→synced paths covered | ✅ No production change beyond mapper-backed status derivation |

## Test Summary
- **Total tests written this slice**: 7 new tests/assertion groups
- **Total tests passing**: 204 in required focused run
- **Layers used**: Unit / service integration-style unit tests
- **Approval tests**: Existing service coverage used as approval safety net for preserved pending/conflict/synced behavior
- **Pure functions created**: 0 this slice; services now consume the PR1 pure mapper functions

## Tests Run
1. Safety net: `PATH="$HOME/.nvm/versions/node/v20.19.6/bin:$PATH" npm test -- --include src/app/features/admin/animals/data-access/animals.service.spec.ts --include src/app/features/admin/animals/data-access/animals-images.service.spec.ts --include src/app/features/admin/animals/data-access/animals-events.service.spec.ts --include src/app/features/admin/animals/data-access/animals-health-events.service.spec.ts --include src/app/features/admin/animals/data-access/animals-reproduction-events.service.spec.ts --watch=false` → 5 files / 40 tests passed
2. RED: same data-access command → 5 files / 39 passed, 6 failed for missing `failed`/`uiStatus` mapper-backed service metadata
3. GREEN targeted: same data-access command → 5 files / 45 tests passed
4. Update regression targeted: same data-access command after adding update ack coverage → 5 files / 46 tests passed
5. Image formatting regression: `PATH="$HOME/.nvm/versions/node/v20.19.6/bin:$PATH" npm test -- --include src/app/features/admin/animals/data-access/animals-images.service.spec.ts --watch=false` → 1 file / 3 tests passed
6. Required focused: `PATH="$HOME/.nvm/versions/node/v20.19.6/bin:$PATH" npm test -- --include src/app/core/offline --include src/app/features/admin/animals --watch=false` → 30 files / 204 tests passed

## Deviations
None — implementation keeps the existing IndexedDB/outbox flow, preserves service method contracts, and only broadens local sync-status metadata to the shared UI status union where needed.

## Remaining Tasks
- [ ] Phase 4: Header/sidebar GANADERO UX
- [ ] Phase 5: Animal list/detail/media badges
- [ ] Phase 6: GANADERO route guard
- [ ] Phase 7: Broader final test pass for modified feature/UI files

## Files Changed
- `hato-fe/src/app/core/offline/offline-types.ts` — event snapshot payloads now share `AnimalOfflineUiStatus`
- `hato-fe/src/app/features/admin/animals/data-access/animals.service.ts` — animal snapshot status derivation now uses `mapAnimalOfflineUiStatus()`
- `hato-fe/src/app/features/admin/animals/data-access/animal-events-timeline.adapter.ts` — general event status derivation now uses `mapAnimalOfflineUiStatus()`
- `hato-fe/src/app/features/admin/animals/data-access/animal-health-events-timeline.adapter.ts` — health event status derivation now uses `mapAnimalOfflineUiStatus()` while preserving treatment/visit projections
- `hato-fe/src/app/features/admin/animals/data-access/animal-reproduction-events-timeline.adapter.ts` — reproduction event status derivation now uses `mapAnimalOfflineUiStatus()` and preserves legacy `syncState`
- `hato-fe/src/app/features/admin/animals/data-access/animals-images.service.ts` — image records expose optional mapper-backed `uiStatus`
- `hato-fe/src/app/features/admin/animals/data-access/animal-images-timeline.adapter.ts` — image status derivation now uses `mapAnimalMediaUiStatus()`
- `hato-fe/src/app/features/admin/animals/data-access/*.spec.ts` — mapper-backed service status coverage and reconnect/ack synced regression
- `openspec/changes/animal-offline-architecture-v1/tasks.md` — Phase 3 tasks marked complete
- `openspec/changes/animal-offline-architecture-v1/apply-progress.md` — cumulative apply progress updated through PR2

## Status
12/24 implementation tasks complete. Ready for next chained slice: Phase 4 header/sidebar GANADERO UX.
