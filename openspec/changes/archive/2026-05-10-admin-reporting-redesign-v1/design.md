# Design: Admin Reporting Redesign V1

## Technical Approach

Replace the current offline-debug `/admin/reportes` projection with ADMIN-only server-backed reports. BE adds one JAX-RS resource under `/api/admin/reports`, a service, DTO records, and repository projection queries. FE keeps the existing lazy route and `DataTableComponent`, but swaps snapshot freshness/sync UI for report selection, explicit filters, table rendering, and client-side XLSX export.

## Architecture Decisions

| Option | Tradeoff | Decision |
|---|---|---|
| Three endpoints returning bounded JSON vs one generic report endpoint | More DTOs, clearer contracts and tests | Use `/inventory-by-ganadero`, `/health-activity`, `/notification-reach` |
| Client XLSX via lazy `import('xlsx')` vs server Excel | Faster V1 and no BE binary streaming; browser memory risk | Client export with limits and future server-side escape hatch |
| Dedicated report repository methods vs ad-hoc resource queries | More files, better layering | Keep REST → `AdminReportsService` → existing/new repository methods |

## Data Flow

    AdminReportingPage ──filters──→ AdminReportsStore ──→ AdminReportsService(HttpClient)
          │                                │                         │
          └──── DataTable + Export ────────┘                         ▼
                    dynamic import('xlsx')          AdminReportsResource → Service → Repositories

## File Changes

| File | Action | Description |
|---|---|---|
| `hato-be/src/main/java/bo/pasorapa/hato/web/rest/AdminReportsResource.java` | Create | `@RolesAllowed("ADMIN")`, Bean Validation query beans, JSON endpoints. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/AdminReportsService.java` | Create | Validates date windows/limits and maps repository rows to DTOs. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/dto/admin/reports/*.java` | Create | Request/filter and response records for all reports. |
| `hato-be/src/main/java/bo/pasorapa/hato/repository/AnimalRepository.java` | Modify | Add grouped inventory by ganadero/category/sex/active. |
| `hato-be/src/main/java/bo/pasorapa/hato/repository/AnimalHealthEventRepository.java` | Modify | Add report query joined to animal/ganadero by date/type/ganadero/animal, ordered desc. |
| `hato-be/src/main/java/bo/pasorapa/hato/repository/AdminNotificationRecipientRepository.java` | Modify | Add notification reach grouped by notification with optional published date range. |
| `hato-be/src/main/resources/db/changelog/017-admin-reporting-indexes-v1.yaml` + `master.yaml` | Create/Modify | Add report indexes only where current ones do not cover filters. |
| `hato-fe/src/app/features/admin/reporting/*` | Modify | Remove offline projection/debug logic; implement report catalog page/store/service/types. |
| `hato-fe/src/app/features/admin/reporting/data-access/admin-reports-export.ts` | Create | Lazy XLSX export utility. |
| `hato-fe/package.json` | Modify | Add `xlsx` runtime dependency. |

## Interfaces / Contracts

Filters: `from`/`to` use ISO date (`yyyy-MM-dd`) inclusive; service converts to `[from 00:00, to 23:59:59.999]` and rejects `from > to`. Default max range: 366 days. Row limit default/max: health `200/500`, notification reach `200/500`; inventory is grouped and unpaged.

- `GET /api/admin/reports/inventory-by-ganadero?ganaderoId=&active=` → `{ rows:[{ganaderoId, ganaderoName,total,active,inactive,byCategory,bySex}] }`
- `GET /api/admin/reports/health-activity?from&to&type&ganaderoId&animalUuid&limit` → `{ rows:[{eventId,occurredAt,type,ganaderoId,ganaderoName,animalUuid,animalCode,animalTag,notes}] }`
- `GET /api/admin/reports/notification-reach?from&to&limit` → `{ rows:[{notificationId,title,publishedAt,totalRecipients,readCount,pendingCount,readRate}] }`

## Query Strategy / Indexes

Inventory groups `Animal` joined to `ownerGanadero`; current `idx_animals_owner_ganadero` is useful, add composite `(owner_ganadero_id, active, category, sex)` if plan needs it. Health activity filters primarily by `occurred_at`, `health_event_type`, `animal_uuid`; add `(occurred_at, health_event_type, animal_uuid)` because current index starts with `animal_uuid`. Notification reach reuses `idx_admin_notification_recipient_notification_read`; add `idx_admin_notifications_published_id (published_at, id)` for date ordering.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| BE REST | ADMIN success, GANADERO 403, invalid dates/limits 400, DTO shapes | `AdminReportsResourceTest` with rest-assured seeded data |
| BE repository/service | grouping counts, read rate, deterministic ordering | Service/repository unit or Quarkus tests |
| FE service/store | URLs, filter serialization, loading/error, report switching | Http testing + store specs |
| FE page/export | No sync/debug copy, renders filters/DataTable, lazy export called | component specs; mock `admin-reports-export` |

## Migration / Rollout

No data migration required. Add non-destructive indexes and route-compatible FE replacement.

## Open Questions

- [ ] None blocking.
