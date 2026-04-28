# Verification Report

**Change**: integral-herd-management-v2  
**Mode**: Strict TDD (resolved from `sdd-init/code` + `sdd/code/testing-capabilities`)  
**Date**: 2026-04-28

---

## Completeness

Source of truth:
- Engram: `sdd/integral-herd-management-v2/tasks`
- OpenSpec: `openspec/changes/integral-herd-management-v2/tasks.md`

| Metric | Value |
|--------|-------|
| Tasks total | 24 |
| Tasks complete | 24 |
| Tasks incomplete | 0 |

---

## Build & Tests Execution (evidence)

### Backend (Quarkus / Maven)

**Java selection (jenv)**: Repo has `hato-be/.java-version = 21.0.5`, but `JAVA_HOME` was still pointing to Java 8 (jenv export plugin not enabled). Verification ran Maven with Java 21 by exporting:

```bash
export JAVA_HOME="$(jenv prefix 21.0.5)"
```

**Tests**: ✅ Passed

Command:

```bash
export JAVA_HOME="$(jenv prefix 21.0.5)"
./mvnw test -Dtest=SyncPayloadMapperV2ContractTest,SyncServiceV2Test,SyncResourceV2IntegrationTest
```

Result summary:
- Tests run: 7
- Failures: 0
- Errors: 0
- Skipped: 0

Additional policy tests (to cover v2 policy + exclusion semantics):

```bash
export JAVA_HOME="$(jenv prefix 21.0.5)"
./mvnw test -Dtest=SyncServiceTest#shouldExposeV2PolicyDiffAndAllowedActionsForAnimalConflict,SyncServiceTest#shouldRejectManualResolutionActionExcludedByPolicy
```

Result summary:
- Tests run: 2
- Failures: 0
- Errors: 0
- Skipped: 0

**Compile**: ✅ Passed

Command:

```bash
export JAVA_HOME="$(jenv prefix 21.0.5)"
./mvnw -DskipTests compile
```

### Frontend (Angular / Vitest via `ng test`)

**Node selection**: Used Node `20.19.6` via `nvm use 20.19.6`.

**Tests**: ✅ Passed

Command:

```bash
npm test -- --watch=false \
  --include="src/app/core/offline/offline-types.spec.ts" \
  --include="src/app/core/offline/offline-store.migrations.spec.ts" \
  --include="src/app/core/offline/offline-store.service.spec.ts" \
  --include="src/app/features/admin/reporting/data-access/admin-reporting-projection.spec.ts" \
  --include="src/app/features/admin/reporting/data-access/admin-reporting.utils.spec.ts" \
  --include="src/app/features/admin/reporting/data-access/admin-reporting.store.spec.ts" \
  --include="src/app/features/admin/reporting/admin-reporting.integration.spec.ts" \
  --include="src/app/features/admin/reporting/admin-reporting-page.component.spec.ts"
```

Result summary (Vitest):
- Test files: 8 passed
- Tests: 37 passed

**Type check**: ✅ Passed

Command:

```bash
npx tsc --noEmit -p tsconfig.app.json
```

**Coverage**: ➖ Not available

Attempted command (fails on current Angular test runner):

```bash
npm test -- --watch=false --code-coverage --include="src/app/features/admin/reporting/data-access/admin-reporting-projection.spec.ts"
```

Result: `Error: Unknown argument: code-coverage`

---

## TDD Compliance

Source of truth:
- Engram: `sdd/integral-herd-management-v2/apply-progress`
- OpenSpec: `openspec/changes/integral-herd-management-v2/apply-progress.md`

| Check | Result | Details |
|-------|--------|---------|
| TDD Evidence reported | ✅ | Apply-progress incluye tabla “TDD Cycle Evidence”. |
| All tasks have tests | ✅ | 24/24 tasks tienen al menos un test asociado en tasks.md (capas FE/BE). |
| RED confirmed (tests exist) | ✅ | Se verificó existencia de: `SyncPayloadMapperV2ContractTest`, `SyncServiceV2Test`, `SyncResourceV2IntegrationTest`, `offline-*`, `admin-reporting-*`. |
| GREEN confirmed (tests pass) | ✅ | BE: 9/9 tests green (7 V2 sync + 2 v2 policy); FE: 37/37 tests green (suite objetivo del change). |
| Triangulation adequate | ✅ | Dedupe/overlap/window guardrails cubiertos con múltiples casos (unit + integration). |
| Safety Net for modified files | ➖ | No verificable desde artifacts (no incluye baseline run global); se confía en apply-progress. |

---

## Test Layer Distribution

| Layer | Evidence | Files |
|-------|----------|-------|
| Unit (BE) | parsing/contract checks | `SyncPayloadMapperV2ContractTest.java` |
| Integration (BE) | QuarkusTest + REST-assured | `SyncServiceV2Test.java`, `SyncResourceV2IntegrationTest.java` |
| Unit (FE) | pure projection + store/unit | `offline-types.spec.ts`, `offline-store.migrations.spec.ts`, `offline-store.service.spec.ts`, `admin-reporting-projection.spec.ts`, `admin-reporting.store.spec.ts` |
| Integration (FE) | Angular component + orchestrator wiring | `admin-reporting.integration.spec.ts`, `admin-reporting-page.component.spec.ts` |
| E2E | not installed | — |

---

## Changed File Coverage

Coverage analysis skipped — current `ng test` runner does **not** accept `--code-coverage` in this repo (and Vitest coverage plugin is not configured).

---

## Assertion Quality

**Assertion quality**: ✅ All assertions in changed test files verify real behavior (no tautologies / ghost-loops / type-only-only checks found).

---

## Spec Compliance Matrix

Source of truth:
- Engram: `sdd/integral-herd-management-v2/spec`
- OpenSpec: `openspec/changes/integral-herd-management-v2/specs/**/spec.md`

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| herd-lot-offline-sync-v2 | Create lot and assign animals offline | `hato-fe/src/app/core/offline/offline-store.service.spec.ts > should queue explicit V2 lot and ledger operations while rejecting overlapping local assignments` | ⚠️ PARTIAL |
| herd-lot-offline-sync-v2 | Reject overlapping active assignment | `hato-be/src/test/java/bo/pasorapa/hato/service/SyncServiceV2Test.java > shouldRejectOverlappingLotAssignments` | ✅ COMPLIANT |
| herd-productivity-ledger-v2 | Register productivity entry offline | `hato-fe/src/app/core/offline/offline-store.service.spec.ts > should queue explicit V2 lot and ledger operations while rejecting overlapping local assignments` | ✅ COMPLIANT |
| herd-productivity-ledger-v2 | Duplicate entry identity during reconciliation | `hato-be/src/test/java/bo/pasorapa/hato/service/SyncServiceV2Test.java > shouldCanonicalizeProductivityLedgerByIdentityAndPullSingleCanonicalRecord` | ✅ COMPLIANT |
| herd-cost-ledger-v2 | Save valid cost entry offline | `hato-fe/src/app/core/offline/offline-store.service.spec.ts > should queue explicit V2 lot and ledger operations while rejecting overlapping local assignments` | ✅ COMPLIANT |
| herd-cost-ledger-v2 | Invalid cost classification is rejected | `hato-be/src/test/java/bo/pasorapa/hato/service/mapper/SyncPayloadMapperV2ContractTest.java > shouldRejectInvalidV2ContractsEarly` | ✅ COMPLIANT |
| herd-descriptive-indicators-projection-v2 | Compute descriptive indicators offline | `hato-fe/src/app/features/admin/reporting/data-access/admin-reporting-projection.spec.ts > should derive descriptive KPIs...` | ✅ COMPLIANT |
| herd-descriptive-indicators-projection-v2 | Request outside allowed windows | `.../admin-reporting-projection.spec.ts > should keep the scope descriptive and reject unsupported ad-hoc window...` | ✅ COMPLIANT |
| admin-reporting-aggregates-v1 (delta) | Predefined filter preset is accepted | `hato-fe/src/app/features/admin/reporting/admin-reporting-page.component.spec.ts > should trigger bounded window preset changes...` | ✅ COMPLIANT |
| admin-reporting-aggregates-v1 (delta) | Ad-hoc filter is rejected | `.../admin-reporting-projection.spec.ts > reject unsupported ad-hoc window...` + `.../admin-reporting.store.spec.ts > setPreset('invalid-free-filter')` | ✅ COMPLIANT |
| admin-reporting-aggregates-v1 (delta) | Explicit exclusions are applied | `hato-fe/src/app/features/admin/reporting/data-access/admin-reporting-projection.spec.ts > should omit explicitly excluded productivity metrics and cost categories from V1 preset totals` | ✅ COMPLIANT |
| admin-reporting-operational-events-v1 (delta) | User attempts excluded capability | `.../admin-reporting-page.component.spec.ts > should keep excluded V1 capabilities unavailable...` | ✅ COMPLIANT |
| admin-reporting-operational-events-v1 (delta) | User attempts optimization-oriented view | `.../admin-reporting-page.component.spec.ts > should keep excluded...` (no prediction/optimization strings) | ✅ COMPLIANT |
| sync-entity-resolution-policy-v2 (delta) | Política habilita solo acciones definidas | `hato-be/src/test/java/bo/pasorapa/hato/service/SyncServiceTest.java > shouldExposeV2PolicyDiffAndAllowedActionsForAnimalConflict` | ✅ COMPLIANT |
| sync-entity-resolution-policy-v2 (delta) | Exclusión explícita bloquea resolución manual | `hato-be/src/test/java/bo/pasorapa/hato/service/SyncServiceTest.java > shouldRejectManualResolutionActionExcludedByPolicy` | ⚠️ PARTIAL |
| sync-entity-resolution-policy-v2 (delta) | New V2 entity follows declared policy | `hato-be/src/test/java/bo/pasorapa/hato/web/rest/SyncResourceV2IntegrationTest.java > shouldExposeV2PolicyWhenOverlappingLotAssignmentIsRejected` | ✅ COMPLIANT |

**Compliance summary**: 14/16 scenarios compliant; 2 partial; 0 untested

---

## Correctness (Static — Structural Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| Lotes/asignaciones (offline V2) | ✅ Implemented | BE tests muestran `LOT_ASSIGNMENT` overlap rejection y policy key v2; FE reporting incluye LOT/LOT_ASSIGNMENT en snapshots y signatures. |
| Ledger productividad/costos (offline V2) | ✅ Implemented | BE dedupe por identidad (`updatedAt` + tie-break opId) probado; FE proyección dedupe determinístico probado. |
| `periodKey` mensual (`YYYY-MM`) | ✅ Implemented | Validado en BE contract test (rechaza `2026/04`), usado en FE identities. |
| Moneda única (sin conversión) | ✅ Implemented | Payload V2 exige `currency` y tests fijan `BOB`; no se detectó conversión en la proyección V2. |
| KPIs `7d|30d|90d` | ✅ Implemented | FE proyección y store usan `90d`; guardrail rechaza ventanas ad-hoc. |
| Reporting actualizado + exclusión predictiva | ✅ Implemented | Page/specs incluyen mensaje de scope y tests aseguran ausencia de export/scheduling/predictiva. |

---

## Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| LOT_ASSIGNMENT como entidad temporal | ✅ Yes | Overlap rejection probado en SyncServiceV2Test + SyncResourceV2IntegrationTest. |
| Extender SyncEntityType/payload/service (sin endpoint nuevo) | ✅ Yes | Tests usan `/api/sync/push` y `/api/sync/pull` con entityType V2. |
| KPIs via proyección local, ventanas acotadas | ✅ Yes | `projectAdminReportingV2` + guardrail de ventana en tests FE. |

---

## Issues Found

### CRITICAL (must fix before archive)

None

### WARNING (should fix)

- ⚠️ `Create lot and assign animals offline` sigue cubierto parcialmente: se valida queue de `LOT` y ledgers, y validación local de overlap via snapshot existente; no hay test que demuestre enqueue explícito de `LOT_ASSIGNMENT` como operación offline.
- ⚠️ `Exclusión explícita bloquea resolución manual` queda parcial: se prueba que para un caso excluido la política expone acciones limitadas (p.ej. sólo `discard_local`), pero no se prueba el intento real de `resolveConflict` rechazado con preservación del estado.
- ⚠️ FE coverage tooling: `ng test` actual no acepta `--code-coverage`; la capacidad cached quedó desactualizada.
- ⚠️ BE tooling: `JAVA_HOME` puede quedar en Java 8 aunque `jenv` seleccione 21 por shims; para Maven es obligatorio exportar `JAVA_HOME` (ver arriba).

### SUGGESTION (nice to have)

- ➕ Agregar tests FE específicos de enqueue/validación local para entidades V2 (`LOT`, `LOT_ASSIGNMENT`, `PRODUCTIVITY_LEDGER`, `COST_LEDGER`) para convertir escenarios hoy “PARTIAL” a “COMPLIANT”.

---

## Verdict

**PASS WITH WARNINGS** — 0 escenarios UNTESTED/FAILING; quedan 2 escenarios PARTIAL bajo Strict TDD verify.
