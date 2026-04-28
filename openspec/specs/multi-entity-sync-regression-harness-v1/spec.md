# multi-entity-sync-regression-harness-v1 Specification

## Purpose
Contrato FE+BE para regresión determinística multi-entidad sin cambios productivos.

## Requirements

### Requirement: Deterministic regression matrix
The system MUST run a deterministic matrix for reorder, retries, duplicated `operationId`, reconnection, mixed batches, and conflict chains.

#### Scenario: Deterministic execution baseline
- GIVEN fixed clock/seed and stable fixtures
- WHEN the matrix is executed in FE and BE suites
- THEN outcomes are repeatable across runs

### Requirement: Push/pull and pagination continuity
The system MUST verify `push -> pull` continuity and assert `hasMore` pagination until exhaustion.

#### Scenario: hasMore incremental draining
- GIVEN pull responses with `hasMore=true`
- WHEN sync cycles continue until `hasMore=false`
- THEN all pages are consumed in order

### Requirement: Retry/idempotency with duplicates
The system MUST verify retries and duplicate deliveries preserve idempotency by `operationId` in single and mixed batches.

#### Scenario: Duplicate retry in mixed batch
- GIVEN a mixed batch where one `operationId` is replayed
- WHEN retries are executed after transient failure
- THEN duplicate side effects are not re-applied

### Requirement: Taxonomy and exclusions
The system MUST classify cases as `smoke` or `stress` and SHALL document explicit exclusions.

#### Scenario: Scope gate in CI
- GIVEN harness suites are selected for CI
- WHEN smoke profile runs
- THEN all mandatory smoke cases execute
