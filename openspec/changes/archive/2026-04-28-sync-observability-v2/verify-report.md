# Verification Report

**Change**: sync-observability-v2  
**Mode**: Strict TDD (resolved from `sdd-init/code` + `sdd/code/testing-capabilities`)  
**Date**: 2026-04-28

---

## Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 20 |
| Tasks complete | 20 |
| Tasks incomplete | 0 |

Source of truth:
- Engram: `sdd/sync-observability-v2/tasks`
- OpenSpec: `openspec/changes/sync-observability-v2/tasks.md`

---

## Build & Tests Execution

### Frontend (hato-fe)

**Node**: `20.19.6` (from `.nvmrc`, using `nvm use 20.19.6`)  
**Tests**: ✅ Passed

Command:
```bash
CI=true npm test -- --watch=false
```

Result (summary):
- Test Files: 51 passed
- Tests: 174 passed

**Build**: ✅ Passed (with bundle budget warning)

Command:
```bash
npm run build
```

Result:
- ✅ Build OK
- ⚠️ Warning: initial bundle exceeded budget (827.71 kB > 500 kB)

**Type check**: ✅ Passed

Command:
```bash
npx tsc --noEmit -p tsconfig.app.json
```

**Coverage**: ➖ Not available

Evidence:
- `ng test --code-coverage` → *Unknown argument*
- `ng test --coverage` → missing package `@vitest/coverage-v8`

### Backend (hato-be)

**Java**: `21.0.5` (from `hato-be/.java-version`)  

**IMPORTANT (jenv usage)**: `./mvnw` was initially running under Java 8 (classfile incompatibility). Verification was executed forcing Java 21 via:
```bash
export JAVA_HOME="$(jenv prefix 21.0.5)"
export PATH="$JAVA_HOME/bin:$PATH"
```

**Tests**: ✅ Passed

Command:
```bash
./mvnw test
```

Result (summary):
- Tests run: 135, Failures: 0, Errors: 0, Skipped: 0

**Compile**: ✅ Passed

Command:
```bash
./mvnw -DskipTests compile
```

**Coverage**: ➖ Not available

Note:
- `./mvnw test -Dquarkus.test.coverage.enabled=true` passed, but no coverage report artifacts were found under `hato-be/target/**/jacoco*` or `**/*coverage*`.

---

## TDD Compliance

| Check | Result | Details |
|-------|--------|---------|
| TDD Evidence reported | ✅ | Found in `openspec/changes/sync-observability-v2/apply-progress.md` (“TDD Cycle Evidence”) |
| All tasks have tests | ⚠️ | Tasks are fully covered by tests overall; evidence table references tests for the critical behavior. Some GREEN tasks are wiring/UI and share test files instead of 1:1 new files. |
| RED confirmed (tests exist) | ✅ | Verified referenced test files exist in FE + BE codebase |
| GREEN confirmed (tests pass) | ✅ | FE 174/174 passed; BE 135/135 passed |
| Triangulation adequate | ✅ | Runtime finished vs in-progress; windows default vs 7d vs invalid; stale default 24h covered |
| Safety Net for modified files | ✅ | Baseline suites run and passing (per apply-progress + current execution) |

**Assertion quality**: ✅ All assertions verify real behavior

---

## Test Layer Distribution (change-related files)

| Layer | Files | Tools |
|-------|-------|-------|
| Unit (FE logic/services/stores) | `sync-metrics.store.spec.ts`, `offline-store.service.spec.ts`, `sync-orchestrator.service.spec.ts` | Angular/Vitest (`ng test`) |
| Integration-ish (FE component) | `sync-observability.component.spec.ts`, `sidebar.spec.ts` | Angular TestBed |
| Integration (BE) | `SyncServiceTest.java`, `SyncResourceTest.java`, `SyncConflictAuditLedgerRepositoryTest.java` | Quarkus JUnit + RestAssured |
| E2E | 0 | not installed |

---

## Spec Compliance Matrix

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Runtime Snapshot Metrics (FE) | FE publishes cycle metrics | `hato-fe/src/app/core/offline/sync-orchestrator.service.spec.ts > should publish trigger and phase timings for a finished cycle` | ✅ COMPLIANT |
| Runtime Snapshot Metrics (FE) | FE handles in-progress cycle | `hato-fe/src/app/core/offline/sync-orchestrator.service.spec.ts > should keep the cycle open... and expose in-flight queue metrics` | ✅ COMPLIANT |
| Queue Pending State and Outcome Counters (FE) | Global pending visibility | `hato-fe/src/app/core/offline/sync-metrics.store.spec.ts > should keep a unique dictionary and an empty runtime snapshot by default` | ✅ COMPLIANT |
| Queue Pending State and Outcome Counters (FE) | Per-entity pending visibility | `hato-fe/src/app/core/offline/offline-store.service.spec.ts > should summarize queue state per status and entity` | ✅ COMPLIANT |
| Errors and Conflicts Operational View | Top error and conflict reasons | `hato-fe/src/app/core/offline/offline-store.service.spec.ts > should summarize top recent errors...` + `hato-be/src/test/java/.../SyncServiceTest.java > shouldAggregateSyncObservability...` | ✅ COMPLIANT |
| Errors and Conflicts Operational View | Open vs resolved conflict split | `hato-be/src/test/java/.../SyncServiceTest.java > shouldAggregateSyncObservability...` | ✅ COMPLIANT |
| Global and Entity Sync Status | Entity staleness from timestamps | `hato-fe/src/app/core/offline/offline-store.service.spec.ts > should summarize top recent errors... checkpoint health with the stale default` | ✅ COMPLIANT |
| Global and Entity Sync Status | Missing entity history | `hato-fe/src/app/core/offline/sync-metrics.store.spec.ts > should keep a unique dictionary... empty runtime snapshot by default` | ✅ COMPLIANT |
| Historical Aggregates API (BE) | 24h aggregate query | `hato-be/src/test/java/.../SyncResourceTest.java > shouldExposeObservabilityUsingDefault24hWindow` | ✅ COMPLIANT |
| Historical Aggregates API (BE) | 7d aggregate query by entity | `hato-be/src/test/java/.../SyncResourceTest.java > shouldAcceptObservability7dWindow` + `hato-be/src/test/java/.../SyncServiceTest.java > shouldAggregateSyncObservability...` | ✅ COMPLIANT |
| Explicit Non-Goals and Exclusions | Scope validation for excluded integrations | No APM/alerting deps added; feature is limited to FE runtime + BE endpoint | ✅ COMPLIANT |

**Compliance summary**: 11/11 scenarios compliant

---

## Correctness (Static — Structural Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| Diccionario único de métricas | ✅ Implemented | FE `SYNC_METRICS_DICTIONARY_V2` + BE `OBSERVABILITY_DICTIONARY` (5 keys) |
| Endpoint `/api/sync/observability` | ✅ Implemented | `SyncResource @Path("/api/sync")` + `@Path("/observability")` |
| Windows fijas `24h`/`7d` + default `24h` | ✅ Implemented | BE `resolveObservabilityWindow()` + FE windows `['24h','7d']` |
| `stale` default 24h | ✅ Implemented | FE `SYNC_OBSERVABILITY_STALE_DEFAULT_MS` + BE `OBSERVABILITY_STALE_DEFAULT_MS` |
| UI operativa | ✅ Implemented | Ruta FE `/admin/sync-observability` + componente standalone + tests |

---

## Coherence (Design)

| Decision | Followed? | Notes |
|----------|----------|-------|
| Diccionario único FE/BE | ✅ Yes | Keys alineadas (`cycle/queue/errors/conflicts/entityHealth`) |
| Runtime incremental FE | ✅ Yes | Snapshot runtime mantenido en `SyncMetricsStore` y actualizado por orquestador/servicios |
| Endpoint BE mínimo `/api/sync/observability` | ✅ Yes | Implementado con `window` opcional y validación |

---

## Issues Found

**CRITICAL** (must fix before archive):
- None

**WARNING** (should fix):
- BE tooling: `./mvnw` corre con Java 8 por defecto en este entorno; para tests/compile es necesario forzar `JAVA_HOME` a 21. Esto puede romper CI si no está configurado.
- FE build: warning de presupuesto de bundle inicial (no rompe runtime, pero puede crecer).

**SUGGESTION** (nice to have):
- Cobertura: habilitar `@vitest/coverage-v8` en FE o alternativa, y configurar reporte de coverage en BE si se espera enforcement en Strict TDD.

---

## Verdict

**PASS WITH WARNINGS** — comportamiento requerido probado por tests (FE+BE) y coherencia FE/BE confirmada; quedan warnings operativos (JAVA_HOME para mvnw, budgets FE, coverage no disponible).
