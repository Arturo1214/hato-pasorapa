# Design: Animal Event Log Consolidation V1

## Technical Approach

Create one canonical `animal_event_logs` persistence model and keep existing REST DTO contracts as typed façades. The BE remains layered (`Resource → Service → Repository/Domain`): existing event services delegate to a shared repository/model through category-aware mappers, while resources keep their current URLs. The FE keeps `animal-offline-architecture-v1` mechanics (outbox, snapshots, checkpoints) and only changes the animal-event entity contract/adapters.

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|---|---|---|---|
| Canonical table | New `animal_event_logs` with `event_category`, `event_type`, common columns, `metadata_json`, `operation_id unique` | Reuse `animal_events`; keep three tables plus union view | Avoids privileged “general” table and gives sync one cursor/id space. |
| Typed API boundaries | Preserve existing request/response DTOs and mapper names, backed by unified log | Expose raw unified DTO everywhere | Prevents category leakage into UI/API and protects validation semantics. |
| Compatibility | Dev migration copies rows then old tables become temporary compatibility views/adapters until tests pass | Big-bang delete old paths | Safer while product is dev-stage; rollback is revertible before production data. |
| Vet visits | Project `FIELD_VET_VISIT` from `HEALTH` rows using persisted metadata plus optional queryable lifecycle columns | Continue CLOB-only filtering | Current grouping scans metadata; unified log should add indexes/projection fields for visit list/chain. |

## Data Flow

    REST DTO / Sync payload
        → category mapper validates typed fields
        → AnimalEventLogService
        → AnimalEventLogRepository
        → animal_event_logs
        → category mapper / timeline adapter / vet projection

## File Changes

| File | Action | Description |
|---|---|---|
| `hato-be/src/main/java/bo/pasorapa/hato/domain/AnimalEventLog.java` | Create | Unified entity: `eventId`, `animal`, `eventCategory`, `eventType`, timestamps, actor/source, `operationId`, metadata, vet projection columns. |
| `hato-be/src/main/java/bo/pasorapa/hato/domain/enumeration/AnimalEventCategory.java` | Create | `GENERAL`, `HEALTH`, `REPRODUCTION`. |
| `hato-be/src/main/java/bo/pasorapa/hato/repository/AnimalEventLogRepository.java` | Create | Panache queries for history, sync cursor, vet visit lookup/chain, projections. |
| `AnimalEvent*`, `AnimalHealthEvent*`, `AnimalReproductionEvent*` service/mapper/resource files | Modify | Keep DTO contracts, route all writes/reads through unified service/repository. |
| `SyncService.java`, `SyncPayloadMapper.java`, `SyncEntityType.java` | Modify | Support canonical `ANIMAL_EVENT_LOG` while accepting legacy three entity types during transition. |
| `hato-be/src/main/resources/db/changelog/020-animal-event-log-consolidation-v1.yaml` and `master.yaml` | Create/Modify | Create table/indexes, copy three existing tables, add compatibility/drop notes. |
| `hato-fe/src/app/core/offline/offline-types.ts`, store migrations/specs | Modify | Add `ANIMAL_EVENT_LOG`, unified payload/snapshot types, migrate old snapshot keys/checkpoints. |
| `hato-fe/src/app/features/admin/animals/data-access/*timeline.adapter.ts` | Modify | Convert unified log snapshots to category-specific timeline items. |

## Interfaces / Contracts

BE persistence contract: `eventCategory` selects validation namespace; `eventType` stores the concrete enum name. For `HEALTH/FIELD_VET_VISIT`, persist derived nullable columns: `visit_id`, `parent_visit_id`, `visit_status`, `protocol_status`, `next_due_at` to support list and chain without CLOB scans.

FE offline contract: `ANIMAL_EVENT_LOG` snapshots include `{ id, animalUuid, eventCategory, eventType, occurredAt, performedByUserId, sourceChannel, operationId, metadata, createdAt, updatedAt }`. Legacy `ANIMAL_EVENT`, `ANIMAL_HEALTH_EVENT`, and `ANIMAL_REPRODUCTION_EVENT` remain accepted only as compatibility inputs until migrated.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| BE unit | category mappers, vet lifecycle, migration row mapping | RED tests first for one category at a time. |
| BE integration | REST endpoints, sync push/pull idempotency, vet list/chain | `quarkus-junit5` + `rest-assured`; lock existing endpoint behavior. |
| FE unit | offline type migration, store snapshots/checkpoints, timeline adapters | Update colocated `*.spec.ts`; no UX expansion. |

## Migration / Rollout

Dev-stage migration: create unified table, copy `animal_events` as `GENERAL`, `animal_health_events` as `HEALTH`, `animal_reproduction_events` as `REPRODUCTION`, preserving IDs/operation IDs/timestamps. Add indexes on `(animal_uuid, occurred_at, event_id)`, `(event_category, event_type, updated_at, event_id)`, `(operation_id)`, and vet columns. Keep old entities as compatibility mappers/views for one slice, then remove duplicate persistence paths after regression tests.

Risk slices: 1) schema/entity/repository, 2) health + `FIELD_VET_VISIT` projection/chain, 3) general/reproduction services, 4) sync mapper, 5) FE offline migration/adapters. `animal-offline-architecture-v1` owns offline UX/orchestration; this change only changes entity contracts and migration adapters.

## Open Questions

- None.
