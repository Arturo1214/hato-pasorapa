# Tasks: Admin Reporting V1

## Phase 1: Foundation Contracts + Offline Schema

- [x] 1.1 **RED** Create `hato-fe/src/app/features/admin/reporting/data-access/admin-reporting.utils.spec.ts` with failing tests for presets (`all`, `active_only`, `inactive_only`), fallback `all`, windows `7d/30d`, and `recentActivity` limit `20`.
- [x] 1.2 **GREEN** Implement `hato-fe/src/app/features/admin/reporting/data-access/admin-reporting.utils.ts` with preset/window guards, deterministic timestamp sort helper, and `RECENT_ACTIVITY_LIMIT = 20`.
- [x] 1.3 **REFACTOR** Normalize shared contracts in `hato-fe/src/app/core/offline/offline-types.ts` (`ReportingWindow`, `ReportingPresetId`, `AdminReportingDerivedState`, freshness metadata, source signature map).
- [x] 1.4 **RED** Add failing migration/store tests for reporting meta persistence in `hato-fe/src/app/core/offline/offline-store.service.spec.ts` (or nearest offline store spec).
- [x] 1.5 **GREEN** Update `hato-fe/src/app/core/offline/offline-store.migrations.ts` and `hato-fe/src/app/core/offline/offline-store.service.ts` to support `syncState.meta.reporting` get/set/invalidate with schema bump.
- [x] 1.6 **REFACTOR** Keep migration idempotent and preserve no-backend-change V1 contract.

## Phase 2: Projection Engine (Strict TDD)

- [x] 2.1 **RED** Create failing tests in `hato-fe/src/app/features/admin/reporting/data-access/admin-reporting-projection.spec.ts` for local aggregates, `7d/30d` windows, exclusions, and deterministic recent ordering.
- [x] 2.2 **GREEN** Implement `hato-fe/src/app/features/admin/reporting/data-access/admin-reporting-projection.ts` to compute aggregates from `USER/GANADERO/ANIMAL` and event counts from `ANIMAL_EVENT/ANIMAL_HEALTH_EVENT/ANIMAL_REPRODUCTION_EVENT`.
- [x] 2.3 **RED** Add failing projection tests for invalid/ad-hoc preset rejection and fallback behavior.
- [x] 2.4 **GREEN** Apply preset filtering in projection using only V1 presets and enforce `recentActivity` truncation to 20 items.
- [x] 2.5 **REFACTOR** Extract reusable projection helpers to `admin-reporting.utils.ts` and simplify fixtures/assertions in projection spec.

## Phase 3: Store + Incremental Cache

- [x] 3.1 **RED** Create `hato-fe/src/app/features/admin/reporting/data-access/admin-reporting.store.spec.ts` with failing tests for startup recompute, post-sync recompute, stale detection, and offline manual refresh.
- [x] 3.2 **GREEN** Implement `hato-fe/src/app/features/admin/reporting/data-access/admin-reporting.store.ts` (signals/selectors/actions: `initialize`, `rebuild`, `ensureFresh`, `setWindow`, `setPreset`, `refreshNow`).
- [x] 3.3 **RED** Add failing tests for incremental cache invalidation keyed by source checkpoints + selected window/preset signature.
- [x] 3.4 **GREEN** Persist/read derived state through `OfflineStoreService` and recompute only when signature changes; keep stale=false only after successful recompute.
- [x] 3.5 **REFACTOR** Isolate signature/freshness helpers and reduce duplicate setup in store tests.

## Phase 4: Runtime Wiring + UI Reporting

- [x] 4.1 **RED** Add failing integration spec (new or existing admin shell spec) asserting `REPORTING_REFRESH_EVENT` triggers store rebuild and freshness update.
- [x] 4.2 **GREEN** Update `hato-fe/src/app/core/offline/sync-orchestrator.service.ts` to dispatch `REPORTING_REFRESH_EVENT` after successful sync pull.
- [x] 4.3 **GREEN** Wire startup in `hato-fe/src/app/app.initializers.ts` and `hato-fe/src/app/app.config.ts` so `AdminReportingStore.initialize()` runs at bootstrap.
- [x] 4.4 **RED** Create `hato-fe/src/app/features/admin/reporting/admin-reporting-page.component.spec.ts` for freshness visibility, bounded window/preset controls, and offline manual refresh CTA.
- [x] 4.5 **GREEN** Implement `hato-fe/src/app/features/admin/reporting/admin-reporting-page.component.ts` with selectors for summary, event counts, recent activity, freshness, stale state, and V1-only controls.
- [x] 4.6 **GREEN** Update `hato-fe/src/app/app.routes.ts` and `hato-fe/src/app/ui/layout/main-layout/sidebar/sidebar.ts` to expose protected route `admin/reportes` for ADMIN only.

## Phase 5: Verification and Scope Guards

- [x] 5.1 **RED** Add negative tests (store/component) ensuring excluded V1 capabilities remain unavailable (no ad-hoc filters, exports, scheduled, or predictive entry points).
- [x] 5.2 **GREEN** Implement guard logic/messages in FE state/UI to keep V1 scope closed while preserving operational reports.
- [x] 5.3 **REFACTOR** Final cleanup of reporting feature structure under `hato-fe/src/app/features/admin/reporting/**` following standalone + feature-first conventions.
- [x] 5.4 Run frontend unit/integration tests for touched specs and update this file checkboxes during `sdd-apply`; confirm backend stays unchanged in V1.
