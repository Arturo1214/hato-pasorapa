# Tasks: Animal Images Local Storage V1

## Phase 1: Foundation y contratos (strict TDD)

- [x] 1.1 **RED** Crear `hato-be/src/test/java/bo/pasorapa/hato/service/AnimalImageLiquibaseMigrationTest.java` para fallar por tabla `animal_images`, índices por `animal_uuid` y unicidad `operation_id`.
- [x] 1.2 **GREEN** Crear `hato-be/src/main/resources/db/changelog/008-animal-images-local-storage-v1.yaml` y registrarlo en `hato-be/src/main/resources/db/changelog/master.yaml`.
- [x] 1.3 **RED** Crear `hato-fe/src/app/core/offline/offline-types.animal-image.spec.ts` para fallar por ausencia de `ANIMAL_IMAGE` y payload offline requerido.
- [x] 1.4 **GREEN** Modificar `hato-fe/src/app/core/offline/offline-types.ts` con contratos `AnimalImageOfflineCreatePayload`/snapshot y estado `PENDING|SYNCED|FAILED`.
- [x] 1.5 **REFACTOR** Ajustar naming común (`checksumSha256`, `binaryRef`, `operationId`) entre FE/BE para evitar drift de contrato.

## Phase 2: Backend core + filesystem local + seguridad

- [x] 2.1 **RED** Crear `hato-be/src/test/java/bo/pasorapa/hato/service/mapper/AnimalImageMapperTest.java` (metadata incompleta, MIME inválido, size inconsistente, V1 exclusions).
- [x] 2.2 **GREEN** Crear `hato-be/src/main/java/bo/pasorapa/hato/domain/AnimalImage.java`, `repository/AnimalImageRepository.java` y DTOs en `service/dto/animalimage/*`.
- [x] 2.3 **GREEN** Crear `hato-be/src/main/java/bo/pasorapa/hato/service/mapper/AnimalImageMapper.java` con validaciones de contrato y parseo de sync payload.
- [x] 2.4 **RED** Crear `hato-be/src/test/java/bo/pasorapa/hato/service/AnimalImageStorageServiceTest.java` para path traversal, allowlist MIME, checksum y escritura en temp dir.
- [x] 2.5 **GREEN** Crear `hato-be/src/main/java/bo/pasorapa/hato/service/AnimalImageStorageService.java` + config en `hato-be/src/main/resources/application.properties` (`root-dir`, `max-bytes`, `mime-allowlist`, `enabled`).
- [x] 2.6 **RED** Crear `hato-be/src/test/java/bo/pasorapa/hato/service/AnimalImageServiceTest.java` para append-only, idempotencia por `operationId`, orden determinista y compensación metadata↔archivo.
- [x] 2.7 **GREEN** Crear `hato-be/src/main/java/bo/pasorapa/hato/service/AnimalImageService.java` con create/list/download autenticado.
- [x] 2.8 **REFACTOR** Extraer helpers de validación/seguridad reutilizables entre mapper, storage y service.

## Phase 3: Offline/sync incremental FE+BE

- [x] 3.1 **RED** Extender `hato-be/src/test/java/bo/pasorapa/hato/service/SyncServiceTest.java` y `.../web/rest/SyncResourceTest.java` para push/pull `ANIMAL_IMAGE`, ACK parcial y no bloqueo de otros entity types.
- [x] 3.2 **GREEN** Modificar `hato-be/src/main/java/bo/pasorapa/hato/service/dto/sync/SyncEntityType.java`, `.../service/mapper/SyncPayloadMapper.java` y `.../service/SyncService.java`.
- [x] 3.3 **RED** Crear `hato-fe/src/app/core/offline/offline-image-binary-store.service.spec.ts` para persistencia Blob por `operationId`, lookup y purge post-ACK.
- [x] 3.4 **GREEN** Crear `hato-fe/src/app/core/offline/offline-image-binary-store.service.ts` y migración en `hato-fe/src/app/core/offline/offline-store.migrations.ts`.
- [x] 3.5 **RED** Extender `hato-fe/src/app/core/offline/sync-orchestrator.service.spec.ts` para hidratación `base64Data`, reconciliación `SYNCED/FAILED` y deduplicación por `operationId`.
- [x] 3.6 **GREEN** Modificar `hato-fe/src/app/core/offline/sync-orchestrator.service.ts` y `offline-store.service.ts` para push/pull + limpieza de binarios.

## Phase 4: API REST + data access + UI de imágenes

- [x] 4.1 **RED** Crear `hato-be/src/test/java/bo/pasorapa/hato/web/rest/AnimalImageResourceTest.java` para `GET /api/animals/{uuid}/images` (orden estable, thumbnailRef opcional) y `GET /api/animal-images/{id}/content` autenticado.
- [x] 4.2 **GREEN** Crear `hato-be/src/main/java/bo/pasorapa/hato/web/rest/AnimalImageResource.java` (REST → Service → Repository, DTO-only).
- [x] 4.3 **RED** Crear `hato-fe/src/app/features/admin/animals/data-access/animals-images.service.spec.ts` para queue-first offline, retry idempotente y listado por animal.
- [x] 4.4 **GREEN** Crear `hato-fe/src/app/features/admin/animals/data-access/animals-images.service.ts` y `animal-images-timeline.adapter.ts`.
- [x] 4.5 **RED** Extender `hato-fe/src/app/features/admin/animals/animals-page.component.spec.ts` para carga múltiple, previews básicas, estados pending/synced/failed.
- [x] 4.6 **GREEN** Modificar `hato-fe/src/app/features/admin/animals/animals-page.component.ts` con selector múltiple y timeline V1.

## Phase 5: Cobertura final y verificación por escenarios spec

- [x] 5.1 **REFACTOR** Normalizar errores de validación y mapping de estados sync en FE/BE sin cambiar contratos públicos.
- [x] 5.2 **VERIFY** Añadir integración en `hato-be/src/test/java/bo/pasorapa/hato/web/rest/AnimalImageEndToEndSyncTest.java` para: carga offline → reconexión → sync → descarga autenticada.
- [x] 5.3 **VERIFY** Añadir prueba de regresión FE `hato-fe/src/app/features/admin/animals/animals-images-offline-flow.spec.ts` cubriendo `PENDING→SYNCED` y falla parcial `FAILED`.
- [x] 5.4 **VERIFY** Validar explícitamente exclusiones V1 (sin crop/filtros/video/audio/galería compleja) en tests de mapper/resource.
