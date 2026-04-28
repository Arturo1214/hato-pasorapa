# Apply Progress: animal-events-history-v1

## Implementation Progress

**Change**: animal-events-history-v1  
**Mode**: Strict TDD

### Completed Tasks
- [x] Phase 1 — foundation ledger append-only, DTOs/event types y contrato offline `ANIMAL_EVENT`.
- [x] Phase 2 — capability sync/create con idempotencia por `operationId`, ownership/auditoría y validaciones V1.
- [x] Phase 3 — proyección determinista sobre `animals` usando precedencia `occurredAt -> clientCreatedAt -> operationId`.
- [x] Phase 4 — historial mínimo por animal en backend + data-access/UI Angular.
- [x] Phase 5 — offline create/list, pull/push `ANIMAL_EVENT`, snapshots locales, suites completas verdes.

### Files Changed
| File | Action | What Was Done |
|------|--------|---------------|
| `hato-be/src/main/resources/db/changelog/005-animal-events-history-v1.yaml` | Created | Migración de `animal_events` con FK, índices y unique por `operation_id`. |
| `hato-be/src/main/java/**/AnimalEvent*.java` | Created | Entidad, enum, DTOs, mapper, repository y service del ledger V1. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/SyncService.java` | Modified | Push/pull `ANIMAL_EVENT`, parser de payload e integración con proyección/auditoría. |
| `hato-be/src/main/java/bo/pasorapa/hato/web/rest/AnimalEventResource.java` | Created | Endpoint `GET /api/animals/{uuid}/events` con filtros V1. |
| `hato-fe/src/app/core/offline/offline-types.ts` | Modified | Nuevo entity type `ANIMAL_EVENT` y contratos tipados compartidos. |
| `hato-fe/src/app/core/offline/offline-store.service.ts` | Modified | Helper de snapshot puntual para proyección/listado local. |
| `hato-fe/src/app/features/admin/animals/data-access/animals-events.service.ts` | Created | Timeline online/offline, alta queue-first y proyección optimista local. |
| `hato-fe/src/app/features/admin/animals/data-access/animal-events-timeline.adapter.ts` | Created | Adapter único para normalizar/mapear timeline API/snapshot. |
| `hato-fe/src/app/features/admin/animals/animals-page.component.ts` | Modified | Formulario de eventos + render mínimo de historial por animal. |
| `hato-be/src/test/java/**`, `hato-fe/src/app/**/*.spec.ts` | Modified/Created | Cobertura TDD backend/frontend y ajustes de cleanup para nuevo grafo de FK. |

### TDD Cycle Evidence
| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1–1.4 | `SyncServiceTest`, `AnimalEventServiceTest` | BE integration/service | ✅ `SyncServiceTest`, `SyncResourceTest` baseline green | ✅ Casos nuevos para `ANIMAL_EVENT`/catálogo | ✅ Pasó con ledger + DTOs + enum | ✅ Casos `TRANSFERRED`, `SANITARY`, pull | ✅ Mapper/service separados |
| 1.5–1.6 | `animals-events.service.spec.ts`, `sync-orchestrator.service.spec.ts` | FE unit | ✅ specs offline/animals baseline green | ✅ Nuevos contratos/timeline typed | ✅ Pasó con `ANIMAL_EVENT` en offline types/store | ✅ Casos online/offline + auditoría | ✅ Adapter único + helper snapshot |
| 2.1–2.5 | `SyncServiceTest`, `SyncResourceTest` | BE integration | ✅ suite sync previa | ✅ Idempotencia/auditoría/invalid type | ✅ Pasó con `AnimalEventService` + token authority | ✅ Replay duplicado + actor mismatch coverage indirecta | ✅ Validaciones audit/meta centralizadas |
| 3.1–3.5 | `AnimalEventServiceTest` | BE service | ✅ suite BE verde antes de tocar proyección | ✅ Reglas V1 + precedencia fuera de orden | ✅ Pasó re-replayando eventos sobre `animals` | ✅ Terminales + transfer + observation | ✅ Orden único reutilizado por repo/service |
| 4.1–4.6 | `AnimalEventResourceTest`, `animals-events.service.spec.ts`, `animals-page.component.spec.ts` | BE integration + FE unit/component | ✅ suites animals previas verdes | ✅ Filtros/rango/orden/historial UI | ✅ Pasó con endpoint + data-access + timeline UI | ✅ Online/offline + render por animal | ✅ Adapter timeline consolidado |
| 5.1–5.6 | `sync-orchestrator.service.spec.ts`, `SyncResourceTest`, full suites | FE unit + BE integration + full | ✅ baselines + targeted suites | ✅ Push/pull `ANIMAL_EVENT`, replay, auditoría | ✅ `./mvnw test` + `ng test` verdes | ✅ Duplicate replay + sourceChannel/performedByUserId | ✅ Cleanup de tests por nuevas FK |

### Test Summary
- **Total tests written/updated**: 10 archivos de test tocados con cobertura nueva de ledger, timeline y sync.
- **Total tests passing**: `./mvnw test` ✅ (60 tests) + `ng test` ✅ (84 tests).
- **Layers used**: BE service/integration, FE unit/component.
- **Approval tests**: None — cambio netamente funcional.
- **Pure functions created**: `compareAnimalEventTimeline`, `matchesAnimalEventFilters`, `normalizeAnimalEventItem`, `decorateAnimalEventSnapshot`.

### Deviations from Design
- Se tomó `performedByUserId` del usuario autenticado como fuente de verdad cuando existe token; el payload sólo puede coincidir, no sobreescribir.
- Se fijó `notes` con límite funcional de 500 caracteres para cerrar la pregunta abierta del design sin ampliar alcance.
- El “comparador dedicado” quedó distribuido entre repository ordering + adapter FE porque el contrato V1 usa orden distinto para proyección (`clientCreatedAt`) y listado (`createdAt`).

### Issues Found
- El nuevo FK `animal_events -> animals` obligó a ajustar el orden de cleanup en suites existentes (`AnimalResourceTest`, `AnimalServiceTest`, `GanaderosResourceTest`, `SyncResourceTest`).

### Remaining Tasks
- [ ] Ninguna. Cambio listo para `sdd-verify`.

### Status
23/23 tasks complete. Ready for verify.
