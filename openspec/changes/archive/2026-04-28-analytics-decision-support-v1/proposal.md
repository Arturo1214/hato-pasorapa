# Proposal: Analytics Decision Support V1

## Intent

Crear soporte de decisión **descriptivo y explicable** para operación del hato, 100% local-first, usando datos offline existentes. El objetivo es priorizar acciones manuales diarias/semanales sin introducir BI predictiva ni automatización de decisiones.

## Scope

### In Scope
- Nuevo feature FE `admin/decision-support` con cards de insights descriptivos accionables.
- Pipeline local de insights derivado de snapshots offline (eventos, lotes, productividad, costos, sanidad, reproducción).
- Guardrails funcionales explícitos: sin predicción, sin optimización automática, sin integraciones externas.
- UX de explicación por insight (fuente de datos, ventana temporal, regla aplicada).

### Out of Scope
- Modelos predictivos (forecast/scoring), recomendaciones automáticas o “next best action” calculada por IA.
- Auto-optimización de recursos o scheduling automático.
- APIs/servicios de terceros, BI cloud, nuevas integraciones externas.

## Capabilities

### New Capabilities
- `analytics-decision-support-v1`: generación y visualización local de insights descriptivos explicables con acciones manuales sugeridas.

### Modified Capabilities
- `admin-reporting-aggregates-v1`: reutilización de agregados para comparación período vs período en soporte de decisión.
- `herd-descriptive-indicators-projection-v2`: ampliación de proyección local para señales accionables (sin outputs predictivos).
- `admin-reporting-operational-events-v1`: alineación de exclusiones explícitas para mantener límites anti-predictiva/anti-optimización.

## Approach

Implementar un feature separado en `hato-fe` (arquitectura por feature), con store/proyección local y contrato de insight tipado. Reusar estado offline existente y normalizar ventanas temporales para consistencia. No se crea backend analítico nuevo.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `hato-fe/src/app/features/admin/decision-support/` | New | Ruta, página, store y componentes standalone. |
| `hato-fe/src/app/features/admin/reporting/data-access/` | Modified | Reuso/extensión de agregados y utilidades descriptivas. |
| `hato-fe/src/app/core/offline/` | Modified | Tipos/estado derivado para insights locales persistibles. |
| `openspec/specs/*` | Modified/New | Especificaciones de capability nueva y deltas. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Scope creep hacia BI predictiva | Med | Guardrails en spec + tests de rechazo explícitos. |
| Degradación de performance local | Med | Cálculo incremental, cache derivada, límites de ventana. |
| Insights poco accionables | Med | Taxonomía fija de insight + criterio “qué hacer ahora”. |

## Rollback Plan

Desactivar ruta `admin/decision-support`, eliminar proyección/estado derivado nuevo y volver a `admin/reportes` como único punto analítico descriptivo. No hay migraciones BE ni dependencias externas que revertir.

## Dependencies

- `sdd-init/code` (strict TDD y convenciones FE/BE).
- Datos locales ya sincronizados por flujo offline existente.

## Success Criteria

- [ ] Soporte de decisión funciona offline sin llamadas a servicios externos.
- [ ] Cada insight muestra explicación trazable (fuente + regla + ventana).
- [ ] Cero funcionalidades predictivas/optimizadoras expuestas en UI o contratos.
- [ ] Cobertura de tests de comportamiento actualizada en `*.spec.ts` afectadas.
