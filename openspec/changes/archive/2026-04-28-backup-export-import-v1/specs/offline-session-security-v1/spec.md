# Delta for offline-session-security-v1

## MODIFIED Requirements

### Requirement: Sync Gate Requires Active Session

The system SHALL block push and pull operations when session state is `reauth_required` or `expired`, MUST require successful login reauthentication before allowing sync, and MUST transition session state to `reauth_required` after successful import or restore operations that mutate local persisted data.

(Previously: sync was blocked for non-active states, but import/restore was not explicitly required to set `reauth_required`.)

#### Scenario: Sync allowed with active session
- GIVEN session state is `active`
- WHEN a push or pull is requested
- THEN sync proceeds

#### Scenario: Sync blocked pending reauthentication
- GIVEN session state is `reauth_required` or `expired`
- WHEN a push or pull is requested
- THEN sync is denied and reauthentication is required

#### Scenario: Import/restore enforces session boundary
- GIVEN session state is `active` before local import or restore
- WHEN import or restore completes successfully
- THEN session state becomes `reauth_required` before any next sync attempt
