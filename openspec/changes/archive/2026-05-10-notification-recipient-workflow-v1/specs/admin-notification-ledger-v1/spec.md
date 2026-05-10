# admin-notification-ledger-v1 Specification

## Purpose

Definir la emisión ADMIN y el almacenamiento canónico de notificaciones internas con targeting V1 simple para GANADERO. Incluir resumen de entrega y estado de lectura en los contratos ADMIN.

## Requirements

### Requirement: Internal notification canonical record

The system MUST persist each ADMIN notification as an immutable canonical record with unique ID, title/body, creator identity, timestamps, and publish status.

#### Scenario: Admin creates a publishable notification

- GIVEN an authenticated ADMIN with valid content
- WHEN the ADMIN submits a new internal notification
- THEN the system stores a canonical notification record with audit fields
- AND the notification becomes eligible for recipient distribution

#### Scenario: Invalid notification payload is rejected

- GIVEN an authenticated ADMIN with missing required fields
- WHEN the ADMIN submits the notification
- THEN the system rejects the request with validation errors

### Requirement: Targeting V1 with explicit includes and excludes

The system MUST support V1 targeting modes for GANADERO recipients: `ALL_ACTIVE_GANADEROS` and `EXPLICIT_LIST`, and MUST support explicit exclusion IDs where exclusion precedence is final.

#### Scenario: Broadcast to all active GANADERO except excluded IDs

- GIVEN a notification targeted to `ALL_ACTIVE_GANADEROS` with exclusion list [U2]
- WHEN recipient targeting is resolved
- THEN all active GANADERO except U2 are selected

#### Scenario: Explicit list with overlapping include/exclude

- GIVEN a notification with explicit include list [U1, U2, U3] and exclusion list [U2]
- WHEN recipient targeting is resolved
- THEN U1 and U3 remain recipients
- AND U2 is not a recipient

### Requirement: Sender and recipient listing contract

The system SHALL provide list views for ADMIN issuance history and recipient-resolved notifications with deterministic ordering for verification and support operations.

#### Scenario: Admin lists recently issued notifications

- GIVEN multiple canonical notifications exist
- WHEN ADMIN requests the issuance list
- THEN notifications are returned in deterministic newest-first order
- AND each item includes targeting summary and audit metadata

## MODIFIED Requirements

### Requirement: Admin sees delivery summary per notification

(Previously: Admin list view only — no delivery breakdown)

The system MUST include in each ADMIN notification list item a `deliveryMetrics` summary computed from `AdminNotificationRecipient` records: `totalCount`, `readCount`, and `pendingCount`.

#### Scenario: Admin sees delivery summary in notification list

- GIVEN notification N1 was sent to 10 recipients (7 read, 3 pending)
- WHEN ADMIN lists notifications
- THEN N1 shows `deliveryMetrics.totalCount: 10`, `deliveryMetrics.readCount: 7`, `deliveryMetrics.pendingCount: 3`

#### Scenario: Notification with no recipients shows zero counts

- GIVEN a notification was created but never sent
- WHEN ADMIN lists notifications
- THEN the notification shows `deliveryMetrics.totalCount: 0`, `deliveryMetrics.readCount: 0`, `deliveryMetrics.pendingCount: 0`
