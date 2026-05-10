# Delta for admin-notification-ledger-v1

## ADDED Requirements

### Requirement: Notification reach report via /api/admin/reports/notification-reach

The system SHALL expose a notification reach report at `GET /api/admin/reports/notification-reach` returning per-notification metrics: `totalCount`, `readCount`, `pendingCount`, and `readRate` (percentage). The report SHALL support filtering by date range.

#### Scenario: Notification reach report returns metrics

- GIVEN notifications with recipients exist in the system
- WHEN an ADMIN requests `GET /api/admin/reports/notification-reach`
- THEN the response is an array of notifications with deliveryMetrics per notification
- AND each entry includes: notificationId, title, totalCount, readCount, pendingCount, readRate

#### Scenario: Read rate is computed correctly

- GIVEN notification N1 has 10 recipients, 7 have read, 3 are pending
- WHEN ADMIN fetches notification reach
- THEN N1.readRate is returned as 70.0 (percentage, one decimal)

#### Scenario: Notification reach filtered by date range

- GIVEN an ADMIN requests with `startDate` and `endDate` query params
- WHEN the BE evaluates the request
- THEN only notifications created within that range are included
- AND the response reflects that filtered set

## MODIFIED Requirements

### Requirement: Admin sees delivery summary per notification

(Previously: delivery metrics in list view; now also available as standalone reach report)

The system MUST include in the notification reach report the same `deliveryMetrics` summary defined in the notification ledger spec: `totalCount`, `readCount`, `pendingCount`, computed from `AdminNotificationRecipient` records.

#### Scenario: Standalone reach report matches list delivery metrics

- GIVEN notification N1 was sent to 10 recipients (7 read, 3 pending)
- WHEN ADMIN fetches `/api/admin/reports/notification-reach`
- THEN the entry for N1 shows `totalCount: 10`, `readCount: 7`, `pendingCount: 3`
- AND `readRate: 70.0`

(Previously: delivery summary only in list view)