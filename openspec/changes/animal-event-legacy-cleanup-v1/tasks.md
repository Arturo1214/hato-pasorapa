# Tasks: Animal Event Legacy Cleanup V1

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 800–1100 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 |
| Delivery strategy | user approved chained implementation |
| Chain strategy | stacked-to-main |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Remove BE code references (services, compatibility view, imports) while tests stay green | PR 1 | Base = main; includes refactored services + tests; no DB changes |
| 2 | Remove legacy repositories and nested VetVisitQuery dependency from AnimalEventLogRepository | PR 2 | Base = PR 1 branch; deletes repo files; inline VetVisitQuery into AnimalEventLogRepository |
| 3 | Liquibase cleanup + final regression verification | PR 3 | Base = PR 2 branch; adds 021 cleanup migration; full BE+FE test gate |

---

## Phase 1: Remove Code References (PR 1)

### 1.1 Remove `AnimalHealthEventCompatibilityView`

- [x] 1.1.1 Delete `hato-be/src/main/java/bo/pasorapa/hato/service/AnimalHealthEventCompatibilityView.java`
- [x] 1.1.2 Remove `@Inject AnimalHealthEventCompatibilityView` from `AnimalHealthEventService` and `GanaderoDashboardService` — verify all `findByVisitId` / `findByParentVisitId` calls are replaced with `AnimalEventLogRepository.findByVisitIdRoot` / `findByParentVisitId`
- [x] 1.1.3 Compile: `./mvnw -DskipTests compile` — must pass before proceed

### 1.2 Remove Legacy Repo Injections from Services

- [x] 1.2.1 `AnimalEventService`: Remove `AnimalEventRepository` field and constructor param; ensure all queries route through `AnimalEventLogRepository`
- [x] 1.2.2 `AnimalHealthEventService`: Remove `AnimalHealthEventRepository` field and constructor param; verify `list()`, `getVisitChainDetail`, `toPullItem` all route via `AnimalEventLogRepository`
- [x] 1.2.3 `AnimalReproductionEventService`: Remove `AnimalReproductionEventRepository` field and constructor param; verify `list()`, `toPullItem` route via `AnimalEventLogRepository`
- [x] 1.2.4 `AnimalService`: Remove `AnimalEventRepository` field and constructor param
- [x] 1.2.5 `GanaderoDashboardService`: Remove `AnimalEventRepository` and `AnimalHealthEventRepository` field/params
- [x] 1.2.6 `AdminReportsService`: Remove `AnimalHealthEventRepository` field and constructor param

### 1.3 Update SyncService

- [x] 1.3.1 `SyncService.java`: Remove `AnimalEventRepository`, `AnimalHealthEventRepository`, `AnimalReproductionEventRepository` field declarations and constructor params
- [x] 1.3.2 Verify all sync push/pull paths for events route via `AnimalEventLogRepository` — no fallback to legacy repos
- [x] 1.3.3 Compile: `./mvnw -DskipTests compile` — must pass

### 1.4 Update SyncServiceTest

- [x] 1.4.1 `SyncServiceTest.java`: Remove imports for `AnimalEventRepository`, `AnimalHealthEventRepository`, `AnimalReproductionEventRepository`
- [x] 1.4.2 Remove any test setup that creates instances of legacy repositories; mock `AnimalEventLogRepository` instead
- [x] 1.4.3 Compile + run: `./mvnw test -Dtest=SyncServiceTest` — must pass

### 1.5 VetVisitQuery Dependency Handling

- [x] 1.5.1 `AnimalEventLogRepository.findFieldVetVisitsByOwner` currently takes `AnimalHealthEventRepository.VetVisitQuery` as parameter (line 173) — this creates a hard compile-time dependency preventing legacy repo deletion
- [x] 1.5.2 Move `VetVisitQuery` record from `AnimalHealthEventRepository` into `AnimalEventLogRepository` as a nested static interface or record
- [x] 1.5.3 Update all callers of `findFieldVetVisitsByOwner` to use the moved type
- [x] 1.5.4 Compile: `./mvnw -DskipTests compile` — must pass

### 1.6 Run Affected Tests

- [x] 1.6.1 Run: `./mvnw test -Dtest=AnimalEventServiceTest,AnimalHealthEventServiceTest,AnimalReproductionEventServiceTest,SyncServiceTest` — all must pass

---

## Phase 2: Delete Legacy Repositories and Entities (PR 2)

### 2.1 Delete Legacy Repository Files

- [x] 2.1.1 Delete `hato-be/src/main/java/bo/pasorapa/hato/repository/AnimalEventRepository.java`
- [x] 2.1.2 Delete `hato-be/src/main/java/bo/pasorapa/hato/repository/AnimalHealthEventRepository.java`
- [x] 2.1.3 Delete `hato-be/src/main/java/bo/pasorapa/hato/repository/AnimalReproductionEventRepository.java`

### 2.2 Delete Legacy JPA Entity Files

- [x] 2.2.1 Delete `hato-be/src/main/java/bo/pasorapa/hato/domain/AnimalEvent.java`
- [x] 2.2.2 Delete `hato-be/src/main/java/bo/pasorapa/hato/domain/AnimalHealthEvent.java`
- [x] 2.2.3 Delete `hato-be/src/main/java/bo/pasorapa/hato/domain/AnimalReproductionEvent.java`

### 2.3 Compile Verification

- [x] 2.3.1 Compile: `./mvnw -DskipTests compile` — must pass with zero references to deleted classes
- [x] 2.3.2 Run full test suite: `./mvnw test` — all must pass

---

## Phase 3: Liquibase Cleanup Migration (PR 3)

### 3.1 Author Cleanup Migration

- [x] 3.1.1 Create `hato-be/src/main/resources/db/changelog/021-animal-event-legacy-cleanup-v1.yaml`
- [x] 3.1.2 Drop views first with `onFail: MARK_RAN`: `animal_events_view`, `animal_health_events_view`, `animal_reproduction_events_view`
- [x] 3.1.3 Add precondition `tableExists` for each legacy table; drop `animal_events`, `animal_health_events`, `animal_reproduction_events` with `onFail: MARK_RAN`
- [x] 3.1.4 Add to `master.yaml` include entry for `021-animal-event-legacy-cleanup-v1.yaml`

### 3.2 Migration Verification

- [ ] 3.2.1 Run Liquibase in dev: `./mvnw quarkus:dev` — allow migration to apply; verify no runtime errors
- [x] 3.2.2 Confirm `animal_event_logs` data intact; old tables/views absent from schema

---

## Phase 4: Full Regression and Archive

### 4.1 Backend Full Regression

- [x] 4.1.1 Run: `./mvnw test` — full BE test suite, all must pass
- [x] 4.1.2 Focus: event REST tests, vet visit chain/timeline, sync push/pull, dashboard/report

### 4.2 Frontend Verification

- [x] 4.2.1 Run: `cd hato-fe && npm test -- --watch=false` — all FE tests must pass
- [x] 4.2.2 Focus: offline sync, animal timeline, vet visit UI

### 4.3 Archive

- [ ] 4.3.1 Persist final tasks artifact to Engram `sdd/animal-event-legacy-cleanup-v1/tasks`
- [ ] 4.3.2 Update OpenSpec `tasks.md` with final state

---

## Dependency Order

1. Phase 1 (PR 1): Remove code references and compatibility view — this unblocks the repo deletion
2. Phase 2 (PR 2): Delete legacy repo/entity files — can only happen after Phase 1 compiles green
3. Phase 3 (PR 3): Liquibase cleanup migration — only after both PRs show no runtime references
4. Phase 4: Final regression and archive — gate for merge to main

## Safety Gates

- PR 1 must compile + pass affected tests before PR 2 starts
- PR 2 must pass full test suite before PR 3 migration runs
- Do not drop DB objects before code is green
- Vet visit chain and sync offline must remain non-regressive throughout
