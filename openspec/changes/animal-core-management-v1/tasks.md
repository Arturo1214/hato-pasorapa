# Tasks: Animal Core Management V1

## Phase 1: Foundation técnica y contrato canónico (BE/FE)

- [x] 1.1 (RED) Ampliar `hato-be/src/test/java/bo/pasorapa/hato/web/rest/AnimalResourceTest.java` para fallar por contrato UUID canónico (`GET/PUT /api/animals/{uuid}`), `ownerGanaderoId` requerido y exclusión de `id` externo.
- [x] 1.2 (GREEN) Crear `hato-be/src/main/resources/db/changelog/004-animal-core-management-v1.yaml` y enlazarlo en `hato-be/src/main/resources/db/changelog/master.yaml` con `owner_ganadero_id`, `arete`, `marca`, `tatuaje` + índices de unicidad normalizada.
- [x] 1.3 (GREEN) Actualizar `hato-be/src/main/java/bo/pasorapa/hato/domain/Animal.java`, `service/dto/AnimalRequest.java`, `service/dto/AnimalResponse.java` y `service/mapper/AnimalMapper.java` para UUID/owner/visibles.
- [x] 1.4 (REFACTOR) Unificar normalización de visibles y errores de validación en `hato-be/src/main/java/bo/pasorapa/hato/service/AnimalService.java` para reutilizar en create/update/sync.

## Phase 2: Capability ficha animal (alta/edición + ownership + unicidad)

- [x] 2.1 (RED) Crear `hato-be/src/test/java/bo/pasorapa/hato/service/AnimalServiceTest.java` con casos fallidos: owner inexistente, colisión normalizada en `arete/marca/tatuaje`, y regla “al menos uno informado”.
- [x] 2.2 (GREEN) Implementar validaciones y reglas en `hato-be/src/main/java/bo/pasorapa/hato/service/AnimalService.java` usando `GanaderoRepository` y helpers en `repository/AnimalRepository.java`.
- [x] 2.3 (GREEN) Ajustar `hato-be/src/main/java/bo/pasorapa/hato/web/rest/AnimalResource.java` para alta/edición por UUID y respuestas consistentes de errores de negocio.
- [x] 2.4 (REFACTOR) Limpiar duplicación REST/Service y dejar DTOs como frontera única (sin exponer entidad) en `AnimalResource` + `AnimalMapper`.
- [x] 2.5 (RED) Crear `hato-fe/src/app/features/admin/animals/animals-page.component.spec.ts` con validaciones de formulario reactivo (owner requerido + al menos un visible) y mensajes de error.
- [x] 2.6 (GREEN) Crear `hato-fe/src/app/features/admin/animals/animals-page.component.ts` standalone con signals, Reactive Forms y flujo alta/edición.
- [x] 2.7 (REFACTOR) Extraer lógica de acceso a datos en `hato-fe/src/app/features/admin/animals/data-access/animals.service.ts` y mantener componente de presentación liviano.

## Phase 3: Capability listado y filtros operativos

- [x] 3.1 (RED) Extender `AnimalResourceTest.java` para filtros fallidos/esperados: `visible.contains`, `ownerGanaderoId.equals`, `active.equals`, `category.equals` + rechazo de `active="si"`.
- [x] 3.2 (GREEN) Actualizar `hato-be/src/main/java/bo/pasorapa/hato/service/dto/AnimalCriteria.java`, `service/AnimalQueryService.java` y `web/util/AnimalCriteriaDoc.java` con filtros V1.
- [x] 3.3 (REFACTOR) Consolidar predicados reutilizables en `AnimalQueryService` para evitar drift entre listados y sync pull.
- [x] 3.4 (RED) Crear `hato-fe/src/app/features/admin/animals/data-access/animals.service.spec.ts` para filtros online/offline y marcadores pending/conflict.
- [x] 3.5 (GREEN) Implementar listado paginable + filtros en `animals.service.ts` y bind en `animals-page.component.ts`.

## Phase 4: Capability offline/sync CREATE+UPDATE ANIMAL

- [x] 4.1 (RED) Extender `hato-be/src/test/java/bo/pasorapa/hato/service/SyncServiceTest.java` y `web/rest/SyncResourceTest.java` con casos ANIMAL CREATE offline, replay idempotente y conflicto por versión.
- [x] 4.2 (GREEN) Habilitar matriz offline ANIMAL CREATE en `hato-be/src/main/java/bo/pasorapa/hato/service/mapper/SyncPayloadMapper.java` y parseo payload core (`ownerGanaderoId`, `arete`, `marca`, `tatuaje`).
- [x] 4.3 (GREEN) Implementar handlers CREATE/UPDATE en `hato-be/src/main/java/bo/pasorapa/hato/service/SyncService.java` manteniendo semántica de `version_conflict` existente.
- [x] 4.4 (RED) Agregar pruebas en `animals.service.spec.ts` para cola offline con `entityId = animalUuid`, replay al reconectar y snapshot local estable.
- [x] 4.5 (GREEN) Actualizar `hato-fe/src/app/core/offline/offline-types.ts` y `features/admin/animals/data-access/animals.service.ts` para contrato offline/sync sin remapeo de identidad.

## Phase 5: Wiring FE/BE y verificación final

- [x] 5.1 (GREEN) Registrar ruta y navegación en `hato-fe/src/app/app.routes.ts` (acceso ADMIN/GANADERO) y `hato-fe/src/app/ui/layout/main-layout/sidebar/sidebar.ts` + `sidebar.spec.ts`.
- [x] 5.2 (REFACTOR) Alinear naming y contratos entre payload FE y DTO BE (uuid/owner/visibles) revisando `animals.service.ts`, `AnimalRequest.java`, `AnimalResponse.java`.
- [x] 5.3 (VERIFY) Ejecutar `./mvnw test` en `hato-be` validando suites Animal/Sync sin regresión de foundation.
- [x] 5.4 (VERIFY) Ejecutar `ng test` en `hato-fe` validando `animals-page`, `animals.service` y regresión de offline store.
