# offline-sync-channel-unification Specification

## Purpose
Eliminar doble canal de replay y consolidar un único orquestador para operaciones offline permitidas.

## Requirements

### Requirement: Single Replay Channel Enforcement
The system MUST execute offline replay only through the global sync orchestrator and MUST NOT perform feature-level replay from `AdminUsersService` or `GanaderosService`.

#### Scenario: Unified replay path
- GIVEN pending USER/GANADERO offline operations
- WHEN sync is triggered
- THEN all replay traffic is emitted only by the orchestrator through `/api/sync`

#### Scenario: Feature service replay forbidden
- GIVEN a feature service attempts direct replay logic
- WHEN static/runtime validation is executed
- THEN direct replay is blocked and reported as contract violation

### Requirement: Explicit Capability Matrix and Acceptance Criteria
The system MUST enforce this matrix: `USER -> STATUS_UPDATE only`, `GANADERO -> CREATE|STATUS_UPDATE`, `createUser/resetPassword -> online-only`, and MUST expose per-capability acceptance checks.

#### Scenario: Capability matrix validation
- GIVEN queued operations across USER and GANADERO
- WHEN eligibility evaluation runs
- THEN only matrix-allowed operations are replayable and others are explicitly rejected

#### Scenario: Acceptance criteria completeness
- GIVEN test evidence for users, ganaderos, channel unification, cursor/conflicts/idempotency
- WHEN release gate is evaluated
- THEN each capability has pass/fail criteria and all are satisfiable by automated tests

### Requirement: Explicit Exclusions and NFR Guardrails
The system SHALL NOT add offline support for new entities beyond USER/GANADERO, SHALL NOT introduce semantic auto-merge, and SHALL keep retry/backoff/metrics behavior consistent with foundation V1.

#### Scenario: Scope exclusion enforcement
- GIVEN a request to enqueue unsupported entity or advanced merge behavior
- WHEN offline contract validation runs
- THEN the request is rejected as out-of-scope without side effects

#### Scenario: NFR consistency with foundation
- GIVEN repeated transient failures during multi-entity sync
- WHEN orchestrator applies retry policy
- THEN backoff+jitter, counters, and `lastSyncAt` remain available and internally consistent
