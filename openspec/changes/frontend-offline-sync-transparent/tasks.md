# Tasks: frontend-offline-sync-transparent

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 650-950 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1: OfflineEntityChangeBus + sync/users/ganaderos subscriptions → PR 2: razas upsert/subscription → PR 3: vet visit overlays + health-event emissions |
| Delivery strategy | chained delivery approved for escalated slices |
| Chain strategy | feature-branch-chain (slice 1: tasks 1-4; slice 2: task 5) |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain (slice 1: tasks 1-4; slice 2: task 5)
400-line budget risk: High

## Notes for Apply

- Strict TDD is active for this project. Use RED → GREEN → TRIANGULATE → REFACTOR.
- Frontend test command: `cd hato-fe && npm test`.
- Keep changes Angular 21 standalone/signal-friendly, feature-scoped, and RxJS-typed.
- Preserve current operational admin/ganadero UX: no duplicate page titles, keep existing `app-data-table`, status cards, and dialog flows.
- Do not add `RAZA` to offline sync entity types in this change; treat it as a UI freshness key only.
- Do not refactor all entities into stores; keep the first implementation targeted.

## Proposed First Autonomous Slice

Use this slice if the delivery decision is to chain PRs: implement tasks 1-4 only, covering the shared bus, coalesced sync emissions, and users/ganaderos stale-list fixes. Verification boundary: affected unit specs plus `cd hato-fe && npm test`. Rollback boundary: remove the new bus file, injected dependencies, and page subscriptions; existing manual reload flows remain.

## Implementation Tasks

### 1. RED: Shared offline entity change bus

- [x] Add failing tests in `hato-fe/src/app/core/offline/offline-entity-change-bus.service.spec.ts` for:
  - [x] `watch(['USER'])` emits only `USER` changes and ignores other entity keys.
  - [x] `emitBatch` coalesces by `entity + source + operation + reason`.
  - [x] Coalescing de-duplicates IDs and preserves count/reason where provided.
- [x] GREEN: Add `hato-fe/src/app/core/offline/offline-entity-change-bus.service.ts` with:
  - [x] `OfflineEntityChangeKey`, source, operation, and payload types.
  - [x] `OfflineEntityChangeBus` provided in root, exposing `changes$`, `lastChange`, `emit`, `emitBatch`, and `watch`.
  - [x] A tested coalescing helper local to the file unless a shared helper is justified.
- [x] REFACTOR: Keep the API small and ensure no generic `OfflineStoreService.saveSnapshot` emissions are introduced.

### 2. RED: Coalesced sync emissions

- [x] Update failing tests in `hato-fe/src/app/core/offline/sync-orchestrator.service.spec.ts` for:
  - [x] Pull items for `USER`/`GANADERO` emit one `pull/sync-batch` event per entity after the entity pull loop.
  - [x] Empty pull pages emit no entity bus event.
  - [x] Acked create ID reconciliation emits `reconcile/snapshot-upsert` with old and new IDs.
  - [x] Push acknowledgements emit coalesced `push/sync-batch` events without per-status-transition noise.
- [x] GREEN: Update `hato-fe/src/app/core/offline/offline-store.service.ts` so `applyPullResponse(entityType, items, checkpoint)` returns affected `entityType`, IDs, and count while preserving current persistence behavior.
- [x] GREEN: Update `hato-fe/src/app/core/offline/sync-orchestrator.service.ts` to inject/configure `OfflineEntityChangeBus` and emit via one `emitBatch([...])` near the end of successful sync persistence.
- [x] TRIANGULATE: Include `ANIMAL_EVENT_LOG`/`ANIMAL_HEALTH_EVENT` in sync emission coverage only where current payloads already expose reliable entity IDs.
- [x] REFACTOR: Keep existing custom window refresh events unchanged.

### 3. RED: Users transparent freshness

- [x] Add failing tests in `hato-fe/src/app/features/admin/users/data-access/admin-users.service.spec.ts` for:
  - [x] `createUser`/`updateUser` save snapshots and emit `USER` `online-mutation/snapshot-upsert` with returned IDs.
  - [x] Optimistic status update emits `USER` `local-mutation/status-update`.
- [x] Add/update failing tests in `hato-fe/src/app/features/admin/users/admin-users-page.component.spec.ts` proving a `USER` bus event triggers a reload without browser refresh.
- [x] GREEN: Update `hato-fe/src/app/features/admin/users/data-access/admin-users.service.ts` to accept/inject the bus and emit after successful snapshot writes.
- [x] GREEN: Update `hato-fe/src/app/features/admin/users/admin-users-page.component.ts` to subscribe to `entityChangeBus.watch(['USER'])` with `auditTime(50)` and `takeUntilDestroyed`, calling existing `loadUsers()`.
- [x] REFACTOR: Keep existing explicit dialog/status reloads for compatibility; avoid duplicate state-management abstractions.

### 4. RED: Ganaderos transparent freshness

- [x] Add failing tests in `hato-fe/src/app/features/admin/ganaderos/data-access/ganaderos.service.spec.ts` for:
  - [x] `enqueueCreate` emits `GANADERO` `local-mutation/create` after pending snapshot save.
  - [x] `updateGanadero` emits `GANADERO` `online-mutation/snapshot-upsert`.
  - [x] Optimistic status update emits `GANADERO` `local-mutation/status-update` using the canonical entity ID.
- [x] Add/update failing tests in `hato-fe/src/app/features/admin/ganaderos/ganaderos-page.component.spec.ts` proving a `GANADERO` bus event triggers existing `loadGanaderos()`.
- [x] GREEN: Update `hato-fe/src/app/features/admin/ganaderos/data-access/ganaderos.service.ts` with bus dependency/emissions after successful snapshot writes.
- [x] GREEN: Update `hato-fe/src/app/features/admin/ganaderos/ganaderos-page.component.ts` to subscribe with `auditTime(50)` and `takeUntilDestroyed`.
- [x] TRIANGULATE: Verify queued create ID reconciliation from task 2 causes a later ganadero refresh.

### 5. RED: Razas immediate upsert and freshness

- [x] Add failing tests in `hato-fe/src/app/features/admin/razas/razas-page.component.spec.ts` and/or `hato-fe/src/app/features/admin/razas/data-access/razas.service.spec.ts` for:
  - [x] Create/update/set-active mutation feedback containing `raza` upserts the visible row immediately even if `listAll()` is stale.
  - [x] A `RAZA` bus event triggers one reload through `auditTime(50)`.
- [x] GREEN: Update `hato-fe/src/app/features/admin/razas/data-access/razas.service.ts` to emit `RAZA` `online-mutation/snapshot-upsert` after mutation responses.
- [x] GREEN: Update `hato-fe/src/app/features/admin/razas/razas-page.component.ts` to upsert returned `raza` by `uuid` and subscribe to `entityChangeBus.watch(['RAZA'])`.
- [x] REFACTOR: Use a small local/shared `upsertById` helper only if it reduces duplication without expanding scope.

### 6. RED: Vet visit overlays for attend/follow-up/cancel

- [x] Add failing tests in `hato-fe/src/app/features/admin/vet-visits/vet-visits-page.component.spec.ts` for:
  - [x] Attend + finalize overlays the parent as attended/closed despite a stale reload response.
  - [x] Attend + schedule keeps the attended parent visible and inserts the follow-up child after the parent when backend projection is stale.
  - [x] Cancel overlay remains after a bus-triggered reload.
- [x] GREEN: Update `hato-fe/src/app/features/admin/vet-visits/vet-visits-page.component.ts` with a session-scoped `pendingVisitOverlays` signal/map and helpers to remember/merge overlays.
- [x] GREEN: Ensure create, attend, follow-up, and cancel flows call the overlay helper before reload and merge overlays on every `reloadVisits$` path.
- [x] GREEN: Subscribe the page to `['VET_VISIT', 'ANIMAL_EVENT_LOG', 'ANIMAL_HEALTH_EVENT']` with `auditTime(50)` and `takeUntilDestroyed`.
- [x] REFACTOR: Keep overlay logic local to vet visits; do not change backend projection contracts.

### 7. RED: Health event mutation emissions

- [x] Add failing tests in `hato-fe/src/app/features/admin/animals/data-access/animals-health-events.service.spec.ts` for:
  - [x] Field vet visit create emits `ANIMAL_EVENT_LOG` with the operation/entity ID.
  - [x] When visit metadata includes a visit ID, the service also emits `VET_VISIT` `snapshot-upsert`.
- [x] GREEN: Update `hato-fe/src/app/features/admin/animals/data-access/animals-health-events.service.ts` to inject/configure the bus and emit after successful local/online event creation.
- [x] TRIANGULATE: Confirm source is `local-mutation` for queued/offline paths and `online-mutation` for direct online writes.

### 8. Final verification and cleanup

- [x] Run `cd hato-fe && npm test` and capture failures/output.
- [x] If full test runtime is prohibitive, first run the targeted specs for changed files, then run the full command before final handoff unless blocked.
- [x] Inspect changed line count (`git diff --stat`) against the 400-line review budget.
- [x] Confirm no generated artifacts or broad store refactors were introduced in the original FE SDD slices.
- [x] Follow-up BE validation/fixes were added after Slice A FE↔BE review: vet visit status canonicalization and animal owner scoping/security. These are outside the original FE-only slice boundaries and should be described separately in review/PR notes.
- [x] Update this `tasks.md` checkboxes during apply progress and document any deferred PR slices.
