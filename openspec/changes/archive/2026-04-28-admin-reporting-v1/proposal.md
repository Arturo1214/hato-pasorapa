# Proposal: Admin Reporting V1 (Offline/Local-First)

## Intent

Habilitar una vista administrativa V1 con métricas agregadas y reportes operativos básicos desde snapshots locales sincronizados, para monitoreo aun sin conectividad.

## Scope

### In Scope
- Métricas agregadas de usuarios, ganaderos y animales usando snapshots locales existentes.
- Reportes operativos básicos de eventos (conteos por tipo en 7/30 días + actividad reciente).
- UX offline/local-first con indicador de frescura (`lastSyncAt`, `lastComputedAt`) y refresco manual.

### Out of Scope
- BI avanzada (drill-down libre, cohortes, dashboards configurables).
- Exportaciones complejas (PDF/Excel), reportes programados o envíos automáticos.
- Filtros arbitrarios/ad-hoc no definidos en V1.
- Analítica predictiva o modelos de proyección.

## Capabilities

### New Capabilities
- `admin-reporting-aggregates-v1`: métricas administrativas agregadas sobre snapshots de `USER`, `GANADERO` y `ANIMAL`.
- `admin-reporting-operational-events-v1`: reportes operativos básicos sobre `ANIMAL_EVENT`, `ANIMAL_HEALTH_EVENT` y `ANIMAL_REPRODUCTION_EVENT`.
- `admin-reporting-offline-freshness-v1`: contrato de frescura y comportamiento offline-first para reporting administrativo.

### Modified Capabilities
- None.

## Approach

Implementar proyección local-first en frontend reutilizando el pipeline de sync: leer snapshots de IndexedDB, calcular agregados por ventana temporal, cachear estado derivado opcional en `syncState.meta.reporting` y recomputar post-sync sin endpoints backend nuevos en V1.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `hato-fe/src/app/features/admin/reporting/**` | New | Nueva feature (page/store/projections/UI de reportes). |
| `hato-fe/src/app/app.routes.ts` | Modified | Ruta protegida para reporting administrativo. |
| `hato-fe/src/app/ui/layout/main-layout/sidebar/sidebar.ts` | Modified | Entrada de navegación a reportes. |
| `hato-fe/src/app/core/offline/offline-store.service.ts` | Modified | Lectura snapshots y persistencia opcional de proyección. |
| `hato-fe/src/app/core/offline/offline-types.ts` | Modified | Tipos para estado derivado de reporting. |
| `hato-fe/src/app/core/offline/offline-store.migrations.ts` | Modified | Migración de esquema si se persiste `meta.reporting`. |
| `hato-fe/src/app/core/offline/sync-orchestrator.service.ts` | Modified | Hook de recomputación post-sync. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Reportes desactualizados por falta de sync | Med | Mostrar frescura visible + CTA de sincronización manual. |
| Costo de cálculo local con snapshots grandes | Med | Cache incremental y cómputo acotado por ventanas 7/30 días. |
| Scope creep hacia BI/filtros libres | High | Gate explícito V1 y backlog para V2. |

## Rollback Plan

Desactivar ruta/entry de reporting y revertir feature + migración `meta.reporting`; mantener intactos sync y dashboard actual.

## Dependencies

- Snapshots offline existentes (`USER`, `GANADERO`, `ANIMAL`, eventos).
- Guard de acceso administrativo ya operativo en FE.

## Success Criteria

- [ ] Admin puede abrir reporting y ver métricas agregadas sin conectividad.
- [ ] Conteos de eventos 7/30 días y actividad reciente se calculan desde snapshots locales.
- [ ] Se muestra frescura de datos y existe acción de refresco/sync manual.
- [ ] No se incorporan BI avanzada, exportaciones complejas, filtros arbitrarios ni analítica predictiva en V1.
