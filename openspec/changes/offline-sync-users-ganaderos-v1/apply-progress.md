# Implementation Progress

**Change**: offline-sync-users-ganaderos-v1
**Mode**: Strict TDD

## Completed Tasks
- [x] 1.1 RED (BE): tests de matriz de capacidad offline y rechazo `OPERATION_NOT_ALLOWED_OFFLINE`
- [x] 1.2 GREEN (BE): whitelist homogénea en `SyncService` y pasaje de `currentUserId` desde `SyncResource`
- [x] 1.3 REFACTOR (BE): extracción de validación/normalización a `SyncPayloadMapper`
- [x] 1.4 Contratos FE/BE finales para `GANADERO CREATE`: outbox canónico por `operationId`, snapshot local `pending:*` y helper compartido para disparar sync global
- [x] 2.1 RED (BE): casos USER para push permitido, replay idempotente, `409 version_conflict` y pull incremental `updatedAt+id`
- [x] 2.2 GREEN (BE): handlers USER en `SyncService` y método de dominio reutilizable en `AdminUserService`
- [x] 2.3 GREEN (BE repos): `UserRepository.listChangedSince(cursorUpdatedAt,cursorId,limitPlusOne)` con orden `updatedAt,id`
- [x] 2.4 REFACTOR (BE): cursor/nextCursor USER unificado con baseline ANIMAL
- [x] 2.5 FE users: sin replay feature-level, sólo enqueue + `MANUAL_SYNC_EVENT`, preservando snapshots optimistas mientras haya pendientes USER
- [x] 3.1 RED (BE): cobertura GANADERO CREATE/STATUS_UPDATE, duplicados y conflicto `409`
- [x] 3.2 GREEN (BE): flujo GANADERO en `SyncService` y métodos de dominio reutilizables en `GanaderoService`
- [x] 3.3 GREEN (BE repos): `GanaderoRepository.listChangedSince(cursorUpdatedAt,cursorId,limitPlusOne)` con regla `updatedAt,id`
- [x] 3.4 REFACTOR (BE): clasificación homogénea `validation_error` / `version_conflict` entre USER, GANADERO y ANIMAL
- [x] 3.5 FE ganaderos: create/status sólo encolan y disparan al orquestador global; no más replay HTTP feature-specific
- [x] 4.1 FE core RED: cobertura de lotes mixtos `USER/GANADERO/ANIMAL`, reconciliación explícita `pending:*` y cursores por entidad en `sync-orchestrator.service.spec.ts`
- [x] 4.2 FE core GREEN: replay único `/api/sync`, señal central post-sync y reconciliación de snapshots pending→server id en `sync-orchestrator.service.ts`
- [x] 4.3 FE core REFACTOR: consolidación de feedback central de sync en `SyncMetricsStore` y utilidades de store para reasignar snapshots/outbox
- [x] 4.4 FE UI RED/GREEN: páginas admin users/ganaderos muestran progreso central, último mensaje post-sync y conflicto manual sin perder UX base
- [x] 5.1 Gate BE: `./mvnw -Dtest=SyncServiceTest,SyncResourceTest test` en verde sin regresión visible sobre ANIMAL
- [x] 5.2 Gate FE: `ng test` focalizado para services/orchestrator/pages afectados en verde
- [x] 5.3 REFACTOR final: limpieza de nombres/mensajes, checklist de aceptación actualizado y change listo para verify

## Files Changed
| File | Action | What Was Done |
|---|---|---|
| `hato-be/src/test/java/bo/pasorapa/hato/service/SyncServiceTest.java` | Modified | Se agregó cobertura TDD para USER y GANADERO: replay idempotente, `409`, pull incremental y `GANADERO CREATE` con identidad estable basada en `operationId`. |
| `hato-be/src/test/java/bo/pasorapa/hato/web/rest/SyncResourceTest.java` | Modified | Se extendió el contrato REST `/api/sync` para USER/GANADERO en push/pull/conflicts y se mantuvo la cobertura de rechazo offline. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/SyncService.java` | Modified | Se implementaron handlers reales offline para USER/GANADERO, cursor genérico por `updatedAt,id`, conflictos homogéneos y receipts con `entityId` canónico. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/AdminUserService.java` | Modified | Se expuso `syncUpdateStatus` reutilizable desde `/api/sync` sin romper la semántica online-only de `createUser` y `resetPassword`. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/GanaderoService.java` | Modified | Se expusieron `syncCreate` y `syncUpdateStatus`; el create offline persiste `operationId` como identidad estable del ganadero. |
| `hato-be/src/main/java/bo/pasorapa/hato/repository/UserRepository.java` | Modified | Se añadió `listChangedSince` con orden determinístico `updatedAt,id`. |
| `hato-be/src/main/java/bo/pasorapa/hato/repository/GanaderoRepository.java` | Modified | Se añadió `listChangedSince` con orden determinístico `updatedAt,id`. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/mapper/SyncPayloadMapper.java` | Modified | El mapper ahora parsea payloads de USER/GANADERO además de la matriz offline y ANIMAL. |
| `hato-fe/src/app/core/offline/sync-orchestrator.service.ts` | Modified | El orquestador centraliza feedback de sync, procesa lotes mixtos, reconcilia snapshots `pending:*` y mantiene replay único por `/api/sync`. |
| `hato-fe/src/app/core/offline/sync-orchestrator.service.spec.ts` | Modified | Se agregó TDD para lotes mixtos, cursores por entidad, reconciliación pending→server id y feedback central tras conflictos. |
| `hato-fe/src/app/core/offline/sync-metrics.store.ts` | Modified | El store central ahora expone `syncing`, `lastMessage` y `manualRefreshRequired` compartidos por UI/offline state. |
| `hato-fe/src/app/core/offline/offline-store.service.ts` | Modified | Se agregó `reassignSnapshotEntityId()` para reconciliar snapshots optimistas cuando el backend devuelve el id real. |
| `hato-fe/src/app/features/admin/users/data-access/admin-users.service.ts` | Modified | La señal `syncState` pasa a derivar del store central; `createUser`/`resetPassword` siguen online-only y `STATUS_UPDATE` permanece queue-first. |
| `hato-fe/src/app/features/admin/ganaderos/data-access/ganaderos.service.ts` | Modified | La señal `syncState` pasa a derivar del store central; `CREATE`/`STATUS_UPDATE` siguen queue-first con reconciliación canónica posterior. |
| `hato-fe/src/app/features/admin/users/admin-users-page.component.ts` | Modified | La UI muestra syncing central y el último mensaje post-sync/conflicto. |
| `hato-fe/src/app/features/admin/ganaderos/ganaderos-page.component.ts` | Modified | La UI muestra syncing central y el último mensaje post-sync/conflicto. |
| `hato-fe/src/app/features/admin/users/admin-users-page.component.spec.ts` | Modified | RED/GREEN para visibilidad de progreso central y mensajes post-sync en users. |
| `hato-fe/src/app/features/admin/ganaderos/ganaderos-page.component.spec.ts` | Modified | RED/GREEN para visibilidad de progreso central y mensajes post-sync en ganaderos. |
| `openspec/changes/offline-sync-users-ganaderos-v1/tasks.md` | Modified | Se marcaron 4.1–4.4 y 5.3 como completadas y se agregó el checklist final de aceptación. |

## Deviations from Design
Ninguna relevante. La implementación sigue el canal único `/api/sync`, mantiene `createUser`/`resetPassword` online-only y sólo agrega una señal central más rica para que la UI admin refleje el estado real del orquestador.

## Issues Found
No quedaron blockers. La única observación de tooling fue que `ng test --browsers=ChromeHeadless` no aplica con el runner Vitest actual; la suite focalizada se ejecutó con `ng test --watch=false --include=...`.

## TDD Cycle Evidence
| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 1.1 | `hato-be/src/test/java/bo/pasorapa/hato/service/SyncServiceTest.java`, `hato-be/src/test/java/bo/pasorapa/hato/web/rest/SyncResourceTest.java` | Integration | ✅ 8/8 | ✅ Written first | ✅ 11/11 passing | ✅ Allowed + disallowed matrix cases and REST rejection | ➖ None needed |
| 1.2 | `hato-be/src/test/java/bo/pasorapa/hato/service/SyncServiceTest.java`, `hato-be/src/test/java/bo/pasorapa/hato/web/rest/SyncResourceTest.java` | Integration | ✅ 8/8 | ✅ Reused RED from 1.1 | ✅ 11/11 passing | ✅ Service + REST paths exercised | ➖ None needed |
| 1.3 | `hato-be/src/test/java/bo/pasorapa/hato/service/SyncServiceTest.java`, `hato-be/src/test/java/bo/pasorapa/hato/web/rest/SyncResourceTest.java` | Integration / Approval | ✅ 11/11 | ✅ Approval baseline before refactor | ✅ 11/11 passing | ➖ Approval tests preserved behavior | ✅ Extracted `SyncPayloadMapper` |
| 1.4 | `hato-fe/src/app/features/admin/ganaderos/data-access/ganaderos.service.spec.ts`, `hato-fe/src/app/core/offline/sync-orchestrator.service.spec.ts` | Unit | ✅ 26/26 | ✅ Written first | ✅ 12/12 passing | ✅ Canonical outbox id + pending snapshot + manual sync helper | ✅ Shared `triggerManualSync()` + outbox entity reassignment |
| 2.1 | `hato-be/src/test/java/bo/pasorapa/hato/service/SyncServiceTest.java`, `hato-be/src/test/java/bo/pasorapa/hato/web/rest/SyncResourceTest.java` | Integration | ✅ 11/11 | ✅ Written first | ✅ 19/19 passing | ✅ Push + replay + pull + conflict for USER | ➖ None needed |
| 2.2 | `hato-be/src/test/java/bo/pasorapa/hato/service/SyncServiceTest.java`, `hato-be/src/test/java/bo/pasorapa/hato/web/rest/SyncResourceTest.java` | Integration | ✅ 11/11 | ✅ Reused RED from 2.1 | ✅ 19/19 passing | ✅ Service + REST USER paths exercised | ➖ None needed |
| 2.3 | `hato-be/src/test/java/bo/pasorapa/hato/service/SyncServiceTest.java`, `hato-be/src/test/java/bo/pasorapa/hato/web/rest/SyncResourceTest.java` | Integration | ✅ 11/11 | ✅ Reused RED from 2.1 | ✅ 19/19 passing | ✅ Ordered USER pull validated with múltiples rows | ➖ None needed |
| 2.4 | `hato-be/src/test/java/bo/pasorapa/hato/service/SyncServiceTest.java`, `hato-be/src/test/java/bo/pasorapa/hato/web/rest/SyncResourceTest.java` | Integration / Approval | ✅ 19/19 | ✅ Approval baseline before cursor refactor | ✅ 19/19 passing | ✅ Shared cursor builder verified across ANIMAL/USER | ✅ Generic pull cursor helpers |
| 2.5 | `hato-fe/src/app/features/admin/users/data-access/admin-users.service.spec.ts` | Unit | ✅ 26/26 | ✅ Written first | ✅ 12/12 passing | ✅ Online queue + local optimistic read path | ✅ Feature now depends on shared manual-sync helper |
| 3.1 | `hato-be/src/test/java/bo/pasorapa/hato/service/SyncServiceTest.java`, `hato-be/src/test/java/bo/pasorapa/hato/web/rest/SyncResourceTest.java` | Integration | ✅ 11/11 | ✅ Written first | ✅ 19/19 passing | ✅ Create + status + duplicate + conflict for GANADERO | ➖ None needed |
| 3.2 | `hato-be/src/test/java/bo/pasorapa/hato/service/SyncServiceTest.java`, `hato-be/src/test/java/bo/pasorapa/hato/web/rest/SyncResourceTest.java` | Integration | ✅ 11/11 | ✅ Reused RED from 3.1 | ✅ 19/19 passing | ✅ Domain service + sync handlers for GANADERO exercised | ➖ None needed |
| 3.3 | `hato-be/src/test/java/bo/pasorapa/hato/service/SyncServiceTest.java`, `hato-be/src/test/java/bo/pasorapa/hato/web/rest/SyncResourceTest.java` | Integration | ✅ 11/11 | ✅ Reused RED from 3.1 | ✅ 19/19 passing | ✅ Ordered GANADERO pull validated with múltiples rows | ➖ None needed |
| 3.4 | `hato-be/src/test/java/bo/pasorapa/hato/service/SyncServiceTest.java`, `hato-be/src/test/java/bo/pasorapa/hato/web/rest/SyncResourceTest.java` | Integration / Approval | ✅ 19/19 | ✅ Approval baseline before error/cursor homogenization | ✅ 19/19 passing | ✅ Shared validation/conflict semantics verified | ✅ Generic `noConflict`/`versionConflict`/cursor helpers |
| 3.5 | `hato-fe/src/app/features/admin/ganaderos/data-access/ganaderos.service.spec.ts` | Unit | ✅ 26/26 | ✅ Written first | ✅ 12/12 passing | ✅ Offline create + online create + online status | ✅ Canonical-id helper + snapshot persistence by entity key |
| 4.1 | `hato-fe/src/app/core/offline/sync-orchestrator.service.spec.ts` | Unit | ✅ 22/22 | ✅ Written first | ✅ 32/32 passing | ✅ Mixed push results + per-entity pull cursors + pending reconciliation | ➖ Covered by same cycle with 4.2 |
| 4.2 | `hato-fe/src/app/core/offline/sync-orchestrator.service.spec.ts` | Unit | ✅ 22/22 | ✅ Reused RED from 4.1 | ✅ 32/32 passing | ✅ Snapshot reconciliation + conflict feedback + cursor advancement | ✅ Replay remains centralized in orchestrator |
| 4.3 | `hato-fe/src/app/core/offline/sync-orchestrator.service.spec.ts`, `hato-fe/src/app/features/admin/{users,ganaderos}/data-access/*.spec.ts` | Unit / Approval | ✅ 25/25 | ✅ Approval baseline before central-state refactor | ✅ 32/32 passing | ✅ Shared central state consumed by both admin features | ✅ `SyncMetricsStore` + `OfflineStoreService` responsibilities clarified |
| 4.4 | `hato-fe/src/app/features/admin/users/admin-users-page.component.spec.ts`, `hato-fe/src/app/features/admin/ganaderos/ganaderos-page.component.spec.ts` | Unit | ✅ 22/22 | ✅ Written first | ✅ 32/32 passing | ✅ Syncing state + post-sync message rendered in both admin pages | ➖ UI structure already clean |
| 5.1 | `hato-be/src/test/java/bo/pasorapa/hato/service/SyncServiceTest.java`, `hato-be/src/test/java/bo/pasorapa/hato/web/rest/SyncResourceTest.java` | Integration | ✅ 19/19 | ✅ Existing targeted suite used as release gate | ✅ 19/19 passing | ➖ Suite-level gate | ➖ None needed |
| 5.2 | `hato-fe/src/app/features/admin/users/data-access/admin-users.service.spec.ts`, `hato-fe/src/app/features/admin/ganaderos/data-access/ganaderos.service.spec.ts`, `hato-fe/src/app/core/offline/sync-orchestrator.service.spec.ts`, `hato-fe/src/app/features/admin/users/admin-users-page.component.spec.ts`, `hato-fe/src/app/features/admin/ganaderos/ganaderos-page.component.spec.ts` | Unit | ✅ 25/25 | ✅ Focused gate updated after RED additions | ✅ 32/32 passing | ➖ Suite-level gate | ➖ None needed |
| 5.3 | `openspec/changes/offline-sync-users-ganaderos-v1/tasks.md`, `hato-fe/src/app/core/offline/sync-orchestrator.service.spec.ts` | Refactor / Docs | ✅ 32/32 | ✅ Checklist/assertion updates written after green coverage | ✅ 32/32 passing + BE 19/19 | ✅ Acceptance checklist and final wording stabilized | ✅ Final cleanup only, sin cambio de contrato |

## Test Summary
- **Total tests written**: 20 acumulados (11 BE + 9 FE nuevos)
- **Latest targeted passing runs**: FE 32/32 (`admin-users.service.spec.ts`, `ganaderos.service.spec.ts`, `sync-orchestrator.service.spec.ts`, `admin-users-page.component.spec.ts`, `ganaderos-page.component.spec.ts`) + BE 19/19 (`SyncServiceTest`, `SyncResourceTest`)
- **Layers used**: Integration (BE), Unit (FE)
- **Approval tests**: Existing sync service/resource tests y baseline FE focalizada reutilizados para refactors 1.3, 2.4, 3.4 y 4.3
- **Pure/shared functions created**: `reassignSnapshotEntityId()` en store y expansión central de `SyncMetricsStore`; se mantiene `triggerManualSync()` como helper compartido de disparo

## Remaining Tasks
- [x] Ninguna. El change quedó completo para `sdd-verify`.

## Status
21/21 tareas completadas acumuladas. El canal único offline queda cerrado para USER/GANADERO/ANIMAL, la reconciliación `pending:*` ya no duplica snapshots y la UI admin consume señal central post-sync suficiente para pasar a verify.
