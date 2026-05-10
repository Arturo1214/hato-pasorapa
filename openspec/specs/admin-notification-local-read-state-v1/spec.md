# admin-notification-local-read-state-v1 Specification

## Purpose

Definir el comportamiento de lectura de notificaciones. El estado leído se persiste en el servidor usando `AdminNotificationRecipient.read` y `updatedAt`. Se elimina el concepto de inbox ADMIN y el estado local-only por dispositivo.

## Requirements

### Requirement: Server-persisted read-state per recipient

The system MUST persist read-state for each GANADERO recipient in `AdminNotificationRecipient` using `read` (boolean) and `updatedAt` (timestamp). Read-state is canonical and server-authoritative.

#### Scenario: Ganadera marks notification as read

- GIVEN GANADERA G1 has notification N1 with `read: false`
- WHEN G1 marks N1 as read via server endpoint
- THEN `read` becomes `true` and `updatedAt` is set to current server time
- AND subsequent calls reflect the persisted state

#### Scenario: Read-state persists across devices

- GIVEN GANADERA G1 has marked notification N1 as read on device A
- WHEN G1 accesses the inbox on device B
- THEN N1 appears as read (state is server-persisted, not device-local)

### Requirement: Unread counter derived from server state

The system SHALL compute the unread count for a GANADERO as the count of `AdminNotificationRecipient` records where `recipientUserId` matches the GANADERO and `read` is `false`.

#### Scenario: Unread count reflects server read-state

- GIVEN GANADERA G1 has 5 notifications: 3 with `read: true`, 2 with `read: false`
- WHEN unread count is requested
- THEN the count is 2

### Requirement: No admin inbox concept

The system MUST NOT expose an ADMIN-specific inbox view that shows GANADERO notifications. ADMIN sees only the notification ledger/history with metrics.

ADMIN UI MUST NOT show local unread counters, refresh-inbox actions, local-inbox tables, or mark-read actions.

#### Scenario: Admin does not have a personal notification inbox

- GIVEN authenticated ADMIN navigates to any inbox-like route
- WHEN the system evaluates the request
- THEN ADMIN is shown the notification ledger/history view
- AND no personal GANADERO-style inbox is rendered

## REMOVED Requirements

### Requirement: Local read-state per device

(Reason: Replaced by server-persisted `AdminNotificationRecipient.read`. Local-only read-state is deprecated; clients must use server endpoints for read/write operations.)

### Requirement: Merge behavior on incremental updates

(Reason: Covered by `ganadero-notification-inbox-v1` spec. The merge logic remains implementation concern, but this requirement is subsumed by the new server-authoritative model.)