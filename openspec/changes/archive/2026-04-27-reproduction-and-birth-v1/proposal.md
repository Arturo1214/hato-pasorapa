# Proposal: Reproduction and Birth V1

## Intent

Habilitar trazabilidad reproductiva V1 (servicio, preñez, parto y vínculo cría-madre/padre) con enfoque offline-first y límites de dominio explícitos, evitando mezclar reproducción en `animal_events` o `animal_health_events`.

## Scope

### In Scope
- Ledger reproductivo append-only para servicio, confirmación/pérdida de preñez y parto.
- Registro de cría con relación madre obligatoria y padre opcional por `animalUuid`.
- Sync offline-first (queue-first, idempotencia por `operationId`, pull incremental por cursor).
- Timeline y formularios reproductivos en `animals-page` siguiendo patrón actual.

### Out of Scope
- Analítica reproductiva avanzada (KPIs, predicción, tasas).
- Imágenes/adjuntos clínicos o documentales.
- Reproducción asistida/protocolos multi-etapa complejos.

## Capabilities

### New Capabilities
- `animal-reproduction-event-ledger-v1`: ledger append-only dedicado para eventos reproductivos V1 y consulta por animal.
- `animal-reproduction-offline-sync-v1`: push/pull incremental idempotente para entidad reproductiva.
- `animal-birth-parentage-link-v1`: contrato de parto y filiación madre/padre/cría consultable offline.

### Modified Capabilities
- None (sin cambios de requerimientos en specs existentes de `animal-event-*` y `animal-health-*`).

## Approach

Implementar un agregado reproductivo separado con contrato sync propio (`SyncEntityType` dedicado), metadata tipada por evento y proyección mínima de filiación en estado vigente del animal cuando corresponda. Reusar infraestructura offline actual sin rediseño base.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `hato-be/src/main/resources/db/changelog/*` | New/Modified | Nueva migración V1 de reproducción/partos y registro en `master.yaml`. |
| `hato-be/src/main/java/bo/pasorapa/hato/domain/*Reproduction*` | New | Entidades/enums reproductivos append-only. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/SyncService.java` | Modified | Push/pull incremental para nueva entidad reproductiva. |
| `hato-fe/src/app/core/offline/*` | Modified | Tipos offline + orquestación sync para reproducción. |
| `hato-fe/src/app/features/admin/animals/*` | Modified | Data access queue-first y UI timeline/form reproductivo. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Scope creep hacia analítica/adjuntos | Med | Mantener exclusiones V1 en specs y validaciones de contrato. |
| Inconsistencia temporal cría↔madre/padre offline | Med | Reglas de orden e idempotencia por `operationId` + validaciones de referencia. |
| Acople accidental con ledgers existentes | Low | Enums, tablas y endpoints separados; tests de boundary explícitos. |

## Rollback Plan

Desactivar exposición de endpoints/UX reproductiva y revertir migración V1 en rollback controlado (drop tablas nuevas), sin tocar `animal_events` ni `animal_health_events`; conservar backups previos al deploy.

## Dependencies

- Infraestructura offline vigente (cola local + sync push/pull incremental).
- Catálogo `animals` activo para validar referencias madre/padre/cría.

## Success Criteria

- [ ] Se registran y listan eventos reproductivos V1 sin impactar ledgers operativo/sanitario.
- [ ] Alta offline de reproducción sincroniza sin duplicados por `operationId`.
- [ ] Parto permite relación madre obligatoria y padre opcional con consistencia de referencias.
- [ ] UI muestra timeline reproductivo y estado de sincronización pendiente/sincronizado.
