# Design: Sync Observability V2

## Technical Approach

Se implementa observabilidad híbrida en dos planos: **runtime FE** (estado inmediato de ciclo/outbox por entidad) y **histórico BE** (agregados 24h/7d desde `sync_operation_receipts` + `sync_conflict_audit_ledger`). Ambos planos usan un diccionario semántico único (`SyncMetricsDictionaryV2`) para evitar divergencias de significado entre UI y backend.

## Architecture Decisions

### Decision 1: Diccionario único de métricas V2

| Opción | Tradeoff | Decisión |
|---|---|---|
| Diccionarios separados FE/BE | Implementación más rápida, alta deriva semántica | ❌ |
| Diccionario compartido por contrato DTO/TS | Más trabajo inicial, consistencia fuerte | ✅ |

**Choice**: Definir claves canónicas (cycle, queue, errors, conflicts, entityHealth) y mapearlas 1:1 en TS/Java.
**Rationale**: Mitiga el principal riesgo del proposal (runtime vs histórico inconsistente).

### Decision 2: Runtime agrega incrementalmente en FE

| Opción | Tradeoff | Decisión |
|---|---|---|
| Recalcular todo desde `listOutbox()` cada ciclo | Simple, costo mayor en dispositivos modestos | ❌ |
| Agregación incremental + fallback puntual | Más lógica, menor costo sostenido | ✅ |

**Choice**: `SyncOrchestratorService` mide ciclo/fase/trigger; `OfflineStoreService` expone resumen por estado/entidad; `SyncMetricsStore` compone snapshot.
**Rationale**: Preserva UX offline-first con payload liviano.

### Decision 3: Endpoint BE mínimo y derivado

| Opción | Tradeoff | Decisión |
|---|---|---|
| Endpoint analítico amplio ad-hoc | Flexibilidad alta, scope creep | ❌ |
| Endpoint único `/api/sync/observability` con ventanas fijas | Menos flexible, alcance controlado | ✅ |

**Choice**: Exponer agregados mínimos (24h/7d) + breakdown por entidad/resultados + conflictos abiertos/resueltos.
**Rationale**: Cumple V2 sin derivar a plataforma de monitoreo.

## Data Flow

`syncNow(trigger)` inicia marcas de tiempo y contexto de ciclo.

```text
SyncOrchestratorService
  ├─ push/pull instrumentados (duración, resultados)
  ├─ OfflineStoreService.summarizeOutboxByStatusAndEntity()
  ├─ OfflineStoreService.listCheckpointHealth()
  └─ SyncMetricsStore.update(V2 snapshot)

UI admin (resumen operativo) ── consume signal runtime

SyncResource.GET /api/sync/observability?window=24h|7d
  └─ SyncService.getObservability(window)
      ├─ SyncOperationReceiptRepository.aggregateByWindow(...)
      └─ SyncConflictAuditLedgerRepository.aggregateResolution(...)
```

## File Changes

| File | Action | Description |
|---|---|---|
| `hato-fe/src/app/core/offline/sync-metrics.store.ts` | Modify | Expandir `SyncMetricsSnapshot` a V2 con `cycle`, `queue`, `errors`, `conflicts`, `entityHealth` + selector resumen legacy-compatible. |
| `hato-fe/src/app/core/offline/sync-orchestrator.service.ts` | Modify | Instrumentar trigger, tiempos push/pull/total, top errores y actualización de snapshot V2 por ciclo. |
| `hato-fe/src/app/core/offline/offline-store.service.ts` | Modify | Agregar métodos `summarizeOutboxByStatusAndEntity()`, `summarizeErrors()`, `listCheckpointHealth(now)` sin romper API actual. |
| `hato-fe/src/app/core/offline/offline-types.ts` | Modify | Tipos compartidos FE para estados de observabilidad por entidad/cola. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/dto/sync/SyncObservabilityResponse.java` | Create | DTO raíz del endpoint de agregados (window, totals, perEntity, conflicts). |
| `hato-be/src/main/java/bo/pasorapa/hato/service/dto/sync/SyncMetricDictionaryEntry.java` | Create | Contrato explícito de claves/categorías del diccionario V2 para serialización estable. |
| `hato-be/src/main/java/bo/pasorapa/hato/repository/SyncOperationReceiptRepository.java` | Modify | Consultas agregadas por ventana, entidad, clasificación, reason/opType. |
| `hato-be/src/main/java/bo/pasorapa/hato/repository/SyncConflictAuditLedgerRepository.java` | Modify | Agregados de conflictos abiertos vs resueltos por ventana. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/SyncService.java` | Modify | Nuevo método de servicio para construir respuesta observability V2 en capa service. |
| `hato-be/src/main/java/bo/pasorapa/hato/web/rest/SyncResource.java` | Modify | Nuevo `GET /api/sync/observability` (window opcional con default 24h). |
| `hato-fe/src/app/core/offline/sync-orchestrator.service.spec.ts` | Modify | Casos por trigger, degradación, conflictos, latencias y compatibilidad legacy. |
| `hato-be/src/test/java/bo/pasorapa/hato/service/SyncServiceTest.java` | Modify | Validar agregados por ventana y mapeo de diccionario. |
| `hato-be/src/test/java/bo/pasorapa/hato/web/rest/SyncResourceTest.java` | Modify | Validar contrato endpoint, defaults y errores de query param. |

## Interfaces / Contracts

```ts
type MetricsWindow = '24h' | '7d';
interface SyncRuntimeSnapshotV2 {
  cycle: { trigger: 'manual'|'startup'|'reconnect'; startedAt: string; endedAt?: string; durationMs?: number; pushMs?: number; pullMs?: number };
  queue: { totalByStatus: Record<'pending'|'in_flight'|'retry_scheduled'|'failed'|'dead_letter'|'conflict', number>; byEntity: Record<string, Record<string, number>> };
  conflicts: { open: number; resolved: number; blockedOperations: number };
  entityHealth: Record<string, { cursorUpdatedAt: string|null; lastSuccessAt: string|null; stalenessMs: number|null; stale: boolean }>;
}
```

```java
public record SyncObservabilityResponse(
    String window,
    java.util.Map<String, Long> totals,
    java.util.Map<String, java.util.Map<String, Long>> byEntity,
    java.util.List<java.util.Map<String, Object>> topReasons,
    java.util.Map<String, Long> conflicts
) {}
```

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit FE | Cálculo de snapshot V2 por trigger/errores/cola | `sync-orchestrator.service.spec.ts` + dobles de store/api |
| Unit FE | Agregadores de outbox/checkpoints | tests nuevos en `offline-store.service.spec.ts` |
| Unit BE | Consultas agregadas + mapeo a DTO | `SyncServiceTest` con fixtures de receipts/ledger |
| Integration BE | Contrato REST `/api/sync/observability` | `SyncResourceTest` con `rest-assured` |

## Migration / Rollout

Sin migración de schema obligatoria para V2 inicial (se reutilizan tablas existentes). Rollout por feature-flag de consumo UI: si falla, mantener snapshot legacy y ocultar consumo del endpoint histórico.

## Open Questions

- [x] Umbral `stale` por entidad fijo o configurable por tipo
  - **Resuelto**: default `24h` con override opcional por tipo en FE/DTO; V2 usa el default global y deja override listo para verify/iteración futura.
- [x] Header de versionado dedicado para observability
  - **Resuelto**: no se agrega header V2; el scope queda en query `window=24h|7d` sobre `/api/sync/observability`.
