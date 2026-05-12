# Apply Progress: Animal Event Log Consolidation V1

**Change**: animal-event-log-consolidation-v1
**Mode**: Strict TDD
**Artifact store**: hybrid
**PR boundary**: PR 1 / Phase 1 `event-log-be-schema-health`

## Completed Tasks

- [x] 1.1.1 Create unified `animal_event_logs` changelog with health vet projection columns and indexes
- [x] 1.1.2 Register migration in `master.yaml`
- [x] 1.2.1 Create `AnimalEventCategory`
- [x] 1.2.2 Create `AnimalEventLog`
- [x] 1.2.3 Create `AnimalEventLogRepository`
- [x] 1.3.1–1.3.5 Add HEALTH mapper tests and mapping methods for legacy health events/requests ⇄ unified log
- [x] 1.4.1–1.4.5 Add unified vet visit projection queries and route vet list/chain through `AnimalEventLogRepository`
- [x] 1.1.3 Add dedicated `Migration020Test` row-count copy regression for GENERAL/HEALTH/REPRODUCTION rows
- [x] 1.5.1 Add dedicated `AnimalHealthEventCompatibilityView.java` transition adapter
- [x] 1.5.2 Dual-write health create path to legacy and unified repositories
- [x] 1.5.3 Vet visit and health resource regression tests pass
- [x] 1.6.1 Run wildcard vet-health regression suite
- [x] 1.6.2 FIELD_VET_VISIT lifecycle/list/chain scenarios remain green in regression runner

## Not Completed in PR 1 Slice

- None — PR 1 / Phase 1 `event-log-be-schema-health` is complete.

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1–1.2 schema/entity/repository | `AnimalHealthEventServiceTest` | Integration | ✅ 43/43 baseline | ✅ compile-fail RED for missing `AnimalEventLogRepository`/entity | ✅ required runner passed 48/48 | ✅ latest visit + child ordering cases | ✅ repository projection isolated |
| 1.3 HEALTH mapper | `AnimalHealthEventMapperTest` | Unit | ✅ 43/43 baseline | ✅ compile-fail RED for missing mapper methods/types | ✅ mapper/service subset passed 43/43 | ✅ entity→log, request→log, log→DTO cases | ✅ projection extraction centralized in mapper |
| 1.4 vet projection/service delegation | `AnimalHealthEventServiceTest`, `VetVisitResourceTest` | Integration/REST | ✅ 43/43 baseline | ✅ repository projection tests written before repository implementation | ✅ required runner passed 48/48 | ✅ latest-row and parent-child chain cases | ✅ service reuses existing DTO grouping via log→health adapter |
| 1.5 compatibility regression | `VetVisitResourceTest`, `AnimalHealthEventResourceTest` | REST | ✅ 43/43 baseline | ✅ existing tests failed until seeded unified projection and service delegation were aligned | ✅ `AnimalHealthEventResourceTest` passed 4/4 | ✅ list + chain + health endpoint regressions | ➖ none needed |
| 1.1.3 migration row-copy regression | `Migration020Test` | Integration/Liquibase | ✅ required runner green before new migration test | ✅ test failed before isolated migration execution existed | ✅ `Migration020Test` passed 1/1 | ✅ GENERAL + HEALTH + REPRODUCTION count assertions | ✅ isolated H2 migration harness keeps scope focused |
| 1.5.1 compatibility view adapter | `AnimalHealthEventServiceTest` | Integration/Service | ✅ `Migration020Test,AnimalHealthEventServiceTest` RED/GREEN cycle used for affected service scope | ✅ compile-fail RED for missing `AnimalHealthEventCompatibilityView` | ✅ `Migration020Test,AnimalHealthEventServiceTest` passed 21/21 | ✅ visit id + parent visit id transition-read cases | ➖ minimal adapter only |
| 1.6.1 vet-health regression lock | `*VetVisit*`, `*AnimalHealthEvent*` | Integration/REST/Unit | ✅ required runner passed | ✅ regression runner required by task before marking complete | ✅ wildcard runner passed 54/54 | ✅ service + mapper + resource + liquibase migration classes included | ➖ no code refactor |

## Tests Run

- `JAVA_HOME=$(/usr/libexec/java_home -v 21) ./mvnw -Dtest=Migration020Test,AnimalHealthEventServiceTest test` — ✅ 21 tests passed
- `JAVA_HOME=$(/usr/libexec/java_home -v 21) ./mvnw -Dtest=AnimalHealthEventServiceTest,VetVisitResourceTest,AnimalHealthEventMapperTest test` — ✅ 49 tests passed
- `JAVA_HOME=$(/usr/libexec/java_home -v 21) ./mvnw -Dtest=AnimalHealthEventResourceTest test` — ✅ 4 tests passed
- `JAVA_HOME=$(/usr/libexec/java_home -v 21) ./mvnw -Dquarkus.profile=test -Dtest="*VetVisit*,*AnimalHealthEvent*" test` — ✅ 54 tests passed

## Deviations / Notes

- `metadata_json` uses `CLOB` to match existing H2/PostgreSQL-compatible project changelog/entity pattern; the logical contract still stores serialized metadata and keeps projection columns queryable.
- Repository projection RED tests were added to `AnimalHealthEventServiceTest` instead of a new `VetVisitProjectionTest` so the injected required runner executes them.
- `Migration020Test` applies only `020-animal-event-log-consolidation-v1.yaml` against isolated H2 legacy tables to verify copy-count behavior without coupling to the full Liquibase master prerequisite graph.
- `AnimalHealthEventCompatibilityView` is intentionally small and delegates transition reads to `AnimalHealthEventRepository`; unified-log reads remain in `AnimalEventLogRepository`.
