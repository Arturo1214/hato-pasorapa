# Verification Report

**Change**: field-vet-workflow-v1  
**Mode**: Strict TDD (resolved from `sdd-init/code` + `sdd/code/testing-capabilities`)  
**Date**: 2026-04-28

---

## Completeness

Source of truth:
- OpenSpec: `openspec/changes/field-vet-workflow-v1/tasks.md`
- Engram: `sdd/field-vet-workflow-v1/tasks`

| Metric | Value |
|--------|-------|
| Tasks total | 19 |
| Tasks complete | 19 |
| Tasks incomplete | 0 |

---

## Build & Tests Execution (real execution)

### Backend (Quarkus)

**Java**: `jenv shell 21.0.5` (per `hato-be/.java-version`)  
**Tests command**:

```bash
./mvnw -Dtest=AnimalHealthEventMapperTest,AnimalHealthEventServiceTest,AnimalHealthEventResourceTest,SyncResourceTest test
```

**Result**: ✅ BUILD SUCCESS

- Tests run: **47**
- Failures: **0**
- Errors: **0**
- Skipped: **0**

**Type-check / compile**:

```bash
./mvnw -DskipTests compile
```

**Result**: ✅ Passed

### Frontend (Angular)

**Node**: `nvm use 20.19.6` (per `.nvmrc`)  
**Tests command**:

```bash
npm test -- --watch=false
```

**Result**: ✅ Passed

- Test Files: **57 passed**
- Tests: **212 passed**

**Type-check**:

```bash
npx tsc --noEmit -p tsconfig.app.json
```

**Result**: ✅ Passed

### Coverage

➖ Not available in current repo config:
- FE: `ng test --coverage` requires `@vitest/coverage-v8` (not installed)
- FE: `--code-coverage` flag is not supported by the current `ng test` runner
- BE: `-Dquarkus.test.coverage.enabled=true` config key is not recognized (coverage extension not enabled)

---

## TDD Compliance (Strict)

Evidence source: `openspec/changes/field-vet-workflow-v1/apply-progress.md` (TDD Cycle Evidence table) + executed test runs above.

| Check | Result | Details |
|-------|--------|---------|
| TDD evidence reported | ✅ | Table present in apply-progress |
| All tasks have tests | ✅ | Rows map to existing FE/BE `*.spec.*` / `*Test.java` files |
| RED confirmed (tests exist) | ✅ | All referenced test files exist in repo |
| GREEN confirmed (tests pass) | ✅ | FE suite + BE targeted suite executed and passed |
| Triangulation adequate | ✅ | Mapper/service/resource/sync + FE mapper/component/timeline cover multiple cases |
| Safety net for modified files | ✅ | Apply-progress reports pre-existing suites executed (not independently provable beyond recorded evidence) |

**Assertion quality**: ✅ All assertions verify real behavior (no tautologies, ghost loops, or “smoke-only” tests found in audited files).

---

## Test Layer Distribution (Strict)

| Layer | Files (examples) | Notes |
|-------|------------------|------|
| Unit | `hato-be/.../AnimalHealthEventMapperTest.java`, `hato-fe/.../offline-types*.spec.ts`, `hato-fe/.../vet-visit-form.mapper.spec.ts`, `hato-fe/.../animal-health-events-timeline.adapter.spec.ts` | Pure mapping/contract/projection rules |
| Integration | `hato-be/.../AnimalHealthEventServiceTest.java`, `hato-be/.../AnimalHealthEventResourceTest.java`, `hato-be/.../SyncResourceTest.java`, `hato-fe/.../vet-visits-page.component.spec.ts`, `hato-fe/.../animals-health-events.service.spec.ts`, `hato-fe/.../sidebar.spec.ts` | Quarkus + REST and Angular TestBed/feature wiring |
| E2E | — | Not installed |

---

## Spec Compliance Matrix (behavioral)

> ✅ COMPLIANT requires at least one passing test proving runtime behavior.

### Domain: field-vet-visit-workflow-v1

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Registro offline-first e idempotente | Registro offline y sync posterior | `hato-be/.../SyncResourceTest.java > shouldSyncFieldVetVisitOnlyOncePerOperationIdAndPullTypedMetadata` | ✅ COMPLIANT |
| Registro offline-first e idempotente | Rechazo por timestamp inválido | `hato-be/.../AnimalHealthEventMapperTest.java > (requireOffsetDateTime parse rejects)` | ⚠️ PARTIAL (backend parse is covered; scenario is not explicitly named for FIELD_VET_VISIT invalid occurredAt) |
| Checklist y nota clínica tipadas | Checklist y nota válidos | `hato-be/.../AnimalHealthEventMapperTest.java > shouldAcceptFieldVetVisitWithTypedBlocks` | ✅ COMPLIANT |
| Checklist y nota clínica tipadas | Nota clínica incompleta | `hato-be/.../AnimalHealthEventMapperTest.java > shouldRejectFieldVetVisitWithoutClinicalNote` | ✅ COMPLIANT |
| Protocolo y seguimiento básico | Protocolo activo con próximo control | `hato-fe/.../animal-health-events-timeline.adapter.spec.ts > should project field vet visits with visitId, active follow-up and nextDueAt` | ✅ COMPLIANT |
| Protocolo y seguimiento básico | Protocolo cerrado | `hato-be/.../AnimalHealthEventServiceTest.java > shouldProjectFieldVetVisitAsActiveOrClosedAndFilterByVisitId` | ✅ COMPLIANT |
| Listados por animal y visita | Listado por animal | `hato-be/.../AnimalHealthEventResourceTest.java > shouldListOnlyEventsForRequestedAnimalWithoutLeakingOtherAnimals` | ✅ COMPLIANT |
| Listados por animal y visita | Listado por visita específica | `hato-be/.../AnimalHealthEventResourceTest.java > shouldFilterFieldVetVisitsByVisitIdAndExposeDerivedStatus` | ✅ COMPLIANT |
| Exclusiones explícitas V1 | Intento de guardar multimedia | `hato-be/.../AnimalHealthEventMapperTest.java > shouldRejectClinicalAttachmentsAndBillingOutsideCurrentScope` | ✅ COMPLIANT |

### Domain: animal-health-event-ledger-v1 (delta)

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Metadata tipada FIELD_VET_VISIT | Evento de visita con metadata completa | `hato-be/.../AnimalHealthEventMapperTest.java > shouldAcceptFieldVetVisitWithTypedBlocks` | ✅ COMPLIANT |
| Metadata tipada FIELD_VET_VISIT | Bloque tipado ausente | `hato-be/.../AnimalHealthEventMapperTest.java > shouldRejectFieldVetVisitWithoutClinicalNote` | ✅ COMPLIANT |
| Listado por visita dentro del animal | Filtro por visit identifier | `hato-fe/.../animals-health-events.service.spec.ts > should request visitId filtering...` + `hato-be/.../AnimalHealthEventResourceTest.java > shouldFilterFieldVetVisitsByVisitId...` | ✅ COMPLIANT |
| Tipos V1 y exclusiones explícitas | Evento fuera de alcance | `hato-be/.../AnimalHealthEventMapperTest.java > shouldRejectTypesOutsideScope` + `... > shouldRejectClinicalAttachmentsAndBillingOutsideCurrentScope` | ✅ COMPLIANT |

### Domain: animal-health-treatment-follow-up-v1 (delta)

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Seguimiento alineado al protocolo | Estado activo por protocolo en curso | `hato-be/.../AnimalHealthEventServiceTest.java > shouldProjectFieldVetVisitAsActiveOrClosedAndFilterByVisitId` + `hato-fe/.../animal-health-events-timeline.adapter.spec.ts > should project field vet visits...` | ✅ COMPLIANT |
| Seguimiento alineado al protocolo | Cierre de protocolo | `hato-be/.../AnimalHealthEventServiceTest.java > shouldProjectFieldVetVisitAsActiveOrClosedAndFilterByVisitId` | ✅ COMPLIANT |
| Vista básica de seguimiento por animal | Timeline mixto tratamiento + visita | `hato-fe/.../animal-health-events-timeline.adapter.spec.ts` (treatment + vet projection) | ✅ COMPLIANT |

**Compliance summary**: 15 scenarios total → 14 ✅ COMPLIANT, 1 ⚠️ PARTIAL

---

## Correctness (Static — Structural Evidence)

| Focus point requested | Evidence | Status |
|---|---|---|
| Contract `FIELD_VET_VISIT` | BE `AnimalHealthEventMapper.validateFieldVetVisit()` requires `visit/checklist/clinicalNote/protocol` | ✅ |
| `visitId` separado de `operationId` | FE mapper builds `metadata.visit.visitId` and service generates `operationId`; tests assert `visitId != operationId` | ✅ |
| Checklist fijo | BE fixed set `FIELD_VET_CHECKLIST_CODES`; FE exports `FIELD_VET_CHECKLIST_CODES` and page renders fixed catalog | ✅ |
| `FOLLOW_UP_REQUIRED` requiere `nextDueAt` | BE mapper rejects missing `nextDueAt`; FE form validator blocks submission | ✅ |
| Sync/idempotencia por `operationId` | BE create uses `findByOperationId` and sync test pushes same op twice with one persisted row | ✅ |
| UI veterinaria separada | New `/features/admin/vet-visits/*` + route `admin/visitas-veterinarias` + sidebar entry; animals page no longer hosts vet form | ✅ |
| Exclusiones de scope | BE rejects metadata keys containing attachment/image/multimedia/billing/cost/prescription | ✅ |

---

## Coherence (Design)

| Decision | Followed? | Notes |
|----------|----------|------|
| Reusar `ANIMAL_HEALTH_EVENT` + metadata tipada | ✅ Yes | No nuevo agregado/tabla/endpoints dedicados |
| Metadata discriminada por tipo | ✅ Yes | Validación BE + unions TS + tests |
| UI vet desacoplada a feature dedicada | ✅ Yes | `vet-visits` feature + tests de navegación |

---

## Issues Found

**CRITICAL (must fix before archive):**
- None.

**WARNING (should fix):**
- Coverage tooling not available for Strict TDD changed-file coverage (missing FE `@vitest/coverage-v8`, BE coverage extension not enabled).

**SUGGESTION (nice to have):**
- Add an explicit BE test for `FIELD_VET_VISIT` with invalid `occurredAt` to cover the spec scenario directly (today it's indirectly covered by the shared `requireOffsetDateTime` parser behavior).

---

## Verdict

**PASS WITH WARNINGS** — All tasks completed and all executed FE/BE tests passed; one spec scenario is only partially mapped to a directly-named test and coverage tooling is not currently available.
