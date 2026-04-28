# Design: Multi-Entity Sync Regression Harness V1

## Technical Approach

Implementar un harness híbrido FE+BE orientado a regresión determinística, reutilizando suites existentes y agregando una capa común de fixtures/tiempo/retry para que los escenarios críticos se ejecuten con el mismo lenguaje de casos (`smoke`/`stress`).

El enfoque separa responsabilidades: FE valida comportamiento de orquestación local (outbox, checkpoint, no-concurrencia, runtime snapshot) y BE valida contrato sync (`operationId` idempotente, `hasMore`, conflictos y consistencia por operación). Se agregan casos de matriz mínima obligatoria sobre los tests existentes, sin tocar código productivo.

## Architecture Decisions

| Decision | Options | Tradeoff | Choice |
|---|---|---|---|
| Ubicación del harness | Suite nueva independiente vs extender specs actuales | Suite nueva simplifica lectura pero duplica setup; extensión mantiene contexto real y menor costo | Extender `sync-orchestrator.service.spec.ts`, `SyncServiceTest`, `SyncResourceTest` con helpers compartidos por módulo |
| Determinismo temporal/azar | Usar tiempo real vs clock/seed inyectados | Tiempo real induce flakes | Clock/seed fijos en FE (`now`, `random`) y timestamps explícitos en BE fixtures |
| Verificación de paginación | Assert de una sola página vs drenado completo | Una sola página no detecta backlog silencioso | Drenado iterativo hasta `hasMore=false` con assert de orden + cursor monotónico |
| Taxonomía de casos | Nombres ad-hoc vs smoke/stress formal | Ad-hoc complica CI gate | Tag explícito por caso (`[smoke]`, `[stress]`) y matriz documentada |

## Data Flow

1) FE prepara outbox/checkpoint determinísticos y ejecuta `syncNow(trigger)`.
2) FE envía `push`, procesa resultados por `operationId`, y luego hace `pull` por entidad.
3) BE responde `results` idempotentes y `pull` paginado (`hasMore`, `nextCursor`).
4) FE aplica páginas al store y publica runtime snapshot/refresh events.

```text
FE fixture -> SyncOrchestratorService -> /api/sync/push -> SyncService(receipts)
        \-> /api/sync/pull(hasMore,nextCursor) -> applyPullResponse/checkpoint
```

## File Changes

| File | Action | Description |
|---|---|---|
| `hato-fe/src/app/core/offline/sync-orchestrator.service.spec.ts` | Modify | Agregar matriz FE: reorder, retry transient, reconnect, mixed batch, conflicto encadenado y drenado `hasMore`; asserts de runtime (`attempt`, `reconnectCount`, `batchComposition`, `hasMoreObserved`). |
| `hato-fe/src/app/core/offline/testing/sync-harness.fixtures.ts` | Create | Fixtures determinísticos FE (operaciones multi-entidad, cursores, respuestas push/pull por páginas). |
| `hato-fe/src/app/core/offline/testing/sync-harness.assertions.ts` | Create | Asserts reutilizables para outbox/checkpoint/orden/idempotencia y taxonomía smoke/stress. |
| `hato-be/src/test/java/bo/pasorapa/hato/service/SyncServiceTest.java` | Modify | Casos de idempotencia por `operationId` en lote mixto, conflicto + `retry_local`, y validación de `hasMore`/cursor en pull incremental. |
| `hato-be/src/test/java/bo/pasorapa/hato/web/rest/SyncResourceTest.java` | Modify | Contrato HTTP para push/pull multi-entidad, paginación `hasMore`, conflictos y compatibilidad de status/body en pipeline actual. |
| `hato-be/src/test/java/bo/pasorapa/hato/support/sync/SyncHarnessFixtures.java` | Create | Builder de fixtures determinísticos BE (usuarios, animales, eventos, lotes mixtos, cursores). |

## Interfaces / Contracts

No se introducen contratos productivos nuevos. Se estandariza contrato de test para casos:

```ts
type HarnessCase = {
  id: string;
  tier: 'smoke' | 'stress';
  entities: OfflineEntityType[];
  expectsHasMore: boolean;
  expectsConflict: boolean;
};
```

```java
record PullPageExpectation(boolean hasMore, String nextCursorId, int itemCount) {}
```

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit (FE) | Orden push→pull, retry scheduling, no-concurrencia, runtime flags | Vitest con `SyncApiClient` fake y clock/seed fijos |
| Service Integration (BE) | Idempotencia de duplicados, conflicto encadenado, cursor/paginación | `@QuarkusTest` + DB limpia por caso + fixtures determinísticos |
| REST Integration (BE) | Contrato `/api/sync` para mixed batch, `hasMore`, conflicto | Rest-assured validando status/campos por operación |

## Migration / Rollout

No migration required. Rollout incremental: primero smoke obligatorio en CI; stress como suite extendida del mismo pipeline para evitar romper compatibilidad.

## Open Questions

- [ ] ¿El pipeline actual separa jobs para smoke/stress o necesitamos filtro por naming al inicio?
- [ ] ¿Queremos límite explícito de páginas por ciclo FE para cortar loops defensivos en tests?
