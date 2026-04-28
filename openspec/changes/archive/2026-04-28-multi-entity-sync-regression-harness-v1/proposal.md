# Proposal: Multi-Entity Sync Regression Harness V1

## Intent

Reducir regresiones severas del sync offline-first multi-entidad creando un harness híbrido FE+BE, determinístico y repetible, que capture fallas de orden, idempotencia, reconexión y conflictos antes de release.

## Scope

### In Scope
- Matriz V1 de regresión dura para reorder, retries, duplicados, reconexión, lotes mixtos y conflictos multi-entidad.
- Harness FE en `sync-orchestrator.service.spec.ts` como oráculo de pipeline local (outbox/checkpoints/estados).
- Harness BE en `SyncServiceTest` + `SyncResourceTest` como oráculo de contrato/idempotencia/paginación.
- Fixtures y naming taxonomy compartida (smoke vs stress) para evitar duplicación y flakes.

### Out of Scope
- Load testing masivo (volumen/throughput de escala).
- Chaos engineering distribuido (fallas infra/red multi-nodo).
- Observabilidad enterprise (APM, tracing distribuido, alerting/SLO externos).

## Capabilities

### New Capabilities
- `multi-entity-sync-regression-harness-v1`: contrato de harness híbrido FE+BE para regresión determinística multi-entidad.

### Modified Capabilities
- `sync-observability-runtime-history-v2`: extender criterios de verificación runtime para ciclos complejos (reconnect/retry/lotes mixtos) en contexto de test harness.
- `offline-conflict-resolution-v2`: reforzar escenarios de conflicto encadenado con retry posterior e idempotencia preservada en lotes mixtos.
- `sync-conflict-audit-ledger-v2`: endurecer verificación de audit trail consistente bajo duplicados y conflictos repetidos por `operationId`.

## Approach

Implementar enfoque híbrido por capas: FE valida consistencia operacional del ciclo (push→pull, estados outbox, checkpoints y no-concurrencia), BE valida semántica de contrato (`operationId` idempotente, `hasMore`, resultados por operación). Ejecutar una matriz mínima priorizada por riesgo y determinismo temporal/aleatorio controlado.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `hato-fe/src/app/core/offline/sync-orchestrator.service.spec.ts` | Modified | Escenarios V1 de reorder/retry/reconnect/lotes mixtos. |
| `hato-be/src/test/java/bo/pasorapa/hato/service/SyncServiceTest.java` | Modified | Idempotencia, duplicados cruzados y conflictos encadenados. |
| `hato-be/src/test/java/bo/pasorapa/hato/web/rest/SyncResourceTest.java` | Modified | Contrato HTTP sync para lotes mixtos y reconexión. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Flakiness por tiempo/azar | Med | Reloj/seed determinísticos y fixtures estables. |
| Cobertura incompleta de combinatorias | Med | Taxonomía smoke/stress + matriz mínima obligatoria. |
| Backlog silencioso por `hasMore` | Med | Escenarios explícitos de paginación incremental en BE y asserts en FE. |

## Rollback Plan

Revertir cambios de tests/fixtures del harness en FE+BE y restaurar suites previas; no hay migraciones ni cambios de contrato productivo en V1.

## Dependencies

- Infra de pruebas existente: Vitest (FE), JUnit/Quarkus test + REST-assured (BE).
- Contratos vigentes de `/api/sync` y políticas/conflict ledger V2.

## Success Criteria

- [ ] Matriz V1 ejecuta determinísticamente y cubre los 6 ejes críticos definidos.
- [ ] Se detectan regresiones de reorder/duplicados/retry/reconnect sin falsos positivos recurrentes.
- [ ] No se introducen cambios funcionales en producción; solo fortalecimiento de regresión.
