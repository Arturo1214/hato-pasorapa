# Tasks: Integral Herd Management V2

## Defaults cerrados para V2
- Moneda: única moneda de instalación (`currency` fija), sin conversión.
- `periodKey`: mensual fijo con formato `YYYY-MM`.
- KPIs descriptivos: sólo ventanas `7d`, `30d`, `90d`.

## Phase 1: Contratos y migraciones base (TDD Foundation)
- [x] 1.1 **RED-BE** Crear `SyncPayloadMapperV2ContractTest` para validar `periodKey` mensual, moneda única, amount>=0, category/source requeridos y no-overlap de `LOT_ASSIGNMENT`.
- [x] 1.2 **GREEN-BE** Extender `SyncEntityType.java` con `LOT`, `LOT_ASSIGNMENT`, `PRODUCTIVITY_LEDGER`, `COST_LEDGER`.
- [x] 1.3 **GREEN-BE** Crear entidades `HerdLot`, `HerdLotAssignment`, `HerdProductivityLedger`, `HerdCostLedger` en `hato-be/.../domain/` con constraints de identidad y negocio.
- [x] 1.4 **GREEN-BE** Crear repositorios Panache en `hato-be/.../repository/` con `findByOperationId` y `listChangedSince` por cursor.
- [x] 1.5 **GREEN-BE** Crear `db/changelog/011-integral-herd-management-v2.yaml` + incluirlo en `master.yaml`.
- [x] 1.6 **REFACTOR-BE** Consolidar validaciones comunes V2 en helpers de mapper/service para evitar duplicación.

## Phase 2: Sync backend V2 por entidad
- [x] 2.1 **RED-BE** Crear tests unitarios `SyncServiceV2Test` para CREATE/UPDATE/PULL y resolución determinística (`updatedAt`, desempate `operationId`).
- [x] 2.2 **GREEN-BE** Implementar en `SyncPayloadMapper.java` parseo y policy matrix V2 por entidad/opType.
- [x] 2.3 **GREEN-BE** Implementar en `SyncService.java` handlers V2, dedupe por identidad ledger y rechazo overlap activo.
- [x] 2.4 **RED-BE-INT** Crear `SyncResourceV2IntegrationTest` (rest-assured) para push/pull offline, conflicto V2 y política aplicada.
- [x] 2.5 **GREEN-BE-INT** Ajustar wiring REST/service para pasar todos los escenarios de integración.

## Phase 3: Offline FE entidades y reconciliación
- [x] 3.1 **RED-FE** Crear specs en `offline-types.spec.ts` y `offline-store.migrations.spec.ts` para schema v9, tipos V2, `periodKey` mensual y moneda fija.
- [x] 3.2 **GREEN-FE** Extender `offline-types.ts` con entity types V2, snapshots y identities de ledgers.
- [x] 3.3 **GREEN-FE** Implementar migración v9 en `offline-store.migrations.ts` normalizando `syncState.meta.reporting` y firmas V2.
- [x] 3.4 **RED-FE** Crear specs `offline-store.service.spec.ts` para enqueue/snapshot/query/invalidación por entidades V2.
- [x] 3.5 **GREEN-FE** Implementar helpers V2 en `offline-store.service.ts`.
- [x] 3.6 **GREEN-FE** Extender `sync-orchestrator.service.ts` con `supportedEntities` V2 y refresh hooks de reporting.
- [x] 3.7 **REFACTOR-FE** Extraer utilidades de validación temporal/dedupe para reutilizarlas entre store y reporting.

## Phase 4: Proyecciones KPI y reporting admin
- [x] 4.1 **RED-FE** Crear `admin-reporting-projection.spec.ts` para KPIs descriptivos (`7d|30d|90d`), desgloses por lote y guardrail “sin predictiva”.
- [x] 4.2 **GREEN-FE** Implementar `projectAdminReportingV2` en `admin-reporting-projection.ts` con dedupe determinístico.
- [x] 4.3 **RED-FE** Crear `admin-reporting.store.spec.ts` para rebuild post-sync con snapshots V2 y presets declarados.
- [x] 4.4 **GREEN-FE** Ajustar `admin-reporting.store.ts` y `admin-reporting.utils.ts` (ventanas permitidas, rechazo ad-hoc, exclusiones V1 explícitas).
- [x] 4.5 **GREEN-FE** Actualizar `admin-reporting-page.component.ts` con cards/desgloses V2 y mensajes de alcance descriptivo.
- [x] 4.6 **REFACTOR-FE** Simplificar mapeos view-model/reporting para minimizar branching por ventana.

## Phase 5: Verificación end-to-end técnica y endurecimiento
- [x] 5.1 **RED-FE-INT** Crear `admin-reporting.integration.spec.ts` para flujo offline→sync→rebuild KPI V2.
- [x] 5.2 **GREEN-FE-INT** Corregir integración FE/BE hasta cumplir escenarios de specs de lotes, productividad, costos y policy matrix.
- [x] 5.3 **TEST-REGRESSION** Agregar suite de no-regresión para reporting V1 (`7d/30d`) coexistiendo con V2 (`90d`).
- [x] 5.4 **HARDENING** Documentar contratos V2 y decisiones cerradas en comentarios técnicos de mapper/projection y actualizar checklist de exclusiones no predictivas.
