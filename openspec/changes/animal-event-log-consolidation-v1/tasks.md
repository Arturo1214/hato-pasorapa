# Tasks: Animal Event Log Consolidation V1

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 700–1000 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Schema + Health/FIELD_VET_VISIT projection + vet visit regression | PR 1: `event-log-be-schema-health` | Target `main`; BE unit + REST-assured; vet visit regression tests locked |
| 2 | General + Reproduction services + Sync mapper | PR 2: `event-log-be-general-repro-sync` | Target PR 1; BE unit tests per category |
| 3 | FE offline migration + timeline adapters + regression coverage | PR 3: `event-log-fe-offline-migration` | Target PR 2; FE specs + vet visit regression |

---

## Phase 1: BE Schema + Entity + Repository + Health/Vet Projection (PR 1)

### 1.1 Schema & Migration
- [x] 1.1.1 Create `hato-be/src/main/resources/db/changelog/020-animal-event-log-consolidation-v1.yaml` with `animal_event_logs` table: `event_id` (UUID PK), `animal_uuid` (FK nullable), `event_category` (`GENERAL`, `HEALTH`, `REPRODUCTION`), `event_type` (varchar), `occurred_at`, `performed_by_user_id`, `source_channel`, `operation_id` (unique), `metadata_json` (jsonb), `created_at`, `updated_at`; add indexes on `(animal_uuid, occurred_at, event_id)`, `(event_category, event_type, updated_at, event_id)`, `(operation_id)`; add vet projection columns nullable: `visit_id`, `parent_visit_id`, `visit_status`, `protocol_status`, `next_due_at`
- [x] 1.1.2 Register migration in `master.yaml`
- [x] 1.1.3 Write `Migration020Test`: copy rows from `animal_events` → `GENERAL`, `animal_health_events` → `HEALTH`, `animal_reproduction_events` → `REPRODUCTION`; verify counts match

### 1.2 Domain Entity & Enum
- [x] 1.2.1 Create `AnimalEventCategory.java` enum: `GENERAL`, `HEALTH`, `REPRODUCTION`
- [x] 1.2.2 Create `AnimalEventLog.java` entity with all columns from 1.1.1 including vet projection columns
- [x] 1.2.3 Create `AnimalEventLogRepository.java` extending `PanacheRepositoryBase<AnimalEventLog, UUID>` with: `findByAnimalUuidOrderByOccurredAtDesc(animalUuid)`, `findByEventCategory(eventCategory, Pageable)`, `findByOperationId(operationId)`, `findVetVisitsByAnimal(animalUuid, estado, modo, veterinarianId, from, to, Pageable)` — vet projection columns as projection interface

### 1.3 Category Mapper (HEALTH) — TDD RED first
- [x] 1.3.1 Write failing `AnimalHealthEventMapperTest`: `toAnimalEventLog(entity) → eventCategory=HEALTH, eventType preserved, metadata preserved`
- [x] 1.3.2 Write failing `AnimalHealthEventMapperTest`: `toAnimalEventLog(dto) → valid row; invalid category-type pair throws IllegalArgumentException`
- [x] 1.3.3 Implement `AnimalHealthEventMapper` mapping health events to unified log with `eventCategory=HEALTH`; reject cross-category types
- [x] 1.3.4 Write failing test: `toAnimalHealthEventDto(log) → FIELD_VET_VISIT metadata blocks preserved verbatim including visit/checklist/clinicalNote/protocol/cost/treatmentPlan/cancelReason`
- [x] 1.3.5 Implement `toAnimalHealthEventDto` from `AnimalEventLog` for `HEALTH` rows

### 1.4 Vet Visit Projection (from unified log)
- [x] 1.4.1 Write failing `VetVisitProjectionTest`: `findByVisitIdRoot(visitId)` returns latest event per `visitId` from `animal_event_logs` where `event_category=HEALTH` and `event_type=FIELD_VET_VISIT`
- [x] 1.4.2 Write failing test: chain query `findByParentVisitId(parentVisitId)` returns children ordered by `occurredAt`
- [x] 1.4.3 Implement vet visit projection methods in `AnimalEventLogRepository`
- [x] 1.4.4 Modify `AnimalHealthEventService` to delegate to `AnimalEventLogRepository` for vet list/chain queries
- [x] 1.4.5 Add service method `getVisitChain(visitId)` returning parent + children with `visitId` dedup

### 1.5 Compatibility Adapters (old tables → unified log)
- [x] 1.5.1 Create `AnimalHealthEventCompatibilityView.java`: temporary adapter that reads from `animal_health_events` while writing goes to unified log; used only during transition
- [x] 1.5.2 Add `AnimalHealthEventService` write path now persists to `AnimalEventLogRepository` AND keeps compatibility view for reads
- [x] 1.5.3 Verify: `./mvnw test -Dquarkus.profile=test` — existing `VetVisitResourceTest` + `AnimalHealthEventResourceTest` pass

### 1.6 Vet Visit Regression Lock
- [x] 1.6.1 Run full BE test suite; confirm all vet-visit tests pass: `./mvnw test -Dquarkus.profile=test -Dtest="*VetVisit*,*AnimalHealthEvent*"`
- [x] 1.6.2 Confirm `FIELD_VET_VISIT` lifecycle scenarios from `field-vet-visit-workflow-v1/spec.md` still pass

---

## Phase 2: General + Reproduction Services + Sync Mapper (PR 2)

### 2.1 Category Mapper — GENERAL (TDD RED first)
- [x] 2.1.1 Write failing `AnimalEventMapperTest`: `toAnimalEventLog(entity) → eventCategory=GENERAL, eventType=SOLD/DECEASED/LOST/TRANSFERRED/OBSERVATION`
- [x] 2.1.2 Write failing test: invalid category-type pair `GENERAL + VACCINATION` throws `IllegalArgumentException`
- [x] 2.1.3 Implement `AnimalEventMapper` mapping general events to unified log; reject cross-category types
- [x] 2.1.4 Write failing test: `toAnimalEventDto(log) → general event DTO with audit fields preserved`
- [x] 2.1.5 Implement `toAnimalEventDto` from `AnimalEventLog` for `GENERAL` rows

### 2.2 Category Mapper — REPRODUCTION (TDD RED first)
- [x] 2.2.1 Write failing `AnimalReproductionEventMapperTest`: `toAnimalEventLog(entity) → eventCategory=REPRODUCTION, eventType=SERVICE/PREGNANCY_CONFIRMED/PREGNANCY_LOSS/BIRTH`
- [x] 2.2.2 Write failing test: invalid category-type pair `REPRODUCTION + SOLD` throws `IllegalArgumentException`
- [x] 2.2.3 Implement `AnimalReproductionEventMapper` mapping reproduction events to unified log
- [x] 2.2.4 Write failing test: `toAnimalReproductionEventDto(log) → reproduction metadata schema unchanged`
- [x] 2.2.5 Implement `toAnimalReproductionEventDto` from `AnimalEventLog` for `REPRODUCTION` rows

### 2.3 Service Updates — General & Reproduction
- [x] 2.3.1 Update `AnimalEventService` write path: persist via `AnimalEventLogRepository`, delegate to `AnimalEventMapper`
- [x] 2.3.2 Update `AnimalEventService` read path: query unified log, map via `toAnimalEventDto`
- [x] 2.3.3 Update `AnimalReproductionEventService` write path: persist via `AnimalEventLogRepository`, delegate to `AnimalReproductionEventMapper`
- [x] 2.3.4 Update `AnimalReproductionEventService` read path: query unified log, map via `toAnimalReproductionEventDto`

### 2.4 Sync Mapper Update
- [x] 2.4.1 Add `SyncEntityType.ANIMAL_EVENT_LOG` to `SyncEntityType.java`
- [x] 2.4.2 Modify `SyncPayloadMapper` to accept legacy `ANIMAL_EVENT`, `ANIMAL_HEALTH_EVENT`, `ANIMAL_REPRODUCTION_EVENT` payloads and map to unified `ANIMAL_EVENT_LOG` canonical form
- [x] 2.4.3 Write failing `SyncPayloadMapperTest`: legacy health payload maps to `eventCategory=HEALTH` with idempotency via `operationId`
- [x] 2.4.4 Write failing test: duplicate `operationId` across categories does not create duplicate rows (idempotency)
- [x] 2.4.5 Update `SyncService` push/push to read/write `ANIMAL_EVENT_LOG` canonical type

### 2.5 Compatibility Cleanup Prep
- [x] 2.5.1 Remove dual-write path: `AnimalEventService`, `AnimalReproductionEventService` now only write to unified log (compatibility view remains for reads only during transition)
- [x] 2.5.2 Verify: `./mvnw test -Dquarkus.profile=test` — all event category tests pass

---

## Phase 3: FE Offline Migration + Timeline Adapters (PR 3)

### 3.1 FE Offline Types
- [x] 3.1.1 Add `ANIMAL_EVENT_LOG` to `SyncEntityType` in `hato-fe/src/app/core/offline/offline-types.ts`
- [x] 3.1.2 Create unified snapshot/payload types: `AnimalEventLogSnapshot { id, animalUuid, eventCategory, eventType, occurredAt, performedByUserId, sourceChannel, operationId, metadata, createdAt, updatedAt }`
- [x] 3.1.3 Update `SyncPayload` to include `ANIMAL_EVENT_LOG` variant
- [x] 3.1.4 Write `animal-event-log-offline.spec.ts`: offline type migration, idempotency via `operationId`

### 3.2 Store Migration
- [x] 3.2.1 Migrate existing `animal_event` snapshot keys to unified log format: add `eventCategory=GENERAL`
- [x] 3.2.2 Migrate `animal_health_event` keys to `eventCategory=HEALTH`
- [x] 3.2.3 Migrate `animal_reproduction_event` keys to `eventCategory=REPRODUCTION`
- [x] 3.2.4 Update IndexedDB store: checkpoint keys for sync cursor now use `lastSyncedEventId` + `lastSyncedAt` on unified log
- [x] 3.2.5 Write `store-migration.spec.ts`: verify old snapshots migrate to new format without data loss

### 3.3 Timeline Adapters
- [x] 3.3.1 Update `hato-fe/src/app/features/admin/animals/data-access/animal-timeline.adapter.ts`: filter unified log by `eventCategory` to derive general/health/reproduction timelines
- [x] 3.3.2 Update health timeline adapter: `FIELD_VET_VISIT` projected from `HEALTH` rows with vet columns, visit/clinical/treatment blocks from metadata
- [x] 3.3.3 Update `animal-detail/history.component.ts` to use unified log query with category filter
- [x] 3.3.4 Write `animal-timeline.adapter.spec.ts`: category filter correctness, vet visit chain projection from unified log

### 3.4 Vet Visit Regression Protection
- [x] 3.4.1 Write `vet-visit-timeline-regression.spec.ts`: confirm `FIELD_VET_VISIT` lifecycle chain (`PROGRAMADA→ATENDIDA→CANCELADA/FINALIZADA`) projected from unified log matches current behavior from `animal_health_events`
- [x] 3.4.2 Write `vet-visit-offline-regression.spec.ts`: offline create/sync/retrieve of vet visits works against unified log
- [x] 3.4.3 Run FE tests: `npm test --prefix hato-fe -- --run` (no build)

### 3.5 Migration Execution & Finalization
- [x] 3.5.1 Execute migration: copy existing rows from three tables into `animal_event_logs` with correct `eventCategory`
- [x] 3.5.2 Verify compatibility views return same results as unified log queries
- [x] 3.5.3 Run full BE + FE test suites: `./mvnw test -Dquarkus.profile=test` AND `npm test --prefix hato-fe -- --run` — ✅ 2026-05-13 full BE suite green with Java 21 (`./mvnw test`: 334 tests, 0 failures/errors) and full FE suite green using the Angular runner equivalent (`npm test -- --watch=false`: 465 tests, 0 failures)
- [x] 3.5.4 Confirm vet visit workflow regression tests pass: `npm test --prefix hato-fe -- --run --grep "vet-visit"` (protecting `vet-visit-clinical-workflow-v1`)
- [x] 3.5.5 Document migration completion in `CHANGELOG-migration.md`

---

## Phase 4: Post-Migration Cleanup (conditional — only after all slices verified)

- [ ] 4.1 Drop compatibility views: `animal_events_view`, `animal_health_events_view`, `animal_reproduction_events_view`
- [ ] 4.2 Remove duplicate persistence paths from services (now only write to unified log)
- [ ] 4.3 Drop old tables: `animal_events`, `animal_health_events`, `animal_reproduction_events` (after verifying no remaining references)
- [ ] 4.4 Final regression: full BE + FE test suite passes; no production build
