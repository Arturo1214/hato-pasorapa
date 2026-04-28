# Implementation Progress

**Change**: field-vet-workflow-v1
**Mode**: Strict TDD

## Completed Tasks
- [x] 1.1–1.5 Contrato BE/FE para `FIELD_VET_VISIT`, checklist fijo, `visitId` explícito y `FOLLOW_UP_REQUIRED -> nextDueAt`.
- [x] 2.1–2.5 Reglas BE de continuidad por `visitId`, filtros por visita, proyección `ACTIVE/CLOSED` e idempotencia por `operationId` en sync.
- [x] 3.1–3.5 UI veterinaria separada con mapper tipado, ruta dedicada y navegación desde animales/sidebar.
- [x] 4.1–4.4 Timeline FE con `visitId`/`nextDueAt`, guardrails out-of-scope y cleanup final del change.

## Files Changed
| File | Action | What Was Done |
|---|---|---|
| `hato-be/src/main/java/**/AnimalHealthEventType.java` | Modified | Se agregó `FIELD_VET_VISIT` al catálogo sanitario V1. |
| `hato-be/src/main/java/**/AnimalHealthEventMapper.java` | Modified | Se implementó contrato tipado `visit/checklist/clinicalNote/protocol` con catálogo fijo y rechazos out-of-scope. |
| `hato-be/src/main/java/**/AnimalHealthEventService.java` | Modified | Se agregó continuidad por `visitId`, proyección `ACTIVE/CLOSED`, filtro por visita y validación temporal de `nextDueAt`. |
| `hato-be/src/main/java/**/AnimalHealthEventRepository.java` | Modified | Se encapsuló helper por `animalUuid + visitId + rango` sin parseo string frágil. |
| `hato-be/src/main/java/**/AnimalHealthEventResource.java` | Modified | Se habilitó `visitId` como query param del listado. |
| `hato-be/src/test/java/**/AnimalHealthEvent*.java`, `SyncResourceTest.java` | Modified | RED/GREEN para contrato vet, follow-up, filtro por visita e idempotencia sync. |
| `hato-fe/src/app/core/offline/offline-types*.ts` | Modified | Se agregaron unions/discriminated metadata, checklist codes y protocol statuses de visitas vet. |
| `hato-fe/src/app/features/admin/vet-visits/**` | Created | Nueva feature veterinaria separada con formulario, mapper tipado y tests. |
| `hato-fe/src/app/features/admin/animals/data-access/animal-health-events-timeline.adapter.*` | Modified | Se integró proyección `FIELD_VET_VISIT` con `visitId`, `ACTIVE/CLOSED` y `nextDueAt`. |
| `hato-fe/src/app/features/admin/animals/animals-page.component.*` | Modified | Se removió la UI vet embebida y quedó navegación a la feature dedicada. |
| `hato-fe/src/app/app.routes*.ts`, `ui/layout/main-layout/sidebar.*` | Modified | Se agregó ruta y entrada de navegación para visitas veterinarias. |
| `openspec/changes/field-vet-workflow-v1/tasks.md` | Modified | Todas las tareas quedaron marcadas completas. |

## Deviations from Design
Ninguna relevante. Se mantuvo el enfoque sobre `ANIMAL_HEALTH_EVENT`, metadata tipada y UI veterinaria desacoplada.

## Issues Found
Sin blockers. La simplificación consciente fue dejar el formulario vet enfocado a `FIELD_VET_VISIT` y mantener otros eventos sanitarios existentes fuera de esa pantalla dedicada.

## TDD Cycle Evidence
| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 1.1–1.3 | `AnimalHealthEventMapperTest.java` | Unit | ✅ 8/8 previas | ✅ Written first | ✅ 11/11 | ✅ missing blocks + catálogo inválido + follow-up sin due date | ✅ Constantes/helpers extraídos |
| 1.4–1.5 | `offline-types.spec.ts`, `offline-types.health.spec.ts` | Unit | ✅ 2/2 previas | ✅ Written first | ✅ 4/4 | ➖ Contratos estructurales | ✅ Unions y catálogos tipados |
| 2.1–2.5 | `AnimalHealthEventServiceTest.java`, `AnimalHealthEventResourceTest.java`, `SyncResourceTest.java` | Integration | ✅ 41/41 previas | ✅ Written first | ✅ 36/36 focalizadas | ✅ ACTIVE/CLOSED + filtro visitId + sync idempotente | ✅ Helper interno de follow-up |
| 3.1–3.5 | `vet-visits-page.component.spec.ts`, `vet-visit-form.mapper.spec.ts`, `animals-page.component.spec.ts`, `app.routes.admin.spec.ts`, `sidebar.spec.ts` | Unit | ✅ 20/20 previas | ✅ Written first | ✅ 18/18 focalizadas | ✅ validaciones + catálogo + navegación separada | ✅ mapper puro + UI desacoplada |
| 4.1–4.4 | `animal-health-events-timeline.adapter.spec.ts`, suites mapper/service | Unit + Integration | ✅ 15/15 previas | ✅ Written first | ✅ incluido en corridas focalizadas | ✅ ACTIVE/CLOSED + nextDueAt + out-of-scope | ✅ Timeline y fixtures alineados |

## Test Summary
- **Backend targeted**: `./mvnw -Dtest=AnimalHealthEventMapperTest,AnimalHealthEventServiceTest,AnimalHealthEventResourceTest,SyncResourceTest test` ✅ 47/47
- **Frontend targeted**: `npm test -- --watch=false --include ...` ✅ 29/29
- **Layers used**: Unit (FE/BE mapper), Integration (BE service/resource/sync)
- **Approval tests**: No aplicó; el cambio fue comportamiento nuevo sobre contratos existentes.
- **Pure/shared functions created**: `mapVetVisitFormToCreateInput` + helpers de timeline/proyección vet.

## Remaining Tasks
- [x] Ninguna. El change quedó listo para `sdd-verify`.

## Status
20/20 tareas completadas. Backend, sync, metadata tipada, timeline, UI veterinaria separada y suites focalizadas quedaron listas para verify.
