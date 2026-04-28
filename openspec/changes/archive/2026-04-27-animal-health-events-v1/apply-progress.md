# Apply Progress: animal-health-events-v1

## Implementation Progress

**Change**: animal-health-events-v1  
**Mode**: Strict TDD

### Completed Tasks
- [x] Phase 1 — agregado sanitario base, changelog `006-*`, contratos offline `ANIMAL_HEALTH_EVENT` y validaciones tipadas mínimas.
- [x] Phase 2 — create append-only sanitario e integración FE queue-first con snapshots pending.
- [x] Phase 3 — continuidad de tratamientos append-only con `treatmentCaseId` string semántico y estado derivado activo/cerrado en timeline.
- [x] Phase 4 — listado `GET /api/animals/{uuid}/health-events` y wiring UI separado del operativo.
- [x] Phase 5 — push/pull incremental e idempotente para `ANIMAL_HEALTH_EVENT`, más suites objetivo ejecutadas.
- [x] Correctivo verify unblocker — build FE reparado, cobertura faltante agregada y exclusión explícita de adjuntos/imágenes clínicas validada.

### Files Changed
| File | Action | What Was Done |
|---|---|---|
| `hato-be/src/main/java/**/AnimalHealthEvent*.java` | Created | Nuevo agregado sanitario completo: entity, enum, DTOs, mapper, repository, service y resource. |
| `hato-be/src/main/resources/db/changelog/006-animal-health-events-v1.yaml` | Created | Tabla `animal_health_events` con FK, unique por `operation_id` e índices de timeline/pull. |
| `hato-be/src/main/java/**/sync/*` | Modified | Nuevo entity type `ANIMAL_HEALTH_EVENT` en capability matrix, push/pull e idempotencia. |
| `hato-be/src/test/java/**/AnimalHealthEvent*.java` | Created | Tests de mapper, service, resource y liquibase para contratos V1. |
| `hato-be/src/test/java/**/Sync*Test.java` | Modified | Cobertura de push/pull sanitario, replay idempotente, reject sin `operationId` y primer pull sin cursor. |
| `hato-fe/src/app/core/offline/offline-types.ts` | Modified | Nuevo tipo offline `ANIMAL_HEALTH_EVENT` y contratos tipados FE. |
| `hato-fe/src/app/features/admin/animals/data-access/animals-health-events.service.ts` | Created | Servicio sanitario queue-first con snapshots locales y fetch remoto filtrable. |
| `hato-fe/src/app/features/admin/animals/data-access/animal-health-events-timeline.adapter.ts` | Created | Normalización, badges sync y estado derivado de tratamiento. |
| `hato-fe/src/app/features/admin/animals/animals-page.component.ts` | Modified | UI separada entre eventos operativos y sanitarios con formulario/timeline sanitario. |
| `hato-fe/src/app/**/health*.spec.ts` | Created/Modified | Tests FE para contratos, servicio, adapter, sync orchestrator y página. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/mapper/AnimalHealthEventMapper.java` | Modified | Rechazo explícito de metadata fuera de scope (`attachment*` / `image*`) y mantenimiento de reglas mínimas por tipo. |
| `hato-fe/package.json` | Modified | Se agregó `@angular/animations` para alinear imports de Angular Material/async animations con el build. |
| `hato-fe/package-lock.json` | Modified | Lockfile regenerado tras instalar dependencias Angular faltantes (`@angular/animations`, `@angular/service-worker`). |

### TDD Cycle Evidence
| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 1.1–1.4 | `AnimalHealthEventMapperTest.java`, `AnimalHealthEventLiquibaseMigrationTest.java` | Unit | N/A (new) | ✅ Written | ✅ Passed | ✅ catálogo + metadata + schema | ✅ mapper y changelog consolidados |
| 1.5 | `offline-types.health.spec.ts` | Unit | ✅ targeted FE suite | ✅ Written | ✅ Passed | ➖ estructural | ➖ None needed |
| 2.1–3.3 | `AnimalHealthEventServiceTest.java` | Integration | N/A (new) | ✅ Written | ✅ Passed | ✅ create, disease invalid, treatment close | ✅ helpers y continuidad separados |
| 2.4, 3.4, 5.5 | `animals-health-events.service.spec.ts`, `animal-health-events-timeline.adapter.spec.ts` | Integration/Unit | N/A (new) | ✅ Written | ✅ Passed | ✅ online/offline + treatment status | ✅ badges/adapter sin duplicación pesada |
| 4.1–4.4 | `AnimalHealthEventResourceTest.java`, `animals-page.component.spec.ts` | API/UI | ✅ targeted suites | ✅ Written | ✅ Passed | ✅ filtros + wiring separado | ✅ DTO/listado y UI sanitaria separada |
| 5.1–5.4 | `SyncServiceTest.java`, `SyncResourceTest.java`, `sync-orchestrator.service.spec.ts` | Integration/API/UI | ✅ targeted suites | ✅ Written | ✅ Passed | ✅ push, pull, replay, missing payload opId | ✅ patrón sync alineado con `ANIMAL_EVENT` |
| C1 | `AnimalHealthEventMapperTest.java` | Unit | ✅ 4/4 mapper baseline | ✅ `DISEASE_REPORTED`, tratamiento incompleto y adjuntos/imágenes fuera de scope | ✅ 8/8 mapper tests passing | ✅ happy path + 4 invalid branches | ✅ validación de attachments extraída sin romper reglas previas |
| C2 | `AnimalHealthEventResourceTest.java` | API | ✅ 1/1 resource baseline | ✅ listado base por animal excluyendo otros | ✅ 2/2 resource tests passing | ✅ sin filtros + con filtros | ➖ None needed |
| C3 | `SyncServiceTest.java` | Integration | ✅ 15/15 sync baseline | ✅ primer pull sanitario sin cursor | ✅ 16/16 sync tests passing | ✅ cursor previo + primer pull | ➖ None needed |
| C4 | `animals-health-events.service.spec.ts` | Integration | ✅ FE suite baseline reproducida | ✅ alta offline sin manual sync | ✅ suite FE 26 archivos / 93 tests passing | ✅ online + offline | ➖ None needed |
| C5 | `hato-fe/package.json` / `package-lock.json` | Config | ❌ build FE roto en verify (`@angular/animations` / `@angular/service-worker`) | ✅ falla reproducida antes del fix | ✅ `npm run build` successful | ➖ estructural | ➖ None needed |

### Test Summary
- **Total tests written**: 11 nuevos iniciales + 7 correctivos de verify unblock
- **Total tests passing**: BE targeted 41 + FE suite completa 93
- **Layers used**: Unit, Integration, API/UI, Config/build verification
- **Approval tests**: None — se agregaron comportamientos nuevos
- **Pure functions created**: validator/normalizer helpers FE + metadata validation helpers BE

### Deviations from Design
Ninguna crítica. Se mantiene `treatmentCaseId` como **string semántico** y se agrega una guardia explícita para rechazar adjuntos/imágenes clínicas, alineando el contrato con el scope V1 sin abrir soporte de archivos.

### Issues Found
Ninguna bloqueante. El build FE ya no falla; queda solo el warning de budget de Angular en producción, fuera del scope del change.

### Remaining Tasks
- [ ] Ninguna de implementación — listo para rerun de `sdd-verify`.

### Status
24/24 tasks complete. Correctivo aplicado; ready for rerun de verify.
