# Proposal: Animal Health Events V1

## Intent

Incorporar un módulo sanitario mínimo, auditable y offline-first para registrar vacunaciones, desparasitaciones, enfermedades y tratamientos con seguimiento básico, **sin mezclarlo** con `animal_events` operativo. Esto cubre una necesidad funcional inmediata de campo sin romper límites ya definidos en V1 operativo.

## Scope

### In Scope
- Ledger append-only `animal_health_events` separado del ledger operativo.
- Tipos V1: `VACCINATION`, `DEWORMING`, `DISEASE_REPORTED`, `TREATMENT_STARTED`, `TREATMENT_FOLLOW_UP`, `TREATMENT_CLOSED`.
- Contrato mínimo por evento: `animalUuid`, `healthEventType`, `occurredAt`, `notes`, `performedByUserId`, `sourceChannel`, `operationId`, `metadata` tipada.
- Offline-first: queue-first, push/pull incremental e idempotencia por `operationId`.
- Timeline sanitario por animal con filtros básicos por tipo y rango temporal.

### Out of Scope
- Reproducción (celo, servicio, preñez, parto, genealogía).
- Imágenes, adjuntos o archivos clínicos.
- Event sourcing total del agregado animal y reconstrucción integral de estado.
- Protocolos clínicos avanzados, analítica/dosificación inteligente.

## Capabilities

### New Capabilities
- `animal-health-event-ledger-v1`: registro sanitario append-only separado de `animal_events`, con auditoría mínima obligatoria.
- `animal-health-offline-sync-v1`: alta/listado offline y sincronización idempotente para `ANIMAL_HEALTH_EVENT`.
- `animal-health-treatment-follow-up-v1`: seguimiento básico de tratamiento por eventos de continuidad/cierre sin updates destructivos.

### Modified Capabilities
- None.

## Approach

Crear agregado sanitario dedicado en FE/BE y extender la infraestructura offline/sync existente mediante un nuevo `SyncEntityType` para salud. Mantener intacto el catálogo y proyección de `animal_events` operativo para evitar regresiones y preservar compatibilidad de specs actuales.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `hato-be/src/main/resources/db/changelog/` | New | Migración para `animal_health_events` + índices/idempotencia |
| `hato-be/src/main/java/.../service/SyncService.java` | Modified | Push/pull para entidad sanitaria |
| `hato-be/src/main/java/.../service/mapper/SyncPayloadMapper.java` | Modified | Mapping/validación payload sanitario |
| `hato-be/src/main/java/.../dto/sync/SyncEntityType.java` | Modified | Nuevo tipo `ANIMAL_HEALTH_EVENT` |
| `hato-fe/src/app/core/offline/offline-types.ts` | Modified | Contratos tipados de eventos sanitarios |
| `hato-fe/src/app/core/offline/sync-orchestrator.service.ts` | Modified | Pull incremental de salud |
| `hato-fe/src/app/features/admin/animals/` | Modified | UI + data-access para timeline/alta sanitaria |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Deriva de alcance a reproducción/imágenes | High | Definir OUT explícito y rechazar requisitos fuera de V1 |
| Metadata sanitaria inconsistente FE/BE | Med | Contrato mínimo tipado + validaciones espejo |
| Fragilidad offline por updates mutables | Med | Seguimiento sólo append-only (`FOLLOW_UP`/`CLOSED`) |

## Rollback Plan

Desactivar exposición de endpoints/UI sanitarios y revertir migración/changelog del módulo `animal_health_events`; mantener `animal_events` operativo sin cambios asegura continuidad funcional.

## Dependencies

- Infraestructura offline/sync existente (`operationId`, push/pull incremental).
- Suite de pruebas FE/BE para validar idempotencia y boundaries.

## Success Criteria

- [ ] Se registran y consultan eventos sanitarios V1 por animal en timeline separado del operativo.
- [ ] La sincronización offline-first sanitaria es idempotente ante reintentos/replays.
- [ ] `animal-event-ledger-v1` permanece sin cambio de catálogo ni mezcla sanitaria.
- [ ] No se implementan reproducción, imágenes ni event sourcing total en este change.
