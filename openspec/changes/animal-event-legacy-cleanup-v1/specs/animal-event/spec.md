# Delta for Animal Event Legacy Cleanup

## REMOVED Requirements

### Requirement: Legacy Animal Event Entities Persist at Runtime

The system MUST NOT have runtime dependency on `AnimalEvent`, `AnimalHealthEvent`, or `AnimalReproductionEvent` JPA entities after this change.

(Reason: These entities are superseded by `AnimalEventLog` as the single persistence source)

### Requirement: Legacy Repository Layer Persists at Runtime

The system MUST NOT have runtime dependency on `AnimalEventRepository`, `AnimalHealthEventRepository`, or `AnimalReproductionEventRepository` after this change.

(Reason: Event query logic migrated to `AnimalEventLogRepository`)

### Requirement: Legacy Database Tables Exist

The system MUST NOT retain `animal_events`, `animal_health_events`, or `animal_reproduction_events` tables after migration cleanup in dev stage.

(Reason: Data consolidated into `animal_event_logs` in migration 020)

### Requirement: Legacy Database Views Exist

The system MUST NOT retain `animal_events_view`, `animal_health_events_view`, or `animal_reproduction_events_view` after this change.

(Reason: Views were temporary compatibility layer; removed after consolidation)

### Requirement: Dual-Write Persistence on Event Create

The `AnimalHealthEventService` SHALL stop writing to both `animal_health_events` and `animal_event_logs` tables. Writes SHALL target only `animal_event_logs`.

(Previously: Dual-write to legacy table + log table on create)

### Requirement: Dual-Write Persistence on Reproduction Event Create

The `AnimalReproductionEventService` SHALL stop writing to `animal_reproduction_events`. Writes SHALL target only `animal_event_logs`.

(Previously: Dual-write to legacy table + log table on create)

### Requirement: Read Path Through Legacy Repositories

The `AnimalHealthEventService.list()` SHALL read from `AnimalEventLogRepository` exclusively, not from `AnimalHealthEventRepository`. The `AnimalReproductionEventService.list()` SHALL read from `AnimalEventLogRepository` exclusively, not from `AnimalReproductionEventRepository`.

(Previously: Merged results from legacy repo + log repo)

### Requirement: `AnimalHealthEventCompatibilityView` Bean

The `AnimalHealthEventCompatibilityView` CDI bean SHALL be removed. Its `findByVisitId` and `findByParentVisitId` methods are replaced by `AnimalEventLogRepository.findByVisitIdRoot` and `findByParentVisitId`.

(Reason: Compatibility layer no longer needed after read-path migration)

### Requirement: Vet Visit Timeline Query Through Legacy Repo

`AnimalHealthEventService.getVisitChainDetail` SHALL query `AnimalEventLogRepository` for visit chain events, not `AnimalHealthEventRepository`.

(Previously: `filterEventsByOwner(toHealthEvents(animalEventLogRepository.findByVisitIdRoot(visitId)))`)

### Requirement: Legacy Column `health_event_type` Referenced in Queries

The system MUST NOT contain JPQL or SQL referencing `health_event_type`, `reproduction_event_type`, or `event_type` columns on legacy tables.

(Reason: Type columns unified in `animal_event_logs.event_type`)

### Requirement: Offline Sync Payload Compatibility

The offline sync payload structure for animal events SHALL remain backward-compatible at the DTO/mapper boundary. If FE or offline clients send payloads with legacy field names (`healthEventType`, `reproductionEventType`), the mapper layer SHALL translate to `AnimalEventCategory` + `eventType` before persisting to `AnimalEventLog`.

(Reason: External payload compatibility preserved at mapper boundary, not at DB layer)

## ADDED Requirements

### Requirement: `AnimalEventLog` as Sole Write Target for Health Events

The system SHALL persist all health event data exclusively to `animal_event_logs` with `event_category = 'HEALTH'`. The `AnimalHealthEventMapper.toAnimalEventLog` method is the single write path.

#### Scenario: Create health event writes only to `animal_event_logs`

- GIVEN a valid `AnimalHealthEventRequest` for a health event
- WHEN `AnimalHealthEventService.create()` is called
- THEN the event is persisted to `animal_event_logs` with `event_category = 'HEALTH'`
- AND no row is written to `animal_health_events`

#### Scenario: Health event read from log via mapper

- GIVEN a health event record in `animal_event_logs` with `event_category = 'HEALTH'`
- WHEN `AnimalHealthEventMapper.toAnimalHealthEvent(log)` is called
- THEN the returned `AnimalHealthEvent` contains equivalent data translated from the log

### Requirement: `AnimalEventLog` as Sole Write Target for Reproduction Events

The system SHALL persist all reproduction event data exclusively to `animal_event_logs` with `event_category = 'REPRODUCTION'`. The `AnimalReproductionEventMapper.toAnimalEventLog` method is the single write path.

#### Scenario: Create reproduction event writes only to `animal_event_logs`

- GIVEN a valid `AnimalReproductionEventRequest`
- WHEN `AnimalReproductionEventService.create()` is called
- THEN the event is persisted to `animal_event_logs` with `event_category = 'REPRODUCTION'`
- AND no row is written to `animal_reproduction_events`

### Requirement: Vet Visit Timeline from `animal_event_logs`

The system SHALL derive all vet visit timeline data from `animal_event_logs` records with `event_category = 'HEALTH'` and `event_type = 'FIELD_VET_VISIT'`.

#### Scenario: Vet visit chain resolves from logs

- GIVEN a visitId with related events in `animal_event_logs`
- WHEN `AnimalEventLogRepository.findByVisitIdRoot(visitId)` is called
- THEN all chain events are returned with `visitId`, `parentVisitId`, `visitStatus` fields populated
- AND `AnimalHealthEventMapper.toAnimalHealthEvent` translates each log to a health event DTO

#### Scenario: Vet visit list for owner resolves from logs

- GIVEN a ganadero ownerId and `VetVisitFilterDto`
- WHEN `AnimalEventLogRepository.findFieldVetVisitsByOwner(ownerId, query)` is called
- THEN grouped visit items are built from log records with visit metadata projected into response DTOs

### Requirement: Animal Timeline Unified from `animal_event_logs`

The system SHALL derive animal event timelines (general, health, reproduction) from `animal_event_logs` exclusively.

#### Scenario: General events timeline from log

- GIVEN an animal UUID
- WHEN `AnimalEventLogRepository.findGeneralByAnimalUuidForProjection(animalUuid)` is called
- THEN events with `event_category = 'GENERAL'` are returned ordered by `occurredAt`

#### Scenario: Reproduction events timeline from log

- GIVEN an animal UUID and reproduction event type filter
- WHEN `AnimalEventLogRepository.listReproductionHistory(uuid, type, from, to)` is called
- THEN events with `event_category = 'REPRODUCTION'` are returned ordered by `occurredAt` desc

### Requirement: Migration Cleanup Drops are Dev-Stage Safe

The Liquibase migration that drops legacy tables and views SHALL be gated behind a development-only flag or executed manually in dev after verifying no runtime dependencies remain.

#### Scenario: Legacy table drop does not affect running application

- GIVEN the application is running with `animal_events`, `animal_health_events`, `animal_reproduction_events` tables present
- WHEN the drop migration is applied
- THEN `AnimalEventLogRepository` queries continue to work
- AND API responses for event lists remain unchanged

#### Scenario: Legacy view drop does not break application

- GIVEN the application is running with legacy views present
- WHEN the view drop migration is applied
- THEN no runtime error occurs because no code references the dropped views

### Requirement: Backward-Compatible API Payloads

API endpoints SHALL return responses in the same DTO structure as before cleanup, ensuring FE/offline clients do not regress.

#### Scenario: Health event list response shape unchanged

- GIVEN a health event exists in `animal_event_logs`
- WHEN `GET /api/animals/{uuid}/health-events` is called
- THEN the response matches `AnimalHealthEventListResponse` structure with same field names

#### Scenario: Reproduction event list response shape unchanged

- GIVEN a reproduction event exists in `animal_event_logs`
- WHEN `GET /api/animals/{uuid}/reproduction-events` is called
- THEN the response matches `AnimalReproductionEventListResponse` structure with same field names

#### Scenario: General event list response shape unchanged

- GIVEN a general event exists in `animal_event_logs`
- WHEN `GET /api/animals/{uuid}/events` is called
- THEN the response matches `AnimalEventListResponse` structure with same field names

### Requirement: Offline Sync Compatibility

Offline sync SHALL continue to produce and consume event payloads compatible with existing offline storage schemas. Mapper layer handles translation between unified log format and legacy-compatible sync payloads.

#### Scenario: Pull items compatible with offline schema

- GIVEN an `AnimalHealthEvent` event
- WHEN `AnimalHealthEventService.toPullItem(event)` is called
- THEN the returned map matches the expected offline sync field names and structure

#### Scenario: Pregnancy diagnosis linked service resolved from log

- GIVEN a pregnancy diagnosis event linked to a service event via `serviceEventUuid` in metadata
- WHEN `AnimalReproductionEventService` resolves the link
- THEN it queries `AnimalEventLogRepository.findByEventIdOrOperationId(REPRODUCTION, serviceEventUuid)` to locate the service

### Requirement: Vet Visits and Animal Timelines Non-Regression

Vet visit chaining, follow-up projections, treatment continuity, and animal event timelines SHALL NOT degrade after legacy cleanup.

#### Scenario: Field vet visit chain sorted correctly

- GIVEN a visit chain with parent and child visits stored in `animal_event_logs`
- WHEN `AnimalHealthEventService.getVisitChainDetail(visitId, ...)` is called
- THEN the returned items are sorted by `parentVisitId` nulls first, then `occurredAt`, then `visitId`

#### Scenario: Follow-up projection built from log

- GIVEN a timeline of health events for an animal
- WHEN `AnimalHealthEventService.list(...)` is called
- THEN follow-up projections are resolved from `visitId` and `treatmentCaseId` metadata stored in `animal_event_logs`

#### Scenario: Treatment continuity validated from log

- GIVEN a `TREATMENT_STARTED` event stored in `animal_event_logs`
- WHEN a `TREATMENT_FOLLOW_UP` request is submitted for the same `treatmentCaseId`
- THEN `AnimalHealthEventService` validates continuity using log data, not legacy table data

## Migration Artifacts to Remove

| Artifact | Type | Reason |
|----------|------|--------|
| `AnimalEvent.java` | JPA Entity | Superseded by `AnimalEventLog` |
| `AnimalHealthEvent.java` | JPA Entity | Superseded by `AnimalEventLog` |
| `AnimalReproductionEvent.java` | JPA Entity | Superseded by `AnimalEventLog` |
| `AnimalEventRepository.java` | Panache Repository | Logic moved to `AnimalEventLogRepository` |
| `AnimalHealthEventRepository.java` | Panache Repository | Logic moved to `AnimalEventLogRepository` |
| `AnimalReproductionEventRepository.java` | Panache Repository | Logic moved to `AnimalEventLogRepository` |
| `AnimalHealthEventCompatibilityView.java` | CDI Bean | Compatibility layer no longer needed |
| `animal_events` table | DB Table | Data migrated to `animal_event_logs` in 020 |
| `animal_health_events` table | DB Table | Data migrated to `animal_event_logs` in 020 |
| `animal_reproduction_events` table | DB Table | Data migrated to `animal_event_logs` in 020 |
| `animal_events_view` | DB View | Temporary compatibility view, drop in cleanup |
| `animal_health_events_view` | DB View | Temporary compatibility view, drop in cleanup |
| `animal_reproduction_events_view` | DB View | Temporary compatibility view, drop in cleanup |

## Regression Gates

| Gate | Check |
|------|-------|
| BE: Health event create | POST creates row in `animal_event_logs` only |
| BE: Health event list | GET returns same `AnimalHealthEventListResponse` shape |
| BE: Reproduction event create | POST creates row in `animal_event_logs` only |
| BE: Reproduction event list | GET returns same `AnimalReproductionEventListResponse` shape |
| BE: General event list | GET returns same `AnimalEventListResponse` shape |
| BE: Vet visit chain | `getVisitChainDetail` returns correctly grouped items |
| BE: Vet visit list | `listVetVisits` returns same structure as before |
| BE: Treatment continuity | `TREATMENT_FOLLOW_UP` validates against log data |
| BE: Sync pull item | `toPullItem` produces compatible offline payload |
| BE: Pregnancy diagnosis link | Service reference resolved from log |
| FE: Animal timeline | Timeline renders same data from unified log source |
| FE: Vet visit UI | Visit cards, chain navigation unchanged |
| FE: Offline: event log sync | Offline storage writes/reads compatible |