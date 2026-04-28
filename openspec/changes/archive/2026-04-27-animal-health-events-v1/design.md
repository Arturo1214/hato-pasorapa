# Design: Animal Health Events V1

## Technical Approach

Implementar un agregado sanitario **separado** del ledger operativo (`animal_events`), reutilizando la infraestructura offline/sync existente (outbox, pull incremental, `operationId`). El backend agrega tabla/entidad/servicio/resource propios para salud; el frontend agrega tipos, servicio y timeline sanitario dedicado en `animals` sin tocar el catálogo operativo actual.

## Architecture Decisions

| Decision | Option | Tradeoff | Selected |
|---|---|---|---|
| Boundary de dominio | Reusar `animal_events` vs `animal_health_events` separado | Reusar reduce archivos pero rompe límites V1 y mezcla semántica | **Separado** |
| Persistencia seguimiento tratamiento | Updates mutables vs append-only (`FOLLOW_UP`/`CLOSED`) | Mutable simplifica lectura puntual pero rompe idempotencia/replay | **Append-only** |
| Metadata sanitaria | JSON libre vs contrato mínimo tipado por tipo | Libre acelera corto plazo pero deriva validaciones FE/BE | **Tipada mínima** |
| Sync entity type | Reusar `ANIMAL_EVENT` vs `ANIMAL_HEALTH_EVENT` | Reusar reduce cambios pero acopla cursores y conflictos | **Nuevo tipo** |

## Data Flow

1. FE encola `CREATE ANIMAL_HEALTH_EVENT` (outbox + snapshot optimista).
2. `SyncOrchestratorService` hace push a `/api/sync/push`.
3. BE (`SyncService`) valida capability matrix, mapea payload sanitario y persiste idempotente por `operationId`.
4. BE responde `no_conflict|validation_error` y luego expone pull incremental por `entityType=ANIMAL_HEALTH_EVENT`.
5. FE aplica pull a snapshots y actualiza timeline sanitario local.

```text
AnimalsPage(Health form)
   -> AnimalsHealthEventsService
   -> OfflineStore(outbox/snapshots)
   -> SyncOrchestrator(push)
   -> BE SyncService + AnimalHealthEventService
   -> animal_health_events (append-only)
   -> SyncOrchestrator(pull)
   -> OfflineStore snapshots
   -> AnimalsPage(health timeline)
```

## File Changes

| File | Action | Description |
|---|---|---|
| `hato-be/src/main/resources/db/changelog/006-animal-health-events-v1.yaml` | Create | Tabla `animal_health_events`, FK a `animals.uuid`, unique `operation_id`, índices por `animal_uuid/occurred_at/event_id` y `updated_at/event_id`. |
| `hato-be/src/main/resources/db/changelog/master.yaml` | Modify | Incluir changelog `006-*`. |
| `hato-be/src/main/java/bo/pasorapa/hato/domain/AnimalHealthEvent.java` | Create | Entidad append-only sanitaria con auditoría mínima. |
| `hato-be/src/main/java/bo/pasorapa/hato/domain/enumeration/AnimalHealthEventType.java` | Create | Catálogo V1 sanitario. |
| `hato-be/src/main/java/bo/pasorapa/hato/repository/AnimalHealthEventRepository.java` | Create | Historial por animal y pull incremental. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/dto/animalhealthevent/*` | Create | Request/Response/ListResponse sanitarios. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/mapper/AnimalHealthEventMapper.java` | Create | Mapping payload↔DTO↔entity + metadata. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/AnimalHealthEventService.java` | Create | Create idempotente y list filtrado (sin proyección destructiva). |
| `hato-be/src/main/java/bo/pasorapa/hato/web/rest/AnimalHealthEventResource.java` | Create | `GET /api/animals/{uuid}/health-events`. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/dto/sync/SyncEntityType.java` | Modify | Agregar `ANIMAL_HEALTH_EVENT`. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/mapper/SyncPayloadMapper.java` | Modify | Capability matrix + parse request sanitario. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/SyncService.java` | Modify | Handler push/pull para salud. |
| `hato-fe/src/app/core/offline/offline-types.ts` | Modify | Nuevo tipo entidad y contrato `AnimalHealthEvent*`. |
| `hato-fe/src/app/core/offline/sync-orchestrator.service.ts` | Modify | Pull por `ANIMAL_HEALTH_EVENT`. |
| `hato-fe/src/app/features/admin/animals/data-access/animals-health-events.service.ts` | Create | Alta/listado sanitario queue-first. |
| `hato-fe/src/app/features/admin/animals/data-access/animal-health-events-timeline.adapter.ts` | Create | Normalización, filtros y badges de sync sanitarios. |
| `hato-fe/src/app/features/admin/animals/animals-page.component.ts` | Modify | Sección formulario/timeline sanitario separado del operativo. |

## Interfaces / Contracts

```java
public record AnimalHealthEventRequest(
  UUID animalUuid,
  AnimalHealthEventType healthEventType,
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
type AnimalHealthEventType =
  | 'VACCINATION' | 'DEWORMING' | 'DISEASE_REPORTED'
  | 'TREATMENT_STARTED' | 'TREATMENT_FOLLOW_UP' | 'TREATMENT_CLOSED';

interface AnimalHealthEventMetadata {
  treatmentCaseId?: string;
  productName?: string;
  batchLot?: string;
  nextDueAt?: string;
  diagnosisCode?: string;
}
```

Reglas metadata mínima:
- `VACCINATION|DEWORMING`: `productName` recomendado, `nextDueAt` opcional.
- `DISEASE_REPORTED`: `diagnosisCode` o `notes` no vacío.
- `TREATMENT_*`: `treatmentCaseId` obligatorio para encadenar seguimiento.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit BE | Mapper/validaciones metadata por tipo | Nuevos tests `AnimalHealthEventMapperTest` + casos inválidos. |
| Integration BE | `SyncService` push/pull + idempotencia `operationId` | Extender `SyncServiceTest` y `SyncResourceTest` con `ANIMAL_HEALTH_EVENT`. |
| API BE | Timeline sanitario filtrado y orden determinista | Nuevo `AnimalHealthEventResourceTest` (rest-assured). |
| Unit FE | Adapter/filtros/sync badges sanitarios | `animal-health-events-timeline.adapter.spec.ts`. |
| Integration FE | Queue-first, snapshot optimista, trigger manual sync | `animals-health-events.service.spec.ts` + ajuste `sync-orchestrator.service.spec.ts`. |
| UI FE | Render/submit sanitario sin romper operativo | Extender `animals-page.component.spec.ts`. |

## Migration / Rollout

Sin feature flag. Rollout en una migración Liquibase + despliegue FE/BE coordinado. Backward compatibility: `animal_events` operativo queda intacto. Si falla, rollback removiendo exposición de endpoints/UI sanitarios y revertiendo changelog `006-*`.

## Open Questions

- [ ] ¿`treatmentCaseId` será UUID o string semántico generado en FE?
- [ ] ¿Se requiere endpoint agregado “casos abiertos” en V1 o alcanza timeline por animal?
