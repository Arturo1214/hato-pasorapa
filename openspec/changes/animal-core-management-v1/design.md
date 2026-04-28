# Design: Animal Core Management V1

## Technical Approach

Implementar **core-state first** sobre el modelo actual: mantener `animals` como estado vigente, canonizar `uuid` como identidad externa en REST/Sync/FE, introducir ownership actual (`ownerGanaderoId`) y reemplazar `code/tag` por identificadores visibles explícitos (`arete`, `marca`, `tatuaje`) con validación/normalización. Se reutiliza la infraestructura offline existente (outbox/inbox/checkpoints/version conflict) extendiendo únicamente capacidad ANIMAL para `CREATE` además de `UPDATE`.

## Architecture Decisions

| Decisión | Opciones | Tradeoff | Elección |
|---|---|---|---|
| Identidad externa animal | `id` técnico vs `uuid` | `id` rompe contrato offline/móvil; `uuid` evita coupling con DB | `uuid` obligatorio en API pública, `/sync`, snapshots FE |
| Ownership vigente | FK nullable vs FK obligatoria a ganadero | nullable permite inconsistencias; obligatoria fuerza integridad operativa | `owner_ganadero_id` obligatorio y validado en service |
| Identificadores visibles | un solo campo vs `arete/marca/tatuaje` | un solo campo simplifica pero pierde operación real; tres campos exige reglas | tres campos opcionales con regla “al menos uno informado” |
| Unicidad visibles | global por campo vs por owner | global reduce duplicados pero puede ser restrictivo; por owner mejora flexibilidad | V1: unicidad global normalizada por campo (nulo permitido) |
| Alta offline ANIMAL | remapeo id servidor vs UUID cliente estable | remapeo agrega complejidad; UUID estable simplifica reconciliación | CREATE usa `entityId = animalUuid` desde cliente |

## Data Flow

```
UI Animals (signals + forms)
   -> AnimalsService (HTTP/Offline bridge)
      -> OfflineStore (outbox/snapshots) -> SyncOrchestrator -> /api/sync/push
      -> /api/animals (online)

/api/animals -> AnimalResource -> AnimalService -> AnimalRepository/GanaderoRepository
                                      -> AnimalMapper -> AnimalResponse

/api/sync/push -> SyncService + SyncPayloadMapper -> AnimalRepository
```

Secuencia CREATE offline:
1) FE genera `animalUuid` y encola `ANIMAL/CREATE` con `entityId=animalUuid`.
2) SyncOrchestrator envía operación cuando hay conectividad.
3) BE crea/actualiza por `uuid`, responde `serverVersion`.
4) FE marca ack sin remap de identidad (mismo UUID en snapshot/outbox).

## File Changes

| File | Action | Description |
|---|---|---|
| `hato-be/src/main/resources/db/changelog/004-animal-core-management-v1.yaml` | Create | Agrega `owner_ganadero_id`, `arete`, `marca`, `tatuaje`; índices/constraints de unicidad normalizada |
| `hato-be/src/main/resources/db/changelog/master.yaml` | Modify | Incluye changelog `004` |
| `hato-be/src/main/java/bo/pasorapa/hato/domain/Animal.java` | Modify | Nuevos campos core + relación ownership actual |
| `hato-be/src/main/java/bo/pasorapa/hato/repository/AnimalRepository.java` | Modify | Búsqueda por `uuid`/visibles/owner y helpers de unicidad |
| `hato-be/src/main/java/bo/pasorapa/hato/service/dto/AnimalRequest.java` | Modify | Contrato create/update por UUID + owner + visibles |
| `hato-be/src/main/java/bo/pasorapa/hato/service/dto/AnimalResponse.java` | Modify | Exponer `uuid`, `ownerGanaderoId`, visibles y metadatos sync |
| `hato-be/src/main/java/bo/pasorapa/hato/service/mapper/AnimalMapper.java` | Modify | Map bidireccional core V1 |
| `hato-be/src/main/java/bo/pasorapa/hato/service/AnimalService.java` | Modify | Validación owner + unicidad visibles + normalización |
| `hato-be/src/main/java/bo/pasorapa/hato/service/dto/AnimalCriteria.java` | Modify | Filtros por visibleIdentifier/owner/active/category |
| `hato-be/src/main/java/bo/pasorapa/hato/service/AnimalQueryService.java` | Modify | Predicados de filtros operativos |
| `hato-be/src/main/java/bo/pasorapa/hato/web/rest/AnimalResource.java` | Modify | Endpoints por `uuid` y contrato de listado V1 |
| `hato-be/src/main/java/bo/pasorapa/hato/service/mapper/SyncPayloadMapper.java` | Modify | Permite `ANIMAL CREATE` y parsea payload core |
| `hato-be/src/main/java/bo/pasorapa/hato/service/SyncService.java` | Modify | Handler `ANIMAL CREATE` + `UPDATE` manteniendo conflictos por versión |
| `hato-fe/src/app/features/animals/animals-page.component.ts` | Create | Pantalla standalone listado+formulario |
| `hato-fe/src/app/features/animals/data-access/animals.service.ts` | Create | Bridge online/offline similar a ganaderos |
| `hato-fe/src/app/features/animals/data-access/animals.service.spec.ts` | Create | Pruebas de queue/replay/filter offline |
| `hato-fe/src/app/app.routes.ts` | Modify | Ruta `animals` para ADMIN/GANADERO |
| `hato-fe/src/app/ui/layout/main-layout/sidebar/sidebar.ts` | Modify | Item menú “Animales” |
| `hato-fe/src/app/core/offline/offline-types.ts` | Modify | Asegura contrato payload ANIMAL CREATE/UPDATE |

## Interfaces / Contracts

```ts
// FE/BE contract (resumen)
type AnimalIdentity = { uuid: string; ownerGanaderoId: string };
type VisibleIds = { arete?: string; marca?: string; tatuaje?: string };
// regla: al menos uno de arete/marca/tatuaje presente
```

`GET/PUT /api/animals/{uuid}` y filtros de listado: `visible.contains`, `ownerGanaderoId.equals`, `active.equals`, `category.equals`.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| BE Unit | validación owner + unicidad visibles + normalización | `AnimalServiceTest` con casos positivos/colisión |
| BE Integration | contrato REST por `uuid` y filtros | `AnimalResourceTest` + rest-assured |
| BE Sync | `ANIMAL CREATE/UPDATE` idempotencia y conflictos | ampliar `SyncServiceTest` y `SyncResourceTest` |
| FE Unit | enqueue offline, snapshots, filtros locales | `animals.service.spec.ts` |
| FE Component | validaciones form/reactive + mensajes sync | `animals-page.component.spec.ts` |

## Migration / Rollout

Sin feature flag. Orden: (1) migración DB, (2) contrato BE + tests, (3) sync CREATE ANIMAL + regresión, (4) feature FE y rutas, (5) validación E2E manual online/offline. Rollback: desactivar ANIMAL CREATE en matriz offline y revertir changelog 004.

## Open Questions

- [ ] Confirmar si unicidad visible debe ser global o por `ownerGanaderoId` en producción real.
- [ ] Definir longitud/formato final para `marca` y `tatuaje` (hoy sólo normalización + no vacío).
- [ ] Acordar si `code/tag` se elimina en V1 o se mantiene como alias de compatibilidad temporal.
