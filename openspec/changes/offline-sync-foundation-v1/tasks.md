# Tasks: Offline Sync Foundation V1

## Phase 1: Foundation técnica y guardrails (FE/BE)

- [x] 1.1 [RED] Crear `hato-be/src/test/java/bo/pasorapa/hato/web/rest/SyncResourceTest.java` con contrato mínimo `push/pull` y `409 version_conflict` (fallando).
- [x] 1.2 [GREEN] Crear DTOs `hato-be/src/main/java/bo/pasorapa/hato/service/dto/sync/*.java` y `hato-be/src/main/java/bo/pasorapa/hato/web/rest/SyncResource.java` con validaciones Jakarta y shape de respuesta.
- [x] 1.3 [REFACTOR] Extraer mapeos y clasificación de resultados a `hato-be/src/main/java/bo/pasorapa/hato/service/SyncService.java` manteniendo flujo REST→Service→Repository.
- [x] 1.4 [RED] Crear `hato-be/src/test/java/bo/pasorapa/hato/service/OfflineLiquibaseMigrationTest.java` para validar migración `animals` + tablas de sync sobre dataset legado.
- [x] 1.5 [GREEN] Crear `hato-be/src/main/resources/db/changelog/003-offline-sync-foundation.yaml` y registrar en `hato-be/src/main/resources/db/changelog/master.yaml`.

## Phase 2: Capability `offline-pwa-shell`

- [x] 2.1 [RED] Crear `hato-fe/src/app/core/offline/pwa-shell.spec.ts` para installability (manifest + SW) y reopen offline con indicador visible.
- [x] 2.2 [GREEN] Configurar `hato-fe/angular.json`, crear `hato-fe/public/manifest.webmanifest` y agregar `provideServiceWorker` en `hato-fe/src/app/app.config.ts`.
- [x] 2.3 [REFACTOR] Centralizar estado de conectividad en `hato-fe/src/app/core/offline/offline-status.service.ts` y reutilizarlo en pantallas admin.

## Phase 3: Capability `offline-local-store` (IndexedDB + outbox/inbox)

- [x] 3.1 [RED] Crear `hato-fe/src/app/core/offline/offline-store.service.spec.ts` cubriendo recovery post-restart, migración local one-shot y transiciones `pending→in_flight→acked/dead_letter`.
- [x] 3.2 [GREEN] Implementar `hato-fe/src/app/core/offline/offline-types.ts` con envelope canónico y estados operacionales V1.
- [x] 3.3 [GREEN] Implementar `hato-fe/src/app/core/offline/offline-store.service.ts` con stores `outbox`, `inbox`, `snapshots`, `sync_state` y persistencia durable.
- [x] 3.4 [REFACTOR] Extraer versionado/migraciones a `hato-fe/src/app/core/offline/offline-store.migrations.ts` para evitar drift de esquema local.

## Phase 4: Capability `offline-sync-loop` + retry/backoff + observabilidad

- [x] 4.1 [RED] Crear `hato-fe/src/app/core/offline/sync-orchestrator.service.spec.ts` para triggers (manual/start/reconnect), push-before-pull, cursor atómico, retry con jitter y métricas (`pending/success/failed/lastSyncAt`).
- [x] 4.2 [GREEN] Implementar `hato-fe/src/app/core/offline/sync-orchestrator.service.ts` con política de retry ceiling y programación de `nextAttemptAt`.
- [x] 4.3 [GREEN] Implementar en `hato-be/src/main/java/bo/pasorapa/hato/service/SyncService.java` idempotencia por `operationId`, pull incremental por cursor y clasificación `no_conflict/version_conflict/validation_error`.
- [x] 4.4 [REFACTOR] Separar estrategia de backoff en `hato-fe/src/app/core/offline/retry-policy.ts` y snapshot de métricas en `hato-fe/src/app/core/offline/sync-metrics.store.ts`.
- [x] 4.5 [REFACTOR] Agregar pruebas de servicio `hato-be/src/test/java/bo/pasorapa/hato/service/SyncServiceTest.java` para idempotencia, cursor y conflictos.

## Phase 5: Capability `offline-conflict-handling-minimal` + `offline-contract-alignment-animals` + wiring admin

- [x] 5.1 [RED] Crear `hato-be/src/test/java/bo/pasorapa/hato/web/rest/AnimalResourceTest.java` y extender `SyncResourceTest.java` para exigir `uuid/version/updatedAt` en contrato incremental y replay idempotente.
- [x] 5.2 [GREEN] Modificar `hato-be/src/main/java/bo/pasorapa/hato/domain/Animal.java`, `hato-be/src/main/java/bo/pasorapa/hato/repository/AnimalRepository.java` y DTOs/mappers para exponer contrato offline.
- [x] 5.3 [GREEN] Adaptar `hato-fe/src/app/features/admin/users/data-access/admin-users.service.ts` y `hato-fe/src/app/features/admin/ganaderos/data-access/ganaderos.service.ts` a queue-first con fallback online explícito.
- [x] 5.4 [REFACTOR] Añadir parser común de conflictos en `hato-fe/src/app/core/offline/conflict-mapper.ts` y usar hint `manual_refresh` en UI admin.
- [x] 5.5 [RED] Actualizar `hato-fe/src/app/features/admin/users/admin-users-page.component.spec.ts` y `hato-fe/src/app/features/admin/ganaderos/ganaderos-page.component.spec.ts` para verificar encolado offline y replay al reconectar.
- [x] 5.6 [GREEN] Ajustar pages/components admin para indicador offline y estado de sync visible.
- [x] 5.7 [REFACTOR] Ejecutar y estabilizar suite strict TDD (`hato-fe: ng test`, `hato-be: ./mvnw test`) removiendo duplicación de fixtures en tests offline.
