# admin-notification-offline-sync-v1 Specification

## Purpose

Definir la distribución incremental `NOTIFICATION` para startup/refresh con comportamiento offline-first.

## Requirements

### Requirement: Incremental pull channel for notifications

The system MUST expose `SyncEntityType.NOTIFICATION` in incremental pull so clients can fetch only changes since their last notification checkpoint.

#### Scenario: Pull returns only new notification changes

- GIVEN a client checkpoint at T1 and notifications changed at T2>T1
- WHEN the client executes incremental pull for `NOTIFICATION`
- THEN only changes newer than T1 are returned
- AND the response includes the next checkpoint marker

#### Scenario: Pull with no changes is stable

- GIVEN a client checkpoint with no newer notification changes
- WHEN the client executes incremental pull
- THEN the response returns an empty notification delta

### Requirement: Startup and refresh visibility contract

The client and backend contract MUST ensure GANADERO sees newly targeted notifications on session startup and on explicit refresh/sync.

#### Scenario: New notification appears after startup sync

- GIVEN a notification targeted to the user before login
- WHEN the user starts a new session and startup sync runs
- THEN the notification appears in local inbox after sync completion

#### Scenario: New notification appears after manual refresh

- GIVEN the user session is active and a new targeted notification exists
- WHEN the user triggers refresh/sync
- THEN the inbox includes the new notification without full data reset

### Requirement: Offline-first continuity

When network is unavailable, the system SHOULD preserve last known inbox state and MAY defer notification delta retrieval until connectivity resumes.

#### Scenario: Refresh while offline

- GIVEN the user has locally cached notifications and no connectivity
- WHEN refresh/sync is requested
- THEN cached inbox remains available
- AND no local notification data is deleted due to offline failure
