# Design: Analytics Decision Support V1

## Technical Approach

Se implementa un feature FE dedicado `admin/decision-support` (standalone + arquitectura por feature) que **reutiliza** snapshots y proyecciones descriptivas locales ya existentes, agregando una capa de “insights accionables explicables” sin backend analítico nuevo.  
El cálculo se monta sobre el pipeline offline actual (`OfflineStoreService` + checkpoints + `sourceSignature`) y sobre los agregados de reporting (`projectAdminReportingV2`), incorporando comparativas período vs período y prioridades manuales del día/semana.

## Architecture Decisions

### Decision 1 — Módulo separado vs extender `admin/reportes`

| Option | Tradeoff | Decision |
|---|---|---|
| Extender `admin/reportes` | Menor esfuerzo inicial, pero mezcla lectura histórica con soporte operativo | No elegida |
| Nuevo `admin/decision-support` | Más archivos/tests, pero separación clara de responsabilidades y escalabilidad | **Elegida** |

**Rationale**: mantiene `reporting` como vista descriptiva base y evita sobrecargar una pantalla ya densa.

### Decision 2 — Reusar proyección existente vs crear motor paralelo

| Option | Tradeoff | Decision |
|---|---|---|
| Motor nuevo de analytics | Independencia, pero duplica reglas/filtros/guardrails | No elegida |
| Reusar `admin-reporting` + capa de insights | Menos drift, consistencia temporal y menor costo de mantenimiento | **Elegida** |

**Rationale**: el código actual ya define ventanas válidas, presets y exclusiones (anti-BI avanzada), por lo que conviene componer arriba de eso.

### Decision 3 — Cómputo local incremental vs recálculo completo permanente

| Option | Tradeoff | Decision |
|---|---|---|
| Rebuild completo siempre | Simple, pero peor performance en dispositivos limitados | Parcial (fallback) |
| Incremental con firma/frescura y cache derivada | Más lógica de invalidez, mejor costo de CPU | **Elegida** |

**Rationale**: se replica patrón de `AdminReportingStore` (`ensureFresh`, `sourceSignature`, `latestSyncAt`) para recalcular sólo cuando cambian snapshots/selecciones.

## Data Flow

`/api/sync` (BE actual) → snapshots locales (`OfflineStoreService`) → `projectAdminReportingV2` (base descriptiva) → `projectDecisionSupportV1` (insights explicables) → `AdminDecisionSupportStore` (signals + persistencia) → `AdminDecisionSupportPageComponent`.

```text
SyncService/SyncPayloadMapper
          │
          ▼
Offline snapshots + checkpoints
          │
          ├── projectAdminReportingV2
          │         │
          │         ▼
          └── projectDecisionSupportV1 (reglas descriptivas)
                    │
                    ▼
            DecisionSupportDerivedState (cached)
                    │
                    ▼
             UI cards + explainability blocks
```

Cada insight incluye: `metric`, `window`, `baseline`, `delta`, `severity`, `why`, `manualActions[]`, `scopeGuard`.

## File Changes

| File | Action | Description |
|---|---|---|
| `hato-fe/src/app/app.routes.ts` | Modify | Nueva ruta protegida `admin/decision-support` para admin. |
| `hato-fe/src/app/features/admin/decision-support/admin-decision-support-page.component.ts` | Create | Página standalone de cards/explicaciones/acciones manuales. |
| `hato-fe/src/app/features/admin/decision-support/data-access/admin-decision-support.store.ts` | Create | Store con signals, frescura, invalidación por checkpoints y persistencia local. |
| `hato-fe/src/app/features/admin/decision-support/data-access/admin-decision-support-projection.ts` | Create | Reglas descriptivas locales e interpretación de desvíos. |
| `hato-fe/src/app/features/admin/decision-support/data-access/admin-decision-support.utils.ts` | Create | Guardrails, umbrales, helpers de ventanas/comparativas. |
| `hato-fe/src/app/core/offline/offline-types.ts` | Modify | Contratos `DecisionSupportInsight` y `DecisionSupportDerivedState`. |
| `hato-fe/src/app/core/offline/offline-store.service.ts` | Modify | `get/setDecisionSupportState` y reset coherente. |
| `hato-fe/src/app/core/offline/offline-store.migrations.ts` | Modify | Inicialización/normalización de nuevo estado derivado. |
| `hato-fe/src/app/features/admin/reporting/data-access/admin-reporting-projection.ts` | Modify | Exponer salida reutilizable para comparativas (sin romper contrato actual). |
| `hato-fe/src/app/features/admin/decision-support/**/*.spec.ts` | Create | Cobertura de proyección/store/UI y guardrails. |
| `hato-be/src/main/java/.../SyncService.java` | No change (default) | Se mantiene flujo sync actual; no endpoint analytics nuevo en V1. |

## Interfaces / Contracts

```ts
export interface DecisionSupportInsight {
  id: string;
  category: 'health' | 'reproduction' | 'cost' | 'productivity' | 'operations';
  window: ReportingWindow;
  metric: string;
  currentValue: number;
  baselineValue: number;
  deltaPct: number;
  severity: 'info' | 'watch' | 'critical';
  why: { source: string[]; rule: string; generatedAt: string };
  manualActions: string[];
  scopeGuard: 'descriptive_only';
}
```

Contrato de guardrail: cualquier intento de `forecast`, `score`, `optimization` o `autoAction` retorna error de alcance en capa utils/store y no se renderiza.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit FE | Reglas de insights, severidad, deltas, rechazos anti-predictiva | `*.spec.ts` para projection/utils con fixtures offline |
| Integration FE | Rebuild incremental, cache por `sourceSignature`, persistencia/reload | specs del store con `OfflineStoreService` mock/fake |
| UI FE | Render cards, explainability, estados stale/error/offline | spec de componente standalone |
| Integration BE | No cambios funcionales en analytics; sólo no-regresión de `/api/sync` | mantener cobertura existente quarkus-junit5 + rest-assured |

Ejecución recomendada en implementación: FE con `nvm` (Node del proyecto) y BE con `jenv` (Java 21), sin introducir pipelines nuevos.

## Migration / Rollout

No migration de datos remotos. Se agrega estado derivado local versionado con migración en `offline-store.migrations.ts`. Rollout por feature route: habilitar `admin/decision-support` y fallback funcional a `admin/reportes` si falla cálculo.

## Open Questions

- [ ] Definir set final de umbrales por categoría (ej. `watch`/`critical`) para V1 sin sobreajuste.
- [ ] Confirmar copy UX de acciones manuales para evitar interpretación de “recomendación automática”.
