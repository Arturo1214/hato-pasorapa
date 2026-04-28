# Apply Progress: Integral Herd Management V2

**Change**: `integral-herd-management-v2`  
**Mode**: Strict TDD  
**Date**: 2026-04-28

## Completed Tasks

- [x] Phase 1 — contratos V2, nuevas entidades sync, repositorios y changelog `011-integral-herd-management-v2`.
- [x] Phase 2 — handlers BE para `LOT`, `LOT_ASSIGNMENT`, `PRODUCTIVITY_LEDGER`, `COST_LEDGER` con dedupe determinístico y policy matrix V2.
- [x] Phase 3 — schema offline v9, tipos V2, helpers locales y soportes de reconciliación/reporting.
- [x] Phase 4 — `projectAdminReportingV2`, ventanas `7d|30d|90d`, cards/desglose por lote y guardrails descriptivos.
- [x] Phase 5 — tests BE/FE unit + integración para flujo offline/sync/reporting y comentarios técnicos V2.
- [x] Correctivo post-verify — cobertura explícita para exclusiones de preset V1 sobre productividad/costos y refuerzo FE de persistencia/enqueue V2.

## Files Changed

| File | Action | What Was Done |
|------|--------|---------------|
| `hato-be/src/main/java/bo/pasorapa/hato/service/dto/sync/SyncEntityType.java` | Modified | Agregó tipos sync V2 de lotes, asignaciones, productividad y costos. |
| `hato-be/src/main/java/bo/pasorapa/hato/domain/Herd*.java` | Created | Modeló entidades JPA V2 con constraints de identidad/versión. |
| `hato-be/src/main/java/bo/pasorapa/hato/repository/Herd*Repository.java` | Created | Añadió queries Panache `findByOperationId`, `findByIdentityKey`, `listChangedSince`. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/mapper/SyncPayloadMapper.java` | Modified | Parseo/validación V2 y policy matrix cerrada con comentarios técnicos. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/SyncService.java` | Modified | Wiring push/pull V2, dedupe por identidad, overlap rejection y mapeo pull. |
| `hato-be/src/main/resources/db/changelog/011-integral-herd-management-v2.yaml` | Created | Tablas e índices V2 para lotes, asignaciones y ledgers. |
| `hato-be/src/test/java/**/Sync*V2*.java` | Created | Cobertura TDD para mapper, service e integración REST V2. |
| `hato-fe/src/app/core/offline/offline-types.ts` | Modified | Tipos V2, `90d`, snapshots e identidades de ledgers. |
| `hato-fe/src/app/core/offline/offline-store.migrations.ts` | Modified | Migración schema v9 y normalización reporting V2. |
| `hato-fe/src/app/core/offline/offline-store.service.ts` | Modified | Helpers V2 para lotes/asignaciones/ledgers y canonicalización local. |
| `hato-fe/src/app/features/admin/reporting/data-access/admin-reporting-*.ts` | Modified | Proyección, store y utils V2 con KPIs descriptivos y lot breakdown. |
| `hato-fe/src/app/features/admin/reporting/admin-reporting-page.component.ts` | Modified | UI V2 con nuevos cards y desglose por lote. |
| `hato-fe/src/app/**/*.spec.ts` | Modified | Cobertura FE de schema, reporting, store e integración V2. |
| `hato-fe/src/app/features/admin/reporting/data-access/admin-reporting.utils.ts` | Modified | Declaró exclusiones explícitas por preset V1 para productividad/costos sin abrir filtros ad-hoc. |
| `hato-fe/src/app/features/admin/reporting/data-access/admin-reporting-projection.ts` | Modified | Aplicó exclusiones declaradas al cálculo de agregados, KPIs y desglose por lote. |
| `hato-fe/src/app/features/admin/reporting/data-access/admin-reporting.utils.spec.ts` | Modified | Cubrió contrato de exclusiones explícitas por preset V1. |
| `hato-fe/src/app/features/admin/reporting/data-access/admin-reporting-projection.spec.ts` | Modified | Cubrió escenario spec “Explicit exclusions are applied”. |
| `hato-fe/src/app/core/offline/offline-store.service.spec.ts` | Modified | Reforzó persistencia semántica de read-state y enqueue/overlap explícito para entidades V2. |

## Deviations from Design

None — implementation matches the design intent. The corrective batch only materialized an explicit preset-exclusion contract already implied by the delta spec and kept the integration assertions focused on observable FE behavior.

## Issues Found

- The pre-existing frontend test environment resolves Node `v25.9.0` (non-LTS warning only; tests still pass).
- Backend cleaner needed explicit V2 table cleanup due new FK chain introduced by lot assignments.
- Backend targeted V2 suite still emits pre-existing Quarkus config relocation/deprecation warnings, but the tests stay green and the corrective batch did not expand that surface.

### TDD Cycle Evidence
| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1-2.5 | `SyncPayloadMapperV2ContractTest.java`, `SyncServiceV2Test.java`, `SyncResourceV2IntegrationTest.java` | Unit + Integration | ✅ backend sync baseline passing | ✅ Written | ✅ Passed (`./mvnw -q -Dtest=... test`) | ✅ multiple payload/conflict/dedupe cases | ✅ common helper extraction |
| 3.1-3.7 | `offline-types.spec.ts`, `offline-store.migrations.spec.ts`, `offline-store.service.spec.ts` | Unit | ✅ FE offline baseline passing | ✅ Written | ✅ Passed (`npx ng test --watch=false --include ...`) | ✅ schema/helpers/overlap variants | ✅ shared helper extraction |
| 4.1-5.4 | `admin-reporting-projection.spec.ts`, `admin-reporting.store.spec.ts`, `admin-reporting-page.component.spec.ts`, `admin-reporting.integration.spec.ts` | Unit + Integration | ✅ FE reporting baseline passing | ✅ Written | ✅ Passed (`npx ng test --watch=false --include ...`) | ✅ windows/presets/dedupe/integration cases | ✅ simplified projection/view-model branching |
| corrective-verify | `admin-reporting-projection.spec.ts`, `admin-reporting.utils.spec.ts`, `offline-store.service.spec.ts` | Unit | ✅ 27/27 FE baseline green before edits | ✅ Written (explicit exclusion scenario first) | ✅ Passed (`npm test -- --watch=false --include ...`) + BE safety net (`./mvnw test -Dtest=SyncPayloadMapperV2ContractTest,SyncServiceV2Test,SyncResourceV2IntegrationTest`) | ✅ exclusion + enqueue/overlap variants | ✅ shared preset exclusion helper |

### Test Summary
- **Total tests written/updated**: 24+
- **Total tests passing**: FE targeted suite 30/30 + BE targeted suite 7/7
- **Layers used**: Unit, REST integration, Angular integration
- **Approval tests**: None — behavior intentionally extended
- **Pure functions created**: projection/dedupe/window helpers for V2 reporting + preset exclusion resolver

## Status

24/24 tasks complete. Ready for `sdd-verify` rerun.
