# Shared Device Session Hygiene V1 Specification

## Purpose

Definir higiene local mínima para dispositivos compartidos, evitando reutilización de sesión previa para sincronización y reduciendo residuo sensible.

## Requirements

### Requirement: Local Cleanup on Logout and Critical Session Transitions

The system MUST execute local cleanup on logout and on critical session transitions that invalidate continuity (`reauth_required`, `expired`, or user switch), including removal of sensitive session data and sync metadata that could enable reuse.

#### Scenario: Logout triggers cleanup

- GIVEN a user with persisted offline data and session metadata
- WHEN the user logs out
- THEN sensitive session and sync-reuse data are removed locally

#### Scenario: User switch on shared device

- GIVEN a new login attempt on a device with prior user remnants
- WHEN session ownership changes
- THEN previous user reusable session artifacts are purged before sync

### Requirement: Minimal Retention for Offline Continuity

The system SHOULD retain only the minimum non-sensitive local data required to continue offline UX after cleanup, and MUST NOT retain data that can authorize or replay prior sync identity.

#### Scenario: Continuity-safe retention

- GIVEN cleanup is executed
- WHEN offline features are reopened
- THEN non-sensitive retained data remains usable without enabling prior-user sync

#### Scenario: No reusable sync identity remains

- GIVEN cleanup completed on shared device
- WHEN sync is requested without reauthentication
- THEN the system denies sync due to missing valid session identity

### Requirement: Shared Device Reuse Prevention Rule

The system MUST NOT allow synchronization using a prior persisted session from another user context on the same device.

#### Scenario: Prior session cannot sync

- GIVEN a persisted envelope from a previous user
- WHEN sync is attempted in a different user context
- THEN sync is blocked until current user reauthenticates

### Requirement: UX Contract for Shared Device Mode

The system SHALL provide explicit UX messaging that reauthentication is required before sync after cleanup-triggering events in shared-device contexts.

#### Scenario: Reauth message displayed

- GIVEN session state is `reauth_required` after cleanup-triggering event
- WHEN user initiates sync
- THEN user receives explicit reauthentication guidance before sync can continue
