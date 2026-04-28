# Tasks: Sync Observability V2

## Decisiones cerradas (por defecto)

- Ventanas V2 obligatorias: `24h` y `7d`.
- Límite de errores/conflictos recientes: `20`.
- `stale` por entidad: default `24h` si no existe override por tipo.

## Phase 1: Contracto y defaults (Foundation)

- [x] 1.1 RED FE: crear/ajustar tests de tipos en `hato-fe/src/app/core/offline/sync-metrics.store.spec.ts` para exigir ventanas V2 `24h|7d`, límite recientes `20` y `stale` default `24h`.
- [x] 1.2 GREEN FE: actualizar `hato-fe/src/app/core/offline/offline-types.ts` con `MetricsWindow`, tipos de estado de cola y config de thresholds por entidad con override opcional.
- [x] 1.3 REFACTOR FE: consolidar constantes de diccionario y defaults en `hato-fe/src/app/core/offline/sync-metrics.store.ts` sin romper selector legacy.
- [x] 1.4 RED BE: agregar tests de contrato en `hato-be/src/test/java/bo/pasorapa/hato/service/SyncServiceTest.java` para validar ventanas permitidas (`24h`,`7d`) y fallback default `24h`.
- [x] 1.5 GREEN BE: crear `hato-be/src/main/java/bo/pasorapa/hato/service/dto/sync/SyncMetricDictionaryEntry.java` y `SyncObservabilityResponse.java` con diccionario explícito y campos de recientes limitados a 20.

## Phase 2: Runtime FE (Core)

- [x] 2.1 RED: extender `hato-fe/src/app/core/offline/sync-orchestrator.service.spec.ts` con casos de trigger, ciclo en progreso (`finishedAt=null`), duraciones push/pull/total y compatibilidad legacy.
- [x] 2.2 GREEN: instrumentar `hato-fe/src/app/core/offline/sync-orchestrator.service.ts` para publicar snapshot V2 por ciclo con trigger y timings.
- [x] 2.3 RED: crear tests en `hato-fe/src/app/core/offline/offline-store.service.spec.ts` para agregados por estado/entidad, top errores/conflictos y truncado a 20 recientes.
- [x] 2.4 GREEN: implementar `summarizeOutboxByStatusAndEntity()`, `summarizeErrors(limit=20)`, `listCheckpointHealth(now, staleOverride?)` en `hato-fe/src/app/core/offline/offline-store.service.ts`.
- [x] 2.5 REFACTOR: actualizar `hato-fe/src/app/core/offline/sync-metrics.store.ts` con store/selectors V2 (`cycle`,`queue`,`errors`,`conflicts`,`entityHealth`) y puente legacy.

## Phase 3: Históricos BE + endpoint mínimo (Core/Integration)

- [x] 3.1 RED: ampliar `SyncServiceTest` con fixtures para agregados 24h/7d, breakdown por entidad, conflictos abiertos/resueltos y bloqueadas.
- [x] 3.2 GREEN: implementar agregaciones en `hato-be/src/main/java/bo/pasorapa/hato/repository/SyncOperationReceiptRepository.java` (window, entidad, reason/opType, latencias).
- [x] 3.3 GREEN: implementar agregados de resolución en `hato-be/src/main/java/bo/pasorapa/hato/repository/SyncConflictAuditLedgerRepository.java`.
- [x] 3.4 GREEN: implementar `getObservability(window)` en `hato-be/src/main/java/bo/pasorapa/hato/service/SyncService.java` usando diccionario único y límite 20 recientes.
- [x] 3.5 RED: agregar tests REST en `hato-be/src/test/java/bo/pasorapa/hato/web/rest/SyncResourceTest.java` para default 24h, aceptación 7d y rechazo de window inválida.
- [x] 3.6 GREEN: exponer `GET /api/sync/observability` en `hato-be/src/main/java/bo/pasorapa/hato/web/rest/SyncResource.java` con validación de query param.

## Phase 4: UI observabilidad + verificación (Integration/Testing)

- [x] 4.1 RED: crear tests de componente para panel de observabilidad en `hato-fe/src/app/features/sync-observability/sync-observability.component.spec.ts` (runtime + histórico + estados vacíos/error).
- [x] 4.2 GREEN: crear UI mínima en `hato-fe/src/app/features/sync-observability/sync-observability.component.ts|html|scss` con tarjetas de ciclo, cola, conflictos, top razones y health por entidad.
- [x] 4.3 GREEN: crear cliente `hato-fe/src/app/core/api/sync-observability.api.ts` y wiring en store/selectors para consumir endpoint BE por ventana `24h|7d`.
- [x] 4.4 REFACTOR: ajustar rutas/navegación y naming para coherencia de diccionario; documentar decisions cerradas en `openspec/changes/sync-observability-v2/design.md` (ventanas, límite 20, stale default 24h).
- [x] 4.5 VERIFY: ejecutar suites FE/BE del cambio y dejar checklist de escenarios de spec cubiertos en `openspec/changes/sync-observability-v2/tasks.md` (referencia por requisito).

## Checklist de cobertura por requirement

- [x] Runtime Snapshot Metrics (FE)
  - `sync-orchestrator.service.spec.ts`: trigger, `finishedAt=null`, timings push/pull/total.
- [x] Queue Pending State and Outcome Counters (FE)
  - `offline-store.service.spec.ts`: agregados globales y por entidad.
  - `sync-orchestrator.service.spec.ts`: `in_flight` visible durante ciclo activo.
- [x] Errors and Conflicts Operational View
  - `offline-store.service.spec.ts`: top errores locales.
  - `SyncServiceTest.java`: top reasons, conflictos abiertos/bloqueados.
  - `SyncResourceTest.java`: contrato REST `/api/sync/observability`.
- [x] Global and Entity Sync Status
  - `offline-store.service.spec.ts`: staleness default 24h.
  - `sync-observability.component.spec.ts`: health por entidad visible en UI.
- [x] Historical Aggregates API (BE)
  - `SyncServiceTest.java`: default/fixed windows y payload agregado.
  - `SyncResourceTest.java`: `24h`, `7d` y rechazo de window inválida.
- [x] Explicit Non-Goals and Exclusions
  - Implementación limitada a runtime FE + endpoint mínimo `/api/sync/observability`; sin APM ni rediseño del protocolo `/api/sync`.
