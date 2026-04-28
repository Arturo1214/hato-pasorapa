## Exploration: admin-reporting-v1

### Current State
El sistema ya tiene datos suficientes para reporting administrativo en modo offline-first porque el pipeline de sync trae snapshots de `USER`, `GANADERO`, `ANIMAL`, `ANIMAL_EVENT`, `ANIMAL_HEALTH_EVENT` y `ANIMAL_REPRODUCTION_EVENT` (`SyncService.pull` + `OFFLINE_ENTITY_TYPES`).

Hallazgos relevantes:
- **Dashboard actual limitado**: hoy existe sólo `/api/admin/dashboard/users` con métricas de usuarios/admin/ganaderos por estado (`AdminDashboardService`, `AdminDashboardResource`, `AdminDashboardPageComponent`).
- **No existe módulo de reporting administrativo**: no hay ruta/página/store de reportes operativos agregados (ganaderos + animales + eventos).
- **Offline backbone maduro**: FE ya persiste snapshots y estado derivado local en `syncState.meta` (`calendarAlerts`, `notifications.readState`) con migraciones versionadas (`offline-store.migrations.ts`).
- **Datos de eventos ya normalizados**: los pull items de eventos incluyen `type/healthEventType/reproductionEventType`, `occurredAt`, `metadata`, `updatedAt`, suficientes para agregaciones V1 por ventana temporal y tipo.

Conclusión: `admin-reporting-v1` puede construirse sobre snapshots existentes con proyección local, manteniendo offline-first y evitando abrir un frente BI complejo.

### Affected Areas
- `hato-fe/src/app/app.routes.ts` — nueva ruta protegida para reporting administrativo.
- `hato-fe/src/app/ui/layout/main-layout/sidebar/sidebar.ts` — entrada de navegación a reportes.
- `hato-fe/src/app/features/admin/reporting/**` (nuevo) — page + store + proyecciones para métricas agregadas y reportes operativos básicos.
- `hato-fe/src/app/core/offline/offline-store.service.ts` — lectura de snapshots + persistencia opcional de estado derivado de reporting.
- `hato-fe/src/app/core/offline/offline-types.ts` — tipos de estado derivado local para reporting (si se persiste cache de reporte).
- `hato-fe/src/app/core/offline/offline-store.migrations.ts` — incremento de schema si se agrega `syncState.meta.reporting`.
- `hato-fe/src/app/core/offline/sync-orchestrator.service.ts` — hook de refresh post-sync para recalcular reporting local (patrón equivalente a calendario/notificaciones).
- `hato-fe/src/app/features/admin/dashboard/**` — posible convergencia para evitar duplicar métricas de usuarios entre dashboard y reporting.
- `hato-fe/src/app/**/*.spec.ts` — tests unitarios/integración de proyección, estados stale y delimitación V1.
- `hato-be/src/main/java/bo/pasorapa/hato/service/AdminDashboardService.java` y `web/rest/AdminDashboardResource.java` — sólo si se decide extender métricas canónicas server-side (opción alternativa).

### Approaches
1. **Reporting local-first desde snapshots existentes (recomendado)** — crear store/proyección en FE que agregue métricas y reportes operativos desde IndexedDB + snapshots sincronizados.
   - Pros: respeta offline-first real; evita nueva superficie BE y cambios de sync; menor complejidad para V1.
   - Cons: resultados dependen de la frescura del último sync; requiere UX explícita de “datos actualizados hasta …”.
   - Effort: Medium

2. **Reporting canónico en backend + fallback local** — exponer endpoints agregados (`/api/admin/reporting/*`) y usar snapshots sólo offline.
   - Pros: métricas consistentes online y lógica centralizada para futuras auditorías.
   - Cons: amplía alcance (nuevos contratos, repos agregados, tests BE/FE) y retrasa entrega V1.
   - Effort: High

3. **Nueva entidad sincronizada de reporting materializado** — generar agregados precomputados y distribuirlos por `sync/pull`.
   - Pros: consultas rápidas y consistencia de payload para UI.
   - Cons: sobre-ingeniería para V1; suma complejidad de versionado, retención, invalidación y re-cálculo.
   - Effort: High

### Recommendation
Recomiendo **Approach 1** para `admin-reporting-v1`.

**V1 IN scope propuesto**
1. **Métricas administrativas agregadas** desde snapshots locales:
   - Usuarios por rol/estado (reutilizando semántica actual del dashboard).
   - Ganaderos activos/inactivos.
   - Animales totales, activos/inactivos y por categoría.
2. **Reportes operativos básicos (sin BI)**:
   - Conteo de eventos por tipo y por ventana temporal (7/30 días) para `ANIMAL_EVENT`, `ANIMAL_HEALTH_EVENT`, `ANIMAL_REPRODUCTION_EVENT`.
   - Listado corto de actividad reciente (últimos eventos ordenados por `occurredAt`).
3. **Comportamiento offline-first explícito**:
   - Render con datos locales aunque no haya red.
   - Indicador de frescura (`lastComputedAt` + `lastSyncAt`) y acción de refresh manual.
4. **Sin duplicar lógica de sync**:
   - Reusar pipeline existente y evento post-sync para recomputar proyección.

**V1 OUT of scope (explícito)**
1. BI avanzada (drill-down arbitrario, cohortes, dashboards configurables, predicción).
2. Exportaciones complejas (PDF/Excel), programación de reportes y envíos automáticos.
3. Motor de KPIs custom por tenant o reglas analíticas configurables.
4. Nuevas entidades de sync para reporting materializado.

### Risks
- **Staleness operacional**: si el dispositivo no sincroniza, el reporte refleja estado viejo (mitigar con timestamp visible + CTA de sync).
- **Costo de proyección local**: agregaciones sobre snapshots grandes pueden degradar UX si no se memoiza/cachea por ventana.
- **Desalineación dashboard/reporting**: mantener dos fuentes distintas de métricas de usuarios puede generar inconsistencias si no se unifica contrato.
- **Scope creep hacia BI**: pedidos de filtros arbitrarios o exportaciones en V1 romperían el objetivo de entrega incremental.
- **Strict TDD overhead**: `strict_tdd: true` exige diseñar proyecciones testeables por capas para no frenar avance.

### Ready for Proposal
Yes — el alcance V1 quedó delimitado para avanzar a `sdd-propose`: reporting administrativo offline-first basado en snapshots existentes, con métricas agregadas y reportes operativos básicos, excluyendo explícitamente BI avanzada.
