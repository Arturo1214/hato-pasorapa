# Verification Report

**Change**: reproduction-and-birth-v1  
**Mode**: Strict TDD (resolved from `sdd/code/testing-capabilities` + apply-progress)  
**Date**: 2026-04-27  

---

## Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 29 |
| Tasks complete | 29 |
| Tasks incomplete | 0 |

---

## Build & Tests Execution (real)

### Backend (hato-be)

**Java (jenv)**: 21.0.5 (via `hato-be/.java-version`)  
**Notes**: `./mvnw` MUST be run via `jenv exec` in this environment.

**Tests**: ✅ Passed

Command:
```bash
jenv exec ./mvnw test
```

Result summary:
- Tests run: **97**
- Failures: **0**
- Errors: **0**
- Skipped: **0**
- Exit code: 0 (BUILD SUCCESS)

**Build/type-check**: ✅ Passed

Command:
```bash
jenv exec ./mvnw -DskipTests compile
```

### Frontend (hato-fe)

**Node (nvm)**: 20.19.6 (via repo `/.nvmrc`)  
**npm**: 10.8.2

**Tests**: ✅ Passed

Command:
```bash
nvm use 20.19.6
npm test -- --watch=false
```

Result summary:
- Test Files: **29 passed**
- Tests: **103 passed**

**Type-check**: ✅ Passed

Command:
```bash
npx tsc --noEmit -p tsconfig.app.json
```

---

## Coverage

➖ Not available in this repo configuration.

- FE: `ng test --code-coverage` / `--coverage` is not enabled out-of-the-box (Vitest builder requires `@vitest/coverage-v8`, not installed).
- BE: `-Dquarkus.test.coverage.enabled=true` is an **unrecognized** Quarkus config key with current dependencies (ignored at runtime).

---

## Strict TDD Verification

### TDD Compliance

| Check | Result | Details |
|-------|--------|---------|
| TDD Evidence reported | ✅ | `apply-progress` includes “TDD Cycle Evidence” table |
| All tasks have tests | ✅ | 5/5 task-rows reference existing test files |
| RED confirmed (tests exist) | ✅ | All referenced test files exist in repo |
| GREEN confirmed (tests pass on execution) | ✅ | `jenv exec ./mvnw test` ✅ + `npm test -- --watch=false` ✅ |
| Triangulation adequate | ✅ | Negative/positive paths for metadata, parentage, sync idempotency + UI wiring |
| Safety Net for modified files | ⚠️ | Reported in apply-progress; not independently provable from current state |

---

### Test Layer Distribution (change-related subset)

| Layer | Tests | Files | Tools |
|-------|------:|------:|-------|
| Unit | 12 | 4 | JUnit 5 (plain) + Vitest |
| Integration (incl. API/UI) | 63 | 8 | QuarkusTest + RestAssured + Angular TestBed/Vitest |
| E2E | 0 | 0 | — |
| **Total** | **75** | **12** | |

---

### Changed File Coverage

Coverage analysis skipped — coverage tools not installed/enabled (see Coverage section).

---

### Assertion Quality

**Assertion quality**: ✅ All assertions in the change-related test files verify real behavior (no tautologies / ghost loops detected).

---

## Spec Compliance Matrix (behavioral)

> Rule: a scenario is ✅ only when a covering test exists and **passed** in the executed test runs.

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Ledger append-only | Alta válida y bloqueo de edición | `hato-be/.../AnimalReproductionEventServiceTest > shouldCreateServiceAppendOnlyIdempotently` | ⚠️ PARTIAL (append-only/idempotence proven; no update/delete endpoints to test) |
| Metadata tipada | Validación de metadata por tipo | `.../AnimalReproductionEventMapperTest > shouldAllowPregnancyConfirmedWhenConfirmationDateIsPresent` + `... > shouldRejectBirthsWithoutOffspringCount` | ✅ COMPLIANT |
| Listado por animal + scope | Consulta por animal con alcance V1 | `.../AnimalReproductionEventResourceTest > shouldListAnimalReproductionEventsUsingDeterministicDescendingOrdering` + `... > shouldListOnlyEventsForRequestedAnimalWithoutLeakingOtherAnimals` | ✅ COMPLIANT |
| Queue-first | Alta offline y falla de push | `hato-fe/.../animals-reproduction-events.service.spec.ts > should queue birth events queue-first...` + `hato-fe/.../sync-orchestrator.service.spec.ts > should schedule retry...` | ✅ COMPLIANT |
| Idempotencia | Reintento de operación ya aplicada | `hato-be/.../SyncServiceTest > shouldCreateAnimalReproductionEventOfflineIdempotentlyAndPullIncrementally` | ✅ COMPLIANT |
| Pull incremental | Pull incremental e inicial | `hato-be/.../SyncServiceTest > shouldPullAnimalReproductionEventsOnFirstSyncWithoutCursor` | ✅ COMPLIANT |
| Filiación mínima | Validación de filiación en alta de parto | `.../AnimalReproductionEventMapperTest > shouldRejectBirthsWithoutMotherAnimalUuid` + `.../AnimalReproductionEventServiceTest > shouldProjectBirthParentageIntoOffspringAnimals` + `... > shouldRejectBirthWhenFatherAnimalDoesNotExist` | ✅ COMPLIANT |
| Crías vinculadas | Parto múltiple con dos crías | `.../AnimalReproductionEventServiceTest > shouldProjectBirthParentageIntoOffspringAnimals` | ✅ COMPLIANT |
| Alcance V1 | Consulta por animal y alcance V1 | `.../AnimalReproductionEventMapperTest > shouldRejectOutOfScopeFields` | ⚠️ PARTIAL (out-of-scope enforcement proven; assisted/attachments are covered by codepath but not asserted explicitly) |

**Compliance summary**: 7/9 scenarios ✅, 2/9 ⚠️ partial, 0 failing

---

## Correctness (Static — Structural Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| Agregado reproductivo separado | ✅ Implemented | Tabla/entidad/servicio/resource propios (`animal_reproduction_events`, `AnimalReproductionEvent*`) |
| Offline sync dedicado | ✅ Implemented | `SyncEntityType.ANIMAL_REPRODUCTION_EVENT` + push/pull handlers + FE supportedEntities |
| Parentage (madre obligatoria, padre opcional) | ✅ Implemented | Validación de referencias en `AnimalReproductionEventService.projectBirth` |
| `BIRTH` sin `offspringCount` | ✅ Covered | `AnimalReproductionEventMapperTest#shouldRejectBirthsWithoutOffspringCount` |
| Padre inexistente | ✅ Covered | `AnimalReproductionEventServiceTest#shouldRejectBirthWhenFatherAnimalDoesNotExist` |
| Exclusiones V1 | ✅ Implemented | `rejectOutOfScopeFields` (attachment/genetic/assisted) + DTOs acotados |

---

## Coherence (Design)

| Decision | Followed? | Notes |
|----------|----------|-------|
| Nuevo ledger `animal_reproduction_events` | ✅ Yes | No se mezcló con `animal_events` / `animal_health_events` |
| `BIRTH` en mismo ledger + metadata estructurada | ✅ Yes | Birth metadata + proyección mínima |
| `SyncEntityType` dedicado | ✅ Yes | Pull/push por entidad específica |
| Proyección mínima en `animals` sin sobrescritura | ✅ Yes | Conflicto `ANIMAL_REPRODUCTION_EVENT_PARENTAGE_CONFLICT` cubierto por test |

---

## Issues Found

### CRITICAL (must fix before archive)

None.

### WARNING (should fix)

1) Coverage tooling is not installed/enabled (FE missing `@vitest/coverage-v8`; BE coverage flag unsupported with current deps).
2) Two spec scenarios are only partially asserted (append-only “no edit/delete” and assisted/attachments explicit rejection).

---

## Verdict

**PASS WITH WARNINGS** — BE suite completa ✅ (`jenv exec ./mvnw test`) y FE suite ✅; escenarios críticos (offline sync, parentage, exclusiones base) están cubiertos con tests que pasan.
