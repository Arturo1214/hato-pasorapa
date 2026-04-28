# sync-observability-runtime-history-v2 Specification

## Purpose

Definir un contrato verificable de observabilidad híbrida para offline sync: snapshot runtime en FE y agregados históricos en BE, con semántica consistente para operación interna.

## Requirements

### Requirement: Runtime Snapshot Metrics
The system MUST expose a runtime snapshot per cycle with `trigger`, `startedAt`, `finishedAt`, `totalDurationMs`, and phase durations for `push` and `pull`; reconnect/retry/mixed-batch cycles MUST include `attempt`, `reconnectCount`, `batchComposition`, and `hasMoreObserved`.
(Previously: trace fields were not required.)

#### Scenario: FE publishes cycle metrics
- GIVEN a sync cycle starts from any valid trigger
- WHEN the cycle finishes
- THEN runtime snapshot includes trigger, timestamps, and total/phase durations

#### Scenario: FE handles in-progress cycle
- GIVEN a sync cycle is still running
- WHEN runtime snapshot is requested
- THEN `finishedAt` MAY be null

#### Scenario: Runtime history for reconnect and pagination
- GIVEN a cycle includes reconnect and pull pagination
- WHEN runtime snapshot is recorded
- THEN snapshot includes reconnect count, attempt number, and `hasMoreObserved`
### Requirement: Queue Pending State and Outcome Counters (FE)

The system MUST expose queue/outbox counters globally and per `OfflineEntityType` for states: `pending`, `in_flight`, `retry_scheduled`, `failed`, `dead_letter`, and `conflict`.

#### Scenario: Global pending visibility
- GIVEN outbox operations exist in multiple states
- WHEN runtime snapshot is requested
- THEN snapshot includes total counters per state
- AND `pending` count is explicitly present

#### Scenario: Per-entity pending visibility
- GIVEN outbox operations for at least two entity types
- WHEN runtime snapshot is requested
- THEN snapshot includes per-entity counters for all required states

### Requirement: Errors and Conflicts Operational View

The system MUST provide actionable runtime/historical error-conflict summaries including top codes/reasons, open vs resolved conflicts, and blocked operations count.

#### Scenario: Top error and conflict reasons
- GIVEN errors and conflicts were recorded
- WHEN observability data is queried
- THEN response includes ranked codes/reasons with counts

#### Scenario: Open vs resolved conflict split
- GIVEN conflict lifecycle events exist
- WHEN observability data is queried
- THEN response includes open/resolved totals
- AND blocked operations count

### Requirement: Global and Entity Sync Status

The system MUST provide global sync status and per-entity status including `cursorUpdatedAt`, `lastSuccessAt`, and computed staleness/latency indicators.

#### Scenario: Entity staleness from timestamps
- GIVEN an entity has cursor and success timestamps
- WHEN status is computed
- THEN staleness/latency is derived and exposed for that entity

#### Scenario: Missing entity history
- GIVEN an entity has no successful sync yet
- WHEN status is requested
- THEN status is returned with null-safe timestamps
- AND entity is marked as non-healthy or pending initialization

### Requirement: Historical Aggregates API (BE)

The system MUST expose a backend observability endpoint with aggregated metrics for fixed windows `24h` and `7d`, sourced from sync receipts and conflict ledger.

#### Scenario: 24h aggregate query
- GIVEN historical receipts exist
- WHEN client requests window `24h`
- THEN endpoint returns aggregated cycle, queue, latency, error, and conflict metrics

#### Scenario: 7d aggregate query by entity
- GIVEN historical data across entities
- WHEN client requests window `7d`
- THEN endpoint returns global aggregates and per-entity breakdown

### Requirement: Explicit Non-Goals and Exclusions

The system SHALL NOT require APM integrations, enterprise alerting/SLO workflows, distributed tracing, or `/api/sync` protocol redesign as part of this capability.

#### Scenario: Scope validation for excluded integrations
- GIVEN this capability is implemented
- WHEN acceptance criteria are reviewed
- THEN no dependency on Prometheus/Grafana/Datadog/OpenTelemetry is required
- AND no PagerDuty/Slack/email alerting workflow is required
