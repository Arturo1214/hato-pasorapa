# Delta for sync-observability-runtime-history-v2

## MODIFIED Requirements

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
