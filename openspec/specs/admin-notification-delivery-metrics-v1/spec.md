# ganadero-notification-inbox-v1 Specification

## Purpose

Proveer al GANADERO una bandeja de notificaciones personal que muestra las notificaciones recibidas, su estado leído/no leído, y acciones para marcar una o todas como leídas.

## Requirements

### Requirement: Ganadero inbox lists only own notifications

The system MUST return only notifications addressed to the authenticated GANADERO user, ordered by sent date descending (newest first).

#### Scenario: Ganadero sees only their own notifications

- GIVEN GANADERO G1 has received notifications N1 and N3; GANADERO G2 has received N2
- WHEN G1 requests their inbox
- THEN the response contains only N1 and N3
- AND N2 is absent

#### Scenario: Empty inbox for ganadero with no notifications

- GIVEN a GANADERO has never received any notification
- WHEN that GANADERO requests their inbox
- THEN the response is an empty array

### Requirement: Inbox items show read/unread status

Each inbox item MUST show whether the notification has been read by the current GANADERO, based on `AdminNotificationRecipient.read`.

#### Scenario: Unread notification shown with unread indicator

- GIVEN notification N1 was sent to GANADERO G1 with `read: false`
- WHEN G1 requests their inbox
- THEN N1 appears with `read: false` in the response

#### Scenario: Read notification shown with read indicator

- GIVEN notification N1 was sent to GANADERO G1 with `read: true` and `updatedAt` set
- WHEN G1 requests their inbox
- THEN N1 appears with `read: true` in the response

### Requirement: Mark single notification as read

The system MUST allow a GANADERO to mark a single notification as read, updating `AdminNotificationRecipient.read = true` and setting `updatedAt` to the current timestamp.

#### Scenario: Ganadero marks one notification as read

- GIVEN GANADERO G1 has an unread notification N1 (read: false)
- WHEN G1 marks N1 as read
- THEN N1's `read` becomes `true`
- AND `updatedAt` is set to current server time
- AND subsequent inbox calls reflect N1 as read

### Requirement: Mark all notifications as read

The system MUST allow a GANADERO to mark all their notifications as read in a single operation.

#### Scenario: Ganadero marks all as read

- GIVEN GANADERO G1 has 3 unread notifications (N1, N2, N3 all read: false)
- WHEN G1 marks all as read
- THEN all three notifications have `read: true`
- AND all have `updatedAt` set to current server time

### Requirement: Ganadero cannot access other users' inbox

The system MUST reject with HTTP 403 any attempt to access or modify another user's inbox.

#### Scenario: Cross-tenant access returns 403

- GIVEN GANADERO G1 is authenticated
- WHEN G1 attempts to mark notification N2 (belonging to GANADERO G2) as read
- THEN the response is HTTP 403