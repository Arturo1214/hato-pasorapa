# Design: Animal Offline Architecture V1

## Technical Approach

Consolidate the existing Angular offline foundation instead of replacing it. Animal profile, event, health, reproduction and image services keep queue-first writes through `OfflineStoreService`; lists/details read IndexedDB snapshots whenever offline or when local operations exist. `/sync` remains the only replay channel, with `operationId` idempotency, retry scheduling, conflict metadata, and pull checkpoints. UX becomes transparent for GANADERO: connectivity lives in the header, row/media badges show local state, and manual sync/backup/conflict navigation is removed only from GANADERO routes/menu. Admin/support tools remain available.

## Architecture Decisions

| Decision | Alternatives considered | Rationale |
|---|---|---|
| Reuse `hato-offline` IndexedDB stores: `outbox`, `inbox`, `snapshots`, `sync_state` plus image binary DB | SQLite/OPFS/new DB | Proposal excludes native/SQLite; current code already has schema migrations, queue metrics and backup integration. |
| Represent UI state with one normalized FE union: `synced | pending | conflict | failed | local_only` mapped from outbox/image states | Keep mixed `syncStatus`/`syncState` names everywhere | Existing code has both lowercase animal statuses and uppercase image states; a shared mapper prevents UI drift while preserving API compatibility. |
| Keep background sync auto-triggered by startup/reconnect/manual event, but hide manual controls from GANADERO | Remove manual trigger entirely | Services already call `triggerManualSync` after online queueing; support/admin still need observability and resolution. |
| Store original photo blobs now, recommend compression pipeline next if not present | Block large photos or upload only when online | Current code validates JPEG/PNG and 2MB max, stores blobs by `operationId`, but does not compress; V1 should add thumbnails/optional compression only if safe. |

## Data Flow

```text
Animal UI ─→ feature service ─→ OfflineStoreService ─→ IndexedDB hato-offline
             │                         │
             ├─ image service ─────────┴─→ hato-offline-image-binaries
             │
             └─ triggerManualSync/online ─→ SyncOrchestrator ─→ /sync push/pull
                                                │
                                                └─ snapshots/checkpoints/conflicts
```

## File Changes

| File | Action | Description |
|---|---|---|
| `hato-fe/src/app/core/offline/offline-types.ts` | Modify | Add shared `AnimalOfflineUiStatus`/badge contracts and optional thumbnail/compression metadata. |
| `hato-fe/src/app/core/offline/offline-store.service.ts` | Modify | Keep current stores; add focused helpers for animal scoped outbox/snapshots if needed, no schema split. |
| `hato-fe/src/app/core/offline/offline-image-binary-store.service.ts` | Modify | Persist thumbnail/compressed blob metadata when available; keep existing binary restore compatibility. |
| `hato-fe/src/app/core/offline/sync-orchestrator.service.ts` | Modify | Ensure animal/image replay purges binaries only after ack and leaves conflict metadata for badges. |
| `hato-fe/src/app/features/admin/animals/data-access/*.ts` | Modify | Use shared status mapper across profile/events/health/reproduction/images. |
| `hato-fe/src/app/features/admin/animals/*component.ts` | Modify | Render row/detail/media badges for pending/synced/conflict/local-only/failed. |
| `hato-fe/src/app/ui/layout/main-layout/header/*` | Modify | Inject `OfflineStatusService` and render online/offline indicator. |
| `hato-fe/src/app/ui/layout/main-layout/sidebar/sidebar.ts` | Modify | Remove `Sincronización`, `Backups`, `Conflictos` from `GANADERO_MENU_ITEMS`; leave admin routes/tools intact. |
| `hato-fe/src/app/app.routes.ts` | Modify | Remove or guard GANADERO sync/backups/conflict routes; keep `/admin/conflictos` and support pages. |
| `*.spec.ts` alongside changed files | Modify | Cover behavior changes. |

## Interfaces / Contracts

```ts
export type AnimalOfflineUiStatus = 'synced' | 'pending' | 'conflict' | 'failed' | 'local_only';
export interface AnimalOfflineBadge { status: AnimalOfflineUiStatus; message: string | null; operationId?: string; }
export interface AnimalMediaLocalMeta { binaryRef: string; thumbnailRef?: string | null; compressed?: boolean; sizeBytes: number; checksumSha256: string; }
```

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | status mapping, retry/conflict badges, image blob/thumbnail metadata, route/menu filtering | Vitest specs with in-memory stores and fake `OfflineStatusService`. |
| Integration | animal create/update/image/event offline then reconnect replay | Existing sync harness specs for idempotent `/sync` push/pull and binary purge after ack. |
| UI | header indicator, animal row/media badges, hidden GANADERO tools | Component specs for header/sidebar/animals pages. |

## Migration / Rollout

No destructive migration. Existing `CURRENT_OFFLINE_SCHEMA_VERSION=10` remains valid unless thumbnail metadata becomes persisted in `sync_state.meta`; then add v11 migration with defaults only. Existing image binaries stay keyed by `operationId`. Event-table consolidation is explicitly separate: this design consumes the current three ledgers (`ANIMAL_EVENT`, `ANIMAL_HEALTH_EVENT`, `ANIMAL_REPRODUCTION_EVENT`) and must not merge backend tables.

## Open Questions

- [ ] Should `/ganadero/sincronizacion|backups|conflictos` redirect to dashboard or return 403 after menu removal?
- [ ] Should compression be implemented in V1 or deferred with current 2MB/file cap and thumbnail recommendation?
