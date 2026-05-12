# Proposal: Animal Event Log Consolidation V1

## Intent

Unify duplicated ledgers (`animal_events`, `animal_health_events`, `animal_reproduction_events`) while the product is still in development. Goal: one future-proof event log for broad offline animal scope without losing general, health/vet, or reproduction semantics.

## Scope

### In Scope
- Unified animal event log table/entity/read model with `eventCategory` (`GENERAL`, `HEALTH`, `REPRODUCTION`) and event type discriminator.
- Preserve typed contracts, including `FIELD_VET_VISIT` lifecycle metadata.
- Development-time migration: reshape current rows, keep temporary compatibility adapters/views, then retire duplicate persistence paths.
- BE: entities, repositories, services, DTO/mappers, sync mapper/resource, vet projections, timeline queries/tests.
- FE: offline types/store, sync payloads, timeline adapters, detail/history screens.

### Out of Scope
- Herd lots/ledgers FE UI.
- Transparent offline UX implementation; handled by `animal-offline-architecture-v1`.
- DB read-model optimization unless required to preserve current queries.

## Capabilities

### New Capabilities
- `animal-event-log-consolidation-v1`: Unified event persistence/read contract with category + type discriminator and migration compatibility.

### Modified Capabilities
- `animal-event-ledger-v1`: General events move to category `GENERAL`.
- `animal-health-event-ledger-v1`: Health/vet visits move to `HEALTH` without weakening validation.
- `animal-reproduction-event-ledger-v1`: Reproduction moves to `REPRODUCTION` with append-only guarantees.
- `animal-event-offline-sync-v1`, `animal-health-offline-sync-v1`, `animal-reproduction-offline-sync-v1`: Payloads align to unified log while preserving idempotency.
- `field-vet-visit-workflow-v1`, `admin-veterinary-visits-v1`: Vet visit projections continue from the unified log.

## Approach

Design unified storage first, then slice TDD: schema/domain, migration compatibility, BE queries/sync, FE offline/timeline adapters. Keep API/domain DTOs expressive; do not expose raw persistence shape.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `hato-be/src/main/java/.../domain` | Modified | Bridge event entities to unified log model. |
| `hato-be/src/main/java/.../repository/service/web/rest` | Modified | Consolidate queries, writes, sync, vet projections. |
| `hato-be/src/main/resources/db/changelog` | Modified | Add migration and compatibility/drop strategy. |
| `hato-fe/src/app/core/offline` | Modified | Align entity types, snapshots, queued operations. |
| `hato-fe/src/app/features/admin/animals` | Modified | Timeline adapters and animal history/detail screens. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Active vet visit workflow regression | High | Slice first around `FIELD_VET_VISIT`; lock tests before migration. |
| Offline sync payload breakage | Med | Compatibility mapper and idempotency regression tests. |
| Over-broad refactor | Med | TDD slices and no UI/offline UX expansion in this change. |

## Rollback Plan

Pre-production rollback: revert the migration/code slice before dependent changes ship. Keep old adapters/views until tests prove equivalent reads and sync replay.

## Dependencies

- Existing animal event, health, reproduction, offline sync, and vet visit specs.
- Coordination with `animal-offline-architecture-v1` boundaries.

## Success Criteria

- [ ] One canonical event log supports `GENERAL`, `HEALTH`, and `REPRODUCTION` without duplicate persistence logic.
- [ ] Existing timelines, vet visit projections, and sync flows pass regression tests.
- [ ] Migration/compatibility path is documented and executable.
