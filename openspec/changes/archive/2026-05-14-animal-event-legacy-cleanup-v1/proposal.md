# Proposal: Animal Event Legacy Cleanup V1

## Intent

Safely remove legacy event persistence left after `animal-event-log-consolidation-v1`. `animal_event_logs` is now source of truth; old tables/entities/repos/views must disappear without regressing vet visits, offline sync, timelines, or general/health/reproduction behavior.

## Scope

### In Scope
- Remove DB objects for `animal_events`, `animal_health_events`, `animal_reproduction_events`, and compatibility views after proving they are no longer queried.
- Remove stale Java entities/repositories/view helpers and obsolete old-table tests.
- Update tests so APIs and sync prove unified-log behavior only.
- Add safety checks for vet visit workflow, offline push/pull, animal timeline, and category isolation.

### Out of Scope
- No API contract redesign or DTO rename.
- No changes to categories, metadata schemas, vet lifecycle, or sync conflict semantics.
- No frontend UX redesign; only test/adapter adjustments if stale assumptions exist.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
None — behavior contracts stay unchanged; this removes obsolete implementation/storage.

## Approach

Create a forward Liquibase cleanup changeset dropping views first, then legacy indexes/constraints/tables with preconditions. Remove backend classes mapped to old tables; keep services on `AnimalEventLogRepository` and REST DTOs unchanged. Replace legacy assertions with unified-log regressions.

## Safety Gates

- No service/repository query depends on old tables/views.
- Regression tests cover event resources, `VetVisitResource`, and offline sync.
- Migration proves old objects absent while `animal_event_logs` data remains.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `hato-be/src/main/resources/db/changelog/` | Modified | Cleanup changeset/master include; remove stale index dependency if needed. |
| `hato-be/src/main/java/bo/pasorapa/hato/domain/*Event.java` | Removed | Legacy table entities only. |
| `hato-be/src/main/java/bo/pasorapa/hato/repository/*EventRepository.java` | Removed/Modified | Drop legacy repositories; keep unified log repository. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/` | Modified | Remove compatibility view/support. |
| `hato-be/src/test/java/bo/pasorapa/hato/` | Modified | Replace legacy-table tests with unified-log regressions. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Hidden stale query references old tables | Medium | Static cleanup plus endpoint/offline regressions. |
| Destructive migration drops unmigrated data | Low | Require post-consolidation prerequisite and `animal_event_logs` data checks. |
| Vet visit metadata projection regresses | Medium | Dedicated vet visit workflow tests before cleanup acceptance. |

## Rollback Plan

Revert code and cleanup changeset before release. If applied, restore DB backup or recreate legacy tables/views from `animal_event_logs`, then redeploy previous build.

## Dependencies

- `animal-event-log-consolidation-v1` archived with PASS verification.
- Unified event ledger/offline sync specs remain source of truth.

## Success Criteria

- [ ] No production code references legacy tables, entities, repositories, or views.
- [ ] Cleanup migration leaves `animal_event_logs` intact and old DB objects absent.
- [ ] General, health, reproduction, vet visit, animal timeline, and offline sync tests pass against unified log only.
