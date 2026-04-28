# Tasks: Offline Sync Users y Ganaderos v1

## Phase 1: Foundation técnica y contrato único (BE-first)

- [x] 1.1 **RED (BE)**: ampliar `hato-be/src/test/java/bo/pasorapa/hato/service/SyncServiceTest.java` y `.../web/rest/SyncResourceTest.java` con matriz de capacidad (`USER STATUS_UPDATE`, `GANADERO CREATE|STATUS_UPDATE`) y rechazo `OPERATION_NOT_ALLOWED_OFFLINE`.
- [x] 1.2 **GREEN (BE)**: implementar whitelist homogénea por `entityType/opType` en `hato-be/src/main/java/bo/pasorapa/hato/service/SyncService.java` y pasar `currentUserId` desde `.../web/rest/SyncResource.java`.
- [x] 1.3 **REFACTOR (BE)**: extraer validación/normalización a `hato-be/src/main/java/bo/pasorapa/hato/service/mapper/SyncPayloadMapper.java` para evitar lógica ad-hoc en `SyncService`.
- [x] 1.4 **Contratos**: cerrar identidad idempotente de `GANADERO CREATE` (usar `operationId` estable) ajustando payload FE/BE en `sync-orchestrator.service.ts`, `ganaderos.service.ts` y DTOs/mapeo de sync BE.

## Phase 2: Capability USER (push/pull/conflicto/idempotencia)

- [x] 2.1 **RED (BE)**: agregar casos USER en `SyncServiceTest.java` (push permitido, duplicado idempotente, `409 version_conflict`, pull incremental `updatedAt+id`).
- [x] 2.2 **GREEN (BE)**: implementar handlers USER en `SyncService.java` y método de dominio reutilizable en `hato-be/src/main/java/bo/pasorapa/hato/service/AdminUserService.java`.
- [x] 2.3 **GREEN (BE repos)**: agregar `listChangedSince(cursorUpdatedAt,cursorId,limitPlusOne)` en `hato-be/src/main/java/bo/pasorapa/hato/repository/UserRepository.java` con orden `updatedAt,id`.
- [x] 2.4 **REFACTOR (BE)**: unificar armado de cursor/nextCursor USER con baseline ANIMAL en `SyncService.java`.
- [x] 2.5 **RED/GREEN (FE)**: actualizar `hato-fe/src/app/features/admin/users/data-access/admin-users.service.spec.ts` y luego `.../admin-users.service.ts` para eliminar replay feature-level y encolar + trigger del orquestador.

## Phase 3: Capability GANADERO (push/pull/conflicto/idempotencia)

- [x] 3.1 **RED (BE)**: ampliar `SyncServiceTest.java` y `SyncResourceTest.java` con GANADERO CREATE/STATUS_UPDATE, duplicados y conflicto 409.
- [x] 3.2 **GREEN (BE)**: implementar flujo GANADERO en `SyncService.java` y métodos de dominio en `hato-be/src/main/java/bo/pasorapa/hato/service/GanaderoService.java`.
- [x] 3.3 **GREEN (BE repos)**: implementar cursor incremental en `hato-be/src/main/java/bo/pasorapa/hato/repository/GanaderoRepository.java` con regla `updatedAt,id`.
- [x] 3.4 **REFACTOR (BE)**: homogeneizar clasificación de errores (`validation_error`, `version_conflict`) entre USER/GANADERO/ANIMAL en `SyncService.java`.
- [x] 3.5 **RED/GREEN (FE)**: actualizar `hato-fe/src/app/features/admin/ganaderos/data-access/ganaderos.service.spec.ts` y luego `.../ganaderos.service.ts` para canal único por orquestador.

## Phase 4: Unificación de canal FE + estados UI admin/offline

- [x] 4.1 **RED (FE core)**: extender `hato-fe/src/app/core/offline/sync-orchestrator.service.spec.ts` con lotes mixtos USER/GANADERO/ANIMAL, reconciliación `pending:*` y cursores por entidad.
- [x] 4.2 **GREEN (FE core)**: ajustar `hato-fe/src/app/core/offline/sync-orchestrator.service.ts` para replay único `/api/sync`, cursor homogéneo e idempotencia por operation identity.
- [x] 4.3 **REFACTOR (FE core)**: remover restos de replay feature-specific y consolidar utilidades de clasificación/retry en el orquestador.
- [x] 4.4 **RED/GREEN (FE UI)**: actualizar tests y componentes `hato-fe/src/app/features/admin/users/*page.component.ts` y `.../ganaderos/*page.component.ts` para feedback de cola/sync/conflictos sin regresión UX.

## Phase 5: Gate de regresión y verificación end-to-end por contrato

- [x] 5.1 Ejecutar suite BE focalizada (`./mvnw test` para `SyncServiceTest` y `SyncResourceTest`) y corregir hasta verde sin romper ANIMAL.
- [x] 5.2 Ejecutar suite FE focalizada (`ng test` para services/orchestrator/pages afectados) y corregir hasta verde.
- [x] 5.3 **REFACTOR final**: limpiar duplicaciones, estabilizar nombres/mensajes de error y actualizar checklist de aceptación en `openspec/changes/offline-sync-users-ganaderos-v1/tasks.md` marcando avances en `sdd-apply`.

### Acceptance Checklist

- [x] `USER STATUS_UPDATE`, `GANADERO CREATE` y `GANADERO STATUS_UPDATE` sincronizan por `/api/sync` sin replay por feature.
- [x] `createUser` y `resetPassword` continúan online-only con error offline explícito.
- [x] Pull incremental `USER`/`GANADERO` devuelve deltas + cursor estable `updatedAt + id`.
- [x] Tests FE/BE multi-entidad pasan sin regresión en `ANIMAL`.
