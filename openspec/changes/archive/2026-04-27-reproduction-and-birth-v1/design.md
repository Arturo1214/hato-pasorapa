# Design: Reproduction and Birth V1

## Technical Approach

Implementar un agregado reproductivo separado (append-only) siguiendo el patrón ya usado en `animal_events` y `animal_health_events`: tabla/entidad/servicio/resource propios, contrato sync dedicado y metadata mínima tipada por tipo de evento. Para parto, el evento queda en ledger reproductivo y, cuando se informen `offspringAnimalUuids`, se aplica una proyección mínima en `animals` para filiación (`motherAnimalUuid` obligatorio, `fatherAnimalUuid` opcional, `birthDate`), sin mezclar este dominio con salud/operativo.

## Architecture Decisions

| Decision | Option | Tradeoff | Selected |
|---|---|---|---|
| Boundary de dominio | Reusar `animal_events` vs nuevo ledger | Reusar reduce cambios pero rompe límites y acopla reglas de metadata | **Nuevo agregado `animal_reproduction_events`** |
| Contrato de parto/filiación | Tabla separada de partos vs `BIRTH` con metadata tipada | Tabla separada mejora 3NF pero duplica write path V1 | **`BIRTH` en mismo ledger + metadata estructurada** |
| Proyección de parentesco | Solo lectura desde ledger vs proyección mínima en `animals` | Solo ledger simplifica writes pero empeora consulta offline rápida | **Proyección mínima opcional en `animals`** |
| Sync/offline | Reusar `ANIMAL_EVENT` vs nuevo `ANIMAL_REPRODUCTION_EVENT` | Reuso acopla cursores/conflictos y complica soporte incremental | **Nuevo `SyncEntityType` dedicado** |

## Data Flow

1. FE (`animals-page`) arma payload reproductivo y encola `CREATE` en outbox con `entityType=ANIMAL_REPRODUCTION_EVENT`.
2. `SyncOrchestratorService` hace push a `/api/sync/push`.
3. BE (`SyncService`) valida capability matrix, mapea con `SyncPayloadMapper` y delega a `AnimalReproductionEventService#create` (idempotencia por `operationId`).
4. Servicio valida metadata mínima por tipo:
   - `SERVICE.serviceMethod`
   - `PREGNANCY_CONFIRMED.confirmationDate`
   - `PREGNANCY_LOSS.lossReason`
   - `BIRTH.birthDate`, `BIRTH.offspringCount`, `BIRTH.motherAnimalUuid`, `BIRTH.fatherAnimalUuid?`, `BIRTH.offspringAnimalUuids?`
5. Si evento es `BIRTH`, se ejecuta proyección mínima para crías referenciadas (`animals.mother_animal_uuid`, `father_animal_uuid`, `birth_date`).
6. Pull incremental por cursor devuelve solo cambios de reproducción V1; FE actualiza snapshots y timeline.

```text
AnimalsPage(Reproduction form)
  -> AnimalsReproductionEventsService
  -> OfflineStore(outbox/snapshots)
  -> SyncOrchestrator(push)
  -> SyncResource/SyncService
  -> AnimalReproductionEventService
  -> animal_reproduction_events (+ optional animals parentage projection)
  -> SyncOrchestrator(pull entity=ANIMAL_REPRODUCTION_EVENT)
  -> OfflineStore snapshots
  -> AnimalsPage(reproduction timeline)
```

## File Changes

| File | Action | Description |
|---|---|---|
| `hato-be/src/main/resources/db/changelog/007-reproduction-and-birth-v1.yaml` | Create | Tabla `animal_reproduction_events`, unique `operation_id`, FK a `animals.uuid`, índices para timeline/pull. |
| `hato-be/src/main/resources/db/changelog/master.yaml` | Modify | Incluir changelog `007-*`. |
| `hato-be/src/main/resources/db/changelog/007-reproduction-and-birth-v1.yaml` | Modify | Extender `animals` con `mother_animal_uuid`, `father_animal_uuid`, `birth_date` (nullable) + FK. |
| `hato-be/src/main/java/bo/pasorapa/hato/domain/enumeration/AnimalReproductionEventType.java` | Create | Tipos `SERVICE`, `PREGNANCY_CONFIRMED`, `PREGNANCY_LOSS`, `BIRTH`. |
| `hato-be/src/main/java/bo/pasorapa/hato/domain/AnimalReproductionEvent.java` | Create | Entidad append-only con metadata JSON y auditoría mínima. |
| `hato-be/src/main/java/bo/pasorapa/hato/repository/AnimalReproductionEventRepository.java` | Create | Historial por animal + pull incremental por cursor. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/dto/animalreproductionevent/*` | Create | Request/Response/ListResponse reproductivos. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/mapper/AnimalReproductionEventMapper.java` | Create | Parse payload sync + validación metadata mínima + pull item. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/AnimalReproductionEventService.java` | Create | Create idempotente, listado y proyección mínima de filiación en parto. |
| `hato-be/src/main/java/bo/pasorapa/hato/web/rest/AnimalReproductionEventResource.java` | Create | `GET /api/animals/{uuid}/reproduction-events`. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/dto/sync/SyncEntityType.java` | Modify | Agregar `ANIMAL_REPRODUCTION_EVENT`. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/mapper/SyncPayloadMapper.java` | Modify | Capability matrix + `toAnimalReproductionEventRequest`. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/SyncService.java` | Modify | Push/pull handler para entidad reproductiva. |
| `hato-fe/src/app/core/offline/offline-types.ts` | Modify | Nuevo entity type y contratos `AnimalReproductionEvent*`. |
| `hato-fe/src/app/core/offline/sync-orchestrator.service.ts` | Modify | Soportar pull incremental de reproducción. |
| `hato-fe/src/app/features/admin/animals/data-access/animals-reproduction-events.service.ts` | Create | Queue-first create/list de eventos reproductivos. |
| `hato-fe/src/app/features/admin/animals/data-access/animal-reproduction-events-timeline.adapter.ts` | Create | Normalización, filtros y estado sync timeline reproductivo. |
| `hato-fe/src/app/features/admin/animals/animals-page.component.ts` | Modify | Formulario + timeline reproductivo y flujo de parto/filiación. |

## Interfaces / Contracts

```java
public record AnimalReproductionEventRequest(
  UUID animalUuid,
  AnimalReproductionEventType reproductionEventType,
  OffsetDateTime occurredAt,
  String notes,
  UUID performedByUserId,
  String sourceChannel,
  UUID operationId,
  Map<String,Object> metadata,
  OffsetDateTime clientCreatedAt
) {}
```

```ts
type AnimalReproductionEventType = 'SERVICE' | 'PREGNANCY_CONFIRMED' | 'PREGNANCY_LOSS' | 'BIRTH';
interface AnimalBirthMetadata {
  birthDate: string;
  offspringCount: number;
  motherAnimalUuid: string;
  fatherAnimalUuid?: string;
  offspringAnimalUuids?: string[];
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit BE | Metadata por tipo + reglas de filiación | `AnimalReproductionEventMapperTest` y validaciones negativas. |
| Integration BE | Idempotencia `operationId`, push/pull cursor, proyección parto | Extender tests de `SyncService`/`SyncResource` con nueva entidad. |
| API BE | Listado por `animalUuid` ordenado y acotado | Nuevo `AnimalReproductionEventResourceTest`. |
| Unit FE | Adapter y filtros reproductivos | `animal-reproduction-events-timeline.adapter.spec.ts`. |
| Integration FE | Queue-first, snapshot optimista, trigger sync manual | `animals-reproduction-events.service.spec.ts` + ajuste orquestador. |
| UI FE | Formulario/timeline reproductivo y mensajes de sync | Extender `animals-page.component.spec.ts`. |

## Migration / Rollout

Rollout coordinado FE/BE con una migración Liquibase (`007-*`) y sin feature flag. Compatibilidad hacia atrás: no se alteran tablas ni contratos de `ANIMAL_EVENT` y `ANIMAL_HEALTH_EVENT`. Rollback: deshabilitar endpoints/UI reproductivos y revertir `007-*`.

## Open Questions

- [ ] ¿`offspringAnimalUuids` será obligatorio cuando `offspringCount > 0`, o se permite carga diferida de crías?
- [ ] ¿La proyección en `animals` debe bloquear sobreescritura de parentesco ya cargado manualmente?
