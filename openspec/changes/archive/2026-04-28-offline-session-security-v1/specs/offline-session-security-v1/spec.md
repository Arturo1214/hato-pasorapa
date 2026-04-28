# Offline Session Security V1 Specification

## Purpose

Definir la política de sesión offline para bloquear sincronización con sesión inválida y exigir reautenticación antes de push/pull.

## Requirements

### Requirement: Local Session Envelope Integrity

The system MUST persist a local session envelope with `status` (`active|reauth_required|expired`), `issuedAt`, `lastAuthAt`, and `expiresAt`, and MUST derive validity from this envelope as the single source of truth for offline session state.

#### Scenario: Envelope is valid and active

- GIVEN an envelope with `status=active` and current time earlier than `expiresAt`
- WHEN guard, bootstrap initializer, or sync gate checks session state
- THEN the result is `active`

#### Scenario: TTL has elapsed

- GIVEN an envelope with current time at or after `expiresAt`
- WHEN session state is evaluated
- THEN the system SHALL classify it as `expired`

### Requirement: Sync Gate Requires Active Session

The system SHALL block push and pull operations when session state is `reauth_required` or `expired` and MUST require successful login reauthentication before allowing sync.

#### Scenario: Sync allowed with active session

- GIVEN session state is `active`
- WHEN a push or pull is requested
- THEN sync proceeds

#### Scenario: Sync blocked pending reauthentication

- GIVEN session state is `reauth_required` or `expired`
- WHEN a push or pull is requested
- THEN sync is denied and reauthentication is required

### Requirement: Guard and Bootstrap Consistency

The system MUST use the same session-state decision rule across route guards, app bootstrapping, and sync orchestration to prevent bypasses.

#### Scenario: Consistent denial across components

- GIVEN session state evaluates to `expired`
- WHEN guard, initializer, and sync gate are triggered independently
- THEN all three produce equivalent denial behavior

#### Scenario: State transition recognized at startup

- GIVEN a persisted envelope changed from `active` to `expired` by time
- WHEN the app boots offline
- THEN initializer marks session as non-active before sync attempts

### Requirement: Explicit Security Boundary and Exclusions

The system MUST document V1 security boundaries and MUST NOT claim protection for excluded controls (OS biometrics, MDM/attestation, hardware-backed encryption, remote revocation/recovery).

#### Scenario: Documented exclusion set

- GIVEN V1 security documentation
- WHEN exclusions are reviewed
- THEN all out-of-scope controls are explicitly listed as unsupported

---

## Domain: shared-device-session-hygiene-v1

Related delta source: `openspec/changes/offline-session-security-v1/specs/shared-device-session-hygiene-v1/spec.md`.
This domain is mirrored here to keep the OpenSpec delta aligned with the hybrid Engram artifact used by apply/verify.

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
