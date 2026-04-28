# Design: Animal Events History V1

## Technical Approach

Se implementa un modelo **ledger + proyección**: `animal_events` será append-only para auditoría, y `animals` seguirá siendo el read-model operativo. El BE registra evento + aplica proyección mínima en la misma transacción; el FE sigue queue-first y sincroniza por `ANIMAL_EVENT` sin romper sync existente de `ANIMAL/USER/GANADERO`.

## Architecture Decisions

| Opción | Tradeoff | Decisión |
|---|---|---|
| Event sourcing total del agregado `Animal` | Máxima pureza, alto costo y riesgo de migración | **No** en V1 |
| Ledger append-only + proyección acotada a `animals` | Duplicación controlada, menor riesgo/time-to-value | **Sí** |

| Opción | Tradeoff | Decisión |
|---|---|---|
| Evento como payload libre JSON sin contrato | Más flexible, menor validación/consistencia | **No** |
| Contrato tipado mínimo + `metadata` | Menos flexibilidad, más robustez audit/sync | **Sí** |

| Opción | Tradeoff | Decisión |
|---|---|---|
| Orden de replay por timestamp del servidor | Ignora intención offline del operador | **No** |
| Orden determinista: `occurredAt`, `clientCreatedAt`, `operationId` | Requiere reglas explícitas | **Sí** |

## Data Flow

`FE Animals/Event UI -> OfflineStore(outbox) -> SyncOrchestrator(push ANIMAL_EVENT) -> SyncService -> AnimalEventService -> AnimalEventRepository + AnimalRepository(proyección)`

`SyncService(pull ANIMAL_EVENT) -> FE applyPullResponse -> snapshots ANIMAL_EVENT -> timeline por animal`

Reglas de proyección V1 al persistir evento:
- `SOLD|DECEASED|LOST` => `animal.active=false`
- `TRANSFERRED` => `animal.ownerGanaderoId=metadata.toOwnerGanaderoId`
- `OBSERVATION` => sin cambio core en `animals`

## File Changes

| File | Action | Description |
|---|---|---|
| `hato-be/src/main/resources/db/changelog/005-animal-events-history-v1.yaml` | Create | Tabla `animal_events`, índices por animal/tiempo/tipo y unique `operation_id`. |
| `hato-be/src/main/resources/db/changelog/master.yaml` | Modify | Incluir changelog 005. |
| `hato-be/src/main/java/bo/pasorapa/hato/domain/AnimalEvent.java` | Create | Entidad ledger append-only con auditoría mínima. |
| `hato-be/src/main/java/bo/pasorapa/hato/repository/AnimalEventRepository.java` | Create | Consultas por `animalUuid`, rango y cursor incremental. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/dto/animalevent/*` | Create | DTOs request/response/list + filtros. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/AnimalEventService.java` | Create | Validación negocio, persistencia evento y proyección a `animals`. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/mapper/AnimalEventMapper.java` | Create | Mapping DTO <-> domain y metadata mínima. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/dto/sync/SyncEntityType.java` | Modify | Agregar `ANIMAL_EVENT`. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/mapper/SyncPayloadMapper.java` | Modify | Capability matrix para `ANIMAL_EVENT: CREATE`; parser payload evento. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/SyncService.java` | Modify | `push/pull` para `ANIMAL_EVENT`, idempotencia por `operationId`. |
| `hato-fe/src/app/core/offline/offline-types.ts` | Modify | `OfflineEntityType` incluye `ANIMAL_EVENT`; payload/shape de evento. |
| `hato-fe/src/app/core/offline/sync-orchestrator.service.ts` | Modify | Soporte pull/push `ANIMAL_EVENT` y orden local estable. |
| `hato-fe/src/app/features/admin/animals/data-access/animals-events.service.ts` | Create | Data-access timeline + alta de evento (queue-first). |
| `hato-fe/src/app/features/admin/animals/animals-page.component.ts` | Modify | Form de evento y timeline por animal en listado/ficha. |
| `hato-fe/src/app/features/admin/animals/**/*.spec.ts` | Modify/Create | Tests de comportamiento nuevo (timeline/proyección offline). |

## Interfaces / Contracts

```java
enum AnimalEventType { SOLD, DECEASED, LOST, TRANSFERRED, OBSERVATION }

record AnimalEventRequest(
  UUID animalUuid,
  AnimalEventType type,
  OffsetDateTime occurredAt,
  String notes,
  UUID performedByUserId,
  String sourceChannel,      // ONLINE | OFFLINE
  UUID operationId,
  Map<String, Object> metadata
) {}
```

Metadata mínima por tipo:
- `TRANSFERRED`: `fromOwnerGanaderoId`, `toOwnerGanaderoId`
- `SOLD|LOST|DECEASED|OBSERVATION`: `reasonCode?` opcional

Sync payload `ANIMAL_EVENT/CREATE`:
```json
{
  "animalUuid":"...","type":"TRANSFERRED","occurredAt":"...",
  "notes":"...","performedByUserId":"...","sourceChannel":"OFFLINE",
  "operationId":"...","metadata":{"fromOwnerGanaderoId":"...","toOwnerGanaderoId":"..."}
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| BE Unit | Reglas de proyección V1 por tipo + precedencia offline | `AnimalEventServiceTest` y `SyncPayloadMapper` tests |
| BE Integration | `/api/sync/push|pull` con `ANIMAL_EVENT`, idempotencia `operationId`, cursores | `SyncResourceTest` + `SyncServiceTest` (rest-assured/quarkus-junit5) |
| FE Unit | Encolado queue-first, orden timeline, filtros y mensajes de conflicto | `animals-events.service.spec.ts`, `sync-orchestrator.service.spec.ts` |
| FE Component | Form evento + render de timeline en `animals-page` | `animals-page.component.spec.ts` |

## Migration / Rollout

1. Migración DB (tabla + índices). 2. BE contract + sync matrix. 3. FE queue/timeline. 4. Activar UI de eventos. 5. Backfill opcional: eventos `OBSERVATION` iniciales desde estado actual (no bloqueante). Rollback: deshabilitar `ANIMAL_EVENT` en matrix/UI, mantener `animals` operativo.

## Open Questions

- [ ] ¿`performedByUserId` viene siempre del token servidor (preferido) y solo se valida consistencia del payload?
- [ ] ¿`notes` requiere límite funcional (ej. 500) además del técnico?
- [ ] ¿Backfill inicial se ejecuta en V1 o se posterga a V1.1?
