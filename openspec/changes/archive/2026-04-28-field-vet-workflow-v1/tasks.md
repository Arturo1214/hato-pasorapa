# Tasks: Field Vet Workflow V1

## Default decisions (closed)

- `visitId` explícito y separado de `operationId` en FE+BE.
- `protocol.nextDueAt` obligatorio cuando `status=FOLLOW_UP_REQUIRED`.
- Checklist V1 con catálogo fijo de códigos (sin códigos libres).

## Phase 1: Contracts & Schema Foundation (RED-GREEN-REFACTOR)

- [x] 1.1 RED BE: agregar tests en `hato-be/src/test/.../AnimalHealthEventMapperTest.java` para rechazar `FIELD_VET_VISIT` sin `visitId`, sin `clinicalNote`, checklist fuera de catálogo, y `FOLLOW_UP_REQUIRED` sin `nextDueAt`.
- [x] 1.2 GREEN BE: extender `hato-be/src/main/java/bo/pasorapa/hato/domain/enumeration/AnimalHealthEventType.java` y `.../service/mapper/AnimalHealthEventMapper.java` con contrato tipado `visit/checklist/clinicalNote/protocol`.
- [x] 1.3 REFACTOR BE: extraer constantes/validador de catálogo y reglas de protocolo en `.../service/mapper/AnimalHealthEventMapper.java` para mantener validaciones determinísticas.
- [x] 1.4 RED FE: crear `hato-fe/src/app/core/offline/offline-types.spec.ts` con casos de typing para `visitId`, protocolo y checklist fijo.
- [x] 1.5 GREEN+REFACTOR FE: actualizar `hato-fe/src/app/core/offline/offline-types.ts` con metadata discriminada y unions estrictas para `FIELD_VET_VISIT`.

## Phase 2: Core Behavior & Follow-up Ledger (RED-GREEN-REFACTOR)

- [x] 2.1 RED BE: tests en `hato-be/src/test/.../AnimalHealthEventServiceTest.java` para estado derivado (`ACTIVE/CLOSED`), filtro por `visitId`, idempotencia por `operationId`.
- [x] 2.2 GREEN BE: implementar reglas de continuidad/protocolo en `hato-be/src/main/java/bo/pasorapa/hato/service/AnimalHealthEventService.java` usando `visitId` como identificador de visita.
- [x] 2.3 GREEN BE: extender `hato-be/src/main/java/bo/pasorapa/hato/repository/AnimalHealthEventRepository.java` con query helper por `animalUuid + visitId + occurredAt range`.
- [x] 2.4 REFACTOR BE: centralizar mapeo de estado de protocolo en un helper interno de `AnimalHealthEventService` para evitar duplicación mapper/service.
- [x] 2.5 RED+GREEN Integración BE: cubrir sync create/list en `hato-be/src/test/...` (rest-assured) validando que `FIELD_VET_VISIT` sincroniza una sola vez por `operationId`.

## Phase 3: Veterinary UI Split & FE Wiring (RED-GREEN-REFACTOR)

- [x] 3.1 RED FE: tests de formulario en `hato-fe/src/app/features/admin/vet-visits/vet-visits-page.component.spec.ts` para validaciones obligatorias y catálogo checklist fijo.
- [x] 3.2 GREEN FE: crear `hato-fe/src/app/features/admin/vet-visits/vet-visits-page.component.ts` como pantalla veterinaria separada con formularios reactivos tipados.
- [x] 3.3 RED FE: tests de mapeo en `hato-fe/src/app/features/admin/vet-visits/data-access/vet-visit-form.mapper.spec.ts` para payload con `visitId` distinto de `operationId`.
- [x] 3.4 GREEN FE: crear `hato-fe/src/app/features/admin/vet-visits/data-access/vet-visit-form.mapper.ts` y ajustar `.../animals-health-events.service.ts` para enviar metadata tipada.
- [x] 3.5 GREEN+REFACTOR FE: modificar `hato-fe/src/app/features/admin/animals/animals-page.component.ts` para remover UI vet embebida y dejar navegación a feature vet.

## Phase 4: Timeline Projection, Verification & Guardrails

- [x] 4.1 RED FE: tests en `hato-fe/src/app/features/admin/animals/data-access/animal-health-events-timeline.adapter.spec.ts` para proyección `ACTIVE/CLOSED` y `nextDueAt`.
- [x] 4.2 GREEN FE: actualizar `hato-fe/src/app/features/admin/animals/data-access/animal-health-events-timeline.adapter.ts` integrando eventos `FIELD_VET_VISIT` y filtro por `visitId`.
- [x] 4.3 BE/FE contract tests: validar rechazos de out-of-scope V1 (billing, prescripción compleja, multimedia) en suites existentes de mapper/service y adapter.
- [x] 4.4 REFACTOR final: consolidar fixtures compartidos FE+BE para `FIELD_VET_VISIT` y documentar decisiones cerradas en comentarios de contrato.
