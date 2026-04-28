# Tasks: Animal Health Events V1

## Phase 1: Foundation (contratos + base sanitaria)

- [x] 1.1 [RED][BE] Crear tests de contrato en `hato-be/src/test/java/bo/pasorapa/hato/service/mapper/AnimalHealthEventMapperTest.java` para catálogo V1, metadata mínima y rechazo fuera de alcance.
- [x] 1.2 [GREEN][BE] Crear `hato-be/src/main/java/bo/pasorapa/hato/domain/enumeration/AnimalHealthEventType.java`, DTOs en `.../service/dto/animalhealthevent/` y mapper `.../service/mapper/AnimalHealthEventMapper.java` hasta pasar 1.1.
- [x] 1.3 [REFACTOR][BE] Unificar validaciones y mensajes de error del mapper sin cambiar comportamiento cubierto por tests.
- [x] 1.4 [RED→GREEN][BE] Crear migración `hato-be/src/main/resources/db/changelog/006-animal-health-events-v1.yaml` y actualizar `.../master.yaml` verificando en test de persistencia que existan `operation_id` unique e índices de timeline/pull.
- [x] 1.5 [RED→GREEN][FE] Extender `hato-fe/src/app/core/offline/offline-types.ts` + test nuevo `hato-fe/src/app/core/offline/offline-types.health.spec.ts` para tipos `ANIMAL_HEALTH_EVENT` y contratos tipados.

## Phase 2: Ledger sanitario (alta append-only)

- [x] 2.1 [RED][BE] Crear `hato-be/src/test/java/bo/pasorapa/hato/service/AnimalHealthEventServiceTest.java` para alta válida, rechazo por metadata inválida y rechazo por tipo fuera de scope.
- [x] 2.2 [GREEN][BE] Implementar `hato-be/src/main/java/bo/pasorapa/hato/domain/AnimalHealthEvent.java`, `.../repository/AnimalHealthEventRepository.java` y `.../service/AnimalHealthEventService.java` para create append-only.
- [x] 2.3 [REFACTOR][BE] Extraer helpers de construcción de eventos/metadata en `AnimalHealthEventService` manteniendo verdes los tests.
- [x] 2.4 [RED→GREEN][FE] Crear `hato-fe/src/app/features/admin/animals/data-access/animals-health-events.service.spec.ts` y luego `.../animals-health-events.service.ts` para enqueue create queue-first con estado pending.

## Phase 3: Seguimiento de tratamiento (continuidad/cierre)

- [x] 3.1 [RED][BE] Agregar casos a `AnimalHealthEventServiceTest` para `TREATMENT_STARTED/FOLLOW_UP/CLOSED` con historial inmutable y `treatmentCaseId` obligatorio.
- [x] 3.2 [GREEN][BE] Implementar reglas de continuidad en `AnimalHealthEventMapper.java` y `AnimalHealthEventService.java` sin updates destructivos.
- [x] 3.3 [REFACTOR][BE] Simplificar validación por tipo con estrategia/tabla interna y mantener cobertura existente.
- [x] 3.4 [RED→GREEN][FE] Crear `hato-fe/src/app/features/admin/animals/data-access/animal-health-events-timeline.adapter.spec.ts` y luego `.../animal-health-events-timeline.adapter.ts` para estado derivado activo/cerrado.

## Phase 4: Listados sanitarios (API + UI)

- [x] 4.1 [RED][BE] Crear `hato-be/src/test/java/bo/pasorapa/hato/web/rest/AnimalHealthEventResourceTest.java` para `GET /api/animals/{uuid}/health-events` con filtros por tipo/rango y orden determinista.
- [x] 4.2 [GREEN][BE] Implementar `hato-be/src/main/java/bo/pasorapa/hato/web/rest/AnimalHealthEventResource.java` y consultas filtradas en `AnimalHealthEventRepository.java`.
- [x] 4.3 [REFACTOR][BE] Consolidar mapeo response/listado en DTOs `.../service/dto/animalhealthevent/` evitando duplicación.
- [x] 4.4 [RED→GREEN][FE] Extender `hato-fe/src/app/features/admin/animals/animals-page.component.spec.ts` y luego `.../animals-page.component.ts` para formulario/timeline sanitario separado del operativo.

## Phase 5: Sync offline incremental + hardening final

- [x] 5.1 [RED][BE] Extender `hato-be/src/test/java/bo/pasorapa/hato/service/SyncServiceTest.java` y `.../web/rest/SyncResourceTest.java` para push/pull `ANIMAL_HEALTH_EVENT`, replay idempotente y reject sin `operationId`.
- [x] 5.2 [GREEN][BE] Modificar `hato-be/src/main/java/bo/pasorapa/hato/service/dto/sync/SyncEntityType.java`, `.../service/mapper/SyncPayloadMapper.java` y `.../service/SyncService.java` para capability matrix y cursor incremental sanitario.
- [x] 5.3 [REFACTOR][BE] Alinear ramas de sync con patrón existente de `ANIMAL_EVENT` sin acoplar cursores entre dominios.
- [x] 5.4 [RED→GREEN][FE] Ajustar `hato-fe/src/app/core/offline/sync-orchestrator.service.spec.ts` y luego `.../sync-orchestrator.service.ts` para pull incremental sanitario y aplicación a snapshots.
- [x] 5.5 [REFACTOR][FE] Revisar `animals-health-events.service.ts` + adapter para consistencia de badges pending/synced/error y eliminar duplicación con `animals-events`.
- [x] 5.6 [TDD Gate] Ejecutar suites objetivo (BE unit+integration, FE unit+integration), cerrar TODOs y marcar criterios de spec cumplidos antes de `sdd-apply` batch final.
