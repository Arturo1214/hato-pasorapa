# offline-sync-users Specification

## Purpose
Definir sync offline real de `USER` para operaciones permitidas, con consistencia de cursor/conflictos/idempotencia alineada a `ANIMAL`.

## Requirements

### Requirement: USER Offline Push for Allowed Mutation
The system MUST send `USER STATUS_UPDATE` through `/api/sync` from the global orchestrator when connectivity is restored.

#### Scenario: Replay of allowed USER mutation
- GIVEN a queued `USER STATUS_UPDATE` created offline
- WHEN orchestrator runs a push cycle online
- THEN the mutation is sent once via `/api/sync` and acknowledged in the operation log

#### Scenario: Disallowed USER mutation is not synced
- GIVEN a queued `USER` mutation other than `STATUS_UPDATE`
- WHEN replay eligibility is evaluated
- THEN the mutation is rejected with explicit reason `OFFLINE_OPERATION_NOT_ALLOWED`

### Requirement: USER Pull/Conflict/Idempotency Contract Aligned with ANIMAL
The system MUST use incremental pull cursor `updatedAt + id`, MUST return `409 version_conflict` payload compatible with `ANIMAL`, and MUST process duplicated operation identities idempotently.

#### Scenario: Stable incremental USER pull
- GIVEN cursor `(updatedAt=A,id=U1)`
- WHEN USER changes newer than that cursor exist
- THEN response returns only ordered deltas and next cursor using the same tuple rule

#### Scenario: USER version conflict response
- GIVEN stale USER `version` in pushed operation
- WHEN backend validates persisted version
- THEN response is `409` with conflict classification and refresh hint

#### Scenario: USER idempotent replay
- GIVEN the same operation identity is replayed twice
- WHEN backend processes both requests
- THEN only one state mutation is applied and duplicates are safely acknowledged

### Requirement: Online-only Security Operations for USER
The system SHALL keep `createUser` and `resetPassword` online-only and SHALL NOT enqueue them for offline replay.

#### Scenario: Offline create/reset rejection
- GIVEN device is offline
- WHEN user attempts `createUser` or `resetPassword`
- THEN operation fails immediately with explicit online-only error and no outbox record
