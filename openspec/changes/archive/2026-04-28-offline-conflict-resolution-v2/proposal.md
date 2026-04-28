# Proposal: Offline Conflict Resolution V2

## Intent

Fortalecer el flujo offline-first existente para que conflictos de `/api/sync` puedan resolverse de forma operativa, auditable y consistente por entidad, sin rediseñar el backbone de sincronización V1.

## Scope

### In Scope
- Diff visual por operación en conflicto (`local payload` vs `server state`) con severidad por campo.
- Resolución manual guiada por operación: `accept_server`, `retry_local`, `discard_local`.
- Política explícita por entidad/opType para resolución soportada y hints de UX.
- Auditoría de conflictos y decisiones humanas (actor, timestamp, motivo, resultado) sobre pipeline existente.
- Compatibilidad estricta con idempotencia por `operationId`, cursores y contrato base `/api/sync`.

### Out of Scope
- Merge inteligente por IA.
- Colaboración multiusuario en tiempo real.
- Políticas arbitrarias por campo completamente configurables.

## Capabilities

### New Capabilities
- `offline-conflict-resolution-v2`: contrato transversal de diff visual y resolución manual en el ciclo offline sync.
- `sync-conflict-audit-ledger-v2`: trazabilidad consultable de conflictos y resoluciones humanas.
- `sync-entity-resolution-policy-v2`: publicación/normalización de políticas de resolución por entidad y operación.

### Modified Capabilities
- `animal-event-offline-sync-v1`: incorpora metadatos de conflicto y hooks de resolución.
- `animal-health-offline-sync-v1`: agrega comportamiento de conflicto/resolución en replay idempotente.
- `animal-reproduction-offline-sync-v1`: amplía contrato de manejo de conflicto offline.
- `animal-image-offline-sync-v1`: incluye resolución manual para fallas/conflictos de imagen.

## Approach

Implementación incremental V2 sobre `/api/sync`: extender metadata de conflicto en backend, normalizar políticas por entidad, persistir ledger de conflicto/resolución y agregar workflow FE transversal en outbox/snapshots con feature-flag de rollout.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `hato-fe/src/app/core/offline/*` | Modified | Modelo diff, acciones manuales, estado y persistencia de conflicto. |
| `hato-fe/src/app/features/admin/**` | Modified | UX de revisión y resolución de conflictos por entidad. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/SyncService.java` | Modified | Metadata de conflicto y decisión de resolución. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/mapper/SyncPayloadMapper.java` | Modified | Política explícita por entidad/opType. |
| `hato-be/src/main/java/bo/pasorapa/hato/domain/SyncOperationReceipt.java` | Modified | Campos/registro para auditoría de conflictos. |
| `hato-be/src/main/java/bo/pasorapa/hato/web/rest/SyncResource.java` | Modified | Mantener contrato `/api/sync`, sumar superficies de consulta si aplica. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Scope creep por reglas por dominio | Med | Limitar V2 a 3 acciones estándar y policy por entidad/opType. |
| Inconsistencia FE/BE de políticas | Med | Versionar policy payload + tests de contrato. |
| Auditoría insuficiente | Med | Registrar conflicto + decisión + actor + motivo de forma obligatoria. |

## Rollback Plan

Desactivar feature-flag V2 y volver al manejo V1 (`status: conflict` + retry manual actual), conservando esquema compatible en `/api/sync` y manteniendo ledger como append-only sin bloquear sync.

## Dependencies

- Contrato actual de `/api/sync` y `operationId` idempotente.
- Evolución coordinada FE/BE de tipos de conflicto/policy.

## Success Criteria

- [ ] Todo conflicto generado por `/api/sync` expone diff visual y opciones válidas de resolución.
- [ ] Resoluciones manuales actualizan outbox/snapshots sin romper idempotencia ni cursores.
- [ ] Existe historial consultable de conflicto y decisión humana por `operationId`.
- [ ] Sin regresiones en flujos offline V1 de entidades cubiertas.
