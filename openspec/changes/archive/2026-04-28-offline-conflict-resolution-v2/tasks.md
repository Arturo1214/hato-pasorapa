# Tasks: Offline Conflict Resolution V2

## Phase 1: Foundation (shared contracts + migration)
- [x] 1.1 **RED** BE migration test: crear test Liquibase que falle si no existe `sync_conflict_audit_ledger` e índices (`hato-be/src/test/java/**/db/OfflineConflictResolutionMigrationTest.java`).
- [x] 1.2 **GREEN** Crear `hato-be/src/main/resources/db/changelog/010-offline-conflict-resolution-v2.yaml` y registrar en `hato-be/src/main/resources/db/changelog/master.yaml`.
- [x] 1.3 **REFACTOR** Ajustar nombres de columnas/índices y fixture del test para compatibilidad con schema actual.
- [x] 1.4 **RED** FE tests de tipos para `ManualResolutionAction`, `ConflictDiffField`, `ResolutionPolicy` en `hato-fe/src/app/core/offline/offline-types.spec.ts`.
- [x] 1.5 **GREEN** Extender `hato-fe/src/app/core/offline/offline-types.ts` con contratos V2 y estado local de conflicto/auditoría.

## Phase 2: Policy source-of-truth + conflict payload (backend)
- [x] 2.1 **RED** Unit tests `SyncPayloadMapper` por `entityType/opType`: allowedActions, uxHint y exclusiones (`hato-be/src/test/java/**/service/mapper/SyncPayloadMapperTest.java`).
- [x] 2.2 **GREEN** Implementar matriz de policy en `hato-be/src/main/java/bo/pasorapa/hato/service/mapper/SyncPayloadMapper.java` como source-of-truth.
- [x] 2.3 **REFACTOR** Extraer helper reusable para lookup policy y versionado de policy key.
- [x] 2.4 **RED** Unit tests `SyncService` para conflicto en push: diffFields + serverStateVersion + allowedActions (`hato-be/src/test/java/**/service/SyncServiceTest.java`).
- [x] 2.5 **GREEN** Extender `SyncConflictResponse.java` y `SyncOperationResult.java`; producir metadata V2 backward-compatible desde `SyncService.java`.

## Phase 3: Diff UI + orchestration (frontend)
- [x] 3.1 **RED** Tests de `offline-store.service` para transición `conflict` y persistencia de policy/diff por `operationId` (`hato-fe/src/app/core/offline/offline-store.service.spec.ts`).
- [x] 3.2 **GREEN** Implementar estado y helpers en `hato-fe/src/app/core/offline/offline-store.service.ts`.
- [x] 3.3 **REFACTOR** Simplificar selectors/helpers para lectura de conflictos pendientes.
- [x] 3.4 **RED** Test de `sync-orchestrator.service` que valide consumo de metadata V2 y refresh de conflictos (`hato-fe/src/app/core/offline/sync-orchestrator.service.spec.ts`).
- [x] 3.5 **GREEN** Actualizar `hato-fe/src/app/core/offline/sync-orchestrator.service.ts` para contrato V2.
- [x] 3.6 **RED/GREEN** Crear `admin-conflict-resolution.store.ts` + spec para listado, detalle y allowed actions por policy.
- [x] 3.7 **RED/GREEN** Crear `conflict-resolution-page.component.ts` + spec de UI diff con `reason` obligatorio y bloqueo de acciones excluidas.

## Phase 4: Resolution actions API + local effects
- [x] 4.1 **RED** REST tests para `GET /api/sync/conflicts` y `POST /api/sync/conflicts/{operationId}/resolve` (auth, validación reason, exclusiones) en `hato-be/src/test/java/**/web/rest/SyncResourceTest.java`.
- [x] 4.2 **GREEN** Implementar endpoints en `hato-be/src/main/java/bo/pasorapa/hato/web/rest/SyncResource.java` y DTO `ResolveConflictRequest/Response`.
- [x] 4.3 **RED** Unit tests `SyncService.resolveConflict`: `accept_server|retry_local|discard_local`, rechazo por policy excluida, idempotencia de reintento.
- [x] 4.4 **GREEN** Implementar `resolveConflict` en `hato-be/src/main/java/bo/pasorapa/hato/service/SyncService.java`.
- [x] 4.5 **RED/GREEN** FE integration spec de acción manual: `accept_server` y `discard_local` → outbox `acked`; `retry_local` → `pending`.

## Phase 5: Audit ledger (append-only)
- [x] 5.1 **RED** Tests de repositorio por `operationId` y orden cronológico (`hato-be/src/test/java/**/repository/SyncConflictAuditLedgerRepositoryTest.java`).
- [x] 5.2 **GREEN** Crear `hato-be/src/main/java/bo/pasorapa/hato/domain/SyncConflictAuditLedger.java` y `.../repository/SyncConflictAuditLedgerRepository.java`.
- [x] 5.3 **RED** Test de negocio: cada DETECTED/RESOLVED agrega entrada nueva (sin update/delete).
- [x] 5.4 **GREEN** Registrar eventos append-only desde `SyncService.processOperation` y `SyncService.resolveConflict`.

## Phase 6: Verify (strict TDD gate)
- [x] 6.1 Ejecutar suites FE (`npm test` en `hato-fe`) y BE (`./mvnw test` en `hato-be`) con foco en escenarios de spec offline-conflict/policy/audit.
- [x] 6.2 Agregar/ajustar tests de regresión para `animal-event|health|reproduction|image` garantizando idempotencia por `operationId` con metadata V2 opcional.
- [x] 6.3 Verificar rollout guard (`offlineConflictResolutionV2` + version header), documentar riesgos abiertos (TTL ledger, payload edit en retry) en notas de verify.
