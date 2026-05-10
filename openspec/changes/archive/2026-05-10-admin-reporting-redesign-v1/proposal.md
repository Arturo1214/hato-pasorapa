# Proposal: Admin Reporting Redesign V1

## Intent

Convertir `/admin/reportes` de una vista tipo debug analytics (sync manual, presets genéricos, KPIs excesivos, logs crudos) en reportes administrativos útiles y exportables a Excel.

## Goals / Non-Goals

### Goals
- Reemplazar la UI sync/KPI por catálogo de reportes ADMIN-only.
- Exponer JSON BE bajo `/api/admin/reports/*` con DTOs estables.
- Exportar XLSX desde FE en V1.

### Non-Goals
- Generación Excel server-side, envíos programados o dashboards configurables.
- Reportes de reproducción, costos, productividad o conflictos sync.
- BI predictiva, recomendaciones o ejecución automática de acciones.

## Scope FE/BE

- FE `hato-fe`: rediseñar pantalla admin reportes, filtros por reporte, tablas legibles, botón Exportar Excel; eliminar refresh/sync manual.
- BE `hato-be`: endpoints REST ADMIN-only → Service → Repository/Domain, DTOs API, Bean Validation, consultas Panache.
- Tests: specs FE ante cambios de comportamiento y endpoints Quarkus con rest-assured.

## Capabilities

### New Capabilities
- `admin-exportable-reports-v1`: catálogo de reportes administrativos, filtros, contratos JSON y exportación XLSX FE.

### Modified Capabilities
- `admin-reporting-aggregates-v1`: reemplaza enfoque de métricas locales genéricas por reportes administrativos server-backed.
- `admin-reporting-operational-events-v1`: permite exportación Excel y redefine eventos operativos como reporte sanitario/veterinario filtrable.
- `admin-notification-ledger-v1`: reutiliza métricas de destinatarios para reporte de alcance de notificaciones.

## Proposed Solution

- Crear catálogo con tres reportes MVP y contratos DTO específicos.
- FE consume JSON, renderiza tabla/resumen y genera XLSX con librería cliente (`xlsx`, salvo hallazgo técnico contrario en design).
- BE mantiene seguridad por rol ADMIN y evita exponer entidades.

## Reporting Catalog MVP

1. **Inventario por Ganadero**: conteos de animales por ganadero, activos/inactivos, categoría y sexo.
2. **Actividad Sanitaria/Veterinaria**: eventos sanitarios/veterinarios por rango, tipo, ganadero/animal.
3. **Alcance de Notificaciones**: total destinatarios, leídos, pendientes y tasa de lectura por notificación.

## Excel Export Approach

V1 exporta client-side desde el dataset JSON ya filtrado. Tradeoff: menor carga BE y entrega rápida; riesgo de memoria en datasets grandes, mitigado con límites/paginación o advertencia de rango.

## Migration/Data Considerations

No se prevén migraciones obligatorias; los reportes derivan de `GANADERO`, `ANIMAL`, `ANIMAL_HEALTH_EVENT` y destinatarios de notificaciones existentes.

## Risks / Tradeoffs

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Datasets grandes rompen XLSX cliente | Med | límites de rango y diseño preparado para server-side futuro |
| Specs previas excluyen Excel | High | modificar capacidades explícitamente |
| Métricas inconsistentes por datos históricos | Med | reglas de agregación documentadas y tests |

## Rollback Plan

Revertir rutas/componentes FE nuevos y endpoints `/api/admin/reports/*`; conservar datos porque no hay migración destructiva.

## Dependencies

- Librería XLSX cliente a validar en design.

## Acceptance Criteria

- [ ] ADMIN ve solo catálogo/reportes, sin controles sync/refresh.
- [ ] Tres reportes MVP cargan desde JSON BE y exportan XLSX.
- [ ] Acceso no ADMIN es rechazado.
- [ ] Tests FE/BE cubren filtros, contratos y autorización.
