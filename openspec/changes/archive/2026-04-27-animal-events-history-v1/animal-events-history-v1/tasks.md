# Tasks: Animal Events History V1

## Phase 1: Foundation técnica y contratos base

- [x] 1.1 RED (BE): extender `hato-be/src/test/java/bo/pasorapa/hato/service/SyncServiceTest.java` para cubrir rechazo inicial de `ANIMAL_EVENT`.
- [x] 1.2 GREEN (BE): crear `hato-be/src/main/resources/db/changelog/005-animal-events-history-v1.yaml` y actualizar `hato-be/src/main/resources/db/changelog/master.yaml` con tabla `animal_events`, índices y `unique(operation_id)`.
- [x] 1.3 GREEN (BE): crear `hato-be/src/main/java/bo/pasorapa/hato/domain/AnimalEvent.java`, `repository/AnimalEventRepository.java` y `service/dto/animalevent/*`.
- [x] 1.4 GREEN (BE): crear `hato-be/src/main/java/bo/pasorapa/hato/domain/enumeration/AnimalEventType.java` con catálogo V1 estricto (`SOLD|DECEASED|LOST|TRANSFERRED|OBSERVATION`).
- [x] 1.5 GREEN (FE): actualizar `hato-fe/src/app/core/offline/offline-types.ts` para incluir `ANIMAL_EVENT` y payload tipado de evento V1.
- [x] 1.6 REFACTOR: normalizar campos de auditoría (`performedByUserId`, `sourceChannel`, `operationId`, `occurredAt`) entre DTO BE y tipos FE.

## Phase 2: Capability ledger append-only + ownership/auditoría

- [x] 2.1 RED (BE): agregar casos en `SyncServiceTest` y `hato-be/src/test/java/bo/pasorapa/hato/web/rest/SyncResourceTest.java` para `ANIMAL_EVENT/CREATE`, idempotencia por `operationId` y rechazo de tipo fuera de V1.
- [x] 2.2 GREEN (BE): crear `hato-be/src/main/java/bo/pasorapa/hato/service/mapper/AnimalEventMapper.java` con metadata mínima por tipo (incluye `from/toOwnerGanaderoId` en `TRANSFERRED`).
- [x] 2.3 GREEN (BE): crear `hato-be/src/main/java/bo/pasorapa/hato/service/AnimalEventService.java` para validar ownership/auditoría y persistir ledger append-only sin updates históricos.
- [x] 2.4 GREEN (BE): modificar `hato-be/src/main/java/bo/pasorapa/hato/service/dto/sync/SyncEntityType.java`, `service/mapper/SyncPayloadMapper.java` y `service/SyncService.java` para habilitar `ANIMAL_EVENT:CREATE` y parser de payload.
- [x] 2.5 REFACTOR: extraer validaciones repetidas de metadata/auditoría en helpers del service/mapper.

## Phase 3: Capability proyección de estado actual + precedencia offline

- [x] 3.1 RED (BE): agregar tests en `SyncServiceTest` para reglas de proyección (`SOLD|DECEASED|LOST => active=false`, `TRANSFERRED => owner`, `OBSERVATION => sin cambio core`).
- [x] 3.2 RED (BE): agregar test de precedencia (`occurredAt`, `clientCreatedAt`, `operationId`) con eventos fuera de orden.
- [x] 3.3 GREEN (BE): implementar proyección transaccional en `AnimalEventService` sobre `hato-be/src/main/java/bo/pasorapa/hato/repository/AnimalRepository.java`.
- [x] 3.4 GREEN (BE): asegurar idempotencia de proyección al reprocesar mismo `operationId` desde `SyncService`.
- [x] 3.5 REFACTOR: encapsular precedencia en comparador dedicado reutilizable por ledger/listado/pull.

## Phase 4: Capability listado/historial mínimo por animal

- [x] 4.1 RED (BE): crear `hato-be/src/test/java/bo/pasorapa/hato/web/rest/AnimalEventResourceTest.java` para listado por `animalUuid`, filtros `eventType/rango` y orden estable.
- [x] 4.2 GREEN (BE): crear `hato-be/src/main/java/bo/pasorapa/hato/web/rest/AnimalEventResource.java` y endpoint `GET /api/animals/{uuid}/events` (DTOs, límites V1).
- [x] 4.3 GREEN (FE): crear `hato-fe/src/app/features/admin/animals/data-access/animals-events.service.ts` para timeline online/offline por animal.
- [x] 4.4 RED (FE): agregar pruebas en `hato-fe/src/app/features/admin/animals/data-access/animals-events.service.spec.ts` para filtros y orden timeline estable.
- [x] 4.5 GREEN (FE): actualizar `hato-fe/src/app/features/admin/animals/animals-page.component.ts` + `animals-page.component.spec.ts` para render mínimo de historial por animal.
- [x] 4.6 REFACTOR: consolidar mapeo de timeline (API/snapshot) en adapter único de feature animals.

## Phase 5: Capability offline create/list con sync y hardening TDD

- [x] 5.1 RED (FE): ampliar `hato-fe/src/app/core/offline/sync-orchestrator.service.spec.ts` para push/pull `ANIMAL_EVENT`, replay duplicado y auditoría offline/online.
- [x] 5.2 GREEN (FE): modificar `hato-fe/src/app/core/offline/sync-orchestrator.service.ts` para incluir `ANIMAL_EVENT` en ciclo push/pull y checkpoints.
- [x] 5.3 GREEN (FE): adaptar `hato-fe/src/app/core/offline/offline-store.service.ts` para snapshot/list local de `ANIMAL_EVENT` por `animalUuid`.
- [x] 5.4 RED (BE): agregar integración en `SyncResourceTest` para reconciliación offline con `sourceChannel` y `performedByUserId` persistidos en ledger remoto.
- [x] 5.5 GREEN (BE): ajustar `SyncService`/`AnimalEventService` para tomar `performedByUserId` del contexto autenticado y validar consistencia de payload.
- [x] 5.6 REFACTOR + Verify: ejecutar `./mvnw test` y `ng test`, dejar estable el suite y documentar gaps no bloqueantes en este `tasks.md` antes de `sdd-apply`.

## Gaps no bloqueantes

- Ninguno identificado en `sdd-apply`.
