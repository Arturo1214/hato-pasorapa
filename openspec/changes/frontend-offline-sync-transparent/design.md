# Technical Design: frontend-offline-sync-transparent

## Context

Operational Angular pages currently load table data into component-local signals and refresh only after explicit dialog flows. Offline/local mutations and background sync update `OfflineStoreService` snapshots, but there is no shared entity-change signal that tells pages to re-read or merge local state. The first slice must stay small, preserve the existing table/dialog UX, avoid a broad per-entity store refactor, and support Strict TDD later with `cd hato-fe && npm test`.

Relevant current paths:

- `hato-fe/src/app/core/offline/offline-store.service.ts`
- `hato-fe/src/app/core/offline/sync-orchestrator.service.ts`
- `hato-fe/src/app/features/admin/users/data-access/admin-users.service.ts`
- `hato-fe/src/app/features/admin/users/admin-users-page.component.ts`
- `hato-fe/src/app/features/admin/ganaderos/data-access/ganaderos.service.ts`
- `hato-fe/src/app/features/admin/ganaderos/ganaderos-page.component.ts`
- `hato-fe/src/app/features/admin/razas/data-access/razas.service.ts`
- `hato-fe/src/app/features/admin/razas/razas-page.component.ts`
- `hato-fe/src/app/features/admin/animals/data-access/animals-health-events.service.ts`
- `hato-fe/src/app/features/admin/vet-visits/vet-visits-page.component.ts`

## Design Goals

1. Successful local/online mutations become visible without browser refresh.
2. Background sync/pull/reconcile can notify affected screens.
3. First slice remains reviewable by adding a lightweight bus plus targeted emit/subscribe points.
4. No visual redesign: keep `app-data-table`, MatDialog flows, current status/feedback cards.
5. Avoid broad `OfflineStoreService` reactive refactor and avoid generic every-snapshot emission storms.

## Proposed API

Add `hato-fe/src/app/core/offline/offline-entity-change-bus.service.ts`:

```ts
import { Injectable, signal } from '@angular/core';
import { Observable, Subject, filter, shareReplay } from 'rxjs';
import type { OfflineEntityType } from './offline-types';

export const OFFLINE_ENTITY_CHANGE_KEYS = [
  'USER',
  'GANADERO',
  'ANIMAL_EVENT_LOG',
  'ANIMAL_HEALTH_EVENT',
  'RAZA',
  'VET_VISIT',
] as const;
export type OfflineEntityChangeKey = OfflineEntityType | 'RAZA' | 'VET_VISIT';

export type OfflineEntityChangeSource =
  | 'local-mutation'
  | 'online-mutation'
  | 'push'
  | 'pull'
  | 'reconcile';

export type OfflineEntityChangeOperation =
  | 'create'
  | 'update'
  | 'delete'
  | 'status-update'
  | 'snapshot-upsert'
  | 'sync-batch';

export interface OfflineEntityChange {
  entity: OfflineEntityChangeKey;
  source: OfflineEntityChangeSource;
  operation: OfflineEntityChangeOperation;
  ids?: readonly string[];
  reason?: string;
  count?: number;
  occurredAt: string;
}

@Injectable({ providedIn: 'root' })
export class OfflineEntityChangeBus {
  private readonly changesSubject = new Subject<OfflineEntityChange>();
  readonly changes$ = this.changesSubject.asObservable().pipe(shareReplay({ bufferSize: 1, refCount: true }));
  readonly lastChange = signal<OfflineEntityChange | null>(null);

  emit(change: Omit<OfflineEntityChange, 'occurredAt'> & { occurredAt?: string }) {
    const normalized = { ...change, occurredAt: change.occurredAt ?? new Date().toISOString() };
    this.lastChange.set(normalized);
    this.changesSubject.next(normalized);
  }

  emitBatch(changes: Array<Omit<OfflineEntityChange, 'occurredAt'> & { occurredAt?: string }>) {
    for (const change of coalesceEntityChanges(changes)) {
      this.emit(change);
    }
  }

  watch(entities: readonly OfflineEntityChangeKey[]): Observable<OfflineEntityChange> {
    const allowed = new Set(entities);
    return this.changes$.pipe(filter((change) => allowed.has(change.entity)));
  }
}
```

`coalesceEntityChanges` should group by `entity + source + operation + reason`, de-duplicate IDs, and emit at most one event per group. It can live in the same file and be unit-tested directly or indirectly through `emitBatch`.

### Provisioning

- `OfflineEntityChangeBus` is `providedIn: 'root'`; no route/provider changes required for normal Angular usage.
- Add optional dependencies for testing/integration:
  - `AdminUsersServiceDependencies.entityChangeBus?: OfflineEntityChangeBus`
  - `GanaderosServiceDependencies.entityChangeBus?: OfflineEntityChangeBus`
  - `RazasService` can use the injected singleton directly; if tests need override, add `configureForTesting` only if existing specs require it.
  - `AnimalsHealthEventsService.configureForTesting({ entityChangeBus })`.
  - `SyncOrchestratorDependencies.entityChangeBus?: OfflineEntityChangeBus`; default to `inject(OfflineEntityChangeBus)` in the constructor, same pattern as current `apiClient`/`metricsStore`.

Do not inject the bus into `DEFAULT_OFFLINE_STORE_SERVICE`; that singleton is constructed outside Angular DI. Store writes stay mostly passive, and mutation/sync callers emit after successful writes.

## Event Emission Points

### OfflineStoreService mutation points

Keep `saveSnapshot` generic and non-emitting to avoid a storm from every snapshot save. Target these changes instead:

1. `applyPullResponse(entityType, items, checkpoint)`
   - Return `{ entityType, ids, count }` after persisting.
   - `ids` comes from each item's `uuid || id`.
   - `SyncOrchestratorService` emits one coalesced `pull/sync-batch` event per entity after the entity's paginated pull loop if `count > 0`.

2. `reassignSnapshotEntityId(entityType, currentEntityId, nextEntityId)`
   - Already returns the reassigned snapshot or `null`.
   - `SyncOrchestratorService.reconcileAcknowledgedCreateSnapshot` emits `reconcile/snapshot-upsert` with `[currentEntityId, nextEntityId]` when a pending create receives a server ID.

3. Entity-specific local snapshot helpers (`saveUserSnapshot`, `saveGanaderoSnapshot`, `saveEventSnapshot`) emit after `store.saveSnapshot` completes. They are intentionally targeted and can include exact IDs and operation source.

### SyncOrchestratorService

Collect changes during one sync cycle and emit only after relevant persistence completes:

- Push acknowledgements:
  - For every successful result, add `{ entity: result.entityType, source: 'push', operation: 'sync-batch', ids: [result.entityId].filter(Boolean) }`.
  - For create ID reconciliation, also add `{ entity: result.entityType, source: 'reconcile', operation: 'snapshot-upsert', ids: [oldId, newId] }`.
- Pull loop:
  - Use the returned IDs from `store.applyPullResponse`.
  - Aggregate across pages by entity; emit once after all pages for that entity, not per page.
- Existing custom window events (`calendar-alerts:refresh`, `notifications:refresh`, etc.) stay unchanged for existing feature refreshes.
- Event storm prevention:
  - Do not emit for empty pull pages.
  - Do not emit per snapshot or per outbox status transition (`markInFlight`, `markAcked`, retry/fail/conflict).
  - Use `entityChangeBus.emitBatch([...])` once near the end of the successful sync block, before or after existing refresh window events.

## Entity Merge / Upsert Strategy

### Shared helper

Add a small feature-agnostic helper near the bus or in the affected feature if line budget is tight:

```ts
export function upsertById<T>(items: readonly T[], item: T, idOf: (item: T) => string): T[] {
  const id = idOf(item);
  const index = items.findIndex((current) => idOf(current) === id);
  if (index < 0) return [item, ...items];
  return items.map((current, currentIndex) => currentIndex === index ? { ...current, ...item } : current);
}
```

Keep sorting/filter behavior owned by existing table/data-table logic. For mutation responses, merge immediately into the component signal to remove visible staleness; bus-triggered reload then reconciles with store/server.

### Users

- `AdminUsersService.createUser` and `updateUser`:
  - Continue saving the returned `ManagedUser` snapshot.
  - After `saveUserSnapshot(user)`, emit `{ entity: 'USER', source: 'online-mutation', operation: 'snapshot-upsert', ids: [user.id] }`.
- `updateStatus` / `applyOptimisticStatus`:
  - After saving the optimistic status snapshot, emit `{ entity: 'USER', source: 'local-mutation', operation: 'status-update', ids: [userId] }`.
- `AdminUsersPageComponent`:
  - Subscribe to `entityChangeBus.watch(['USER'])` and reload via existing `loadUsers()`.
  - Also keep explicit reloads after dialog/status responses for compatibility; subscription should be coalesced/debounced so duplicate reloads do not become noticeable.

### Ganaderos

- `GanaderosService.enqueueCreate`:
  - After pending snapshot save, emit `{ entity: 'GANADERO', source: 'local-mutation', operation: 'create', ids: [operation.operationId] }`.
- `updateGanadero`:
  - After returned snapshot save, emit `{ entity: 'GANADERO', source: 'online-mutation', operation: 'snapshot-upsert', ids: [ganadero.id] }`.
- `applyOptimisticStatus`:
  - After snapshot save, emit `{ entity: 'GANADERO', source: 'local-mutation', operation: 'status-update', ids: [canonicalEntityId] }`.
- ID reconciliation from `SyncOrchestratorService` will trigger a second `GANADERO` event when a pending create is reassigned to the server ID.
- `GanaderosPageComponent` subscribes to `['GANADERO']` and calls existing `loadGanaderos()`.

### Razas

Razas are currently online-only and are not in `OfflineEntityType`; do not add them to sync pull in the first slice. Treat them as a UI cache/freshness entity key:

- `RazasService.create/update/setActive` maps responses to `{ outcome, message, raza }` as it does today and emits `{ entity: 'RAZA', source: 'online-mutation', operation: 'snapshot-upsert', ids: [raza.uuid] }`.
- `RazasPageComponent.handleMutationFeedback` should accept the full feedback, immediately upsert `response.raza` into `razas` using `uuid`, set feedback, and avoid depending solely on a full reload.
- Subscribe to `entityChangeBus.watch(['RAZA'])` and call `loadRazas()` with `auditTime(50)` so other raza mutations or future option caches refresh.
- This keeps the online-only status card and disabled offline CTAs unchanged.

## Vet Visit Overlay Strategy

Vet visits are projections over `ANIMAL_EVENT_LOG`/health events, not a first-class offline snapshot entity. The current page has `mergeRecentlySavedVisit`, but attend/follow-up paths often reload without passing an overlay, so stale backend results can hide newly queued changes.

### Local overlay model

In `VetVisitsPageComponent`, keep a small session-scoped overlay map:

```ts
private readonly pendingVisitOverlays = signal<ReadonlyMap<string, VetVisitItem>>(new Map());
```

Helpers:

- `rememberVisitOverlays(visits: VetVisitItem | VetVisitItem[])`: merges into the map by `visitId`.
- `currentVisitOverlays()`: returns `Array.from(map.values())`.
- `mergeVisibleVetVisits(serverItems, overlays, filter)`: reuse and slightly generalize `mergeRecentlySavedVisit`.

### Create

- Existing `buildRecentlySavedVisitsForCreate` already creates overlays for scheduled, attended-now, and attended-now + follow-up.
- After successful `createEvent`, call `rememberVisitOverlays(recentlySavedVisits)` before reload.
- `reloadVisits$` always merges `currentVisitOverlays()` plus any method-local recently saved visits.

### Attend without follow-up

- Build an attended overlay from the row and dialog result:
  - `visitId`: row visit ID.
  - `status`: `ATTENDED`.
  - `chainStatus`: `CLOSED` if `followUpChoice === 'finalize'`, else `OPEN` when attended.
  - `nextControlAt`: `null` for finalize, dialog `nextDueAt` otherwise.
  - `atencionNotas`, `findings`, `costo`, `costCurrency`, `treatmentPlan` from the dialog result.
  - Preserve row `mode`, `animalUuid`, `parentVisitId`, `targetAnimalCount`, veterinarian if not changed.
- Remember it before reload so the visible row updates even if `/vet-visits` still returns the previous pending projection.

### Attend with scheduled follow-up

- Build two overlays:
  1. Attended parent row as above with `chainStatus: 'OPEN'` and `nextControlAt: result.nextDueAt`.
  2. Follow-up child from `buildFollowUpDialogResult(row, result)` with `status: 'PENDING'`, `parentVisitId: row.visitId`, `occurredAt/nextControlAt` at the scheduled date.
- After both `createEvent` calls succeed, remember both overlays and reload.
- `mergeVisibleVetVisits` replaces parent by `visitId` and inserts the child immediately after the parent when it is absent from backend results.

### Cancel

- Existing `canceledVisit` overlay is correct but should be remembered in `pendingVisitOverlays` too, not only passed to one reload.
- Set `status: 'CANCELED'`, `cancelReason`, and `chainStatus: 'CLOSED'` or `null` consistently with backend label expectations. Prefer `CLOSED` for action gating if cancellation closes the chain.

### Background sync and event bus

- `AnimalsHealthEventsService.createEventInternal` emits:
  - `{ entity: 'ANIMAL_EVENT_LOG', source: local/online mutation, operation: 'create', ids: [operationId] }`
  - If `metadata.visit.visitId` exists, also `{ entity: 'VET_VISIT', source: local/online mutation, operation: 'snapshot-upsert', ids: [visitId] }`.
- `SyncOrchestratorService` emits `ANIMAL_EVENT_LOG` pull/push changes; if payload metadata contains vet visit IDs during pull, include a `VET_VISIT` event too. If extracting IDs in sync is too large for first slice, first slice may emit only `ANIMAL_EVENT_LOG` and let `VetVisitsPageComponent` subscribe to both `['VET_VISIT', 'ANIMAL_EVENT_LOG', 'ANIMAL_HEALTH_EVENT']`.
- `VetVisitsPageComponent` subscribes to those keys and reloads current filters, merging overlays.

## Lifecycle and Subscription Approach

Angular 21 standalone/signals conventions:

- Use `DestroyRef` + `takeUntilDestroyed` for every component subscription introduced by this change.
- Use RxJS for bus composition:

```ts
private readonly destroyRef = inject(DestroyRef);
private readonly entityChangeBus = inject(OfflineEntityChangeBus);

constructor() {
  this.loadUsers();
  this.entityChangeBus.watch(['USER']).pipe(
    auditTime(50),
    takeUntilDestroyed(this.destroyRef),
  ).subscribe(() => this.loadUsers());
}
```

- Prefer `auditTime(50)` or `auditTime(0)` over manual flags so synchronous mutation + sync bursts collapse into one reload.
- If a page has `submitting` state (vet visits), bus-triggered reload may still run; the overlay map prevents stale regressions. If duplicate loading indicators become noisy, guard only visual state, not data refresh.
- Do not introduce new top-level titles/subtitles or change table/dialog UX.

## Data Flow

### Online edit/create user/ganadero/raza

1. Dialog submits through existing service.
2. Backend returns entity.
3. Service/page upserts the returned entity locally.
4. Service emits entity bus event.
5. Page subscription reloads/merges current list.
6. Existing feedback card displays unchanged message.

### Offline/queued ganadero status/create and user status

1. Service enqueues operation and writes optimistic snapshot.
2. Service emits local mutation event.
3. Current page reloads from snapshots because pending operations exist.
4. `SyncOrchestratorService` later pushes, reconciles IDs if needed, pulls changes, and emits coalesced push/reconcile/pull events.
5. Page reloads again and sees canonical snapshot/server state.

### Vet visit attend/follow-up/cancel

1. Page maps dialog action to one or more health event create operations.
2. Health service enqueues and snapshots `ANIMAL_EVENT_LOG`.
3. Page records explicit `VetVisitItem` overlays for parent/follow-up/cancel.
4. Reload fetches backend projection and overlays local visit state by `visitId`.
5. Sync bus events trigger later reloads; overlays continue to prevent stale server projections from hiding local changes.

## Test Strategy

Use Strict TDD later; frontend command: `cd hato-fe && npm test`.

Focused tests for first slice:

1. `core/offline/offline-entity-change-bus.service.spec.ts`
   - `watch(['USER'])` only emits matching entity changes.
   - `emitBatch` coalesces duplicate entity/source/operation events and de-duplicates IDs.

2. `core/offline/sync-orchestrator.service.spec.ts`
   - Pull with items for `USER`/`GANADERO` emits one coalesced event per entity after sync.
   - Empty pull pages emit no entity event.
   - Acked create ID reconciliation emits a reconcile event with old and new IDs.

3. `features/admin/users/data-access/admin-users.service.spec.ts`
   - Online update/create saves snapshot and emits `USER` event.
   - Optimistic status update emits `USER` local mutation event.

4. `features/admin/ganaderos/data-access/ganaderos.service.spec.ts`
   - Queued create/status emits `GANADERO` events.
   - Online update emits `GANADERO` event.

5. `features/admin/razas/razas-page.component.spec.ts` or `razas.service.spec.ts`
   - Mutation feedback with `raza` upserts the row without requiring `listAll` to return the new row first.
   - Bus event triggers one reload.

6. `features/admin/vet-visits/vet-visits-page.component.spec.ts`
   - Attend + finalize overlays the parent as `ATTENDED`/closed despite stale list response.
   - Attend + schedule inserts follow-up child after the parent despite stale list response.
   - Cancel overlay remains after bus-triggered reload.

7. `features/admin/animals/data-access/animals-health-events.service.spec.ts`
   - `FIELD_VET_VISIT` create emits `ANIMAL_EVENT_LOG` and `VET_VISIT` events with operation/visit IDs.

## Rollout and Slicing

Recommended first implementation slice (<400 changed lines if practical):

1. Add `OfflineEntityChangeBus` and tests.
2. Add SyncOrchestrator coalesced pull/push/reconcile emissions for `USER`, `GANADERO`, `ANIMAL_EVENT_LOG` only.
3. Add service-level emissions for users and ganaderos; page subscriptions with `takeUntilDestroyed`.
4. Add raza immediate upsert + bus event, but do not add raza to offline sync types.
5. Add vet visit overlay fixes for attend/follow-up/cancel and health-event bus emission.

If line budget pressure is high, split after step 3:

- PR 1: bus + users/ganaderos + sync emissions.
- PR 2: razas + vet visit overlays/events.

## Risks and Mitigations

- **Duplicate reloads/event storms**: coalesce in `emitBatch`, aggregate per sync entity, and use `auditTime` in components.
- **Raza not in offline sync**: use `RAZA` as UI-only change key; do not add to `OFFLINE_ENTITY_TYPES` unless backend sync supports it.
- **Vet projection drift**: overlays are explicit and session-scoped; they do not alter backend contracts. Existing manual reload still works.
- **Lifecycle leaks**: all new component subscriptions use `takeUntilDestroyed`.
- **Review size**: keep helpers small and entity-targeted; avoid moving pages to new stores in this change.

## File Change Plan

Likely first-slice files:

- Add `hato-fe/src/app/core/offline/offline-entity-change-bus.service.ts`
- Add `hato-fe/src/app/core/offline/offline-entity-change-bus.service.spec.ts`
- Update `hato-fe/src/app/core/offline/offline-store.service.ts` to return pull affected IDs.
- Update `hato-fe/src/app/core/offline/sync-orchestrator.service.ts` and spec for bus dependency/emissions.
- Update users/ganaderos services and pages + focused specs.
- Update razas service/page + focused spec.
- Update `AnimalsHealthEventsService` and `VetVisitsPageComponent` + focused specs.
