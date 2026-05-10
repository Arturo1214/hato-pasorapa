# Design: Notification Recipient Workflow V1

## Technical Approach

Keep `AdminNotification` as the immutable ADMIN ledger and promote `AdminNotificationRecipient(read, updated_at)` to the server source of truth for GANADERO read receipts. Backend stays REST → Service → Repository/Domain with API DTOs only; frontend splits ADMIN sent-history/metrics from GANADERO inbox/bell so device-local offline snapshots are not treated as server read state.

## Architecture Decisions

| Decision | Options / Tradeoff | Choice / Rationale |
|---|---|---|
| ADMIN response shape | Extending `AdminNotificationResponse` is low churn but can blur create/list semantics. New metric DTOs are clearer but duplicate ledger fields. | Extend `AdminNotificationResponse` with nullable/non-null `deliveryMetrics` for list/create consistency, backed by a small `AdminNotificationMetricsResponse(totalCount, readCount, pendingCount)`. This keeps FE history simple and avoids a parallel list DTO. |
| GANADERO contracts | Reuse admin DTO leaks targeting/creator internals. | Create `GanaderoNotificationInboxItemResponse` and `GanaderoNotificationInboxResponse`; include `recipientId`, notification `id`, title/body, `read`, `readAt` derived from `updatedAt` when read, `publishedAt`. |
| Counts query strategy | Per-row counts are simple but N+1. | Repository aggregate query groups recipients by notification id and returns total/read counts in one pass; pending = total - read. Unread count uses existing `countByRecipientUserIdAndReadFalse`. |
| Read endpoints | Shared `/api/notifications/recipients` allows ADMIN accidental access. | Keep/adjust paths but restrict to `@RolesAllowed("GANADERO")`; add `GET /api/notifications/inbox`, `GET /api/notifications/unread-count`, `PATCH /api/notifications/recipients/{recipientId}/read`, `PATCH /api/notifications/recipients/read`. |

## Data Flow

```text
ADMIN page ──GET /api/admin/notifications──> Resource ─> Service ─> notification + grouped recipient metrics
GANADERO bell/page ──GET inbox/count───────> Resource ─> Service ─> recipients owned by current user
GANADERO mark read ──PATCH recipient/read──> Service checks recipientUserId, sets read=true, updatedAt=now
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `hato-be/.../web/rest/AdminNotificationsResource.java` | Modify | Return list entries with metrics; ADMIN-only remains. |
| `hato-be/.../web/rest/NotificationRecipientsResource.java` | Modify | Make GANADERO-only and expose inbox/count/read operations. |
| `hato-be/.../service/AdminNotificationService.java` | Modify | Add inbox, unread count, metrics orchestration; set `updatedAt` on single mark-read. |
| `hato-be/.../repository/AdminNotificationRecipientRepository.java` | Modify | Add owned inbox query and grouped metrics query. |
| `hato-be/.../service/dto/admin/notifications/*` | Modify/Create | Add delivery metrics and GANADERO inbox/count DTOs. |
| `hato-be/src/main/resources/db/changelog/016-notification-recipient-workflow-v1.yaml` | Create | Add indexes for `(recipient_user_id, read)`, `(notification_id, read)`. |
| `hato-fe/src/app/features/admin/notifications/**` | Modify | Admin page becomes sent history + metrics + create dialog; remove local inbox coupling. |
| `hato-fe/src/app/features/ganadero/notifications/**` | Create | Standalone inbox page, service/store using server DTOs. |
| `hato-fe/src/app/ui/layout/main-layout/header/*` | Modify | Add GANADERO-only bell with unread count and navigation to `/ganadero/notificaciones`. |
| `hato-fe/src/app/app.routes.ts` | Modify | Point ganadero notification route to new feature page. |

## Interfaces / Contracts

```java
record AdminNotificationMetricsResponse(int totalCount, int readCount, int pendingCount) {}
record GanaderoNotificationInboxItemResponse(String recipientId, String id, String title, String body, boolean read, String readAt, String publishedAt) {}
record GanaderoUnreadCountResponse(long unreadCount) {}
```

FE uses `AdminNotificationsService` only for ADMIN history/create/metrics. New `GanaderoNotificationsService` handles `/notifications/*`; `GanaderoNotificationInboxStore` uses signals for list/loading/error/unread and RxJS for HTTP refresh/mark-read.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| BE service/repository | Metrics totals, owned inbox ordering, `updatedAt` on read | Quarkus service tests with seeded recipients. |
| BE REST | ADMIN cannot access GANADERO inbox; GANADERO cannot access admin metrics; mark own vs foreign recipient | `quarkus-junit5` + rest-assured 200/403/404 assertions. |
| FE unit | Admin page shows metrics/no local inbox; ganadero inbox marks read; header bell is GANADERO-only | Update `*.spec.ts` with mocked services/stores. |
| E2E | Not configured | No E2E required unless runner is added later. |

## Migration / Rollout

Existing rows already get `read=false` from changelog `014`; no read-state migration from device-local storage. Add only non-destructive indexes. Local offline notification read state remains legacy/display cache and MUST NOT overwrite server receipts.

## Open Questions

- [ ] None blocking.
