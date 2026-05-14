# Design: Animal Event Legacy Cleanup V1

## Technical Approach

Finish the deferred Phase 4 from archived `animal-event-log-consolidation-v1`: remove legacy event persistence after proving every runtime boundary uses canonical `animal_event_logs`. The cleanup is not a behavior rewrite. REST resources, DTOs, FE timeline contracts, and sync compatibility stay stable; only duplicate entities/repositories/tables/views are removed or converted to safe no-ops where historical Liquibase ordering requires it.

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|---|---|---|---|
| Reference detection | Use compile-time search + focused tests before deletion: imports, injections, `@Table`, changelog SQL, FE entity types, specs/tests | Drop DB first and fix failures | Safer: code still injects `AnimalEventRepository`, `AnimalHealthEventRepository`, `AnimalReproductionEventRepository` today. |
| Canonical persistence | Keep only `AnimalEventLog` + `AnimalEventLogRepository` for event storage/querying | Keep compatibility repositories backed by views | The archived change already established unified storage; views/repositories now only extend migration risk. |
| API compatibility | Preserve typed REST DTOs/mappers and legacy sync entity-type acceptance, but route to `ANIMAL_EVENT_LOG` only | Force clients to send only canonical entity type immediately | API/offline compatibility belongs at mapper/sync boundary, not in legacy tables. |
| Liquibase cleanup | Add a new cleanup changelog that drops views first, then old tables with preconditions; do not edit applied `005/006/007/020` except if a dev reset intentionally squashes history | Rewrite old changelogs to no-op | Keeping history preserves reproducibility; a later dev-only squash can simplify once team accepts DB reset. |

## Data Flow

    REST DTO / legacy sync payload
        → category mapper compatibility
        → AnimalEventLogRepository
        → animal_event_logs
        → typed API response / FE timeline adapter

No runtime path should query `animal_events`, `animal_health_events`, `animal_reproduction_events`, or `*_view`.

## File Changes

| File | Action | Description |
|---|---|---|
| `hato-be/src/main/java/bo/pasorapa/hato/domain/AnimalEvent.java` | Delete | Remove legacy `animal_events` entity after mapper/service conversions no longer need it as intermediate DTO-like object. |
| `hato-be/src/main/java/bo/pasorapa/hato/domain/AnimalHealthEvent.java` | Delete/replace usage | Remove legacy table entity; keep API DTO/mapper projections from `AnimalEventLog`. |
| `hato-be/src/main/java/bo/pasorapa/hato/domain/AnimalReproductionEvent.java` | Delete/replace usage | Same for reproduction. |
| `hato-be/src/main/java/bo/pasorapa/hato/repository/AnimalEventRepository.java`, `AnimalHealthEventRepository.java`, `AnimalReproductionEventRepository.java` | Delete | Move remaining dashboard/report/vet queries to `AnimalEventLogRepository`. |
| `AnimalEventService.java`, `AnimalHealthEventService.java`, `AnimalReproductionEventService.java`, `AnimalService.java`, `GanaderoDashboardService.java`, `AdminReportsService.java`, `SyncService.java` | Modify | Remove legacy injections/imports; map all event reads/writes through canonical log. |
| `SyncPayloadMapper.java`, `SyncEntityType.java` | Modify | Keep legacy entity enum values accepted for push/pull compatibility; canonicalize payloads without legacy repositories. |
| `hato-be/src/main/resources/db/changelog/021-animal-event-legacy-cleanup-v1.yaml`, `master.yaml` | Create/modify | Drop `animal_events_view`, `animal_health_events_view`, `animal_reproduction_events_view`, then `animal_events`, `animal_health_events`, `animal_reproduction_events`. |
| FE offline/timeline specs under `hato-fe/src/app/...` | Modify | Remove assumptions that legacy snapshots are pulled from legacy BE persistence; keep local migration compatibility as needed. |

## Interfaces / Contracts

REST contracts stay typed. Sync accepts `ANIMAL_EVENT`, `ANIMAL_HEALTH_EVENT`, and `ANIMAL_REPRODUCTION_EVENT` as compatibility input/output aliases only if existing FE tests require them; internally they resolve to `ANIMAL_EVENT_LOG` category filters. No DTO exposes JPA entities.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Static/compile | No references to deleted entities/repos/tables/views | Search before/after; Maven compile via test run. |
| BE integration | Event REST, sync push/pull, dashboard/report, vet visit chain/timeline | Full `./mvnw test -Dquarkus.profile=test`; focused `*Sync*,*VetVisit*,*AnimalEvent*,*AnimalHealthEvent*,*AnimalReproductionEvent*`. |
| FE unit | Offline migrations, sync orchestrator, timeline adapters, vet timeline | Full `npm test -- --watch=false`; focused event/sync/timeline specs. |

## Migration / Rollout

This is dev-stage destructive cleanup. `021` should use Liquibase preconditions (`viewExists`, `tableExists`) with `onFail: MARK_RAN` to make fresh/test DBs resilient. Rollback notes: recreate views over `animal_event_logs`; table rollback is not data-restoring unless backup/export exists, because source rows already live canonically in `animal_event_logs`.

Safe slicing: 1) remove BE code references while views/tables still exist, 2) FE/spec cleanup, 3) Liquibase drops, 4) full BE+FE verification. Do not drop DB objects before code is green.

## Open Questions

- None.
