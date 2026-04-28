# Tasks: Multi-Entity Sync Regression Harness V1

## Phase 1: Foundation & Decisions

- [x] 1.1 Document baseline decisions in this change: CI V1 runs `smoke` always, `stress` only manual/on-demand.
- [x] 1.2 Define defensive `hasMore` cap = 10 pages for test loops in FE/BE harness helpers.
- [x] 1.3 Standardize case tagging by naming/describe (`[smoke]`, `[stress]`) when runner-native tags are unavailable.
- [x] 1.4 Create FE deterministic fixtures in `hato-fe/src/app/core/offline/testing/sync-harness.fixtures.ts` (fixed clock/seed, mixed batches, paged pulls).
- [x] 1.5 Create FE reusable assertions in `hato-fe/src/app/core/offline/testing/sync-harness.assertions.ts` (ordering, idempotency, checkpoint, runtime fields).
- [x] 1.6 Create BE deterministic fixture builder in `hato-be/src/test/java/bo/pasorapa/hato/support/sync/SyncHarnessFixtures.java` (entities, duplicate `operationId`, conflicts, cursors).

## Phase 2: FE strict TDD (RED→GREEN→REFACTOR)

- [x] 2.1 RED: add failing `[smoke]` tests in `sync-orchestrator.service.spec.ts` for deterministic push→pull continuity and `hasMore` draining.
- [x] 2.2 GREEN: implement only test harness wiring/mocks to pass 2.1 without product behavior changes.
- [x] 2.3 REFACTOR: extract repeated setup to fixture/assertion helpers; keep test names by risk axis.
- [x] 2.4 RED: add failing `[smoke]` tests for transient retry + duplicate `operationId` idempotency in mixed batch.
- [x] 2.5 GREEN: adjust fake API responses and expected receipts/checkpoints to satisfy idempotency assertions.
- [x] 2.6 REFACTOR: centralize duplicate/retry scenario builders to avoid data drift.
- [x] 2.7 RED: add failing `[stress]` tests for reconnect cycles, conflict chain + post-resolution retry ordering.
- [x] 2.8 GREEN: complete harness stubs to emit runtime snapshot fields (`attempt`, `reconnectCount`, `batchComposition`, `hasMoreObserved`).
- [x] 2.9 REFACTOR: enforce defensive max-page guard (10) and explicit failure message on pagination overflow.

## Phase 3: BE strict TDD (RED→GREEN→REFACTOR)

- [x] 3.1 RED: extend `SyncServiceTest.java` with failing `[smoke]` tests for duplicate `operationId` idempotency (single + mixed batch).
- [x] 3.2 GREEN: update test fixtures/arrange only to validate no duplicate side effects and stable operation ordering.
- [x] 3.3 REFACTOR: consolidate service-level scenario setup using `SyncHarnessFixtures`.
- [x] 3.4 RED: add failing `[smoke]` tests for incremental `hasMore` pull draining and cursor monotonicity.
- [x] 3.5 GREEN: wire paged fixture expectations (max 10 pages) until `hasMore=false`.
- [x] 3.6 REFACTOR: extract `PullPageExpectation` and shared assertions for readability.
- [x] 3.7 RED: extend `SyncResourceTest.java` with failing `[stress]` contract tests for reconnect/retry, conflict decisions, and repeated conflict audit append.
- [x] 3.8 GREEN: complete REST test payload/response expectations for decision options (`accept_server`, `retry_local`, `discard_local`) and chronological audit events.
- [x] 3.9 REFACTOR: unify REST request builders and response verifiers by taxonomy axis.

## Phase 4: Matrix gating & verification

- [x] 4.1 Create smoke/stress matrix table in this `tasks.md` footer (case id, layer FE/BE, required fields, expected gate).
- [x] 4.2 Add CI selection rules in test docs/config comments: smoke default pipeline; stress manual trigger only.
- [x] 4.3 Add final cross-check tests ensuring FE runtime observability fields and BE audit/conflict traces align per `operationId` timeline.
- [x] 4.4 Verify all harness scenarios are deterministic across reruns and produce no production code diffs.

## Smoke/Stress Matrix (V1 Gate)

| Case ID | Layer | Tier | Required Fields | Gate |
|---|---|---|---|---|
| reorder-push-pull | FE+BE | smoke | `operationId`, ordered push→pull, stable checkpoint cursor | always |
| retry-duplicate-operation-id | FE+BE | smoke | `attempt`, stable classification, no duplicate side effect | always |
| hasMore-drain-until-false | FE+BE | smoke | `hasMore`, monotonic `nextCursor`, max 10 pages | always |
| reconnect-transient-network | FE | stress | `trigger=reconnect`, `reconnectCount`, overflow guard message | manual |
| mixed-batch-conflict-chain | FE+BE | stress | `batchComposition`, `allowedActions`, unaffected ordering | manual |
| repeated-conflict-audit-append | BE | stress | chronological `auditTrail`, repeated `DETECTED` append by `operationId` | manual |
