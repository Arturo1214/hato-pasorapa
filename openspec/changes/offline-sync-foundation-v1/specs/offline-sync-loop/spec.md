# offline-sync-loop Specification

## Purpose
Definir ciclo de sincronización incremental V1 para push/pull con resiliencia y trazabilidad.

## Requirements

### Requirement: Triggered Incremental Push/Pull
The system MUST run sync on manual trigger, app startup, and reconnect events. It MUST push eligible outbox operations and pull remote changes incrementally using a persisted checkpoint cursor.

#### Scenario: Happy path incremental sync
- GIVEN pending outbox operations and a saved cursor
- WHEN sync is triggered with network available
- THEN outbox push is attempted first and pull uses the last cursor

#### Scenario: Cursor advancement
- GIVEN pull response includes a newer checkpoint
- WHEN pull processing completes successfully
- THEN the persisted cursor is advanced atomically

### Requirement: Retry/Backoff and Minimal Observability
The system MUST apply exponential backoff with jitter, enforce retry ceiling, and record minimal metrics: pending, successful, failed, and `lastSyncAt`.

#### Scenario: Retry scheduling
- GIVEN a transient push failure
- WHEN retry policy is evaluated
- THEN `attempts` increments and `nextAttemptAt` is scheduled with backoff+jitter

#### Scenario: Acceptance visibility
- GIVEN at least one sync cycle completed
- WHEN sync status is requested by UI/ops
- THEN counters and `lastSyncAt` are available and internally consistent
