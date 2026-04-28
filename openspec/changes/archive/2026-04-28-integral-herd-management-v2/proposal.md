# Proposal: Integral Herd Management V2

## Intent

Extender la base offline-first para habilitar gestión integral del hato con trazabilidad de lotes, productividad y costos, y con indicadores descriptivos locales confiables. Esta V2 cierra la brecha funcional entre operación diaria y análisis histórico sin introducir BI predictiva.

## Scope

### In Scope
- Entidades nuevas para lotes, registros productivos y registros de costos con sincronización offline-first.
- Proyecciones locales para indicadores descriptivos del hato (tendencias, comparativos históricos acotados, desgloses por lote).
- Ajustes de contratos de sync, políticas de resolución por entidad y migraciones de esquema para soportar V2.

### Out of Scope
- BI predictiva (forecasting, scoring inteligente, recomendaciones automáticas).
- Optimización automática de decisiones productivas/costos.
- Integraciones financieras externas (ERPs, bancos, contabilidad de terceros).

## Capabilities

### New Capabilities
- `herd-lot-offline-sync-v2`: CRUD y sincronización de lotes con asignación animal↔lote y trazabilidad temporal.
- `herd-productivity-ledger-v2`: ledger de productividad por período/animal/lote con reglas de consistencia offline.
- `herd-cost-ledger-v2`: ledger de costos productivos por categoría/fuente con soporte de conciliación sync.
- `herd-descriptive-indicators-projection-v2`: proyección local de KPIs descriptivos no predictivos para vistas admin.

### Modified Capabilities
- `admin-reporting-aggregates-v1`: ampliar agregados para incluir dimensión lote, productividad y costos V2.
- `admin-reporting-operational-events-v1`: extender exclusiones explícitas para mantener límite “sin predictiva” en V2.
- `sync-entity-resolution-policy-v2`: incorporar políticas de resolución para nuevas entidades V2.

## Approach

Adoptar el enfoque de entidades explícitas + proyecciones derivadas en tres etapas: (1) lotes y vínculo animal↔lote, (2) ledgers de productividad/costos, (3) indicadores descriptivos locales. Mantener contratos versionados de sync, reglas de conflicto por entidad y guardrails de alcance no predictivo.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `hato-fe/src/app/core/offline/*` | Modified | Nuevos tipos/serialización para entidades V2. |
| `hato-fe/src/app/features/admin/reporting/data-access/*` | Modified | Proyecciones y stores de indicadores descriptivos V2. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/dto/sync/*` | Modified | Nuevos `SyncEntityType` y contratos payload V2. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/*` | Modified | Sync push/pull y políticas de resolución por entidad. |
| `hato-be/src/main/resources/db/changelog/*` | New/Modified | Migraciones de tablas/índices para lotes y ledgers. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Regresiones en sync/conflictos | Med | TDD estricto por entidad + pruebas de regresión multi-entidad. |
| Inconsistencia temporal de KPIs | Med | Normalizar granularidad (día/semana/período) desde contrato. |
| Scope creep hacia BI avanzada | High | Guardrails en specs/UI y criterios de aceptación explícitos. |

## Rollback Plan

Revertir por etapas: desactivar capacidades V2 por flags, retirar exposición de entidades nuevas en sync, revertir migraciones no críticas con changelog de rollback y mantener reporting V1 como baseline operativo.

## Dependencies

- Contexto `sdd-init/code` (TDD estricto, convenciones Angular/Quarkus).
- Artefactos previos: `sdd/integral-herd-management-v2/explore` y `openspec/.../exploration.md`.

## Success Criteria

- [ ] Existe contrato versionado de entidades V2 sincronizables offline con cobertura de conflictos.
- [ ] Reporting admin muestra indicadores descriptivos V2 sin dependencia online.
- [ ] El alcance OUT (predictiva/optimización/integraciones externas) queda validado en specs y pruebas.
