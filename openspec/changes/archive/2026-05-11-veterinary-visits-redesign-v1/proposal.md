# Proposal: Veterinary Visits Redesign V1

## Intent

Rediseñar visitas veterinarias como una pantalla operativa central, consistente con Animales/Usuarios/Ganaderos, que permita registrar campañas globales del rodeo y visitas específicas por animal, con seguimiento clínico claro, veterinario por visita, calendario y trazabilidad en historias animales.

## Scope

### In Scope
- Vista central admin/ganadero con tabla/lista, filtros, acciones explícitas y labels en español.
- Alta de visita global o específica; específica usa autocomplete de animal con últimos 10 por defecto y búsqueda por arete/marca/tatuaje.
- Metadata por visita: modo, veterinario, notas de atención, estado, `visitId`, próximo control.
- Lifecycle: pendiente/atendida/reprogramada/finalizada/cancelada, permitiendo reprogramar seguimiento o finalizar cadena.
- Campañas globales visibles en historia de cada animal; visitas específicas solo en su animal.
- Integración con calendario/alertas de próximos controles.

### Out of Scope
- Facturación, costos, multimedia, analítica avanzada y notificaciones push remotas.
- Visita específica multi-animal; V1 mantiene un animal por visita específica.

## Capabilities

### New Capabilities
- `admin-veterinary-visits-v1`: pantalla operativa central, registro guiado global/específico, filtros, estados y acciones UX.

### Modified Capabilities
- `field-vet-visit-workflow-v1`: agrega modo global/específico, veterinario por visita, estados de atención/reprogramación/cierre/cancelación y listado global.
- `animal-health-event-ledger-v1`: extiende metadata `FIELD_VET_VISIT` y proyección de historia para campañas globales.
- `animal-health-treatment-follow-up-v1`: ajusta continuidad para seguimientos reprogramados y finalización explícita de cadena.
- `calendar-offline-schedule-v1`: proyecta próximos controles veterinarios globales/específicos.
- `calendar-local-reminders-v1`: clasifica y muestra alertas locales para próximos controles.

## Approach

Usar `ANIMAL_HEALTH_EVENT` existente y extender metadata JSON, no crear agregado nuevo. Crear endpoint BE `GET /api/vet-visits` con filtros y paginación; mantener REST → Service → Repository. En FE reemplazar la página actual por una vista central standalone, signals para estado local, RxJS para llamadas, dialogs Reactive Forms y autocomplete reutilizando patrones existentes.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `hato-fe/src/app/features/admin/vet-visits/` | Modified | Vista central, dialogs, mappers, labels ES |
| `hato-fe/src/app/features/admin/animals/` | Modified | Historia animal incluye campañas globales |
| `hato-fe/src/app/features/admin/calendar/` | Modified | Alertas/próximos controles |
| `hato-be/.../AnimalHealthEventResource.java` | Modified | Endpoint global/listado visitas |
| `hato-be/.../AnimalHealthEventService.java` | Modified | Validaciones metadata/lifecycle |
| `hato-be/.../AnimalHealthEventRepository.java` | Modified | Queries globales paginadas |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Metadata JSON inconsistente | Med | Validación BE con Jakarta Bean Validation/mapper |
| Exposición cross-ganadero | Med | Scope por usuario/ganadero en service |
| Cambio FE grande | Med | Dividir en work units con specs/tests |
| Query global lenta | Med | Paginación y filtros desde V1 |

## Rollback Plan

Revertir endpoint global y cambios FE de `vet-visits`; mantener eventos existentes porque siguen siendo `FIELD_VET_VISIT`. Ignorar nuevos campos metadata en lectores legacy si se despliega parcialmente.

## Dependencies

- Specs existentes: `field-vet-visit-workflow-v1`, `animal-health-event-ledger-v1`, `animal-health-treatment-follow-up-v1`, calendario.
- Patrones UX Angular/Material existentes de listas y autocomplete animal.

## Success Criteria

- [ ] Usuario registra visita global o específica sin ingresar UUID manual.
- [ ] Cada visita/follow-up puede guardar veterinario distinto y notas de atención.
- [ ] Se puede atender, reprogramar, finalizar o cancelar una cadena.
- [ ] Campañas globales aparecen en todas las historias animales; específicas solo en su animal.
- [ ] Próximos controles aparecen en calendario/alertas con labels españoles.
