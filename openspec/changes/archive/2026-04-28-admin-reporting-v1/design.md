# Design: Admin Reporting V1 (Offline/Local-First)

## Technical Approach

Implementar proyección local-first en frontend, siguiendo el patrón `calendar-alerts`/`notification-inbox`: snapshots en IndexedDB (`OfflineStoreService`) + store con signals + recomputación startup/post-sync/manual.

La feature calcula:
- agregados administrativos desde `USER`, `GANADERO`, `ANIMAL`
- conteos operativos por tipo de evento desde `ANIMAL_EVENT`, `ANIMAL_HEALTH_EVENT`, `ANIMAL_REPRODUCTION_EVENT`
- actividad reciente ordenada desc por timestamp

Respeta V1: ventanas `7d/30d` y presets cerrados.

## Architecture Decisions

### Decision 1 — Origen de datos de reporting

| Opción | Tradeoff | Decisión |
|---|---|---|
| Endpoint BE de reporting dedicado | Menos cómputo local, pero rompe objetivo offline y agrega complejidad V1 | ❌ |
| Proyección FE desde snapshots locales | Consistente con offline-first y pipeline actual de sync | ✅ |

**Rationale**: `SyncOrchestratorService` ya hidrata snapshots requeridos; evita dependencia online.

### Decision 2 — Persistencia de derivado

| Opción | Tradeoff | Decisión |
|---|---|---|
| Recalcular siempre en memoria | Simple, pero costoso con snapshots grandes | ❌ |
| Cache derivado en `syncState.meta.reporting` | Requiere migración de schema, pero reduce costo en startup/refresh | ✅ |

**Rationale**: mantiene continuidad offline y habilita invalidación incremental.

### Decision 3 — Incremental cache invalidation

| Opción | Tradeoff | Decisión |
|---|---|---|
| TTL puro (`staleMs`) | Fácil, pero puede quedar desfasado tras sync | ❌ |
| Firma por checkpoints + window/preset | Más código, pero invalida solo cuando cambian fuentes relevantes | ✅ |

**Rationale**: `OfflineSyncCheckpoint` por entidad fuente evita recomputar cuando no cambió input/selección.

### Decision 4 — Filtros V1

| Opción | Tradeoff | Decisión |
|---|---|---|
| Filtro libre composable | Flexible, pero abre scope creep (BI) | ❌ |
| Presets cerrados por contrato | Menos flexibilidad, más control de alcance | ✅ |

**Rationale**: alineado con la exclusión de filtros arbitrarios en V1.

## Data Flow

```
App initializer
  -> SyncOrchestrator.initialize()
  -> AdminReportingStore.initialize()

SyncOrchestrator (post pull success)
  -> dispatch REPORTING_REFRESH_EVENT
  -> AdminReportingStore.rebuild('post-sync')

AdminReportingStore.rebuild(reason)
  -> OfflineStore.listSnapshots(entityTypes)
  -> projectAdminReporting(input: snapshots, window, preset, now)
  -> set state signals/selectors
  -> OfflineStore.setAdminReportingState(derived)
```

Lectura UI: `AdminReportingPageComponent` consume selectors (`summary`, `eventCounts`, `recentActivity`, `freshness`, `stale`, `allowedPresets`).

## File Changes

| File | Action | Description |
|---|---|---|
| `hato-fe/src/app/features/admin/reporting/admin-reporting-page.component.ts` | Create | Página standalone con métricas, ventana (`7d/30d`), presets y actividad reciente. |
| `hato-fe/src/app/features/admin/reporting/data-access/admin-reporting.store.ts` | Create | Store: initialize/rebuild/ensureFresh/selectors. |
| `hato-fe/src/app/features/admin/reporting/data-access/admin-reporting-projection.ts` | Create | Proyección local de agregados, conteos y lista reciente. |
| `hato-fe/src/app/features/admin/reporting/data-access/admin-reporting.utils.ts` | Create | Helpers de ventanas, presets, stale guard y orden estable. |
| `hato-fe/src/app/features/admin/reporting/data-access/admin-reporting.store.spec.ts` | Create | Unit tests store (startup, post-sync, stale, preset inválido). |
| `hato-fe/src/app/features/admin/reporting/data-access/admin-reporting-projection.spec.ts` | Create | Unit tests proyección (7d/30d, preset, orden actividad). |
| `hato-fe/src/app/core/offline/offline-types.ts` | Modify | Tipos `AdminReportingDerivedState`, `ReportingWindow`, `ReportingPresetId` y `syncState.meta.reporting`. |
| `hato-fe/src/app/core/offline/offline-store.migrations.ts` | Modify | `schemaVersion` + migración `v5-to-v6-admin-reporting-derived-state`. |
| `hato-fe/src/app/core/offline/offline-store.service.ts` | Modify | `get/set/invalidateAdminReportingState()` + helpers de meta. |
| `hato-fe/src/app/core/offline/sync-orchestrator.service.ts` | Modify | Nuevo `REPORTING_REFRESH_EVENT` y dispatch post-sync. |
| `hato-fe/src/app/app.initializers.ts` | Modify | Inicializar `AdminReportingStore` en runtime bootstrap. |
| `hato-fe/src/app/app.config.ts` | Modify | Inyección de `AdminReportingStore` en initializer. |
| `hato-fe/src/app/app.routes.ts` | Modify | Ruta protegida `admin/reportes` (ADMIN). |
| `hato-fe/src/app/ui/layout/main-layout/sidebar/sidebar.ts` | Modify | Entrada de navegación para reporting en menú ADMIN. |
| `hato-be/src/main/java/**` | No change (V1) | Sin endpoint nuevo; se reutiliza `/api/sync/pull`. |

## Interfaces / Contracts

```ts
export type ReportingWindow = '7d' | '30d';
export type ReportingPresetId = 'all' | 'active_only' | 'inactive_only';

export interface AdminReportingDerivedState {
  version: 1;
  selectedWindow: ReportingWindow;
  selectedPreset: ReportingPresetId;
  freshness: { lastSyncAt: string | null; lastComputedAt: string | null; stale: boolean };
  aggregates: { usersTotal: number; ganaderosTotal: number; animalesTotal: number; animalesActivos: number };
  eventsByType: Record<ReportingWindow, Record<string, number>>;
  recentActivity: Array<{ id: string; sourceType: 'ANIMAL_EVENT'|'ANIMAL_HEALTH_EVENT'|'ANIMAL_REPRODUCTION_EVENT'; occurredAt: string; animalUuid: string }>;
  sourceSignature: Record<string, string | null>; // checkpoints por entidad fuente
}
```

Regla: si `selectedPreset` no es válido, fallback a `all`.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit (projection) | Conteos `7d/30d`, exclusión fuera de ventana, orden estable, rechazo ad-hoc | `admin-reporting-projection.spec.ts` con fixtures y timestamps fijos |
| Unit (store) | initialize/startup/post-sync/manual/stale + persistencia en meta | `admin-reporting.store.spec.ts` con `InMemoryOfflinePersistenceAdapter` |
| Integration FE | Integración con `REPORTING_REFRESH_EVENT` y visibilidad de frescura | Spec similar a `calendar-alerts.integration.spec.ts` |
| BE | Contrato existente de sync para entidades fuente | Sin tests nuevos en V1 (cobertura actual de sync) |

## Migration / Rollout

1. **Infraestructura offline**: tipos + migración v6 + métodos store.
2. **Dominio reporting**: utils + projection + store con selectors.
3. **Integración runtime**: initializer + evento post-sync.
4. **UI y navegación**: página, ruta, sidebar, frescura.
5. **QA/validación**: unit + integration FE enfocadas en ventanas/presets/freshness.

No migration BE requerida en V1.

## Open Questions

- [ ] ¿Preset V1 definitivo: `all/active_only/inactive_only` u otro set de negocio?
- [ ] ¿Límite de items en `recentActivity` (ej. 20/50)?
