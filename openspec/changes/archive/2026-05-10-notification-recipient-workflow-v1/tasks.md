# Tasks: notification-recipient-workflow-v1

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 550–650 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (BE) → PR 2 (FE admin cleanup + specs) → PR 3 (FE ganadero bell + inbox) |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | BE DTOs, repo, service, resource, indexes | PR 1 | Backend foundation; self-contained |
| 2 | FE admin cleanup + updated specs | PR 2 | Immediate parent = PR 1 |
| 3 | FE ganadero inbox + bell + tests | PR 3 | Immediate parent = PR 2 |

---

## Phase 1: Backend Foundation

- [x] 1.1 Create `AdminNotificationMetricsResponse` DTO — `totalCount`, `readCount`, `pendingCount`
- [x] 1.2 Create `GanaderoNotificationInboxItemResponse` DTO — `recipientId`, `id`, `title`, `body`, `read`, `readAt`, `publishedAt`
- [x] 1.3 Create `GanaderoNotificationInboxResponse` DTO — wrapping list + items
- [x] 1.4 Create `GanaderoUnreadCountResponse` DTO — `unreadCount`
- [x] 1.5 Add `getOwnedInbox(UUID recipientUserId)` and `getGroupedMetrics()` to `AdminNotificationRecipientRepository`
- [x] 1.6 Add `getInbox(UUID userId)` and `getUnreadCount(UUID userId)` to `AdminNotificationService`
- [x] 1.7 Add `GET /inbox` and `GET /unread-count` endpoints to `NotificationRecipientsResource`; change `@RolesAllowed` to `GANADERO` only
- [x] 1.8 Add `getNotificationWithMetrics(UUID notificationId)` to `AdminNotificationService` for list enrichment
- [x] 1.9 Create Liquibase changelog `016-notification-recipient-workflow-v1.yaml` — indexes on `(recipient_user_id, read)` and `(notification_id, read)`
- [x] 1.10 Write `AdminNotificationServiceTest` — metrics totals, owned inbox ordering, `updatedAt` on mark-read
- [x] 1.11 Write `NotificationRecipientsResourceTest` — ADMIN 403 on inbox/count, GANADERO mark own vs foreign recipient 403

## Phase 2: Frontend Admin Cleanup

- [x] 2.1 Update `AdminNotificationListResponse` to include `deliveryMetrics` field — nullable for create response
- [x] 2.2 Update `AdminNotificationResponse` to include `deliveryMetrics` (total/read/pending counts)
- [x] 2.3 Refactor `admin-notifications-page.component.ts` — remove local inbox state and mark-read UI; show sent-history table with metrics columns; keep create-dialog
- [x] 2.4 Remove `markAsRead` / `markAllAsRead` calls from `AdminNotificationsService`
- [x] 2.5 Delete `notification-inbox.page.ts` and `notification-inbox.store.ts` (admin no longer has inbox)
- [x] 2.6 Update `admin-notifications-page.component.spec.ts` — remove inbox/mark-read assertions; add metrics display assertions
- [x] 2.7 Update `admin-notification-ledger-v1/spec.md` — reflect MODIFIED requirement with delivery summary fields
- [x] 2.8 Update `admin-notification-local-read-state-v1/spec.md` — mark REMOVED requirements as removed; NO new code

## Phase 3: Frontend Ganadero Inbox + Bell

- [x] 3.1 Create `ganadero/notifications/data-access/ganadero-notifications.service.ts` — `getInbox()`, `getUnreadCount()`, `markAsRead(recipientId)`, `markAllAsRead()`
- [x] 3.2 Create `ganadero/notifications/data-access/ganadero-notifications.store.ts` — signals for `items`, `loading`, `error`, `unreadCount`; RxJS for HTTP calls
- [x] 3.3 Create `ganadero/notifications/ganadero-inbox-page.component.ts` — standalone; displays inbox list, unread count, mark-read actions; uses `toSignal` for store state; Spanish labels
- [x] 3.4 Create `ganadero/notifications/ganadero-inbox-page.component.spec.ts` — mock service/store; verify inbox list renders, mark-read updates signal, loading/error states
- [x] 3.5 Modify `header.ts` + `header.html` — add GANADERO-only bell icon with badge; show `unreadCount` from `GanaderoNotificationsStore`; link to `/ganadero/notificaciones`
- [x] 3.6 Update `app.routes.ts` — point `ganadero/notificaciones` to new `ganadero-inbox-page.component` instead of `notification-inbox.page`
- [x] 3.7 Update `header.spec.ts` — verify bell is GANADERO-only (not rendered for ADMIN role); verify badge shows correct count
- [x] 3.8 Update `layout-home/spec.md` — reflect MODIFIED bell requirement (GANADERO bell, no ADMIN bell)
