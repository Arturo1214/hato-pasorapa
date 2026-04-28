# offline-sync-ganaderos Specification

## Purpose
Definir sync offline real de `GANADERO` para operaciones permitidas y contractos de consistencia iguales al baseline `ANIMAL`.

## Requirements

### Requirement: GANADERO Offline Push for Allowed Mutations
The system MUST push `GANADERO CREATE` and `GANADERO STATUS_UPDATE` via `/api/sync` through the global orchestrator.

#### Scenario: Replay of offline GANADERO create
- GIVEN a queued `GANADERO CREATE` made offline
- WHEN sync push runs with connectivity
- THEN backend creates the record once and marks operation as successful

#### Scenario: Replay of offline GANADERO status update
- GIVEN a queued `GANADERO STATUS_UPDATE` made offline
- WHEN sync push runs
- THEN backend applies the status change and returns sync acknowledgment

### Requirement: GANADERO Incremental Pull and Consistency Rules
The system MUST expose GANADERO deltas with cursor `updatedAt + id`, MUST honor `409 version_conflict` semantics, and MUST be idempotent for repeated operation identities.

#### Scenario: Incremental GANADERO pull
- GIVEN a stored cursor from previous successful pull
- WHEN new GANADERO changes exist server-side
- THEN pull returns only newer deltas and a deterministic next cursor

#### Scenario: GANADERO conflict and retry compatibility
- GIVEN a replayed mutation with stale `version`
- WHEN backend detects concurrency mismatch
- THEN response is `409 version_conflict` and operation remains retry-governed by orchestrator policy

#### Scenario: GANADERO idempotent duplicate handling
- GIVEN duplicate submissions with same operation identity
- WHEN backend receives both in different retries
- THEN final persisted state is equivalent to a single successful mutation

### Requirement: Capability Acceptance for offline-sync-ganaderos
The capability SHALL be accepted only if allowed GANADERO mutations sync via `/api/sync`, pull cursor progresses monotonically, and no ANIMAL regression is introduced.

#### Scenario: Capability acceptance gate
- GIVEN automated FE/BE checks for push/pull/conflict/idempotency
- WHEN the full suite runs for GANADERO and ANIMAL paths
- THEN all GANADERO criteria pass and ANIMAL baseline behavior remains unchanged
