# Proposal: Animal Offline Architecture V1

## Intent

Make animal work resilient and transparent for GANADERO users: animal data, history, and photos must work offline and sync after reconnect. Keep browser-first IndexedDB (`hato-offline`); no SQLite/native wrapper now.

## Scope

### In Scope
- Offline animal profile CRUD with snapshots, pending updates, conflict markers, and replay.
- Offline animal photos/media via IndexedDB records plus blob storage.
- Animal history: general events, health/vet visits, reproduction events.
- Transparent sync UX: hide GANADERO backup/sync/conflict routes; keep admin/support tools if useful.
- Header online/offline indicator and row/card/media `pending`, `conflict`, `synced`, local-only badges.
- Background sync: replay outbox on reconnect, preserve idempotency, show conflicts inline.

### Out of Scope
- Event-table DB consolidation; create a separate SDD later.
- Lot/herd ledger FE UI/backend expansion unless business requires it.
- Native wrapper, browser SQLite, OPFS/SQLite WASM, or replacing `hato-offline`.

## Capabilities

### New Capabilities
- `animal-offline-transparent-ux-v1`: Connectivity header and GANADERO-safe sync badges.
- `animal-profile-offline-ux-v1`: Offline profile CRUD behavior where no main spec exists.

### Modified Capabilities
- `animal-event-offline-sync-v1`: Transparent replay and inline conflict visibility.
- `animal-image-ledger-v1`: Local blob/photo persistence and local-only media badges.
- `animal-health-event-ledger-v1`: Health/vet history available offline in animal context.
- `animal-reproduction-event-ledger-v1`: Reproduction history participates in animal offline UX.
- `offline-conflict-resolution-v2`: Resolution remains support/admin; GANADERO sees status only.
- `offline-backup-local-continuity-v1`: Backup UX hidden from GANADERO navigation.

## Approach

Use Angular feature architecture and `core/offline`. Keep IndexedDB stores (`outbox`, `inbox`, `snapshots`, `sync_state`) for state and the image binary store for blobs. Sync stays operation/outbox based through `/sync`; conflicts attach metadata and render as badges. Header observes connectivity; GANADERO navigation omits manual sync/backup/conflict entries.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `hato-fe/src/app/core/offline/` | Modified | Store, status, blobs, sync |
| `hato-fe/src/app/features/admin/animals/` | Modified | Animal offline UX |
| `hato-fe/src/app/features/ganadero/` | Modified | Header/navigation status |
| `openspec/specs/*offline*` | Modified | Sync/conflict/backup deltas |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Media storage pressure | Med | Track size/checksum and local-only/error states |
| Hidden sync tools reduce supportability | Med | Keep support observability |
| Fragmented event ledgers persist | Med | Separate consolidation SDD |

## Rollback Plan

Restore previous GANADERO routes/menus and disable badges; keep IndexedDB intact so queued operations continue through current sync.

## Dependencies

- `hato-offline` IndexedDB foundation and `/sync` idempotency contracts.
- Later SDD for event-table consolidation.

## Success Criteria

- [ ] GANADERO can create/edit animals, add photos, and view animal history offline.
- [ ] Connectivity appears in the header; record/media sync state appears inline.
- [ ] Manual sync/backup/conflict menus are absent from GANADERO UX.
- [ ] Pending operations sync after reconnect without duplicates.
