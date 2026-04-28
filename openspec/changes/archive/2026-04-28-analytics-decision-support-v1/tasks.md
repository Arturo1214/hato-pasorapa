# Tasks: Analytics Decision Support V1

## Phase 1: Foundation & Contracts (TDD first)

- [x] 1.1 **RED** FE: `hato-fe/src/app/core/offline/offline-types.spec.ts` valida contratos y ausencia de campos predictivos/autoAction.
- [x] 1.2 **GREEN** FE: `hato-fe/src/app/core/offline/offline-types.ts` agrega `DecisionSupportInsight` y `DecisionSupportDerivedState`.
- [x] 1.3 **GREEN** FE: `hato-fe/src/app/core/offline/offline-store.service.ts` agrega `get/setDecisionSupportState` y reset.
- [x] 1.4 **GREEN** FE: `hato-fe/src/app/core/offline/offline-store.migrations.ts` inicializa estado derivado.
- [x] 1.5 **REFACTOR** FE: ordenar fixtures offline compartidas para reporting/decision-support.

## Phase 2: Projection Rules, Explainability & Guardrails

- [x] 2.1 **RED** FE: `hato-fe/src/app/features/admin/decision-support/data-access/admin-decision-support-projection.spec.ts` cubre ventanas `7d/30d/90d` y alineación `occurredAt/periodKey`.
- [x] 2.2 **RED** FE: `hato-fe/src/app/features/admin/decision-support/data-access/admin-decision-support.utils.spec.ts` rechaza `forecast|score|optimization|autoAction` y datos fuera de ventana.
- [x] 2.3 **GREEN** FE: `hato-fe/src/app/features/admin/decision-support/data-access/admin-decision-support.utils.ts` implementa ventanas válidas, severidad y guardrails.
- [x] 2.4 **GREEN** FE: `hato-fe/src/app/features/admin/decision-support/data-access/admin-decision-support-projection.ts` construye insights explicables con `source/rule/window/manualActions`.
- [x] 2.5 **GREEN** FE: `hato-fe/src/app/features/admin/reporting/data-access/admin-reporting-projection.ts` expone base reusable.

## Phase 3: Store Incremental Cache & Route Wiring

- [x] 3.1 **RED** FE: `hato-fe/src/app/features/admin/decision-support/data-access/admin-decision-support.store.spec.ts` valida cache reuse, invalidación por `sourceSignature/latestSyncAt` y recompute sin duplicados.
- [x] 3.2 **GREEN** FE: `hato-fe/src/app/features/admin/decision-support/data-access/admin-decision-support.store.ts` implementa signals, `ensureFresh` y persistencia offline.
- [x] 3.3 **RED** FE: `hato-fe/src/app/features/admin/decision-support/admin-decision-support-page.component.spec.ts` valida cards, explainability, bloqueo auto-apply y estado offline.
- [x] 3.4 **GREEN** FE: `hato-fe/src/app/features/admin/decision-support/admin-decision-support-page.component.ts` crea pantalla standalone `admin/decision-support`.
- [x] 3.5 **GREEN** FE: `hato-fe/src/app/app.routes.ts` agrega ruta admin protegida con fallback a `admin/reportes`.

## Phase 4: Backend Non-regression & Cross-layer Verification

- [x] 4.1 **RED** BE: extender `hato-be/src/test/java/bo/pasorapa/hato/web/rest/SyncResourceV2IntegrationTest.java` para confirmar `/api/sync` sin contrato analytics nuevo.
- [x] 4.2 **GREEN** BE: ajustar fixtures/assertions para conservar snapshots requeridos por FE.
- [x] 4.3 **REFACTOR** BE/FE: centralizar mensajes/constantes de guardrail de alcance.

## Phase 5: Execution, Quality Gate & Environment Discipline

- [x] 5.1 Ejecutar FE tests con `nvm use` y runner del repo, respetando RED→GREEN.
- [x] 5.2 Ejecutar BE tests con `jenv shell 21` y `./mvnw test -Dtest=*Sync*`.
- [x] 5.3 Verificar escenarios spec: offline render, recompute post-sync, explainability y guardrails.
- [x] 5.4 Mantener este checklist actualizado durante `sdd-apply`.
