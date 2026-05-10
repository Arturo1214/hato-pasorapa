# Apply Progress: admin-reporting-redesign-v1

## Status

- Mode: Strict TDD
- Delivery: sequential chained work-unit continuation, Slice 4 / PR 4
- Completed: Phase 1 — BE DTOs, Service, Resource skeleton; Phase 2 — BE repository queries + Liquibase indexes; Phase 3 — FE service/store; Phase 4 — FE page redesign + XLSX export + tests
- Remaining: None — ready for SDD verify

## Completed Tasks

- [x] 1.1 Inventory by ganadero response DTO
- [x] 1.2 Health activity response DTO
- [x] 1.3 Notification reach response DTO
- [x] 1.4 Inventory by ganadero filter DTO
- [x] 1.5 Health activity filter DTO
- [x] 1.6 Notification reach filter DTO
- [x] 1.7 AdminReportsService skeleton/date-window validation
- [x] 1.8 AdminReportsResource ADMIN-only endpoints
- [x] 1.9 AdminReportsResourceTest endpoint contract/security/skeleton coverage
- [x] 2.1 AnimalRepository inventory-by-ganadero grouped projection query
- [x] 2.2 AnimalHealthEventRepository health activity projection query with filters/order/limit
- [x] 2.3 AdminNotificationRecipientRepository notification reach projection query with targeting + read metrics
- [x] 2.4 Liquibase reporting indexes in `017-admin-reporting-indexes-v1.yaml`
- [x] 2.5 Registered `017-admin-reporting-indexes-v1.yaml` in `master.yaml`
- [x] 2.6 AdminReportsServiceTest data correctness, filters, limits, validation and read-rate coverage
- [x] 3.1 AdminReportsService HttpClient client for three report endpoints
- [x] 3.2 AdminReportsStore signal state for selected report, filters, loading/error/data
- [x] 3.3 Deprecated legacy `projectAdminReportingV2` pending Slice 4 UI rewrite
- [x] 3.4 Confirmed utility module has no refresh event/sync trigger exports to remove
- [x] 3.5 AdminReportsService HttpTestingController coverage for URLs, params, auth, error mapping
- [x] 3.6 AdminReportsStore coverage for switching, filter changes, loading and error states
- [x] 4.1 AdminReports XLSX export utility with lazy `import('xlsx')`, Spanish headers, formatted cells, and `Reporte_{Nombre}_{YYYYMMDD}.xlsx` filenames
- [x] 4.2 Added `xlsx@^0.18.5` runtime dependency and lockfile entries
- [x] 4.3 Rewrote admin reporting page to use `AdminReportsStore`, 3-report selector, per-report filters, DataTable rows, KPI summaries, and Excel export; removed sync/refresh/freshness/window/preset/debug UI
- [x] 4.4 Updated page component spec for report catalog, report switching/filter UX, export invocation, loading/error/empty states, and no legacy sync controls
- [x] 4.5 Added page integration spec covering select report → HTTP-backed store load → DataTable render → export service call
- [x] 4.6 Deleted deprecated `admin-reporting-projection.spec.ts`; projection code remains only for unrelated legacy sync/decision-support compile safety
- [x] 4.7 Updated OpenSpec tasks to mark all phases complete

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1-1.9 | `hato-be/src/test/java/bo/pasorapa/hato/web/rest/AdminReportsResourceTest.java` | Integration / REST | N/A (new files) | ✅ Written first; failed with 404 for missing endpoints | ✅ `JAVA_HOME=$(/usr/libexec/java_home -v 21) ./mvnw -Dtest=AdminReportsResourceTest test` passed | ✅ 3 tests cover ADMIN 200 for three endpoints, GANADERO 403, invalid date windows/limit 400 | ✅ Skeleton kept minimal; repo queries intentionally deferred |
| 2.1-2.6 | `hato-be/src/test/java/bo/pasorapa/hato/service/AdminReportsServiceTest.java` | Integration / service + repository | ✅ `JAVA_HOME=$(/usr/libexec/java_home -v 21) ./mvnw -Dtest=AdminReportsResourceTest test` → 3/3 passing | ✅ Written first; failed with empty skeleton rows (`expected 2/1/2 but was 0`) | ✅ `JAVA_HOME=$(/usr/libexec/java_home -v 21) ./mvnw -Dtest=AdminReportsServiceTest test` → 4/4 passing | ✅ Covers non-empty inventory grouping/filtering, health type/ganadero/limit/order, notification date/limit/readRate, invalid windows | ✅ Queries kept in repositories; service maps projections to API DTOs; additive indexes verified by Liquibase startup |
| 3.1, 3.5 | `hato-fe/src/app/features/admin/reporting/data-access/admin-reports.service.spec.ts` | Unit / HttpClient testing | N/A (new service) | ✅ Written first; failed because `./admin-reports.service` did not exist | ✅ `npm test -- --watch=false --include "src/app/features/admin/reporting/data-access/admin-reports.service.spec.ts" --include "src/app/features/admin/reporting/data-access/admin-reports.store.spec.ts"` → 7/7 passing | ✅ Covers inventory filters/auth, health date/type/ganadero/animal/limit params, notification `targetingMode`, and backend error mapping | ✅ Params centralized through `buildParams`; typed DTO/filter contracts kept at API boundary |
| 3.2, 3.6 | `hato-fe/src/app/features/admin/reporting/data-access/admin-reports.store.spec.ts` | Unit / signal store | N/A (new store) | ✅ Written first; failed because `./admin-reports.store` and service types did not exist | ✅ Same targeted Angular run → 7/7 passing | ✅ Covers report switching + filters, in-flight loading, successful data exposure, and request failure clearing rows/error state | ✅ Store dispatch isolated to three service methods; no offline snapshot/sync/freshness dependencies added |
| 3.3-3.4 | `hato-fe/src/app/features/admin/reporting/data-access/admin-reporting-projection.spec.ts`, `admin-reporting.utils.spec.ts`, `admin-reporting-page.component.spec.ts` | Unit / compatibility | ✅ Existing legacy reporting specs run after compatibility edit | ✅ Deprecation/compat change verified against existing specs; no new behavior expected | ✅ `npm test -- --watch=false --include "src/app/features/admin/reporting/data-access/admin-reporting-projection.spec.ts" --include "src/app/features/admin/reporting/data-access/admin-reporting.utils.spec.ts" --include "src/app/features/admin/reporting/admin-reporting-page.component.spec.ts"` → 12/12 passing | ➖ Triangulation skipped: compatibility-only annotation and utility audit; no behavior branch changed | ✅ Legacy page remains compile-safe until Slice 4 rewires UI/export |
| 4.1-4.2 | `hato-fe/src/app/features/admin/reporting/data-access/admin-reports-export.spec.ts` | Unit / export utility | N/A (new file/dependency) | ✅ Written first; failed because `./admin-reports-export` did not exist | ✅ Targeted page/export run passed 7/7 after adding lazy XLSX utility and dependency | ✅ Covers inventory Spanish headers/filename and notification current-row lazy write path | ✅ Added injectable wrapper for Angular TestBed-friendly page mocking while keeping pure export functions |
| 4.3-4.4 | `hato-fe/src/app/features/admin/reporting/admin-reporting-page.component.spec.ts` | Unit / component | ✅ Existing reporting page/service/store specs passed 10/10 before rewrite | ✅ Updated spec first; failed on missing `selectReport`, `exportCurrentReport`, and new export module | ✅ Targeted page/export run passed 7/7 | ✅ Covers catalog/no sync controls, switching to health + notification filters, export enabled path, loading/error/empty disabled path | ✅ Page now delegates data to `AdminReportsStore`, export to `AdminReportsExportService`, and keeps summaries lightweight |
| 4.5-4.6 | `hato-fe/src/app/features/admin/reporting/admin-reporting.integration.spec.ts` | Integration / component + real store + HttpClient testing | ✅ Existing reporting page/service/store specs passed 10/10 before rewrite | ✅ Integration spec written first; failed on missing page methods and then pending HTTP selection flow | ✅ Targeted reporting suite passed 18/18 including service/store/export/page/integration/legacy store | ✅ Covers default inventory load, health report HTTP filters/auth, rendered DataTable row, and export of loaded dataset | ✅ Avoided relative `vi.mock` for Angular by injecting `AdminReportsExportService`; deleted obsolete projection spec only |

## Test Summary

- Total tests written: 21 cumulative (14 previous + 7 new/rewritten Slice 4 assertions)
- Total tests passing: 18 in final targeted FE run for this slice; 37 cumulative targeted assertions across previous slices and Slice 4
- Layers used: Integration / REST (3), Integration / Service+Repository (4), FE Unit / HttpClient (4), FE Unit / signal store (3), FE Unit / export utility (2), FE Unit / component (4), FE Integration / component+store+HTTP (1), FE legacy store compatibility (4)
- Approval tests: legacy projection spec removed after page stopped using snapshot projection; legacy `AdminReportingStore` spec remains for unrelated sync initializer safety
- Pure functions created: 2 (`buildExcelExport`, `formatDateInput`) plus small pure formatters for table/export display

## Tests Run

- ✅ `npm test -- --watch=false --include "src/app/features/admin/reporting/admin-reporting-page.component.spec.ts" --include "src/app/features/admin/reporting/data-access/admin-reports.store.spec.ts" --include "src/app/features/admin/reporting/data-access/admin-reports.service.spec.ts"` → 10/10 passing (safety net before Slice 4 edits)
- ✅ `npm test -- --watch=false --include "src/app/features/admin/reporting/data-access/admin-reports-export.spec.ts" --include "src/app/features/admin/reporting/admin-reporting-page.component.spec.ts" --include "src/app/features/admin/reporting/admin-reporting.integration.spec.ts"` → 7/7 passing (Slice 4 page/export GREEN)
- ✅ `npm test -- --watch=false --include "src/app/features/admin/reporting/data-access/admin-reports.service.spec.ts" --include "src/app/features/admin/reporting/data-access/admin-reports.store.spec.ts" --include "src/app/features/admin/reporting/data-access/admin-reports-export.spec.ts" --include "src/app/features/admin/reporting/admin-reporting-page.component.spec.ts" --include "src/app/features/admin/reporting/admin-reporting.integration.spec.ts" --include "src/app/features/admin/reporting/data-access/admin-reporting.store.spec.ts"` → 18/18 passing (final targeted reporting suite)

## Notes / Deviations

- `InventoryByGanaderoFilter` follows the design contract (`ganaderoId`, `active`) instead of the task typo that mentioned `@NotNull Long from` / `Long to`.
- Notification reach includes `targetingMode` in the response row to satisfy Slice 2's targeting requirement; this extends the Slice 1 DTO without breaking existing REST shape assertions.
- Liquibase index migration was exercised through targeted Quarkus tests: changelog `017-admin-reporting-indexes-v1.yaml` applied successfully on H2 test startup.
- Slice 3 intentionally added `AdminReportsService`/`AdminReportsStore` alongside the legacy `AdminReportingStore`; Slice 4 page now uses the new store and no longer uses local snapshot projections.
- Legacy `AdminReportingStore`/`projectAdminReportingV2` code remains because app initializers and decision-support projection still reference it for unrelated sync features; only the obsolete projection spec was deleted.
- Angular's unit-test system rejects `vi.mock` for relative imports; the page uses an injectable `AdminReportsExportService` wrapper so component/integration specs can mock export behavior through TestBed.
- `npm install xlsx@^0.18.5` reported 5 npm audit vulnerabilities from the dependency tree (3 moderate, 2 high); no audit fix was applied because that would be outside this slice.
