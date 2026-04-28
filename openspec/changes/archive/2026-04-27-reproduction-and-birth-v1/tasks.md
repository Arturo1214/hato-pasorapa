# Tasks: Reproduction and Birth V1

## Phase 1: Foundation (contracts, schema, strict TDD)

- [x] 1.1 **RED** Crear `hato-be/src/test/java/bo/pasorapa/hato/service/AnimalReproductionEventLiquibaseMigrationTest.java` para fallar por tabla/índices/FK y columnas de filiación faltantes.
- [x] 1.2 **GREEN** Implementar `hato-be/src/main/resources/db/changelog/007-reproduction-and-birth-v1.yaml` y registrar en `hato-be/src/main/resources/db/changelog/master.yaml`.
- [x] 1.3 **REFACTOR** Ajustar nombres/constraints de migración y limpiar duplicación con changelogs previos.
- [x] 1.4 **RED** Crear `hato-fe/src/app/core/offline/offline-types.reproduction.spec.ts` con fallos por `ANIMAL_REPRODUCTION_EVENT` y contratos TS faltantes.
- [x] 1.5 **GREEN** Extender `hato-fe/src/app/core/offline/offline-types.ts` con tipos de evento/metadatos V1 y estado `PENDING_SYNC`.
- [x] 1.6 **REFACTOR** Unificar utilidades de tipos offline existentes para evitar literales repetidos.

## Phase 2: Ledger reproductivo (backend core)

- [x] 2.1 **RED** Crear `hato-be/src/test/java/bo/pasorapa/hato/service/mapper/AnimalReproductionEventMapperTest.java` cubriendo metadata mínima por tipo y rechazos negativos.
- [x] 2.2 **GREEN** Crear `hato-be/src/main/java/bo/pasorapa/hato/domain/enumeration/AnimalReproductionEventType.java` y `hato-be/src/main/java/bo/pasorapa/hato/domain/AnimalReproductionEvent.java`.
- [x] 2.3 **GREEN** Crear `hato-be/src/main/java/bo/pasorapa/hato/service/dto/animalreproductionevent/AnimalReproductionEventRequest.java` + responses/list DTOs.
- [x] 2.4 **GREEN** Implementar `hato-be/src/main/java/bo/pasorapa/hato/service/mapper/AnimalReproductionEventMapper.java` para parse/validación por tipo.
- [x] 2.5 **RED** Crear `hato-be/src/test/java/bo/pasorapa/hato/service/AnimalReproductionEventServiceTest.java` para append-only e idempotencia por `operationId`.
- [x] 2.6 **GREEN** Implementar `hato-be/src/main/java/bo/pasorapa/hato/repository/AnimalReproductionEventRepository.java` y `.../service/AnimalReproductionEventService.java`.
- [x] 2.7 **REFACTOR** Extraer validadores/reutilizables de metadata en service/mapper sin romper tests.

## Phase 3: Partos y filiación

- [x] 3.1 **RED** Ampliar `AnimalReproductionEventServiceTest` con casos `BIRTH`: madre obligatoria, padre opcional, `offspringCount` consistente.
- [x] 3.2 **GREEN** Implementar proyección mínima en `AnimalReproductionEventService.java` hacia `animals.mother_animal_uuid`, `father_animal_uuid`, `birth_date`.
- [x] 3.3 **RED** Crear `hato-fe/src/app/features/admin/animals/data-access/animals-reproduction-events.service.spec.ts` para alta de parto queue-first y fallback offline.
- [x] 3.4 **GREEN** Crear `hato-fe/src/app/features/admin/animals/data-access/animals-reproduction-events.service.ts` con create/list reproductivo.
- [x] 3.5 **REFACTOR** Centralizar armado de metadata `BIRTH` en helper compartido de data-access.

## Phase 4: Listados (API + timeline FE)

- [x] 4.1 **RED** Crear `hato-be/src/test/java/bo/pasorapa/hato/web/rest/AnimalReproductionEventResourceTest.java` para `GET /api/animals/{uuid}/reproduction-events` orden desc y alcance V1.
- [x] 4.2 **GREEN** Crear `hato-be/src/main/java/bo/pasorapa/hato/web/rest/AnimalReproductionEventResource.java` y wiring de servicio/DTO.
- [x] 4.3 **RED** Crear `hato-fe/src/app/features/admin/animals/data-access/animal-reproduction-events-timeline.adapter.spec.ts` para orden, filtros y badge de sync.
- [x] 4.4 **GREEN** Crear `hato-fe/src/app/features/admin/animals/data-access/animal-reproduction-events-timeline.adapter.ts`.
- [x] 4.5 **GREEN** Modificar `hato-fe/src/app/features/admin/animals/animals-page.component.ts` y `.../animals-page.component.spec.ts` para formulario/timeline reproductivo.
- [x] 4.6 **REFACTOR** Reducir acople UI↔data-access con métodos dedicados de presentación.

## Phase 5: Sync offline/incremental + integración

- [x] 5.1 **RED** Extender `hato-be/src/test/java/bo/pasorapa/hato/service/SyncServiceTest.java` y `.../web/rest/SyncResourceTest.java` para push idempotente y pull por cursor de `ANIMAL_REPRODUCTION_EVENT`.
- [x] 5.2 **GREEN** Modificar `hato-be/src/main/java/bo/pasorapa/hato/service/dto/sync/SyncEntityType.java`, `.../service/mapper/SyncPayloadMapper.java` y `.../service/SyncService.java`.
- [x] 5.3 **RED** Extender `hato-fe/src/app/core/offline/sync-orchestrator.service.spec.ts` para cola pendiente, reintento y pull incremental reproductivo.
- [x] 5.4 **GREEN** Modificar `hato-fe/src/app/core/offline/sync-orchestrator.service.ts` para flujo push/pull reproductivo.
- [x] 5.5 **REFACTOR** Ejecutar limpieza final de duplicación en mappers/adapters y mantener todo en verde en suites BE/FE.
