# Design: Veterinary Visits Redesign V1

## Technical Approach

Usar el ledger existente `ANIMAL_HEALTH_EVENT` con `FIELD_VET_VISIT`. La lectura de código muestra que BE/DTO/mapper exigen `animalUuid` (`AnimalHealthEventRequest`, `AnimalHealthEventService.create`), por lo que V1 no debe crear eventos “sin animal”. Las campañas globales se representarán como fan-out: un evento por animal activo del ganadero, todos con el mismo `visit.visitId` y `visit.mode = GLOBAL`. La vista central consumirá un endpoint agregado `GET /api/vet-visits`; la historia animal y calendario seguirán leyendo snapshots/eventos por animal.

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|---|---|---|---|
| Modelo | Extender metadata `FIELD_VET_VISIT` | Nuevo agregado `VETERINARY_CAMPAIGN`; evento sin `animalUuid` | Reutiliza sync/outbox, validaciones y calendario; el código actual no permite evento nulo por animal. |
| Campañas globales | Fan-out por animales activos con `visitId` común | Una fila global única | Garantiza historia/calendario por animal sin proyección especial ni migración DB. |
| Listado central | Nuevo `GET /api/vet-visits` agrupado por `visitId/mode` | Iterar animales desde FE | Evita N llamadas y permite scoping por service/repository. |
| Lifecycle | `visit.status` nuevo + `protocol.status` existente | Reemplazar `protocol.status` | Mantiene continuidad actual y agrega labels UX: pendiente/atendida/reprogramada/finalizada/cancelada. |

## Data Flow

    VetVisitsPage/Dialog ──create specific/global──→ AnimalsHealthEventsService
          │                                      └──→ outbox ANIMAL_HEALTH_EVENT fan-out
          └──list/filter──→ VetVisitsService ──GET /api/vet-visits──→ Resource → Service → Repository

    Animal detail / Calendar ← existing per-animal health-event snapshots ← sync/pull

## File Changes

| File | Action | Description |
|---|---|---|
| `hato-fe/src/app/features/admin/vet-visits/vet-visits-page.component.ts` | Modify | Convertir a pantalla central con toolbar, `app-data-table`, acciones y dialogs. |
| `hato-fe/src/app/features/admin/vet-visits/vet-visit-form-dialog.component.ts` | Create | Reactive Form para modo global/específico, animal autocomplete, veterinario, notas y lifecycle. |
| `hato-fe/src/app/features/admin/vet-visits/data-access/vet-visits.service.ts` | Create | Cliente `GET /api/vet-visits`, normalización y filtros. |
| `hato-fe/src/app/features/admin/vet-visits/data-access/vet-visit-form.mapper.ts` | Modify | Agregar `visit.mode`, `visit.status`, `visit.veterinarian`, `visit.targetAnimalCount`. |
| `hato-fe/src/app/features/admin/animals/data-access/animals.service.ts` | Modify | Soportar carga paginada/activa para fan-out global y autocomplete últimos 10/búsqueda visible. |
| `hato-fe/src/app/features/admin/animals/data-access/animal-health-events-timeline.adapter.ts` | Modify | Leer `visit.mode/status/veterinarian` y mantener proyección por `visitId`. |
| `hato-fe/src/app/features/admin/calendar/data-access/calendar-alerts-projection.ts` | Modify | Etiquetar controles globales/específicos con labels españoles. |
| `hato-be/src/main/java/.../web/rest/VetVisitResource.java` | Create | `GET /api/vet-visits` con filtros, paginación y roles ADMIN/GANADERO. |
| `hato-be/src/main/java/.../service/dto/vetvisit/*` | Create | DTOs de lista/filtros: items agrupados y targets. |
| `hato-be/src/main/java/.../service/AnimalHealthEventService.java` | Modify | Método de listado global, scoping ganadero y proyección follow-up agrupada. |
| `hato-be/src/main/java/.../repository/AnimalHealthEventRepository.java` | Modify | Query `FIELD_VET_VISIT` por owner/date/animal con limit/offset. |
| `hato-be/src/main/java/.../service/mapper/AnimalHealthEventMapper.java` | Modify | Validar metadata nueva y veterinario por evento. |

## Interfaces / Contracts

Metadata V1:

```json
{
  "visit": {
    "visitId": "uuid",
    "mode": "GLOBAL|SPECIFIC",
    "status": "PENDING|ATTENDED|RESCHEDULED|FINALIZED|CANCELED",
    "veterinarian": { "name": "string", "license": "string|null" },
    "targetAnimalCount": 25
  },
  "protocol": { "status": "STARTED|FOLLOW_UP_REQUIRED|CLOSED", "nextDueAt": "ISO|null" }
}
```

`GET /api/vet-visits?mode=&status=&animalUuid=&occurredFrom=&occurredTo=&visitId=&page=&size=` returns `{ items, page, size, total }`; global rows are grouped by `visitId` and expose `targetAnimalCount`, while specific rows keep `animalUuid`.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| FE unit | Mapper metadata, dialog validation, autocomplete, fan-out, table actions | Vitest component/service specs. |
| FE integration | Calendar and animal history labels/projection | Existing projection/adapter specs. |
| BE unit | Metadata validation, lifecycle continuity, ganadero scoping | Mapper/service JUnit tests. |
| BE REST | `GET /api/vet-visits` filters, pagination, grouped globals | RestAssured resource tests. |

## Migration / Rollout

No DB migration. Phase 1: add BE read endpoint/DTOs and metadata validation backward-compatible. Phase 2: FE central list + Spanish labels. Phase 3: global campaign fan-out and calendar/history labels. Rollback: hide new FE route/actions and keep legacy `FIELD_VET_VISIT` events readable.

## Open Questions

- [ ] Confirmar si campaña global debe incluir animales inactivos; diseño asume solo activos.
