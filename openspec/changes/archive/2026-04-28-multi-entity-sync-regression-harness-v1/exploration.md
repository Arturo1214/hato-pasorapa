## Exploration: multi-entity-sync-regression-harness-v1

### Current State
El pipeline offline-first ya existe y está operativo en FE/BE: `SyncOrchestratorService` empuja outbox elegible, luego hace pull secuencial por `supportedEntities` y actualiza snapshots/checkpoints locales. El BE (`SyncService`) procesa lotes `push` por operación (idempotencia por `operationId` vía `SyncOperationReceipt`) y expone `pull` incremental por entidad con `PULL_PAGE_SIZE=100` + `hasMore`. Ya hay cobertura de conflictos V2, retries transitorios, reconexión y lote mixto básico (USER/GANADERO/ANIMAL), pero todavía no hay un harness de regresión V1 específicamente diseñado para estrés multi-entidad con reorder sistemático, duplicados cruzados, reconexión intermitente y paginación multi-entidad combinada.

### Affected Areas
- `hato-fe/src/app/core/offline/sync-orchestrator.service.ts` — orquestación push→pull, reconexión, métricas runtime, resolución de snapshots locales.
- `hato-fe/src/app/core/offline/sync-orchestrator.service.spec.ts` — suite actual donde se agregaría/estructuraría el harness FE de regresión dura.
- `hato-fe/src/app/core/offline/offline-store.service.ts` — reglas de elegibilidad, estados outbox, apply pull y checkpoints.
- `hato-fe/src/app/core/offline/offline-types.ts` — contratos de entidades/operaciones y estados observables del pipeline.
- `hato-be/src/main/java/bo/pasorapa/hato/service/SyncService.java` — idempotencia y clasificación de resultados/conflictos por operación; pull incremental paginado.
- `hato-be/src/test/java/bo/pasorapa/hato/service/SyncServiceTest.java` — pruebas de contrato/idempotencia/conflictos que pueden endurecerse para caos multi-entidad.
- `hato-be/src/test/java/bo/pasorapa/hato/web/rest/SyncResourceTest.java` — cobertura HTTP del contrato sync para escenarios de integración real.

### Approaches
1. **Harness FE-centric (determinístico con fakes de API)** — reforzar `sync-orchestrator.service.spec.ts` como banco principal de regresión.
   - Pros: rápido, determinístico, barato de ejecutar; valida reorder/retry/reconnect y consistencia de outbox+checkpoints+métricas en un solo lugar.
   - Cons: no detecta ciertos problemas de contrato real FE↔BE (serialización, paginación real, headers/roles).
   - Effort: Medium.

2. **Harness BE-centric (servicio+REST con fixtures multi-entidad)** — endurecer `SyncServiceTest` y `SyncResourceTest` para lotes mixtos, duplicados y conflictos encadenados.
   - Pros: máxima fidelidad del contrato backend y reglas de idempotencia/conflicto.
   - Cons: más lento, más setup de datos, menos visibilidad del estado local offline (outbox/checkpoints FE).
   - Effort: High.

3. **Harness híbrido V1 (recomendado)** — FE como “oráculo de pipeline offline” + BE como “oráculo de contrato e idempotencia”, con matriz mínima priorizada por riesgo.
   - Pros: balance cobertura/costo; mantiene offline-first end-to-end sin rediseñar pipeline; reduce regresiones cruzadas.
   - Cons: requiere disciplina en naming/fixtures para evitar duplicación de escenarios entre capas.
   - Effort: Medium-High.

### Recommendation
Adoptar **Approach 3 (híbrido)** con alcance V1 acotado a una matriz de regresión crítica:
- **Reorder**: respuestas push en orden distinto al outbox + pull secuencial multi-entidad.
- **Retries**: transición `pending → retry_scheduled → acked/dead_letter` con jitter determinístico y sin pérdida de operación.
- **Duplicados**: replay de mismo `operationId` dentro del mismo batch y en ciclos distintos.
- **Reconexión**: ciclos startup/reconnect/manual con token/session boundary y sin doble procesamiento concurrente.
- **Lotes mixtos**: USER+GANADERO+ANIMAL(+eventos) con mezcla `no_conflict/version_conflict/validation_error`.
- **Conflictos multi-entidad**: policy/action metadata V2 consistente y persistencia de audit trail.

Para V1, **NO** incluir rediseño de protocolo, infraestructura de chaos testing externa, ni E2E browser; se aprovecha infraestructura actual de unit/integration tests.

### Risks
- `pull.hasMore` existe en BE pero FE hoy ejecuta un único pull por entidad/ciclo; bajo alta delta puede quedar backlog silencioso entre ciclos.
- Cobertura actual está concentrada en escenarios puntuales; sin matriz estandarizada puede haber “huecos diagonales” (ej. duplicado + retry + conflicto en lote mixto).
- Si no se fija determinismo temporal/aleatorio en tests, los flakes pueden ocultar regresiones reales.
- Riesgo de crecimiento excesivo de fixtures si no se define una taxonomía de escenarios V1 (smoke vs stress).

### Ready for Proposal
Yes — el problema está delimitado, hay superficies técnicas claras y un alcance V1 concreto para pasar a `sdd-propose` sin bloquear offline-first.
