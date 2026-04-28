# Design: Integral Herd Management V2

## Technical Approach

Implementar V2 sobre el patrón offline-first existente: **nuevas entidades sincronizables** (LOT, LOT_ASSIGNMENT, PRODUCTIVITY_LEDGER, COST_LEDGER), **proyección local derivada** para KPIs descriptivos y extensión de contratos FE/BE de sync sin romper entidades V1. Se reutiliza el flujo actual `outbox → push/pull → snapshots → proyección`, agregando validaciones determinísticas (no solapamiento temporal, dedupe por identidad de ledger, montos no negativos) y guardrails explícitos “sin predictiva”.

## Architecture Decisions

### Decision: Modelado de asignación animal↔lote como entidad temporal explícita

| Option | Tradeoff | Decision |
|---|---|---|
| Campo `lotId` en `ANIMAL` | simple pero sin historial temporal | ❌ |
| Entidad `LOT_ASSIGNMENT` con `fromDate/toDate` | más joins, pero trazabilidad completa y validación de solapamientos | ✅ |

**Rationale**: los specs exigen intervalos y bloqueo de overlap; requiere identidad propia y reconciliación independiente.

### Decision: Contratos sync versionados por `SyncEntityType` (sin endpoint nuevo)

| Option | Tradeoff | Decision |
|---|---|---|
| Endpoint V2 separado | más aislamiento, más complejidad operativa | ❌ |
| Extender `SyncEntityType`, `SyncPayloadMapper`, `SyncService` | cambio concentrado y compatible con infraestructura actual | ✅ |

**Rationale**: `SyncResource` y `SyncService` ya soportan matriz por entidad/operación y políticas de conflicto V2.

### Decision: KPIs sólo por proyección local derivada y ventanas acotadas

| Option | Tradeoff | Decision |
|---|---|---|
| Calcular en backend por request | depende de conectividad | ❌ |
| Proyección local persistida en `syncState.meta.reporting` | más lógica FE, mejor resiliencia offline | ✅ |

**Rationale**: respeta el objetivo offline y reutiliza patrón `admin-reporting` ya existente.

## Data Flow

```text
UI lotes/costos/productividad
  -> OfflineStore.enqueueOperation (outbox)
  -> SyncOrchestrator.push -> BE SyncService.processOperation
  -> persist dominio + receipt/conflict policy
  -> SyncOrchestrator.pull (por entityType) -> snapshots/checkpoints
  -> AdminReportingStore.rebuild -> projectAdminReportingV2
  -> KPIs descriptivos (7d/30d/90d)
```

Validaciones clave:
- FE pre-check: overlap en `LOT_ASSIGNMENT`, amount>=0, category/source requeridos.
- BE source-of-truth: mismas reglas en mapper/service antes de persistir.

## File Changes

| File | Action | Description |
|---|---|---|
| `hato-fe/src/app/core/offline/offline-types.ts` | Modify | Agregar nuevos `OfflineEntityType`, payload/snapshot types y KPIs V2 (incluye ventana `90d`). |
| `hato-fe/src/app/core/offline/offline-store.migrations.ts` | Modify | Subir schema (v9) y normalizar estado reporting V2 + source signatures nuevas. |
| `hato-fe/src/app/core/offline/offline-store.service.ts` | Modify | Helpers de snapshots/queries para lotes, asignaciones y ledgers; invalidación selectiva reporting V2. |
| `hato-fe/src/app/core/offline/sync-orchestrator.service.ts` | Modify | Incluir entidades V2 en `supportedEntities` y eventos refresh sin alterar contrato base. |
| `hato-fe/src/app/features/admin/reporting/data-access/admin-reporting-projection.ts` | Modify | Extender proyección con desgloses por lote, productividad y costos; dedupe determinístico por identidad. |
| `hato-fe/src/app/features/admin/reporting/data-access/admin-reporting.store.ts` | Modify | Leer snapshots V2, soportar `90d` y freshness por nuevas fuentes. |
| `hato-fe/src/app/features/admin/reporting/data-access/admin-reporting.utils.ts` | Modify | Ventanas permitidas (`7d`,`30d`,`90d`) y mensajes scope V2 no predictivo. |
| `hato-fe/src/app/features/admin/reporting/admin-reporting-page.component.ts` | Modify | Presentar nuevos KPI cards/desgloses por lote con guardrails descriptivos. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/dto/sync/SyncEntityType.java` | Modify | Incorporar `LOT`, `LOT_ASSIGNMENT`, `PRODUCTIVITY_LEDGER`, `COST_LEDGER`. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/mapper/SyncPayloadMapper.java` | Modify | Capability/policy matrix V2 + parsers/validación de payload ledger/lotes. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/SyncService.java` | Modify | Handlers `CREATE/UPDATE` V2, pull por entidad y resolución determinística de duplicados. |
| `hato-be/src/main/java/bo/pasorapa/hato/domain/*` | Create | Entidades `HerdLot`, `HerdLotAssignment`, `HerdProductivityLedger`, `HerdCostLedger`. |
| `hato-be/src/main/java/bo/pasorapa/hato/repository/*Repository.java` | Create | Repos Panache con `findByOperationId` y `listChangedSince` por cursor. |
| `hato-be/src/main/resources/db/changelog/011-integral-herd-management-v2.yaml` | Create | Tablas/índices/constraints para lotes, asignaciones y ledgers. |
| `hato-be/src/main/resources/db/changelog/master.yaml` | Modify | Incluir changelog `011-*`. |

## Interfaces / Contracts

```ts
type OfflineEntityType += 'LOT' | 'LOT_ASSIGNMENT' | 'PRODUCTIVITY_LEDGER' | 'COST_LEDGER';
type ReportingWindow += '90d';

type ProductivityIdentity = `${periodKey}|${animalUuid}|${lotId}|${metricType}`;
type CostIdentity = `${periodKey}|${lotId}|${category}|${source}`;
```

Reglas de reconciliación:
1. Misma identidad + distinta versión: gana mayor `updatedAt`; empate -> mayor `operationId` lexicográfico.
2. `LOT_ASSIGNMENT`: prohibido overlap activo por `animalUuid`.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit FE | Validadores overlap/amount, proyección 90d, dedupe | `*.spec.ts` en offline + reporting data-access |
| Unit BE | Payload parsing, policy matrix, dedupe identity | JUnit5 de `SyncPayloadMapper` y `SyncService` |
| Integration BE | push/pull V2 + conflictos | Quarkus + rest-assured sobre `/api/sync/*` |
| Integration FE | recompute reporting post-sync | specs de `AdminReportingStore` + `admin-reporting.integration.spec.ts` |

## Migration / Rollout

Rollout por 3 incrementos: (1) lotes/asignaciones, (2) ledgers productividad/costos, (3) KPIs/reportes V2. Sin feature flag nuevo: se apoya en compatibilidad de `SyncEntityType` y clientes que no envían entidades V2 continúan igual. Requiere migración DB `011-*` y migración offline schema `v9`.

## Open Questions

- [ ] ¿`currency` de costos se normaliza a una sola moneda de reporte o se muestra por moneda sin conversión en V2?
- [ ] ¿`periodKey` será mensual fijo (`YYYY-MM`) o configurable por tenant?
