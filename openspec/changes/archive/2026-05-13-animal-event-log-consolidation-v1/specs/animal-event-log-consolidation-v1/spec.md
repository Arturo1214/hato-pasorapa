# animal-event-log-consolidation-v1 Specification

## Purpose

Unified event persistence and read contract consolidating `animal_events`, `animal_health_events`, and `animal_reproduction_events` into a single canonical log with `eventCategory` discriminator (`GENERAL`, `HEALTH`, `REPRODUCTION`) and event type typing, while preserving all existing typed metadata contracts and offline sync semantics.

## Requirements

### Requirement: Unified canonical event log

The system MUST persist all animal-scoped events (general, health, reproduction) in a single unified log table/entity keyed by `eventId`, using `eventCategory` (`GENERAL` | `HEALTH` | `REPRODUCTION`) as the top-level discriminator and `eventType` as the second-level discriminator. Each row MUST be immutable once inserted.

#### Scenario: Persist general event

- GIVEN `eventCategory=GENERAL` and `eventType=TRANSFERRED` with required audit fields
- WHEN the event is created
- THEN a single immutable row is inserted in the unified log
- AND `eventCategory` equals `GENERAL`

#### Scenario: Persist health event

- GIVEN `eventCategory=HEALTH` and `eventType=FIELD_VET_VISIT` with typed visit metadata
- WHEN the event is created
- THEN the row is stored in the unified log with `eventCategory=HEALTH`
- AND all existing `FIELD_VET_VISIT` typed blocks are preserved verbatim

#### Scenario: Persist reproduction event

- GIVEN `eventCategory=REPRODUCTION` and `eventType=SERVICE`
- WHEN the event is created
- THEN the row lands in the unified log with `eventCategory=REPRODUCTION`
- AND existing reproduction metadata schema is unchanged

### Requirement: Category-type discriminator matrix

The system MUST enforce that only valid `eventType` values are allowed per `eventCategory`: `GENERAL` accepts `SOLD`, `DECEASED`, `LOST`, `TRANSFERRED`, `OBSERVATION`; `HEALTH` accepts `VACCINATION`, `DEWORMING`, `ILLNESS`, `FIELD_VET_VISIT`; `REPRODUCTION` accepts `SERVICE`, `PREGNANCY_CONFIRMED`, `PREGNANCY_LOSS`, `BIRTH`. Cross-category type assignment MUST be rejected.

#### Scenario: Valid category-type pair

- GIVEN `eventCategory=GENERAL` and `eventType=SOLD`
- WHEN validated
- THEN the event is accepted

#### Scenario: Invalid category-type pair

- GIVEN `eventCategory=GENERAL` and `eventType=VACCINATION`
- WHEN validated
- THEN the system MUST reject with invalid type for category

### Requirement: Offline sync idempotency preserved

The system MUST treat `operationId` as idempotency key across all categories. Duplicate `operationId` values MUST NOT create duplicate rows regardless of category. Conflict metadata MUST be returned when replay cannot be applied.

#### Scenario: Duplicate general event operationId

- GIVEN same `operationId` sent twice with `eventCategory=GENERAL`
- WHEN backend processes replay
- THEN only one row is inserted
- AND conflict is NOT raised

#### Scenario: Duplicate health event operationId

- GIVEN same `operationId` replayed for `eventCategory=HEALTH`
- WHEN backend processes
- THEN idempotency is enforced the same as general events

### Requirement: Migration compatibility path

The system MUST support a development-time migration that reshapes existing rows from `animal_events`, `animal_health_events`, `animal_reproduction_events` into the unified log with correct `eventCategory` values. Temporary compatibility adapters/views SHALL allow existing queries to continue functioning until regression tests prove equivalence.

#### Scenario: Migration maps general ledger rows

- GIVEN existing rows in `animal_events`
- WHEN migration executes
- THEN each row is inserted into unified log with `eventCategory=GENERAL`
- AND original `eventType` values are preserved

#### Scenario: Compatibility view returns equivalent results

- GIVEN compatibility view for `animal_events`
- WHEN queried alongside unified log
- THEN both return the same rows for the same filters

### Requirement: Vet visit lifecycle chain preservation

The system MUST preserve the `FIELD_VET_VISIT` lifecycle metadata blocks (`visit`, `checklist`, `clinicalNote`, `protocol`, `cost`, `treatmentPlan`, `cancelReason`) and chain behavior (`parentVisitId`, `nextControlAt`, `estado` transitions) without regression. The unified log MUST support querying by `visitId`, `animalUuid`, `modo`, `estado`, `veterinarianId`, and date range.

#### Scenario: FIELD_VET_VISIT chain projected from unified log

- GIVEN `FIELD_VET_VISIT` events in unified log forming a chain
- WHEN admin queries the visit chain
- THEN each visit retains its own veterinarianId, estado, and typed metadata
- AND `parentVisitId` links are preserved
- AND chain derived status (`ACTIVE`/`CLOSED`) is computed correctly

### Requirement: Rollback and compatibility expectations

The system MUST document and execute a rollback plan that reverts migration code slices before dependent changes ship. Old adapters and views MUST remain until regression tests prove equivalent reads and sync replay. Pre-production rollback MUST be executable without data loss.

#### Scenario: Pre-production rollback reverts to separate tables

- GIVEN the migration has been applied but dependent changes have not shipped
- WHEN rollback is executed
- THEN the unified log is not queried by production code
- AND existing queries against `animal_events`, `animal_health_events`, `animal_reproduction_events` continue to work
