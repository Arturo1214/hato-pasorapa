# Proposal: frontend-offline-sync-transparent

## Problem

Hato FE offline support is not transparent enough for operational users. Normal create/edit/attend/follow-up flows can succeed, but list/table screens keep stale component-local state until the user manually reloads the page or browser. This breaks trust in offline sync because successful mutations are not reflected immediately, even when the local cache or sync layer already has enough information to update the UI.

Exploration identified these root causes:

- `OfflineStoreService` and the sync core do not expose a reactive entity invalidation/change signal for affected entity types.
- `SyncOrchestrator` does not announce operational entity changes after pull, push, or reconciliation.
- Admin/ganadero operational pages often keep component-local list signals populated by manual `load*()` methods, so they do not react to local mutation results or background sync.
- Some mutation flows, including vet visit attend/follow-up, need an overlay/merge fix so optimistic/local updates do not hide or regress freshly changed data.

## Goals

- Make offline work feel transparent for normal operational flows: successful create/edit/attend/follow-up actions should be visible without manual/browser refresh.
- Add a small, shared entity change bus in the offline/sync core so pages and stores can react to mutations, pull/push, and reconciliation.
- Upsert/merge mutation responses for the first high-value operational entities: users, ganaderos, razas, and vet visit attend/follow-up data.
- Keep the first implementation slice under the 400 changed-line review budget where practical.
- Add focused regression coverage for stale table behavior and merge/overlay cases.

## Non-goals

- Do not refactor every entity into a full per-entity reactive store in this first change.
- Do not redesign the offline architecture or replace IndexedDB/cache mechanisms unless required for the small slice.
- Do not change backend APIs unless the frontend cannot reliably identify changed entities from existing responses.
- Do not change operational page UX structure beyond what is required to keep tables fresh.

## Proposed Approach

1. Introduce a lightweight entity change notification mechanism in the frontend offline/sync core.
   - Announce entity type, operation kind, affected IDs when available, and source (`local-mutation`, `push`, `pull`, `reconcile`).
   - Keep the API small and Angular-friendly: signal/observable interop is acceptable, with typed entity keys.

2. Emit change events from mutation and sync paths.
   - On create/edit success for users, ganaderos, and razas, upsert/merge the returned entity into the offline store and announce the entity change.
   - After sync pull/push/reconciliation touches operational entities, announce affected entity types so dependent lists can reload or merge.

3. Update the smallest set of stale operational tables to react to entity changes.
   - Preserve existing `app-data-table`, dialog-based create/edit flows, and signal-friendly state per project standards.
   - Replace manual-only refresh assumptions with subscriptions/effects that reload or merge when the relevant entity type changes.

4. Fix vet visit attend/follow-up overlay behavior.
   - Ensure local mutation results and sync reconciliation merge into the visible list/detail state without losing freshly changed attend/follow-up fields.

5. Add focused tests.
   - Cover entity change emission from core mutation/sync paths.
   - Cover at least one representative stale table regression: after successful create/edit, the row appears/updates without browser refresh.
   - Cover vet visit attend/follow-up merge/overlay behavior.

## Alternatives Considered

- **Full per-entity reactive store refactor now**: stronger long-term model, but too broad and likely exceeds the review budget. Defer until the change bus proves the shape.
- **Force every page to call `load*()` after each dialog/mutation**: small but duplicates fragile behavior and does not solve background sync/reconciliation updates.
- **Global hard refresh after mutations/sync**: hides the bug but disrupts UX, may break offline transparency, and affects normal flows unnecessarily.
- **Backend-driven invalidation only**: useful later, but local/offline mutation visibility must work without waiting for backend round trips.

## Scope Boundaries

### In scope

- `hato-fe` offline/sync core notification API.
- Mutation-response upsert/merge for users, ganaderos, and razas.
- Operational admin/ganadero table freshness for the touched entities.
- Vet visit attend/follow-up overlay/merge fix.
- Focused Angular/Vitest unit tests for changed behavior.

### Out of scope

- Backend schema/API changes unless a blocking gap is found.
- Broad migration of all operational entities to dedicated stores.
- New E2E framework or broad full-app test expansion.
- Visual redesign of list pages beyond preserving current admin UX conventions.

## Review Slicing

First slice target: under 400 changed lines.

Recommended first PR:

1. Core entity change bus and typed entity keys.
2. Emission from mutation response handling and sync orchestration for the prioritized entities.
3. Minimal subscriptions/effects in affected user/ganadero/raza pages or stores.
4. Vet visit attend/follow-up merge fix.
5. Focused regression tests only for touched paths.

Follow-up slices, if needed:

- Expand entity change emission to additional operational entities.
- Consolidate repeated page reload/merge patterns into feature stores.
- Add broader regression coverage for other stale list screens.

## Risks

- Duplicate reloads or event storms after sync if change events are too coarse.
- Incorrect merge semantics could show stale fields or overwrite local optimistic changes.
- Page-level subscriptions/effects may leak if not tied to Angular lifecycle utilities.
- Review budget risk if too many pages are converted in the first slice.

## Rollback

- The change bus can be disabled by removing emissions/subscriptions while leaving existing manual `load*()` flows intact.
- If merge behavior regresses, revert entity-specific upsert/overlay changes and retain existing server/manual reload behavior.
- Tests should isolate the regression points so rollback can be limited to the affected entity path.

## Acceptance Criteria

- Creating or editing users, ganaderos, and razas updates the corresponding visible table/list without manual/browser refresh.
- Vet visit attend/follow-up changes remain visible after local mutation and after sync reconciliation.
- Sync pull/push/reconciliation emits operational entity changes for touched prioritized entity types.
- Existing normal online flows still work and do not require offline mode to be enabled.
- No full per-entity store refactor is introduced in the first slice.
- Focused tests cover core change emission, mutation-response upsert/merge, and at least one stale table regression.
