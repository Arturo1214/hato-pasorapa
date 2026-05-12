# Tasks: Animal Offline Architecture V1

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 350–500 |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | Single PR — feature is coherent and additive |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Full feature | PR 1 | All phases below; coherent additive change |

## Phase 1: Foundation — Shared Types and Status Mapper

- [ ] 1.1 Add `AnimalOfflineUiStatus` union type (`'synced' | 'pending' | 'conflict' | 'failed' | 'local_only'`), `AnimalOfflineBadge` interface, and `AnimalMediaLocalMeta` interface to `hato-fe/src/app/core/offline/offline-types.ts`
- [ ] 1.2 Add `mapAnimalOfflineUiStatus(outboxStatus, imageState): AnimalOfflineUiStatus` mapper function to `offline-types.ts`
- [ ] 1.3 Add `mapAnimalMediaUiStatus(imageSnapshot): AnimalOfflineUiStatus` for image-only local state
- [ ] 1.4 Write unit specs: `offline-types.spec.ts` — cover all mapper branches

## Phase 2: Offline Store and Sync Infrastructure

- [ ] 2.1 Review `offline-store.service.ts` — no changes needed; existing helpers sufficient
- [ ] 2.2 Modify `offline-image-binary-store.service.ts` — add `thumbnailRef?: string | null` and `compressed?: boolean` fields to blob metadata
- [ ] 2.3 Modify `sync-orchestrator.service.ts` — ensure binary purge on ack preserves `conflict` status for badges
- [ ] 2.4 Write unit specs for image binary store metadata extension

## Phase 3: Animal Feature Services — Use Shared Status Mapper

- [ ] 3.1 Modify `animals.service.ts` — use `mapAnimalOfflineUiStatus()` for badge derivation
- [ ] 3.2 Modify `animals-images.service.ts` — use `mapAnimalMediaUiStatus()` for image badge
- [ ] 3.3 Modify animal event services — apply `mapAnimalOfflineUiStatus()` to snapshot `syncStatus`
- [ ] 3.4 Write integration specs: animal create/update offline → reconnect → badge `synced`

## Phase 4: UI — Header Connectivity and GANADERO Navigation

- [ ] 4.1 Modify `header.ts` — inject `OfflineStatusService`, add `isOnline` signal
- [ ] 4.2 Modify `header.html` — add offline indicator/banner
- [ ] 4.3 Modify `sidebar.ts` — remove `Sincronización`, `Backups`, `Conflictos` from `GANADERO_MENU_ITEMS`
- [ ] 4.4 Write component specs: `header.spec.ts`, `sidebar.spec.ts`

## Phase 5: Animal Pages — Row and Media Badges

- [ ] 5.1 Modify animal list component — render row badges from `mapAnimalOfflineUiStatus()`
- [ ] 5.2 Modify `animal-detail-page.component.ts` — render badge in detail header and photo thumbnails
- [ ] 5.3 Modify animal image card/thumbnail component — show `local_only`/`syncing`/`error` badges
- [ ] 5.4 Write component specs: animal list badges, detail badges, media card badges

## Phase 6: Routes — Guard GANADERO Sync/Backup/Conflict Routes

- [ ] 6.1 In `app.routes.ts` — add `canMatch` guard to `/ganadero/sincronizacion`, `/ganadero/backups`, `/ganadero/conflictos` redirecting GANADERO to dashboard
- [ ] 6.2 Write route guard spec

## Phase 7: Tests

- [ ] 7.1 Update all `*.spec.ts` for modified files
- [ ] 7.2 Run `ng test` — no production build required

## Implementation Order

1. Phase 1 (Types/Mapper) → 2 (Infrastructure) → 3 (Services) → 4 (Header/Sidebar) → 5 (Badges) → 6 (Routes) → 7 (Tests)

## Dependency Note

Does NOT depend on `animal-event-log-consolidation-v1`. Consumes existing event ledgers as-is.
