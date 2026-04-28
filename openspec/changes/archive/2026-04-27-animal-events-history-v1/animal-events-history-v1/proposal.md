# Proposal: Animal Events History V1

## Intent

Hoy sólo existe estado actual del animal; no hay trazabilidad histórica de eventos operativos. Este cambio crea un historial V1 auditable y compatible con operación offline-first, sin reescribir el dominio a event sourcing completo.

## Scope

### In Scope
- Ledger **append-only** `animal_events` por `animalUuid`, con `eventType`, `occurredAt`, `notes`, `performedByUserId`, `sourceChannel`, `operationId`, timestamps.
- Proyección puntual sobre `animals` (estado actual): `SOLD|DECEASED|LOST` => `active=false`; `TRANSFERRED` => cambio de owner; `OBSERVATION` sin mutación core.
- Eventos V1 habilitados: `SOLD`, `DECEASED`, `LOST`, `TRANSFERRED`, `OBSERVATION`.
- Ownership/auditoría del evento: autor, canal (online/offline), idempotencia por `operationId`, y payload owner origen/destino en transferencias.
- Compatibilidad offline-first: alta queue-first, sync `ANIMAL_EVENT` (`CREATE`), replay idempotente, lectura local por animal.

### Out of Scope
- Historial sanitario.
- Historial reproductivo (celo/preñez/parto/genealogía).
- Imágenes/adjuntos.
- Event sourcing total del agregado `Animal`.

## Capabilities

### New Capabilities
- `animal-event-ledger-v1`: registro histórico append-only y consulta por animal/tipo/fecha.
- `animal-event-state-projection-v1`: reglas de impacto de eventos en estado operativo vigente.
- `animal-event-offline-sync-v1`: creación y sincronización offline-first de eventos con idempotencia.

### Modified Capabilities
- None.

## Approach

Adoptar ledger + proyección acotada: separar historial de estado vigente, mantener `animals` como read-model operacional y aplicar sólo mutaciones mínimas derivadas de eventos V1. Tradeoff: menor pureza teórica que event sourcing total, pero menor riesgo y time-to-value más corto.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `hato-be/src/main/resources/db/changelog/*` | Modified | DDL de `animal_events` + índices. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/SyncService.java` | Modified | Push/pull de `ANIMAL_EVENT`. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/mapper/SyncPayloadMapper.java` | Modified | Validación payload V1 + reglas de proyección. |
| `hato-fe/src/app/core/offline/*` | Modified | Tipos, cola y replay offline para eventos. |
| `hato-fe/src/app/features/admin/animals/**` | Modified | UI de alta y timeline V1. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Desorden temporal por `occurredAt` offline | Med | Regla de precedencia (`occurredAt`, `createdAt`, `eventId`) y pruebas de replay. |
| Crecimiento de scope | Med | Enforzar OUT explícito en specs/tasks. |
| Ruptura de contrato sync existente | Low/Med | Capability matrix y compatibilidad backward en mapper/service. |

## Rollback Plan

Desactivar `ANIMAL_EVENT` en sync y UI; mantener `animals` como fuente vigente; rollback de changelog de eventos mediante migración inversa controlada (sin afectar `animals`).

## Dependencies

- Foundation offline existente (outbox/inbox/checkpoints/idempotencia).
- Catálogo vigente de animales y ganaderos para validar ownership.

## Success Criteria

- [ ] 100% de eventos V1 persisten auditoría mínima (`performedByUserId`, `sourceChannel`, `operationId`).
- [ ] Replays offline duplicados no generan doble inserción (idempotencia efectiva por `operationId`).
- [ ] Proyección de estado cumple reglas V1 en 100% de casos de prueba (`SOLD|DECEASED|LOST|TRANSFERRED|OBSERVATION`).
- [ ] Historial responde por animal con filtros (tipo/rango) y orden estable en pruebas de integración.
