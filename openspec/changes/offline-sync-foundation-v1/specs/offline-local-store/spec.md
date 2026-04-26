# offline-local-store Specification

## Purpose
Definir persistencia local durable y modelo operativo de outbox/inbox.

## Requirements

### Requirement: Durable Local Persistence
The system MUST persist domain snapshots and sync metadata in durable local storage and MUST recover them after app restart.

#### Scenario: Restart recovery
- GIVEN pending local data and saved sync metadata
- WHEN the app process is closed and reopened
- THEN data and metadata are restored without loss

#### Scenario: Schema evolution
- GIVEN a storage schema version bump
- WHEN the app starts with older local schema
- THEN migration runs exactly once and preserves compatible records

### Requirement: Outbox/Inbox Operational States
The system MUST store outbox/inbox entries using canonical envelope fields and explicit states: `pending`, `in_flight`, `acked`, `failed`, `dead_letter`.

#### Scenario: Outbox state transition
- GIVEN a queued mutation in `pending`
- WHEN sync dispatch starts and then receives success
- THEN status changes `pending -> in_flight -> acked`

#### Scenario: Terminal failure transition
- GIVEN an entry exceeds retry policy
- WHEN next retry decision is evaluated
- THEN status changes to `dead_letter` with failure reason persisted
