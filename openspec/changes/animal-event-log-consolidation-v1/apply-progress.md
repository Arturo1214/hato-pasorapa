# Apply Progress: Animal Event Log Consolidation V1

**Change**: animal-event-log-consolidation-v1
**Mode**: Strict TDD
**Artifact store**: hybrid
**PR boundary**: PR 1 / Phase 1 `event-log-be-schema-health` + PR 2 / Phase 2 `event-log-be-general-repro-sync` + PR 3 / Phase 3 `event-log-fe-offline-migration` + Phase 3.5 migration finalization

## Completed Tasks

### PR 1 / Phase 1 `event-log-be-schema-health`

- [x] 1.1.1–1.6.2 completed in previous apply batches: unified BE schema/entity/repository, HEALTH/FIELD_VET_VISIT projection, compatibility adapters, migration row-count regression, vet-health regression lock.

### PR 2 / Phase 2 `event-log-be-general-repro-sync`

- [x] 2.1.1–2.5.2 completed in previous apply batch: GENERAL/REPRODUCTION mappers/services, canonical `ANIMAL_EVENT_LOG` sync mapper/service routing, global `operationId` idempotency, PR2 event/sync regression suite.

### PR 3 / Phase 3 `event-log-fe-offline-migration`

- [x] 3.1.1–3.4.3 completed in previous apply batch: FE unified `ANIMAL_EVENT_LOG` contract, v10→v11 offline migration, timeline adapters, animal detail local history via unified snapshots, vet visit offline/timeline regression protection.

### Phase 3.5 Migration Execution & Finalization

- [x] 3.5.1 Migration executes in `020-animal-event-log-consolidation-v1.yaml`, copying legacy general/health/reproduction rows into `animal_event_logs` with correct categories.
- [x] 3.5.2 Added temporary compatibility SQL views and RED/GREEN coverage proving view projections match category-filtered unified log projections.
- [x] 3.5.4 Vet visit workflow/offline regression coverage passed through the required FE scoped runner.
- [x] 3.5.5 Documented migration finalization and cleanup deferral in `CHANGELOG-migration.md`.

## Not Completed / Deferred

- [ ] 3.5.3 Full BE suite gate remains open: `./mvnw test` was attempted and failed outside the required bounded runner. Event-log-scoped sync regressions are fixed; `SyncResourceTest` now passes 28/28 after repairing missing ganadero auth profiles in its fixture; required FE scoped runner passed 251/251. Remaining observed full-suite failures are outside event-log consolidation scope (other ganadero auth fixtures, public registration rate-limit/validation, notification/admin access, observability/migration portability).
- [ ] Phase 4 cleanup deferred. Design allows cleanup only after regression tests prove equivalence and old duplicate paths are safe to remove; current code still references legacy repositories/entities/tables (`AnimalEventRepository`, `AnimalHealthEventRepository`, `AnimalReproductionEventRepository`) in services/reports/sync/dashboard paths.

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.x Phase 1 | Prior apply evidence | Unit/Integration/REST | ✅ captured in previous apply | ✅ prior RED cycles | ✅ vet-health suites passed | ✅ mapper/projection/regression cases | ✅ unified repo/mappers isolated |
| 2.x Phase 2 | Prior apply evidence | Unit/Integration | ✅ captured in previous apply | ✅ prior RED cycles | ✅ event/sync safety suites passed | ✅ category/idempotency cases | ✅ canonical sync routing isolated |
| 3.1–3.4 Phase 3 | Prior apply evidence | FE Unit/Integration-ish | ✅ 241/241 baseline in previous apply | ✅ compile/runtime REDs for missing unified FE contract/adapters | ✅ required FE suite 251/251 in previous apply | ✅ migration/adapters/vet visit chain/offline cases | ✅ shared adapter and migration helpers |
| 3.5.1 migration execution | `Migration020Test` | Liquibase integration | ✅ `Migration020Test` baseline 1/1 passed before changes | ✅ existing row-copy test already locks copy execution | ✅ `Migration020Test` passed 2/2 after view finalization | ✅ GENERAL + HEALTH + REPRODUCTION count assertions | ➖ no production refactor needed |
| 3.5.2 compatibility views | `Migration020Test` | Liquibase integration | ✅ `Migration020Test` baseline 1/1 passed before changes | ✅ new test failed because `animal_events_view` was missing | ✅ `Migration020Test` passed 2/2 after adding views | ✅ three category views compared to unified log projections | ✅ helper reads deterministic projection strings |
| 3.5.5 migration changelog | `CHANGELOG-migration.md` | Documentation | N/A (new doc) | ✅ doc task started after migration/view tests defined | ✅ migration test and required runners passed | ➖ Triangulation skipped: documentation-only task | ➖ no code refactor needed |
| 3.5.3 event-log sync triage | `SyncServiceTest`, `SyncResourceTest` | Service/REST | ✅ full BE reports inspected; event-log failures isolated from unrelated auth/rate-limit failures | ✅ existing typed pull tests failed because legacy pulls no longer read canonical `animal_event_logs`; FIELD_VET_VISIT REST fixture failed strict mapper validation | ✅ focused sync tests passed; event safety runner passed 107/107 | ✅ GENERAL + HEALTH + REPRODUCTION typed pulls plus FIELD_VET_VISIT metadata/idempotency | ✅ legacy pull mapping helpers keep response shape while reading canonical logs |
| 3.5.3 SyncResource fixture follow-up | `SyncResourceTest` | REST/Auth fixture | ✅ prior focused run showed only `GANADERO_PROFILE_NOT_FOUND` login failures | ✅ `SyncResourceTest` failed 26/28 for `ganadero-conflict` and `notif-a` missing ganadero profiles | ✅ `SyncResourceTest` passed 28/28 after seeding matching `ganaderos.email` profiles | ✅ conflict-owner and notification recipient ganadero logins covered | ✅ fixture-only helper overload keeps production auth unchanged |

## Tests Run

- `JAVA_HOME=$(/usr/libexec/java_home -v 21) ./mvnw -Dtest=Migration020Test test` — ✅ baseline 1/1 passed before changes.
- `JAVA_HOME=$(/usr/libexec/java_home -v 21) ./mvnw -Dtest=Migration020Test test` — ❌ RED: `animal_events_view` not found.
- `JAVA_HOME=$(/usr/libexec/java_home -v 21) ./mvnw -Dtest=Migration020Test test` — ✅ GREEN: 2/2 passed after adding compatibility views.
- `JAVA_HOME=$(/usr/libexec/java_home -v 21) ./mvnw -Dtest=AnimalHealthEventServiceTest,VetVisitResourceTest,AnimalHealthEventMapperTest,AnimalEventServiceTest,AnimalReproductionEventServiceTest,SyncServiceTest test` — ✅ required BE safety runner: 106/106 passed.
- `PATH="$HOME/.nvm/versions/node/v20.19.6/bin:$PATH" npm test -- --include src/app/core/offline --include src/app/features/admin/animals --include src/app/features/admin/vet-visits --watch=false` — ✅ required FE runner: 37 files / 251 tests passed.
- `JAVA_HOME=$(/usr/libexec/java_home -v 21) ./mvnw test` — ❌ full BE suite attempted: 334 tests, 15 failures outside the required bounded runner.
- `JAVA_HOME=$(/usr/libexec/java_home -v 21) ./mvnw -Dtest=SyncServiceTest#shouldPullAnimalEventItemsIncrementally+shouldPullAnimalHealthEventsOnFirstSyncWithoutCursor+shouldPullAnimalReproductionEventsOnFirstSyncWithoutCursor test` — ✅ 3/3 passed after canonical typed-pull test alignment.
- `JAVA_HOME=$(/usr/libexec/java_home -v 21) ./mvnw -Dtest=SyncResourceTest#shouldSyncFieldVetVisitOnlyOncePerOperationIdAndPullTypedMetadata test` — ✅ 1/1 passed after valid FIELD_VET_VISIT metadata fixture and canonical log assertion.
- `JAVA_HOME=$(/usr/libexec/java_home -v 21) ./mvnw -Dtest=SyncResourceTest test` — ❌ 26/28 passed; remaining 2 failures are login/profile setup failures (`GANADERO_PROFILE_NOT_FOUND`) unrelated to event-log consolidation.
- `JAVA_HOME=$(/usr/libexec/java_home -v 21) ./mvnw -Dtest=AnimalHealthEventServiceTest,VetVisitResourceTest,AnimalHealthEventMapperTest,AnimalEventServiceTest,AnimalReproductionEventServiceTest,SyncServiceTest,SyncResourceTest#shouldSyncFieldVetVisitOnlyOncePerOperationIdAndPullTypedMetadata test` — ✅ event consolidation safety runner: 107/107 passed.
- `JAVA_HOME=$(/usr/libexec/java_home -v 21) ./mvnw -Dtest=SyncResourceTest test` — ✅ 28/28 passed after fixture-only ganadero profile seeding for GANADERO login scenarios.
- `JAVA_HOME=$(/usr/libexec/java_home -v 21) ./mvnw test` — ❌ full BE suite attempted: 334 tests, 11 failures remain outside event-log consolidation (`OfflineConflictResolutionMigrationTest`, admin/notification ganadero auth fixtures, public ganadero registration rate-limit/validation).

## Deviations / Notes

- Compatibility is implemented as SQL views (`animal_events_view`, `animal_health_events_view`, `animal_reproduction_events_view`) over `animal_event_logs` to satisfy the migration compatibility requirement while legacy tables/repositories remain available until Phase 4 cleanup.
- Legacy sync pull entity types (`ANIMAL_EVENT`, `ANIMAL_HEALTH_EVENT`, `ANIMAL_REPRODUCTION_EVENT`) now read category-filtered canonical `animal_event_logs` and map back to their legacy pull shapes for compatibility.
- `FIELD_VET_VISIT` sync fixtures must include the strict visit metadata required by `AnimalHealthEventMapper` (`mode`, `status`, veterinarian, checklist, clinical note, protocol); incomplete compatibility payloads correctly classify as validation errors.
- GANADERO role login requires a matching `ganaderos.email` profile via `AuthService.resolveGanaderoId`; `SyncResourceTest` had two fixture-only missing profiles unrelated to event-log code.
- Phase 4 cleanup was not executed. Dropping old tables/views is not safe while service/report/sync/dashboard code still injects or queries legacy repositories and while the full BE suite is not green.
- No production build was run.

## Remaining Tasks

- [ ] 3.5.3 Resolve/triage full BE suite failures or re-run full suite from a clean baseline, then complete final full-suite gate.
- [ ] 4.1–4.4 Execute post-migration cleanup only after the full-suite gate is green and legacy repository/table references are removed safely.
