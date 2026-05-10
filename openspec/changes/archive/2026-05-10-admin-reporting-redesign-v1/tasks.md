# Tasks: admin-reporting-redesign-v1

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~950–1,200 (additions); ~600 (deletions); net ~400–700 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | 4 chained PRs (BE foundation → BE repo+indexes → FE service/store → FE page+export+tests) |
| Delivery strategy | sequential chained work-unit continuation approved |
| Chain strategy | stacked-to-main |

Decision needed before apply: No — Slice 1 approved by orchestrator/user
Chained PRs recommended: Yes
Chain strategy: stacked-to-main

---

## Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | BE DTOs + Service + Resource | PR 1 | Base = main; standalone admin report endpoints |
| 2 | BE repository queries + Liquibase indexes | PR 2 | Base = PR 1; indexes + repo additions |
| 3 | FE AdminReportsService + AdminReportsStore | PR 3 | Base = PR 2; FE service/store replacing offline logic |
| 4 | FE page redesign + export utility + tests | PR 4 | Base = PR 3; final wiring and verification |

---

## Phase 1: BE — DTOs, Service, Resource (PR 1)

- [x] 1.1 Create `hato-be/src/main/java/bo/pasorapa/hato/service/dto/admin/reports/InventoryByGanaderoResponse.java` with nested `InventoryRow` record (ganaderoId, ganaderoName, total, active, inactive, byCategory map, bySex map)
- [x] 1.2 Create `hato-be/src/main/java/bo/pasorapa/hato/service/dto/admin/reports/HealthActivityResponse.java` with `HealthActivityRow` record (eventId, occurredAt, type, ganaderoId, ganaderoName, animalUuid, animalCode, animalTag, notes)
- [x] 1.3 Create `hato-be/src/main/java/bo/pasorapa/hato/service/dto/admin/reports/NotificationReachResponse.java` with `NotificationReachRow` record (notificationId, title, publishedAt, totalRecipients, readCount, pendingCount, readRate)
- [x] 1.4 Create `hato-be/src/main/java/bo/pasorapa/hato/service/dto/admin/reports/InventoryByGanaderoFilter.java` — `@Valid` request bean with `@NotNull Long from` and `Long to` (ISO date strings), optional `ganaderoId`, optional `active` Boolean
- [x] 1.5 Create `hato-be/src/main/java/bo/pasorapa/hato/service/dto/admin/reports/HealthActivityFilter.java` — `@Valid` request bean with `@NotNull @PastOrPresent LocalDate from`, `@NotNull @PastOrPresent LocalDate to`, optional `type` enum, optional `ganaderoId`, optional `animalUuid`, `@Max(500) int limit`
- [x] 1.6 Create `hato-be/src/main/java/bo/pasorapa/hato/service/dto/admin/reports/NotificationReachFilter.java` — `@Valid` request bean with optional `from`/`to` ISO dates, `@Max(500) int limit`
- [x] 1.7 Create `hato-be/src/main/java/bo/pasorapa/hato/service/AdminReportsService.java` — `@ApplicationScoped`, validates date ranges (from ≤ to, max 366 days), delegates to repositories, maps to DTOs
- [x] 1.8 Create `hato-be/src/main/java/bo/pasorapa/hato/web/rest/AdminReportsResource.java` — `@Path("/api/admin/reports")`, `@RolesAllowed("ADMIN")`, `@GET /inventory-by-ganadero`, `@GET /health-activity`, `@GET /notification-reach`, injects AdminReportsService
- [x] 1.9 Write `hato-be/src/test/java/bo/pasorapa/hato/web/rest/AdminReportsResourceTest.java` — rest-assured seeded tests: ADMIN 200, GANADERO 403, invalid dates 400, empty results 200, DTO shape assertions

---

## Phase 2: BE — Repository Queries + Indexes (PR 2)

- [x] 2.1 Add to `AnimalRepository.java`: `listInventoryByGanadero()` — JPQL query joining Animal to ownerGanadero, group by ganadero, count total/active/inactive, sub-count by category and sex; return list of projection interface or record
- [x] 2.2 Add to `AnimalHealthEventRepository.java`: `listHealthActivity(HealthActivityFilter)` — JPQL with join to animal+ganadero, filter by occurredAt range, type, ganaderoId, animalUuid, order by occurredAt desc, limit; return rows mapped to DTO fields
- [x] 2.3 Add to `AdminNotificationRecipientRepository.java`: `getNotificationReach(NotificationReachFilter)` — JPQL join notification, group by notification id/title/publishedAt, compute total/reed/pending counts, compute readRate; add index suggestion comment
- [x] 2.4 Create `hato-be/src/main/resources/db/changelog/017-admin-reporting-indexes-v1.yaml` — add composite index `idx_animals_owner_report (owner_ganadero_id, active, category, sex)` if not covered; add `(occurred_at, health_event_type, animal_uuid)` on animal_health_events; add `(published_at, id)` on admin_notifications
- [x] 2.5 Register `017-admin-reporting-indexes-v1.yaml` in `master.yaml` after `016-*.yaml`
- [x] 2.6 Write `hato-be/src/test/java/bo/pasorapa/hato/service/AdminReportsServiceTest.java` — test date validation (from > to → 400), max range 366 days, row count limits, readRate computation

---

## Phase 3: FE — Service + Store (PR 3)

- [x] 3.1 Create `hato-fe/src/app/features/admin/reporting/data-access/admin-reports.service.ts` — HttpClient-based service with `getInventoryByGanadero(filter)`, `getHealthActivity(filter)`, `getNotificationReach(filter)`; returns typed observables; handles errors
- [x] 3.2 Create `hato-fe/src/app/features/admin/reporting/data-access/admin-reports.store.ts` — signal-based store replacing offline logic; `selectedReport`, `reportData`, `loading`, `error` signals; `loadReport(name, filter)`, `setFilter()` methods; NO snapshot/sync/freshness logic
- [x] 3.3 Update `hato-fe/src/app/features/admin/reporting/data-access/admin-reporting-projection.ts` — mark `projectAdminReportingV2` as deprecated; retain for backward compat until PR 4
- [x] 3.4 Update `hato-fe/src/app/features/admin/reporting/data-access/admin-reporting.utils.ts` — keep utility fns needed by projection; remove REPORTING_REFRESH_EVENT, sync trigger refs
- [x] 3.5 Write `hato-fe/src/app/features/admin/reporting/data-access/admin-reports.service.spec.ts` — mock HttpClient, verify correct URLs, query params, error handling, loading state
- [x] 3.6 Write `hato-fe/src/app/features/admin/reporting/data-access/admin-reports.store.spec.ts` — test report switching, filter changes, loading/error states

---

## Phase 4: FE — Page Redesign + Export + Tests (PR 4)

- [x] 4.1 Create `hato-fe/src/app/features/admin/reporting/data-access/admin-reports-export.ts` — lazy `import('xlsx')` utility; `exportToExcel(rows, columns, reportName)` function; Spanish headers map; date-stamped filename `Reporte_{Nombre}_{YYYYMMDD}.xlsx`
- [x] 4.2 Update `hato-fe/package.json` — add `"xlsx": "^0.18.5"` to dependencies
- [x] 4.3 Rewrite `hato-fe/src/app/features/admin/reporting/admin-reporting-page.component.ts` — remove sync/refresh/freshness/stale signals; add report selector (tabs or segmented buttons for 3 reports); add filter controls per report type; render DataTable with dynamic columns; add "Exportar Excel" button triggering `exportToExcel`; inject new AdminReportsStore
- [x] 4.4 Update `hato-fe/src/app/features/admin/reporting/admin-reporting-page.component.spec.ts` — update to reflect new store API; remove sync tests; add report switching tests; add export button click test
- [x] 4.5 Write `hato-fe/src/app/features/admin/reporting/admin-reporting.integration.spec.ts` — full flow: select report → store loads data → page renders table → click export → XLSX download
- [x] 4.6 Delete `hato-fe/src/app/features/admin/reporting/data-access/admin-reporting-projection.spec.ts` (projection code deprecated)
- [x] 4.7 Update `openspec/changes/admin-reporting-redesign-v1/tasks.md` — mark all phases complete

---

## Implementation Order

1. **PR 1 (BE foundation)** — DTOs + Service + Resource first because all other layers depend on the contract. Service + Resource can be developed and tested in isolation once DTOs are frozen.
2. **PR 2 (BE data access)** — Repo queries and indexes; must land before FE starts consuming the endpoints. Repo methods need the domain model and can be added without blocking service/resource.
3. **PR 3 (FE service/store)** — FE service depends on the running BE contract. Store replaces offline logic and can be tested with mocked HTTP.
4. **PR 4 (FE page + export)** — Final integration: page wires to new store, export utility added, all tests green. Old projection code removed here.

## Notes

- `hato-be/src/test/java/bo/pasorapa/hato/web/rest/AdminReportsResourceTest.java` uses `rest-assured` pattern matching existing `AdminNotificationsResourceTest.java`.
- Liquibase indexes are additive only — no destructive changes.
- FE `xlsx` lazy import avoids bundling the library until export is triggered.
- Chained PR strategy resolved for Slice 1: `stacked-to-main`.
