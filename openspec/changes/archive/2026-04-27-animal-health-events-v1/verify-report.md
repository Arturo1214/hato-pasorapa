# Verification Report

**Change**: animal-health-events-v1  
**Version**: N/A  
**Mode**: Strict TDD

---

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 24 |
| Tasks complete | 24 |
| Tasks incomplete | 0 |

---

### Build & Tests Execution

**Frontend (hato-fe)**

- **Node**: v20.19.6 (via `.nvmrc` + `nvm use`)
- **Tests**: ✅ 26 files / 93 tests passed
  ```bash
  source "$HOME/.nvm/nvm.sh" && nvm use
  npm ci
  npm test -- --watch=false
  ```
- **Build**: ✅ Passed (warning de budget)
  ```bash
  source "$HOME/.nvm/nvm.sh" && nvm use
  npm run build
  ```
  - Warning observado: `bundle initial exceeded maximum budget` (no bloqueante).
- **Type check**: ✅ Passed
  ```bash
  source "$HOME/.nvm/nvm.sh" && nvm use
  npx tsc --noEmit -p tsconfig.app.json
  ```

**Backend (hato-be)**

- **Java**: 21.0.5 (via `.java-version` + `jenv`)
- **Tests (targeted)**: ✅ 45 tests passed
  ```bash
  eval "$(jenv init -)" && jenv version
  ./mvnw -Dtest=AnimalHealthEventMapperTest,AnimalHealthEventLiquibaseMigrationTest,AnimalHealthEventServiceTest,AnimalHealthEventResourceTest,SyncServiceTest,SyncResourceTest test
  ```
- **Compile**: ✅ BUILD SUCCESS
  ```bash
  eval "$(jenv init -)" && jenv version
  ./mvnw -DskipTests compile
  ```

**Coverage**: ➖ Not available

- FE: `npm test -- --watch=false --code-coverage` falla con `Unknown argument: code-coverage`.
- BE: `-Dquarkus.test.coverage.enabled=true` es key no reconocido (sin extensión/plugin de coverage activo).

---

### TDD Compliance

| Check | Result | Details |
|-------|--------|---------|
| TDD Evidence reported | ✅ | “TDD Cycle Evidence” presente en apply-progress |
| All tasks have tests | ✅ | Tests BE/FE existen según tasks.md/apply-progress |
| RED confirmed (tests exist) | ✅ | Archivos de test referenciados existen en el repo |
| GREEN confirmed (tests pass) | ✅ | FE 93/93 + BE 45/45 en ejecución real |
| Triangulation adequate | ✅ | Casos válidos/invalidos cubren catálogo, metadata, scope y sync |
| Safety Net for modified files | ✅ | Suites FE/BE relevantes ejecutadas (sync + UI + mapper/service/resource) |

**Assertion quality**: ✅ All assertions verify real behavior

---

### Test Layer Distribution (change-focused)

| Layer | Tests | Files | Tools |
|-------|-------|-------|-------|
| Unit | 11 | 3 | JUnit5 / Vitest |
| Integration | 33 | 4 | QuarkusTest / Angular TestBed + Vitest |
| API/UI | 24 | 3 | rest-assured / Angular Component Test |
| **Total** | **68** | **10** | |

---

### Changed File Coverage

Coverage analysis skipped — no coverage tool detected (FE builder no soporta `--code-coverage`; BE sin cobertura habilitada).

---

### Quality Metrics

**Linter**: ➖ Not available (no runner detectado)  
**Type Checker**: ✅ Passed (`npx tsc --noEmit -p tsconfig.app.json`)

---

### Spec Compliance Matrix

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Ledger tipado/auditable | Alta válida de vacunación | `AnimalHealthEventMapperTest.java > shouldMapVaccinationPayloadWithTypedMetadata` + `AnimalHealthEventServiceTest.java > shouldCreateVaccinationAppendOnlyIdempotently` | ✅ COMPLIANT |
| Ledger tipado/auditable | Rechazo por metadata inválida (DEWORMING) | `AnimalHealthEventMapperTest.java > shouldRejectDewormingWithoutProductName` | ✅ COMPLIANT |
| Tipos V1 + exclusiones | Evento permitido (DISEASE_REPORTED) | `AnimalHealthEventMapperTest.java > shouldAllowDiseaseReportedWhenDiagnosisCodeIsPresent` | ✅ COMPLIANT |
| Tipos V1 + exclusiones | Evento fuera de alcance (reproducción) | `AnimalHealthEventMapperTest.java > shouldRejectTypesOutsideScope` | ✅ COMPLIANT |
| Tipos V1 + exclusiones | Adjunto / imagen clínica | `AnimalHealthEventMapperTest.java > shouldRejectClinicalAttachmentsAndImagesOutsideCurrentScope` | ✅ COMPLIANT |
| Listado sanitario | Listado base por animal (no filtra otros) | `AnimalHealthEventResourceTest.java > shouldListOnlyEventsForRequestedAnimalWithoutLeakingOtherAnimals` | ✅ COMPLIANT |
| Listado sanitario | Filtros por tipo y rango | `AnimalHealthEventResourceTest.java > shouldListAnimalHealthEventsUsingFiltersAndDeterministicOrdering` | ✅ COMPLIANT |
| Offline queue-first | Alta sin conectividad | `animals-health-events.service.spec.ts > should queue health events offline without dispatching manual sync` | ✅ COMPLIANT |
| Offline queue-first | Reintento automático al recuperar conectividad | `sync-orchestrator.service.spec.ts > should trigger one sync on startup and another on reconnect when connectivity returns` | ⚠️ PARTIAL (prueba reconnect genérica; no aserta push de outbox sanitario pendiente) |
| Idempotencia operationId | Replay del mismo evento | `AnimalHealthEventServiceTest.java > shouldCreateVaccinationAppendOnlyIdempotently` + `SyncServiceTest.java > shouldCreateAnimalHealthEventOfflineIdempotentlyAndPullIncrementally` | ✅ COMPLIANT |
| Idempotencia operationId | operationId faltante | `SyncServiceTest.java > shouldRejectAnimalHealthEventsWithoutPayloadOperationId` + `SyncResourceTest.java > shouldRejectAnimalHealthEventMissingPayloadOperationIdThroughSyncResource` | ✅ COMPLIANT |
| Pull incremental | Pull con cursor previo | `SyncResourceTest.java > shouldSyncAnimalHealthEventCreateAndPullIncrementally` | ✅ COMPLIANT |
| Pull incremental | Primer pull sin cursor | `SyncServiceTest.java > shouldPullAnimalHealthEventsOnFirstSyncWithoutCursor` | ✅ COMPLIANT |
| Tratamientos append-only | Inicio y seguimiento | `AnimalHealthEventServiceTest.java > shouldPreserveTreatmentTimelineAndRejectFollowUpAfterClosure` | ✅ COMPLIANT |
| Tratamientos append-only | Cierre posterior | `AnimalHealthEventServiceTest.java > shouldPreserveTreatmentTimelineAndRejectFollowUpAfterClosure` | ✅ COMPLIANT |
| Metadata tratamiento | Metadata válida en seguimiento | `AnimalHealthEventServiceTest.java > shouldPreserveTreatmentTimelineAndRejectFollowUpAfterClosure` | ✅ COMPLIANT |
| Metadata tratamiento | Metadata incompleta | `AnimalHealthEventMapperTest.java > shouldRequireTreatmentThreadMetadataAndStatusNote` + `... > shouldRequireTreatmentProductName` + `... > shouldRequireTreatmentStatusNotes` | ✅ COMPLIANT |
| Vista seguimiento | Timeline con estado derivado | `animal-health-events-timeline.adapter.spec.ts > should normalize health payloads and derive closed treatment status from the latest event` + `animals-health-events.service.spec.ts > should derive treatment status from local timeline snapshots offline` | ✅ COMPLIANT |

**Compliance summary**: 16/17 scenarios compliant (1 partial)

---

### Correctness (Static — Structural Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| Agregado sanitario separado | ✅ Implemented | Tabla `animal_health_events`, resource/service/repo dedicados + `SyncEntityType.ANIMAL_HEALTH_EVENT` |
| Exclusión explícita adjuntos/imágenes clínicas | ✅ Implemented | `AnimalHealthEventMapper.rejectOutOfScopeAttachments()` + test dedicado |
| Metadata mínima tratamiento (regimen/medicación + status note) | ✅ Implemented | Requiere `treatmentCaseId`, `productName`, `notes` + tests de faltantes |
| Append-only | ✅ Implemented (práctica) | Servicio expone solo `create()` y `list()`; idempotencia por `operationId` + unique constraint. *(Nota: entidad tiene `@PreUpdate`, pero no hay paths de update en V1.)* |
| Sync idempotente + capability matrix | ✅ Implemented | Matrix permite solo CREATE para `ANIMAL_HEALTH_EVENT`; receipts por `operationId` + tests push/replay |
| Pull incremental sanitario | ✅ Implemented | Repo `listChangedSince(...)` + índices + tests de cursor y primer pull |

---

### Coherence (Design)

| Decision | Followed? | Notes |
|----------|----------|-------|
| Boundary separado | ✅ Yes | No mezcla con `animal_events` |
| Append-only para seguimiento | ✅ Yes | Lifecycle por eventos START/FOLLOW_UP/CLOSED |
| Metadata tipada mínima | ✅ Yes | Validación central en mapper |
| Nuevo SyncEntityType | ✅ Yes | FE/BE incluyen `ANIMAL_HEALTH_EVENT` |

---

### Issues Found

**CRITICAL** (must fix before archive):

- None

**WARNING** (should fix):

- Reintento automático al recuperar conectividad (escenario sanitario) está **parcialmente** probado: hay test de reconnect, pero no aserta explícitamente el push de un outbox sanitario pendiente.

**SUGGESTION** (nice to have):

- Coverage tooling: hoy no hay comando válido para coverage FE (`--code-coverage`) ni BE (`quarkus.test.coverage.enabled`). Si Strict TDD quiere coverage como métrica informativa, habría que habilitarlo.
- Hard guard append-only: si se quiere enforcement fuerte, considerar constraint/trigger o política de repositorio para evitar updates sobre `animal_health_events`.

---

### Verdict

**PASS WITH WARNINGS** — build FE ok, tests ok, scope/metadata/idempotencia validados; queda 1 escenario parcialmente cubierto por tests (reconnect sanitario con push de pending outbox).
