# Apply Progress: frontend-offline-sync-transparent

## Slice Boundary

- Delivery mode: chained delivery approved by user.
- Implemented slices: slice 1 (tasks 1-4), slice 2 (task 5), and slice 3 (tasks 6-7).
- Deferred slices: none for the current task list; all implementation tasks 1-7 are complete.
- Review budget: forecast remains High; slice 3 added a vet-visits/health-events-only delta (~297 insertions / 33 deletions across 4 files), and cumulative diff remains above the 400-line budget due prior slices.

## Completed Tasks

- [x] Task 1: Shared `OfflineEntityChangeBus` with `emit`, `emitBatch`, coalescing, `lastChange`, and `watch`.
- [x] Task 2: Coalesced sync emissions from `SyncOrchestratorService` for pull, push acknowledgement, and create-ID reconciliation; `OfflineStoreService.applyPullResponse` now returns affected ids/count.
- [x] Task 3: Users service emits entity changes after online create/update and optimistic status; users page subscribes lifecycle-safely and reloads on `USER` events.
- [x] Task 4: Ganaderos service emits entity changes after queued create/status and online update; ganaderos page subscribes lifecycle-safely and reloads on `GANADERO` events.
- [x] Task 5: Razas service emits `RAZA` mutation events; razas page immediately upserts returned `raza` values and subscribes lifecycle-safely to `RAZA` events.
- [x] Task 6: Vet visits page keeps session-scoped overlays for create/cancel/attend/follow-up and merges them on every reload, including bus-triggered stale reloads.
- [x] Task 7: Animals health event creation emits `ANIMAL_EVENT_LOG` and `VET_VISIT` entity changes for field vet visit operations.
- [x] Final verification: targeted specs and full frontend test suite passed for slices 1-3.

## Files Changed

- `hato-fe/src/app/core/offline/offline-entity-change-bus.service.ts`
- `hato-fe/src/app/core/offline/offline-entity-change-bus.service.spec.ts`
- `hato-fe/src/app/core/offline/offline-store.service.ts`
- `hato-fe/src/app/core/offline/sync-orchestrator.service.ts`
- `hato-fe/src/app/core/offline/sync-orchestrator.service.spec.ts`
- `hato-fe/src/app/features/admin/users/data-access/admin-users.service.ts`
- `hato-fe/src/app/features/admin/users/data-access/admin-users.service.spec.ts`
- `hato-fe/src/app/features/admin/users/admin-users-page.component.ts`
- `hato-fe/src/app/features/admin/users/admin-users-page.component.spec.ts`
- `hato-fe/src/app/features/admin/ganaderos/data-access/ganaderos.service.ts`
- `hato-fe/src/app/features/admin/ganaderos/data-access/ganaderos.service.spec.ts`
- `hato-fe/src/app/features/admin/ganaderos/ganaderos-page.component.ts`
- `hato-fe/src/app/features/admin/ganaderos/ganaderos-page.component.spec.ts`
- `hato-fe/src/app/features/admin/razas/data-access/razas.service.ts`
- `hato-fe/src/app/features/admin/razas/data-access/razas.service.spec.ts`
- `hato-fe/src/app/features/admin/razas/razas-page.component.ts`
- `hato-fe/src/app/features/admin/razas/razas-page.component.spec.ts`
- `hato-fe/src/app/features/admin/vet-visits/vet-visits-page.component.ts`
- `hato-fe/src/app/features/admin/vet-visits/vet-visits-page.component.spec.ts`
- `hato-fe/src/app/features/admin/animals/data-access/animals-health-events.service.ts`
- `hato-fe/src/app/features/admin/animals/data-access/animals-health-events.service.spec.ts`
- `openspec/changes/frontend-offline-sync-transparent/tasks.md`
- `openspec/changes/frontend-offline-sync-transparent/apply-progress.md`

## Commands Run

| Command | Result | Evidence |
|---|---:|---|
| `cd hato-fe && npm test -- --watch=false --include='src/app/core/offline/offline-entity-change-bus.service.spec.ts'` | failed (RED) | Failed because `offline-entity-change-bus.service.ts` did not exist yet and new tests could not compile. |
| `cd hato-fe && npm test -- --watch=false --include='src/app/core/offline/offline-entity-change-bus.service.spec.ts'` | passed | 1 test file, 2 tests passed after adding the bus. |
| `cd hato-fe && npm test -- --watch=false --include='src/app/core/offline/sync-orchestrator.service.spec.ts' --include='src/app/features/admin/users/data-access/admin-users.service.spec.ts' --include='src/app/features/admin/users/admin-users-page.component.spec.ts' --include='src/app/features/admin/ganaderos/data-access/ganaderos.service.spec.ts' --include='src/app/features/admin/ganaderos/ganaderos-page.component.spec.ts'` | failed (GREEN repair) | 19 existing sync-orchestrator tests failed because manual `new SyncOrchestratorService(...)` lacked Angular injection context for the default bus. |
| Same targeted multi-spec command plus bus spec | passed | 6 test files, 55 tests passed after adding safe default bus resolution and all slice implementation. |
| `cd hato-fe && npm test -- --watch=false` | passed | 97 test files, 492 tests passed. |
| `git checkout -- hato-fe/src/app/core/offline/offline-store.service.ts` + focused reapply of `applyPullResponse` metadata | n/a | Removed formatting-only churn; `offline-store.service.ts` now has only 4 added lines. |
| `cd hato-fe && npm test -- --watch=false` | passed | Re-run after churn reduction: 97 test files, 492 tests passed. |
| `cd hato-fe && npm test -- --watch=false --include='src/app/features/admin/razas/data-access/razas.service.spec.ts' --include='src/app/features/admin/razas/razas-page.component.spec.ts'` | failed (RED) | New razas tests failed before implementation: service emitted no `RAZA` changes and page lacked bus/upsert behavior; initial fakeAsync test helper was adjusted because the environment lacks zone-testing. |
| Same targeted razas command | passed | 2 test files, 12 tests passed after adding service emissions, page upsert, and bus subscription. |
| `cd hato-fe && npm test -- --watch=false --include='src/app/features/admin/razas/razas-page.component.spec.ts'` | failed (TRIANGULATE RED) | Added regression for bus-triggered stale reload after a recent raza mutation; it failed because the bus reload could still overwrite the immediate upsert with stale `listAll()` data. |
| `cd hato-fe && npm test -- --watch=false --include='src/app/features/admin/razas/data-access/razas.service.spec.ts' --include='src/app/features/admin/razas/razas-page.component.spec.ts'` | passed | 2 test files, 13 tests passed after adding the session-scoped recently-saved raza overlay/merge. |
| `cd hato-fe && npm test -- --watch=false` | passed | 97 test files, 501 tests passed after slice 2. |
| `git diff --check` | passed | No whitespace errors. |
| `cd hato-fe && npm test -- --watch=false --include='src/app/features/admin/vet-visits/vet-visits-page.component.spec.ts' --include='src/app/features/admin/animals/data-access/animals-health-events.service.spec.ts'` | failed (RED) | New slice 3 tests failed before implementation because `AnimalsHealthEventsService.configureForTesting` had no `entityChangeBus` dependency and vet overlays/subscriptions were missing. |
| Same targeted vet-visits + animals-health-events command | passed | 2 test files, 33 tests passed after adding overlays and health-event bus emissions. |
| Same targeted vet-visits + animals-health-events command | passed | 2 test files, 33 tests passed after refactoring fan-out emissions to coalesce per campaign instead of per animal. |
| `cd hato-fe && npm test -- --watch=false` | passed | 97 test files, 506 tests passed after slice 3. |
| `git diff --check` | passed | No whitespace errors after slice 3. |

## TDD Cycle Evidence

| Cycle | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|
| Task 1 bus | Added `offline-entity-change-bus.service.spec.ts`; command failed because service file was missing. | Added root-provided bus with `watch`, `emit`, `emitBatch`, coalescing, and `lastChange`; bus spec passed. | Coalescing test covers duplicate ids and separate reason groups. | Kept coalescing helper local to bus file; no `OfflineStoreService.saveSnapshot` event emission added. |
| Task 2 sync emissions | Added sync tests for pull entity changes, empty pull pages, push ack, and create reconciliation. | Added `applyPullResponse` return metadata and `SyncOrchestratorService` event aggregation/emission. | Existing full sync spec suite remained in place; fixed default bus resolution for manual constructor tests. | Existing calendar/notification/reporting/conflict window events remained unchanged. |
| Task 3 users | Added service tests for create/update/status emissions and page test for bus-triggered reload. | Users service now awaits snapshot saves before emitting; page subscribes to `USER` events with `auditTime(50)` and `takeUntilDestroyed`. | Targeted component/service specs verify transparent reload without browser refresh. | Existing explicit dialog/status reload paths retained for compatibility. |
| Task 4 ganaderos | Added service tests for create/update/status emissions and page test for bus-triggered reload. | Ganaderos service emits after pending/online snapshot saves; page subscribes to `GANADERO` events lifecycle-safely. | Status uses canonical entity id and sync reconcile test verifies later ganadero refresh signal. | Existing UX, dialogs, and manual reload paths retained. |
| Task 5 razas | Added razas service/page tests; RED showed no `RAZA` emissions and no page upsert/bus reload behavior. | Razas service emits `RAZA online-mutation/snapshot-upsert`; page upserts returned raza and watches `RAZA` with `auditTime(50)` + `takeUntilDestroyed`. | Page tests cover update, set-active, create upserts against stale `listAll()`, bus-triggered reload, and preserving recently saved raza after a stale bus-triggered reload. | Added a small session-scoped recently-saved raza overlay/merge; kept `RAZA` as UI-only key and did not add it to `OFFLINE_ENTITY_TYPES`; online-only UX remains unchanged. |
| Task 6 vet visit overlays | Added vet visits page tests for attend-finalize stale reload, attend-schedule stale reload, and cancel overlay after bus-triggered stale reload. | Added `pendingVisitOverlays`, remember/current helpers, bus subscription to `VET_VISIT`/`ANIMAL_EVENT_LOG`/`ANIMAL_HEALTH_EVENT`, and overlay merge on every `reloadVisits$`. | Existing create tests plus new attend/cancel tests prove parent/follow-up/cancel rows stay visible when backend projections are stale. | Kept overlay session-scoped in the page; backend vet status canonicalization was added later as a separate FE↔BE validation fix. |
| Task 7 health event emissions | Added animals health-events service tests for offline and online field vet visit change emissions. | Injected/configured `OfflineEntityChangeBus` and emitted `ANIMAL_EVENT_LOG` + `VET_VISIT` after successful event snapshot/outbox creation. | Tests confirm `local-mutation` offline and `online-mutation` online sources; fan-out emissions were refactored to coalesce operation ids per campaign. | Kept emissions target-specific; did not add generic `OfflineStoreService.saveSnapshot` emissions. |

## Deviations from Design

- `SyncOrchestratorService` defaults to a new standalone `OfflineEntityChangeBus` when constructed outside Angular DI, while still using DI when available. This preserves existing manual unit-test construction and avoids NG0203 outside injection contexts.
- First slice emits sync changes for touched supported entity types generally, not only `USER`/`GANADERO`; no razas/vet visit behavior was wired.

## Remaining Tasks

- None in tasks 1-7. Future work, if desired, should be new SDD scope (for example capping long-lived overlay/recently-mutated marker maps or durable vet projections).

## Workload / PR Boundary

- This apply-progress now covers slice 1, slice 2, and slice 3.
- Slice 3 boundary: tasks 6-7 only; no durable vet visit store/projection, no broad refactor, and no unrelated feature behavior.
- Post-slice FE↔BE validation added backend follow-up fixes outside the original FE-only SDD boundary: vet visit status canonicalization and animal owner scoping/security. Keep these documented separately in review/PR notes.
- Slice 3 workload estimate: ~297 insertions / 33 deletions across 4 vet/health files. Cumulative tracked diff remains above the 400-line review budget because earlier slices are already large.
