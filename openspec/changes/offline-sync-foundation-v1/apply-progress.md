# Apply Progress: Offline Sync Foundation V1

**Change**: `offline-sync-foundation-v1`
**Mode**: Strict TDD
**Batch**: Migraciones offline BE + sync loop V1 FE + política final admin online-only para credenciales sensibles + suites amplias FE/BE + correctivo de runtime wiring seguro

## Completed Tasks

- [x] 1.1 RED (BE): `SyncResourceTest` con `push/pull` mínimo y `409 version_conflict`.
- [x] 1.2 GREEN (BE): DTOs sync y `SyncResource` con validaciones Jakarta y envelope canónico base.
- [x] 1.3 REFACTOR (BE): `SyncService` extraído para clasificación/mapeo manteniendo REST → Service.
- [x] 1.4 RED (BE): `OfflineLiquibaseMigrationTest` sobre dataset legado `animals` + tabla `sync_operation_receipts`.
- [x] 1.5 GREEN (BE): changelog `003-offline-sync-foundation.yaml` registrado en `master.yaml`.
- [x] 2.1 RED (FE): `pwa-shell.spec.ts` para manifest, service worker y banner offline visible.
- [x] 2.2 GREEN (FE): `angular.json`, `manifest.webmanifest`, íconos PWA, `ngsw-config.json` y `provideServiceWorker`.
- [x] 2.3 REFACTOR (FE): `OfflineStatusService` + `OfflineBannerComponent` reutilizado en el shell admin.
- [x] 3.1 RED (FE): `offline-store.service.spec.ts` para recovery, migración one-shot y transiciones operativas.
- [x] 3.2 GREEN (FE): `offline-types.ts` con envelope/outbox/inbox/checkpoints y estados operativos V1.
- [x] 3.3 GREEN (FE): `offline-store.service.ts` con persistencia durable y stores `outbox`, `inbox`, `snapshots`, `sync_state`.
- [x] 3.4 REFACTOR (FE): `offline-store.migrations.ts` con versionado local y adapter in-memory para TDD.
- [x] 4.1 RED (FE): `sync-orchestrator.service.spec.ts` para manual/start/reconnect, push-before-pull, cursor atómico, retry y métricas.
- [x] 4.2 GREEN (FE): `sync-orchestrator.service.ts` con ejecución incremental, scheduling `retry_scheduled` y aplicación atómica de pull.
- [x] 4.3 GREEN (BE): `SyncService` con idempotencia por `operationId`, pull incremental por cursor y clasificación `no_conflict/version_conflict/validation_error`.
- [x] 4.4 REFACTOR (FE): `retry-policy.ts` y `sync-metrics.store.ts` separados del orquestador.
- [x] 4.5 REFACTOR (BE): `SyncServiceTest` para idempotencia, cursor y conflictos.
- [x] 5.1 RED (BE): `AnimalResourceTest` + extensión de `SyncResourceTest` para `uuid/version/updatedAt` y replay idempotente.
- [x] 5.2 GREEN (BE): `Animal`/repository/DTOs/mappers alineados al contrato offline.
- [x] 5.3 GREEN (FE): `admin-users` queda queue-first solo para operaciones no sensibles; `createUser`/`resetPassword` se mantienen online-only sin persistir credenciales en IndexedDB/outbox.
- [x] 5.4 REFACTOR (FE): `conflict-mapper.ts` comparte parsing de conflictos y expone `manual_refresh` para UI admin.
- [x] 5.5 RED (FE): specs de `admin-users`/`ganaderos` cubren encolado offline, replay al reconectar y visibilidad de conflictos.
- [x] 5.6 GREEN (FE): pages admin muestran estado de sync visible, hint manual y feedback explícito de cola offline.
- [x] 5.7 REFACTOR (FE/BE): suites amplias `ng test` + `./mvnw test` quedan verdes; specs admin offline reducen duplicación de fixture config.

## Corrective Runtime Wiring

- [x] C1 RED/GREEN (FE): `SyncOrchestratorService` quedó cableado en runtime vía `app.config.ts` + `initializeApplicationRuntime`, con bootstrap secuencial de config antes del startup sync.
- [x] C2 RED/GREEN (FE): startup/reconnect/manual pasan a ser comportamiento runtime real y auth-safe: el orquestador escucha `online` + `hato:sync-manual`, exige token antes de sincronizar y comparte `DEFAULT_OFFLINE_STORE_SERVICE` con servicios admin.

## Files Changed

| File | Action | What Was Done |
|------|--------|---------------|
| `hato-be/src/test/java/bo/pasorapa/hato/web/rest/SyncResourceTest.java` | Modified | Contrato sync actualizado a UUID real, pull incremental con `uuid/version/updatedAt` y replay idempotente. |
| `hato-be/src/test/java/bo/pasorapa/hato/web/rest/AnimalResourceTest.java` | Created | RED del contrato offline en `AnimalResource`. |
| `hato-be/src/test/java/bo/pasorapa/hato/service/{OfflineLiquibaseMigrationTest.java,SyncServiceTest.java}` | Created | TDD de migración legacy, idempotencia, cursor y conflictos. |
| `hato-be/src/test/resources/db/changelog/test/legacy-master.yaml` | Created | Fixture Liquibase para simular dataset previo a `003`. |
| `hato-be/src/main/resources/db/changelog/{master.yaml,003-offline-sync-foundation.yaml}` | Modified/Created | Migración `animals` + tabla `sync_operation_receipts` + índices de cursor. |
| `hato-be/src/main/java/bo/pasorapa/hato/domain/{Animal.java,SyncOperationReceipt.java}` | Modified/Created | `Animal` gana `uuid/version/updatedAt/lastSyncedAt`; nueva entidad de receipts para idempotencia. |
| `hato-be/src/main/java/bo/pasorapa/hato/repository/{AnimalRepository.java,SyncOperationReceiptRepository.java}` | Modified/Created | Búsqueda por UUID/cursor incremental y persistencia de receipts. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/{AnimalService.java,SyncService.java}` | Modified | Validación con repository tipado y sync real V1 para `ANIMAL`. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/{dto/AnimalResponse.java,mapper/AnimalMapper.java}` | Modified | Exposición de `uuid/version/updatedAt/lastSyncedAt` en API de animales. |
| `hato-fe/src/app/core/offline/sync-orchestrator.service.spec.ts` | Created | RED/triangulación del loop offline V1. |
| `hato-fe/src/app/core/offline/{sync-orchestrator.service.ts,retry-policy.ts,sync-metrics.store.ts}` | Created | Orquestador de sync, política de backoff y snapshot de métricas. |
| `hato-fe/src/app/core/offline/{offline-store.service.ts,offline-types.ts}` | Modified | `operationId` explícito, elegibilidad retry, conflictos y aplicación atómica de pull. |
| `hato-fe/src/app/core/offline/conflict-mapper.{ts,spec.ts}` | Created | Parser puro de conflictos con hint `manual_refresh` para UI/admin services. |
| `hato-fe/src/app/features/admin/users/{admin-users-page.component.ts,admin-users-page.component.spec.ts}` | Modified | Estado de sync visible, hint manual refresh y guardrail visual online-only para altas/reset sensibles. |
| `hato-fe/src/app/features/admin/users/data-access/admin-users.service.{ts,spec.ts}` | Modified/Created | Snapshot offline para list/status, replay de status al reconectar y cobertura explícita para bloqueo de credenciales sensibles offline. |
| `hato-fe/src/app/features/admin/ganaderos/{ganaderos-page.component.ts,ganaderos-page.component.spec.ts}` | Modified | Estado de sync visible y feedback de encolado/replay de ganaderos. |
| `hato-fe/src/app/features/admin/ganaderos/data-access/ganaderos.service.{ts,spec.ts}` | Modified/Created | Queue-first seguro con snapshot optimista, replay por reconnect y fallback online explícito. |
| `hato-fe/src/app/{app.config.ts,app.initializers.ts,app.initializers.spec.ts}` | Modified/Created | Bootstrap runtime del sync offline con initializer secuencial y cobertura dedicada del wiring real. |
| `hato-fe/src/app/core/offline/{offline-store.service.ts,sync-orchestrator.service.ts,sync-orchestrator.service.spec.ts}` | Modified | Store singleton compartido, guardrail por sesión autenticada y trigger manual runtime vía `hato:sync-manual`. |
| `hato-fe/src/app/features/admin/{users,ganaderos}/data-access/*.service.ts` | Modified | Servicios admin comparten el mismo store offline singleton para evitar drift de cache frente al runtime sync. |
| `openspec/changes/offline-sync-foundation-v1/{tasks.md,apply-progress.md}` | Modified | Tracking acumulado del batch apply. |

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1 | `hato-be/src/test/java/bo/pasorapa/hato/web/rest/SyncResourceTest.java` | REST | N/A (new suite) | ✅ Written first; endpoints devolvían `404` | ✅ `./mvnw -Dtest=SyncResourceTest test` | ✅ Push success + conflict + pull vacío | ✅ Servicio extraído fuera del resource |
| 1.2 | `hato-be/src/test/java/bo/pasorapa/hato/web/rest/SyncResourceTest.java` | REST | N/A (new files) | ✅ DTOs faltantes rompían compilación | ✅ Mismo comando backend en verde | ✅ Envelope request/response cubierto en 3 escenarios | ✅ Validaciones y shape centralizados en DTOs |
| 1.3 | `hato-be/src/test/java/bo/pasorapa/hato/web/rest/SyncResourceTest.java` | REST | N/A (new files) | ✅ Recurso fino exigido por el RED | ✅ Mismo comando backend en verde | ✅ Clasificación `no_conflict/version_conflict` verificada | ✅ REST quedó delegando en `SyncService` |
| 1.4 | `hato-be/src/test/java/bo/pasorapa/hato/service/OfflineLiquibaseMigrationTest.java` | DB migration | ✅ `./mvnw -Dtest=SyncResourceTest test` | ✅ Written first; `master.yaml` no migraba `animals` ni receipts | ✅ `./mvnw -Dtest=OfflineLiquibaseMigrationTest,SyncServiceTest,AnimalResourceTest,SyncResourceTest test` | ✅ Dataset legacy conserva filas + UUID/version/update backfilled | ✅ Fixture `legacy-master.yaml` aisló la regresión de Liquibase |
| 1.5 | `hato-be/src/test/java/bo/pasorapa/hato/service/OfflineLiquibaseMigrationTest.java` | DB migration | ✅ Mismo safety net backend | ✅ Changelog `003` inexistente | ✅ Mismo comando backend en verde | ✅ Tablas/índices sync + backfill `animals` verificados | ✅ SQL H2/PostgreSQL separado para UUID portable |
| 2.1 | `hato-fe/src/app/core/offline/pwa-shell.spec.ts` | Unit + Component | N/A (new suite) | ✅ Written first; imports inexistentes | ✅ `npm test -- --watch=false --include ...pwa-shell.spec.ts ...offline-store.service.spec.ts` | ✅ Manifest + SW + banner offline | ✅ Config PWA movida a helper reusable |
| 2.2 | `hato-fe/src/app/core/offline/pwa-shell.spec.ts` | Unit | N/A (structural) | ✅ Test exigió script/config explícitos | ✅ Comando frontend en verde | ➖ Triangulation skipped: task estructural de config/assets | ✅ Shell config desacoplada de `app.config.ts` |
| 2.3 | `hato-fe/src/app/core/offline/pwa-shell.spec.ts` | Component | N/A (new files) | ✅ Banner no existía en RED | ✅ Comando frontend en verde | ✅ Online inicial + transición a offline visible | ✅ Estado de conectividad centralizado en service |
| 3.1 | `hato-fe/src/app/core/offline/offline-store.service.spec.ts` | Unit | N/A (new suite) | ✅ Written first; store/migrations faltantes | ✅ Comando frontend en verde | ✅ Recovery + migration + state transitions | ✅ Adapter de memoria reusable para TDD |
| 3.2 | `hato-fe/src/app/core/offline/offline-store.service.spec.ts` | Unit | N/A (new files) | ✅ Types/envelope inexistentes | ✅ Comando frontend en verde | ✅ Distintos entity/op/status cubiertos | ✅ Contrato tipado separado en `offline-types.ts` |
| 3.3 | `hato-fe/src/app/core/offline/offline-store.service.spec.ts` | Unit | N/A (new files) | ✅ Persistencia durable faltante | ✅ Comando frontend en verde | ✅ Restart recovery + dead-letter path | ✅ Adapter IndexedDB encapsulado |
| 3.4 | `hato-fe/src/app/core/offline/offline-store.service.spec.ts` | Unit | N/A (new files) | ✅ Migración one-shot exigió separación | ✅ Comando frontend en verde | ✅ Primera inicialización migra, segunda no regraba | ✅ Drift de esquema aislado en migrations |
| 4.1 | `hato-fe/src/app/core/offline/sync-orchestrator.service.spec.ts` | Unit | ✅ `npm test -- --watch=false --include src/app/core/offline/offline-store.service.spec.ts --include src/app/core/offline/pwa-shell.spec.ts` | ✅ Written first; faltaban orquestador/métricas/backoff | ✅ `npm test -- --watch=false --include src/app/core/offline/sync-orchestrator.service.spec.ts --include src/app/core/offline/offline-store.service.spec.ts --include src/app/core/offline/pwa-shell.spec.ts` | ✅ Manual + startup/reconnect + retry transient cubiertos | ✅ Dependencias fake y assertions conductuales sin mocks excesivos |
| 4.2 | `hato-fe/src/app/core/offline/sync-orchestrator.service.spec.ts` | Unit | ✅ Mismo safety net frontend | ✅ Loop real inexistente | ✅ Mismo comando frontend en verde | ✅ Push-before-pull + checkpoint/inbox/snapshot consistentes | ✅ `OfflineStoreService` ganó helpers específicos sin mezclar UI |
| 4.3 | `hato-be/src/test/java/bo/pasorapa/hato/service/SyncServiceTest.java` | Service + REST | ✅ `./mvnw -Dtest=SyncResourceTest test` | ✅ Written first; faltaban receipt/idempotencia/cursor real | ✅ `./mvnw -Dtest=OfflineLiquibaseMigrationTest,SyncServiceTest,AnimalResourceTest,SyncResourceTest test` | ✅ Replay seguro + cursor last-item + validation/conflict path | ✅ Recibos persistidos en entidad dedicada `SyncOperationReceipt` |
| 4.4 | `hato-fe/src/app/core/offline/sync-orchestrator.service.spec.ts` | Unit | ✅ Safety net frontend en verde | ✅ Backoff y métricas estaban acoplados al orquestador | ✅ Mismo comando frontend en verde | ✅ Retry con jitter determinístico y snapshot consistente | ✅ `retry-policy.ts` y `sync-metrics.store.ts` extraídos |
| 4.5 | `hato-be/src/test/java/bo/pasorapa/hato/service/SyncServiceTest.java` | Service | ✅ Safety net backend en verde | ✅ Casos de cursor/idempotencia faltaban | ✅ Mismo comando backend en verde | ✅ 3 caminos distintos: replay, pull incremental, conflicto | ✅ Fixtures de animales reutilizables y explícitos |
| 5.1 | `hato-be/src/test/java/bo/pasorapa/hato/web/rest/AnimalResourceTest.java` + `SyncResourceTest.java` | REST | ✅ Safety net backend en verde | ✅ DTOs/resource no exponían `uuid/version/updatedAt` | ✅ Mismo comando backend en verde | ✅ Create animal + pull incremental + replay idempotente | ✅ Contrato offline concentrado en mapper/response |
| 5.2 | `hato-be/src/test/java/bo/pasorapa/hato/web/rest/AnimalResourceTest.java` + `SyncServiceTest.java` | REST + Service | ✅ Safety net backend en verde | ✅ `Animal` legacy sin UUID/version/update tracking | ✅ Mismo comando backend en verde | ✅ Read model + mutation sync usan el mismo contrato | ✅ `AnimalRepository` encapsula búsqueda UUID/cursor |
| 5.3 | `hato-fe/src/app/features/admin/users/data-access/admin-users.service.spec.ts` + `hato-fe/src/app/features/admin/users/admin-users-page.component.spec.ts` | Service + Component | ✅ `ng test --watch=false --include src/app/features/admin/users/data-access/admin-users.service.spec.ts --include src/app/features/admin/users/admin-users-page.component.spec.ts --include src/app/features/admin/ganaderos/data-access/ganaderos.service.spec.ts --include src/app/features/admin/ganaderos/ganaderos-page.component.spec.ts` (20/20) | ✅ Written first; faltaba cubrir `resetPassword` offline y el guardrail visual online-only | ✅ `ng test --watch=false --include src/app/features/admin/users/data-access/admin-users.service.spec.ts --include src/app/features/admin/users/admin-users-page.component.spec.ts` (14/14) | ✅ Create bloqueado + reset bloqueado + botones sensibles deshabilitados offline | ✅ Política final quedó explícita en service y UI sin persistir passwords |
| 5.4 | `hato-fe/src/app/core/offline/conflict-mapper.spec.ts` | Unit | ✅ `npm test -- --watch=false --include src/app/core/offline/offline-store.service.spec.ts --include src/app/features/admin/users/admin-users-page.component.spec.ts --include src/app/features/admin/ganaderos/ganaderos-page.component.spec.ts` | ✅ Written first; faltaba parser reusable para `manual_refresh` | ✅ `npm test -- --watch=false --include src/app/core/offline/conflict-mapper.spec.ts --include src/app/core/offline/offline-store.service.spec.ts --include src/app/features/admin/users/data-access/admin-users.service.spec.ts --include src/app/features/admin/ganaderos/data-access/ganaderos.service.spec.ts --include src/app/features/admin/users/admin-users-page.component.spec.ts --include src/app/features/admin/ganaderos/ganaderos-page.component.spec.ts` | ✅ Metadata offline + HTTP 409 cubiertos | ✅ Mapper puro desacoplado de servicios/pages |
| 5.5 | `hato-fe/src/app/features/admin/{users,ganaderos}/*.component.spec.ts` | Component | ✅ Safety net frontend en verde | ✅ Specs no verificaban cola offline ni replay | ✅ Mismo comando frontend en verde | ✅ Encolado offline + hint manual refresh + replay visible cubiertos | ✅ Mocks de data-access unificados con sync state explícito |
| 5.6 | `hato-fe/src/app/features/admin/{users,ganaderos}/*.component.spec.ts` + `data-access/*.service.spec.ts` | Component + Service | ✅ Safety net frontend en verde | ✅ UI admin no mostraba estado de sync ni feedback de cola | ✅ Mismo comando frontend en verde | ✅ Pending count + reconnect replay + snapshots optimistas cubiertos | ✅ Estado de sync quedó visible y reutilizable por feature |
| 5.7 | `hato-fe/src/app/features/admin/users/admin-users-page.component.spec.ts` + suites globales FE/BE | Approval refactor + Integration | ✅ Approval suites en verde antes de refactor (`ng test` focalizado + `./mvnw test`) | ✅ Refactor guiado por aprobación: se detectó duplicación en fixture config offline | ✅ `ng test --watch=false` (58/58) + `./mvnw test` (32/32) | ➖ Approval refactor; no cambio conductual adicional requerido | ✅ `configure()` reutiliza mensaje offline y la suite amplia quedó estable |
| C1 | `hato-fe/src/app/app.initializers.spec.ts` | Unit | ✅ `ng test --watch=false --include src/app/app.auth.integration.spec.ts` | ✅ Written first; faltaba wiring runtime secuencial config→sync | ✅ `ng test --watch=false --include src/app/app.initializers.spec.ts` | ➖ Single behavior: orden de bootstrap del initializer | ✅ Helper `initializeApplicationRuntime` evita lógica inline en `app.config.ts` |
| C2 | `hato-fe/src/app/core/offline/sync-orchestrator.service.spec.ts` | Unit | ✅ `ng test --watch=false --include src/app/core/offline/sync-orchestrator.service.spec.ts` + regresión admin services | ✅ Written first; startup/reconnect/manual no estaban activos/auth-safe en runtime | ✅ `ng test --watch=false --include src/app/core/offline/sync-orchestrator.service.spec.ts --include src/app/features/admin/users/data-access/admin-users.service.spec.ts --include src/app/features/admin/ganaderos/data-access/ganaderos.service.spec.ts --include src/app/app.auth.integration.spec.ts` | ✅ Startup dormido sin sesión + reconnect/manual activos con token | ✅ Store singleton compartido y trigger manual explicitado como evento runtime |

## Test Summary

- **Backend command**: `eval "$(jenv init - zsh)" && jenv shell 21.0.5 && ./mvnw test`
- **Frontend command**: `source "$HOME/.nvm/nvm.sh" && nvm use && npm test -- --watch=false`
- **Frontend command (focused admin policy)**: `source "$HOME/.nvm/nvm.sh" && nvm use && npm test -- --watch=false --include src/app/features/admin/users/data-access/admin-users.service.spec.ts --include src/app/features/admin/users/admin-users-page.component.spec.ts`
- **Frontend command (corrective runtime wiring)**: `source "$HOME/.nvm/nvm.sh" && nvm use && npm test -- --watch=false --include src/app/app.initializers.spec.ts --include src/app/app.auth.integration.spec.ts --include src/app/core/offline/sync-orchestrator.service.spec.ts --include src/app/features/admin/users/data-access/admin-users.service.spec.ts --include src/app/features/admin/ganaderos/data-access/ganaderos.service.spec.ts`
- **Total tests written**: 33
- **Total tests passing**: batch previo 58/58 frontend + 32/32 backend; correctivo actual 12/12 frontend focalizados
- **Layers used**: Unit (15), Component (6), Integration (2), Service (5), REST (6), DB migration (1)
- **Approval tests**: 1 refactor batch — fixture reuse en `admin-users-page.component.spec.ts` sin cambio conductual
- **Pure functions created**: 7 (`createServiceWorkerRegistrationOptions`, `createEmptyOfflineState`, `migrateOfflineState`, `normalizeOperationStatus`, `createRetryPolicy`, `mapConflict` helper path in orchestrator kept side-effect free, `mapOfflineConflict`)

## Deviations from Design

- El sync backend V1 quedó implementado solo para `ANIMAL`; `USER` y `GANADERO` responden vacío/unsupported hasta que entren sus batches queue-first.
- `admin-users` queda queue-first solo para operaciones no sensibles (`status_update`); `createUser` y `resetPassword` quedan definidos como online-only por política final para NO persistir credenciales sensibles en IndexedDB sin cifrado/rotación explícita.

## Issues Found

- `Animal` legacy usaba `id BIGSERIAL` sin `uuid/version/updated_at`; la migración necesitó backfill DB-specific para generar UUIDs compatibles en H2 y PostgreSQL.
- Angular compiler rechazó marcar `SyncOrchestratorService`/`OfflineStoreService` como `@Injectable` por constructores orientados a TDD; se resolvió con `useFactory` en `app.config.ts` y singleton explícito del store.
- Para mantener TDD rápido, el retry FE usa timestamps ISO y jitter determinístico inyectable; eso simplifica pruebas y evita flakes de reloj.
- Persistir passwords de `createUser`/`resetPassword` en IndexedDB sería un riesgo claro; la política final los deja online-only y la UI ahora lo comunica antes de enviar.

## Remaining Tasks

- [ ] Verify: correr `sdd-verify` contra el change completo con foco en política online-only sensible y contrato queue-first admin.

## Status

24/24 tasks complete + correctivo runtime aplicado. El change queda listo para `sdd-verify`: `SyncOrchestratorService` ya corre en startup/reconnect/manual de forma auth-safe, el store offline compartido evita drift y la política online-only sensible se mantiene intacta.
