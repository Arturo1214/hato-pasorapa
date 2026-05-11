# Design: Animal Breed Catalog V1

## Technical Approach

Implementar el catálogo de razas como entidad transaccional del backend y referencia nullable desde `Animal`. El catálogo se administra online por ADMIN, pero sus lecturas activas alimentan formularios y snapshots offline. `Animal` conserva `color`, `description`, `breedUuid` y denormaliza `breedName` sólo en DTO/pull para mostrar valores históricos aunque la raza se desactive.

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|---|---|---|---|
| Catálogo | `Raza` propia con `uuid`, `name`, `active`, `sortOrder`, timestamps/version | Texto libre o enum | Permite ABM, seed local y desactivación sin romper animales existentes. |
| Relación animal | FK nullable `animals.breed_id` + columnas `color`, `description` | Raza obligatoria en V1 | Evita migración destructiva: datos actuales siguen válidos y UI tolera `null`. |
| Seguridad | `/api/admin/razas` ADMIN write; `/api/razas/active` ADMIN/GANADERO read | Un recurso único con flags | Separa mutación online-only de selección activa autenticada. |
| Offline | No `RAZA` en outbox; sí `breedUuid`/texto animal en snapshots/pull | Sincronizar ABM de razas offline | El catálogo es master-data administrado; ganadero sólo selecciona activas cacheadas. |

## Data Flow

    ADMIN /admin/razas ──→ RazaResource(admin) ──→ RazaService ──→ RazaRepository ──→ razas
          │
          └── activa/desactiva online

    Animal form ──→ RazasService.listActive() ──→ selector
          │
          └── AnimalsService enqueue ANIMAL payload { color, description, breedUuid }
                    └── SyncPayloadMapper.toAnimalRequest() ──→ AnimalService validates active breed

## File Changes

| File | Action | Description |
|---|---|---|
| `hato-be/src/main/java/bo/pasorapa/hato/domain/Raza.java` | Create | Entidad catálogo con soft activation y timestamps. |
| `hato-be/src/main/java/bo/pasorapa/hato/repository/RazaRepository.java` | Create | Búsqueda por UUID/nombre y listado activo ordenado. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/RazaService.java` | Create | ABM, unicidad normalizada, bloqueo de delete físico si está usada. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/dto/raza/*.java` | Create | Request/response/list option DTOs. |
| `hato-be/src/main/java/bo/pasorapa/hato/web/rest/RazaResource.java` | Create | Endpoints admin y active read. |
| `hato-be/.../Animal.java`, `AnimalRequest.java`, `AnimalResponse.java`, `AnimalMapper.java`, `AnimalService.java` | Modify | Agregar color/description/breed, validar raza activa en create/update y exponer `breedName`. |
| `hato-be/.../SyncPayloadMapper.java`, `SyncService.java` | Modify | Preservar campos en push/pull y diff severity. |
| `hato-be/src/main/resources/db/changelog/018-animal-breed-catalog-v1.yaml`, `master.yaml` | Create/Modify | Tabla `razas`, seed `Criolla` `sort_order=1`, FK nullable e índices. |
| `hato-fe/src/app/features/admin/razas/*` | Create | Página ABM con `app-data-table`, dialog typed form y service. |
| `hato-fe/src/app/features/admin/animals/*` | Modify | Form/list/detail muestran color, descripción y raza; selector sólo activas. |
| `hato-fe/src/app/core/offline/*` | Modify | Payload/snapshot schema conserva nuevos campos; migración inicializa `null`. |
| `hato-fe/src/app/app.routes.ts`, `ui/layout/main-layout/sidebar/sidebar.ts` | Modify | Ruta y menú ADMIN `/admin/razas`. |

## Interfaces / Contracts

Backend API:
- `GET /api/razas/active` → `RazaOptionResponse[]` para ADMIN/GANADERO autenticado.
- `GET/POST/PUT /api/admin/razas`, `PATCH /api/admin/razas/{uuid}/active` → ADMIN.
- `AnimalRequest`: agrega `String color`, `String description`, `UUID breedUuid` nullable.
- `AnimalResponse`/sync pull: agrega `color`, `description`, `breedUuid`, `breedName`.

FE contracts:
- `RazaItem { uuid; name; active; sortOrder; version; updatedAt }`.
- `AnimalMutationPayload` y `AnimalOfflineMutationPayload` agregan `color?: string|null`, `description?: string|null`, `breedUuid?: string|null`, `breedName?: string|null` sólo snapshot/display.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| BE unit/integration | Raza CRUD, active list ordered with `Criolla`, validation of inactive/missing breed, ADMIN-only writes | JUnit/REST-assured resource/service tests. |
| BE sync | ANIMAL push/pull preserves new fields and conflict diff includes them | Existing sync service tests/fixtures. |
| FE unit | Raza page DataTable/dialog, animals form typed controls, active-only selector, offline payload preservation | Vitest component/service specs. |
| E2E | Not configured | Document manual smoke: admin creates/desactivates raza; ganadero creates animal offline/online. |

## Migration / Rollout

Ship in slices: backend catalog+migration, animal contract/sync, FE admin catalog, FE animal integration. Rollback by hiding FE route/fields first; DB rollback keeps nullable animal columns if data exists and only disables FK/UI until corrective migration.

## Open Questions

- None.
