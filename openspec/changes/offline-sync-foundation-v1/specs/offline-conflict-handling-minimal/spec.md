# offline-conflict-handling-minimal Specification

## Purpose
Definir manejo de conflictos mínimo para foundation offline V1.

## Requirements

### Requirement: Conflict Detection and Classification
The system MUST detect optimistic concurrency conflicts using entity `version` mismatch and classify outcomes as `no_conflict`, `version_conflict`, or `validation_error`.

#### Scenario: Version conflict detection
- GIVEN a pushed mutation with stale `version`
- WHEN backend validates current persisted version
- THEN response is `409` and classified as `version_conflict`

#### Scenario: Non-conflict classification
- GIVEN a pushed mutation with current `version`
- WHEN backend applies mutation successfully
- THEN response is success and classified as `no_conflict`

### Requirement: V1 Conflict Resolution Contract
The system MUST return a consumable conflict payload including entity identifiers, client/server versions, and resolution hint `manual_refresh`; V1 SHALL NOT perform semantic auto-merge.

#### Scenario: Conflict payload completeness
- GIVEN a `version_conflict` response
- WHEN client reads conflict details
- THEN payload contains enough fields to show user action and refresh local state
