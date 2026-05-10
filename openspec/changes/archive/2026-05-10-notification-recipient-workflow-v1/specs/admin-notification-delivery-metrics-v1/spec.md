# admin-notification-delivery-metrics-v1 Specification

## Purpose

Proveer al ADMIN métricas de entrega operativas por notificación emitida: total de destinatarios, cantidad leídos y cantidad pendientes de lectura.

## Requirements

### Requirement: Admin sees per-notification delivery metrics

The system MUST present ADMIN a delivery metrics view per notification that shows total recipients, read count, and pending count, derived exclusively from `AdminNotificationRecipient` records.

#### Scenario: Admin views delivery metrics for a sent notification

- GIVEN an ADMIN notification exists with 10 recipients (7 read, 3 pending)
- WHEN the ADMIN requests delivery metrics for that notification
- THEN the response returns `deliveryMetrics.totalCount: 10`, `deliveryMetrics.readCount: 7`, `deliveryMetrics.pendingCount: 3`
- AND the notification title and sent timestamp are included for context

#### Scenario: Admin sees zero metrics for notification with no recipients

- GIVEN a notification was created but never sent (0 recipients)
- WHEN the ADMIN requests delivery metrics
- THEN the response returns `deliveryMetrics.totalCount: 0`, `deliveryMetrics.readCount: 0`, `deliveryMetrics.pendingCount: 0`

### Requirement: Metrics include notification identifier and timestamps

The system SHALL include the notification ID, title, and sent-at timestamp in the metrics response so ADMIN can correlate without searching.

#### Scenario: Metrics response includes correlation fields

- GIVEN a sent notification exists
- WHEN metrics are returned
- THEN fields include `notificationId`, `title`, and `sentAt`
- AND the response is suitable for display in an admin table without additional fetches

### Requirement: Admin-only access to metrics endpoint

The system MUST reject any request to the metrics endpoint from GANADERO role with HTTP 403.

#### Scenario: Ganadero receives 403 on metrics endpoint

- GIVEN an authenticated GANADERO calls the delivery metrics endpoint
- WHEN the request is evaluated
- THEN the response is HTTP 403 with an error body
- AND no metrics data is returned
