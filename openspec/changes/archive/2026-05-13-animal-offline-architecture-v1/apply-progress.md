# Apply Progress: Animal Offline Architecture V1

**Change**: animal-offline-architecture-v1
**Mode**: Strict TDD
**Artifact store**: hybrid
**PR boundary**: PR4 / Phase 5 slice — visible animal list/detail/media/timeline badges using existing `uiStatus`/`syncStatus`. No new sync behavior or backend changes.

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
- [x] 4.1 Inject `OfflineStatusService` in `header.ts` and expose `isOnline`/Spanish connectivity label signals
- [x] 4.2 Render persistent header connectivity indicator with online/offline Spanish labels and accessible status semantics
- [x] 4.3 Remove `Sincronización`, `Backups`, and `Conflictos` from `GANADERO_MENU_ITEMS`
- [x] 4.4 Add header/sidebar specs for online/offline indicator and hidden GANADERO manual offline tooling entries
- [x] 5.1 Render Spanish animal row sync badges for `pending`, `synced`, `conflict`, `failed`, and `local_only` states in the animal list identity cell
- [x] 5.2 Render the animal detail header badge plus gallery badges for main image and thumbnails
- [x] 5.3 Render media badges in list thumbnails and the image dialog/detail gallery using existing `uiStatus`/`syncState`; pending local binary photos show `Solo local`, failed photos show `Error`
- [x] 5.4 Add component specs for animal list badges, detail header badges, media badges, and timeline badges while preserving vet visit rendering
- [x] 6.1 Add `canMatch` redirect for `/ganadero/sincronizacion`, `/ganadero/backups`, and `/ganadero/conflictos` to `/ganadero/dashboard`; admin conflict route remains available
- [x] 6.2 Add route spec coverage for GANADERO manual offline tooling redirects
- [x] 7.1 Update all `*.spec.ts` files touched by this slice
- [x] 7.2 Run required focused `ng test` for core offline, admin animals, and vet visits

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
| 4.1-4.2 | `hato-fe/src/app/ui/layout/main-layout/header/header.spec.ts` | Component unit | ✅ 4 files / 19 tests baseline passed | ✅ Header connectivity tests failed because no indicator existed | ✅ 21 targeted layout/route tests passed | ✅ Online and offline route-change scenarios covered | ✅ Labels centralized as computed signals |
| 4.3-4.4 | `hato-fe/src/app/ui/layout/main-layout/sidebar/sidebar.spec.ts`, `sidebar.integration.spec.ts` | Component unit | ✅ 4 files / 19 tests baseline passed | ✅ GANADERO menu cleanup specs failed while manual tooling entries remained | ✅ 21 targeted layout/route tests passed | ✅ Static GANADERO menu and role-switching integration both covered | ✅ Removed conflict badge source from GANADERO menu while keeping admin support store untouched |
| 5.1 | `hato-fe/src/app/features/admin/animals/animals-page.component.spec.ts` | Component unit | ✅ 2 files / 40 tests baseline passed | ✅ Row badge spec failed with no `.animal-sync-badge` elements | ✅ 45 targeted animal page/detail tests passed | ✅ Pending, synced, and conflict row states covered with Spanish labels and conflict message | ✅ Reused small label helpers; kept DataTable and existing identity cell structure |
| 5.2 | `hato-fe/src/app/features/admin/animals/animal-detail-page.component.spec.ts` | Component unit | ✅ 2 files / 40 tests baseline passed | ✅ Detail header/gallery specs failed because no badges rendered | ✅ 45 targeted animal page/detail tests passed | ✅ Conflict detail header plus local-only/failed gallery states covered | ✅ Badge styles shared inside the component without changing data services |
| 5.3 | `hato-fe/src/app/features/admin/animals/animals-page.component.spec.ts`, `animal-detail-page.component.spec.ts` | Component unit | ✅ 2 files / 40 tests baseline passed | ✅ Thumbnail/media specs failed because pending media rendered old `Pendiente` label and detail gallery had no labels | ✅ 45 targeted animal page/detail tests passed | ✅ List thumbnail local-only + failed, main image + thumbnail gallery local-only + failed covered | ✅ Existing `uiStatus` drives labels; no new sync state introduced |
| 5.4 | `hato-fe/src/app/features/admin/animals/animals-page.component.spec.ts`, `animal-detail-page.component.spec.ts` | Component unit | ✅ 2 files / 40 tests baseline passed | ✅ 5 new specs failed before production changes | ✅ 45 targeted animal page/detail tests passed; required focused suite passed 37 files / 266 tests | ✅ Timeline pending/conflict/error badges plus vet visit text/details preserved | ✅ Tests assert visible Spanish behavior, not CSS implementation |
| 6.1-6.2 | `hato-fe/src/app/app.routes.spec.ts` | Route unit | ✅ 4 files / 19 tests baseline passed | ✅ Route spec failed while GANADERO tooling routes still lazy-loaded pages | ✅ 21 targeted layout/route tests passed | ✅ Sync, backups, and conflicts paths all require redirect `canMatch` and no page loader | ✅ Shared `redirectGanaderoOfflineToolRoute` keeps route policy explicit |
| 7.1 | Modified specs above | Unit/component/route | ✅ 4 files / 19 tests baseline passed | ✅ Tests updated before implementation | ✅ Required focused suite passed: 20 files / 102 tests | ✅ Header, sidebar, integration, route cleanup covered | ✅ No production build run |
| 7.2 | Required focused command | Unit/component/service | ✅ Animal page/detail safety net 2 files / 40 tests passed | ✅ Phase 5 RED produced 5 failing specs | ✅ Required focused suite passed: 37 files / 266 tests | ✅ Core offline + animal + vet visit scope covered | ✅ No production build run |

## Test Summary
- **Total tests written this slice**: 5 new behavior specs (2 list/media, 3 detail/gallery/timeline)
- **Total tests passing**: 266 in the required focused run
- **Layers used**: Unit, component unit, service unit
- **Approval tests**: Existing 40-test animal page/detail safety net preserved before behavior changes
- **Pure functions created**: 0

## Tests Run
1. Safety net: `PATH="$HOME/.nvm/versions/node/v20.19.6/bin:$PATH" npm test -- --include src/app/features/admin/animals/animals-page.component.spec.ts --include src/app/features/admin/animals/animal-detail-page.component.spec.ts --watch=false` → 2 files / 40 tests passed
2. RED: same animal page/detail command → 2 files / 40 passed, 5 failed for missing row/detail/media/timeline badges
3. GREEN targeted: same animal page/detail command → 2 files / 45 tests passed
4. Required focused: `PATH="$HOME/.nvm/versions/node/v20.19.6/bin:$PATH" npm test -- --include src/app/core/offline --include src/app/features/admin/animals --include src/app/features/admin/vet-visits --watch=false` → 37 files / 266 tests passed

## Deviations
None — implementation follows the PR4 boundary and reuses the existing `syncStatus`/`uiStatus` values already produced by services/adapters. No new sync behavior, routes, or backend changes were introduced.

## Remaining Tasks
- [x] All implementation tasks in this SDD change are complete

## Files Changed
- `hato-fe/src/app/features/admin/animals/animals-page.component.ts` — renders Spanish row and thumbnail badges from existing animal `syncStatus` and image `uiStatus`
- `hato-fe/src/app/features/admin/animals/animals-page.component.spec.ts` — covers row badges and local-only/error thumbnail badges
- `hato-fe/src/app/features/admin/animals/animal-detail-page.component.ts` — renders detail header, gallery, and timeline badges while preserving vet visit detail rendering
- `hato-fe/src/app/features/admin/animals/animal-detail-page.component.spec.ts` — covers detail header badge, media badges, timeline badges, and vet visit regression behavior
- `openspec/changes/animal-offline-architecture-v1/tasks.md` — marks Phase 5 and 7.2 complete for PR4
- `openspec/changes/animal-offline-architecture-v1/apply-progress.md` — cumulative apply progress merged through PR4

## Status
24/24 implementation tasks complete. Ready for verify.
