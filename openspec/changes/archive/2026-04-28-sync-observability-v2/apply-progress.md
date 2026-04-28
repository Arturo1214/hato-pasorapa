# Implementation Progress

**Change**: sync-observability-v2
**Mode**: Strict TDD

## Completed Tasks
- [x] 1.1 RED FE: contratos de ventanas V2, recientes=20 y stale default 24h en `sync-metrics.store.spec.ts`
- [x] 1.2 GREEN FE: tipos V2 (`MetricsWindow`, queue states, runtime/historical snapshots) en `offline-types.ts`
- [x] 1.3 REFACTOR FE: diccionario único/defaults en `sync-metrics.store.ts` con puente legacy intacto
- [x] 1.4 RED BE: validación de ventanas permitidas y fallback `24h` en `SyncServiceTest.java`
- [x] 1.5 GREEN BE: DTOs `SyncMetricDictionaryEntry` + `SyncObservabilityResponse` con recientes limitados a 20
- [x] 2.1 RED FE: cobertura de trigger, ciclo abierto y timings en `sync-orchestrator.service.spec.ts`
- [x] 2.2 GREEN FE: snapshot runtime V2 por ciclo en `sync-orchestrator.service.ts`
- [x] 2.3 RED FE: cobertura de agregados locales y truncado en `offline-store.service.spec.ts`
- [x] 2.4 GREEN FE: agregadores `summarizeOutboxByStatusAndEntity`, `summarizeErrors`, `listCheckpointHealth`
- [x] 2.5 REFACTOR FE: selectors runtime/historical V2 y compatibilidad legacy en `SyncMetricsStore`
- [x] 3.1 RED BE: fixtures de agregados y conflictos para observability en `SyncServiceTest.java`
- [x] 3.2 GREEN BE: lecturas por ventana en `SyncOperationReceiptRepository.java`
- [x] 3.3 GREEN BE: lecturas por ventana en `SyncConflictAuditLedgerRepository.java`
- [x] 3.4 GREEN BE: `SyncService.getObservability(window)` con diccionario único y recientes limitados
- [x] 3.5 RED BE: contrato REST `24h`/`7d`/window inválida en `SyncResourceTest.java`
- [x] 3.6 GREEN BE: `GET /api/sync/observability` en `SyncResource.java`
- [x] 4.1 RED FE: panel `sync-observability.component.spec.ts` con runtime/histórico/vacíos/error
- [x] 4.2 GREEN FE: UI mínima operativa con tarjetas de ciclo, cola, conflictos, top reasons y health
- [x] 4.3 GREEN FE: cliente `sync-observability.api.ts` + `SyncObservabilityStore`
- [x] 4.4 REFACTOR FE: ruta `/admin/sync-observability`, sidebar y decisions cerradas en `design.md`
- [x] 4.5 VERIFY gate: suites FE/BE focalizadas en verde + checklist de spec agregado a `tasks.md`

## Files Changed
| File | Action | What Was Done |
|---|---|---|
| `hato-fe/src/app/core/offline/offline-types.ts` | Modified | Se agregaron contratos V2 para windows, cola, runtime/histórico, issues y health por entidad. |
| `hato-fe/src/app/core/offline/sync-metrics.store.ts` | Modified | Se consolidó el diccionario único V2, defaults cerrados y selectors runtime/historical sin romper el contrato legacy. |
| `hato-fe/src/app/core/offline/sync-metrics.store.spec.ts` | Created | RED/GREEN de ventanas, límite 20 y stale default 24h. |
| `hato-fe/src/app/core/offline/offline-store.service.ts` | Modified | Se implementaron agregados locales de cola, errores y staleness por checkpoint. |
| `hato-fe/src/app/core/offline/offline-store.service.spec.ts` | Modified | Cobertura de agregados globales/por entidad y health stale con default 24h. |
| `hato-fe/src/app/core/offline/sync-orchestrator.service.ts` | Modified | Se instrumentó trigger/timings y publicación de snapshot runtime V2 durante el ciclo. |
| `hato-fe/src/app/core/offline/sync-orchestrator.service.spec.ts` | Modified | Cobertura de ciclo abierto, timings y compatibilidad legacy con runtime V2. |
| `hato-fe/src/app/core/api/sync-observability.api.ts` | Created | Cliente mínimo para `/api/sync/observability?window=24h|7d`. |
| `hato-fe/src/app/features/sync-observability/**` | Created | Store + componente standalone + tests para la UI operativa de observabilidad. |
| `hato-fe/src/app/app.routes.ts` | Modified | Se agregó la ruta `/admin/sync-observability`. |
| `hato-fe/src/app/ui/layout/main-layout/sidebar.ts` | Modified | Se agregó navegación visible a “Sync observability”. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/dto/sync/SyncMetricDictionaryEntry.java` | Created | Diccionario único serializable para métricas V2. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/dto/sync/SyncObservabilityResponse.java` | Created | DTO agregado con totals, byEntity, topReasons, conflicts, health y recientes. |
| `hato-be/src/main/java/bo/pasorapa/hato/repository/SyncOperationReceiptRepository.java` | Modified | Lectura de receipts por ventana para agregados observability. |
| `hato-be/src/main/java/bo/pasorapa/hato/repository/SyncConflictAuditLedgerRepository.java` | Modified | Lectura del ledger por ventana para abiertos/resueltos y recientes. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/SyncService.java` | Modified | Se agregó `getObservability(window)` + validación de ventanas y agregación V2. |
| `hato-be/src/main/java/bo/pasorapa/hato/web/rest/SyncResource.java` | Modified | Se expuso el endpoint REST mínimo `/api/sync/observability`. |
| `hato-be/src/test/java/bo/pasorapa/hato/service/SyncServiceTest.java` | Modified | RED/GREEN de validación de ventanas y agregados con recientes limitados. |
| `hato-be/src/test/java/bo/pasorapa/hato/web/rest/SyncResourceTest.java` | Modified | RED/GREEN del contrato REST `24h`/`7d`/window inválida. |
| `openspec/changes/sync-observability-v2/tasks.md` | Modified | Tareas marcadas completas y checklist de coverage por requirement. |
| `openspec/changes/sync-observability-v2/design.md` | Modified | Open questions cerradas según decisiones definitivas del change. |

## Deviations from Design
Ninguna relevante. La implementación mantuvo el endpoint mínimo derivado, el diccionario único V2 y el modelo híbrido runtime FE + histórico BE.

## Issues Found
Sin blockers. La única simplificación consciente fue modelar `resolved` runtime FE como 0 local, dejando el split abierto/resuelto completo al histórico BE, que es donde existe el ledger durable.

## TDD Cycle Evidence
| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 1.1 | `hato-fe/src/app/core/offline/sync-metrics.store.spec.ts` | Unit | N/A (new) | ✅ Written first | ✅ Passed | ➖ Structural constants only | ✅ Defaults consolidated |
| 1.2 | `hato-fe/src/app/core/offline/sync-metrics.store.spec.ts` | Unit | N/A (new) | ✅ Reused RED | ✅ Passed | ➖ Structural contracts only | ✅ Types aligned to dictionary |
| 1.3 | `hato-fe/src/app/core/offline/sync-metrics.store.spec.ts` | Unit / Approval | ✅ 23/23 | ✅ Approval baseline before refactor | ✅ 25/25 passing | ➖ Structural consolidation | ✅ Legacy + V2 selectors coexist |
| 1.4 | `hato-be/src/test/java/bo/pasorapa/hato/service/SyncServiceTest.java` | Integration | ✅ 46/46 | ✅ Written first | ✅ Passed | ✅ null/blank/7d/invalid cases | ➖ None needed |
| 1.5 | `hato-be/src/test/java/bo/pasorapa/hato/service/SyncServiceTest.java` | Integration | ✅ 46/46 | ✅ Reused RED | ✅ Passed | ✅ Dictionary + recent issues bounded | ➖ DTOs already compact |
| 2.1 | `hato-fe/src/app/core/offline/sync-orchestrator.service.spec.ts` | Unit | ✅ 23/23 | ✅ Written first | ✅ Passed | ✅ finished + in-progress scenarios | ➖ None needed |
| 2.2 | `hato-fe/src/app/core/offline/sync-orchestrator.service.spec.ts` | Unit | ✅ 23/23 | ✅ Reused RED | ✅ Passed | ✅ timings + queue visibility exercised | ✅ Runtime helpers extracted |
| 2.3 | `hato-fe/src/app/core/offline/offline-store.service.spec.ts` | Unit | ✅ 23/23 | ✅ Written first | ✅ Passed | ✅ queue summary + error summary cases | ➖ None needed |
| 2.4 | `hato-fe/src/app/core/offline/offline-store.service.spec.ts` | Unit | ✅ 23/23 | ✅ Reused RED | ✅ Passed | ✅ health stale + grouped errors | ✅ Small helper extraction |
| 2.5 | `hato-fe/src/app/core/offline/sync-metrics.store.spec.ts`, `sync-orchestrator.service.spec.ts` | Unit / Approval | ✅ 23/23 | ✅ Approval baseline before refactor | ✅ 32/32 passing | ✅ Runtime + historical selectors exercised | ✅ Store responsibilities clarified |
| 3.1 | `hato-be/src/test/java/bo/pasorapa/hato/service/SyncServiceTest.java` | Integration | ✅ 46/46 | ✅ Written first | ✅ Passed | ✅ totals/byEntity/conflicts/health cases | ➖ None needed |
| 3.2 | `hato-be/src/test/java/bo/pasorapa/hato/service/SyncServiceTest.java` | Integration | ✅ 46/46 | ✅ Reused RED | ✅ Passed | ✅ receipts per entity/operationType | ➖ None needed |
| 3.3 | `hato-be/src/test/java/bo/pasorapa/hato/service/SyncServiceTest.java` | Integration | ✅ 46/46 | ✅ Reused RED | ✅ Passed | ✅ ledger open/resolved/recent issues | ➖ None needed |
| 3.4 | `hato-be/src/test/java/bo/pasorapa/hato/service/SyncServiceTest.java` | Integration | ✅ 46/46 | ✅ Reused RED | ✅ Passed | ✅ 24h payload + limit 20 | ✅ Aggregation helpers embedded in service |
| 3.5 | `hato-be/src/test/java/bo/pasorapa/hato/web/rest/SyncResourceTest.java` | Integration | ✅ 46/46 | ✅ Written first | ✅ Passed | ✅ default/7d/invalid REST cases | ➖ None needed |
| 3.6 | `hato-be/src/test/java/bo/pasorapa/hato/web/rest/SyncResourceTest.java` | Integration | ✅ 46/46 | ✅ Reused RED | ✅ Passed | ✅ endpoint path + payload exercised | ➖ Resource remains thin |
| 4.1 | `hato-fe/src/app/features/sync-observability/sync-observability.component.spec.ts` | Unit | N/A (new) | ✅ Written first | ✅ Passed | ✅ runtime + empty + error states | ➖ None needed |
| 4.2 | `hato-fe/src/app/features/sync-observability/sync-observability.component.spec.ts` | Unit | N/A (new) | ✅ Reused RED | ✅ Passed | ✅ queue/reasons/health rendering | ✅ Template kept minimal |
| 4.3 | `hato-fe/src/app/features/sync-observability/sync-observability.component.spec.ts` | Unit | ✅ 25/25 | ✅ Approval baseline for wiring | ✅ 32/32 passing | ✅ client/store/component flow exercised | ✅ Dedicated store added |
| 4.4 | `hato-fe/src/app/ui/layout/main-layout/sidebar/sidebar.spec.ts` | Unit | ✅ 23/23 | ✅ Written first | ✅ Passed | ✅ admin + ganadero navigation cases | ✅ Route/sidebar naming aligned |
| 4.5 | FE/BE targeted suites | Unit + Integration | ✅ Baseline captured | ✅ Existing targeted suites updated after REDs | ✅ FE 32/32 + BE 51/51 | ➖ Suite gate | ➖ None needed |

## Test Summary
- **Total tests written**: 9 nuevos/ajustados relevantes al change (FE 6, BE 3)
- **Latest targeted passing runs**: FE 32/32 (`sync-metrics.store.spec.ts`, `offline-store.service.spec.ts`, `sync-orchestrator.service.spec.ts`, `sync-observability.component.spec.ts`, `sidebar.spec.ts`) + BE 51/51 (`SyncServiceTest`, `SyncResourceTest`, `SyncConflictAuditLedgerRepositoryTest`)
- **Layers used**: Unit (FE), Integration (BE)
- **Approval tests**: baselines focalizadas de `sync-orchestrator.service.spec.ts`, `sidebar.spec.ts`, `SyncServiceTest`, `SyncResourceTest`
- **Pure/shared functions created**: helpers de diffs/aggregation en FE y validación de window/agregación reason counters en BE

## Remaining Tasks
- [x] Ninguna. El change quedó listo para `sdd-verify`.

## Status
20/20 tareas completadas. Runtime FE, histórico BE, endpoint mínimo, persistencia agregada, UI operativa y suites focalizadas quedaron listos para verify.
