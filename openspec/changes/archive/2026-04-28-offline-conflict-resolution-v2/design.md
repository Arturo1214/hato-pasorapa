# Design: Offline Conflict Resolution V2

## Technical Approach
V2 extiende el pipeline actual de `/api/sync` sin romper V1: cuando `push` detecta conflicto o validación no recuperable, BE devuelve metadata enriquecida (diff base/local/server + policy aplicable), FE persiste ese estado en outbox y expone una UI de resolución manual por operación. La decisión humana (`accept_server`, `retry_local`, `discard_local`) se aplica sobre snapshots/outbox y se audita en BE como ledger append-only, manteniendo idempotencia por `operationId` y cursores de `pull` intactos.

## Architecture Decisions

| Decision | Option | Tradeoff | Chosen |
|---|---|---|---|
| Policy por entidad/opType | Hardcode en FE / publicada por BE | Hardcode deriva en drift FE/BE | **BE source-of-truth** con DTO de policy y cache FE |
| Resolución manual | Endpoint nuevo aislado / extender `/api/sync` | Endpoint aparte simplifica dominio, pero duplica seguridad/contexto | **Extender `/api/sync`** con sub-recursos de conflicto |
| Auditoría | Reusar `sync_operation_receipts` / tabla ledger dedicada | Reusar es más simple, pero no modela decisiones múltiples | **Tabla dedicada** `sync_conflict_audit_ledger` (append-only) |
| Diff visual | Computar todo en FE / BE provee snapshot normalizado | FE-only replica reglas por entidad | **BE devuelve `serverState` + campos relevantes; FE renderiza diff genérico** |

## Data Flow

```
SyncOrchestrator.push -> /api/sync/push
  -> SyncService.processOperation
     -> conflict => SyncConflictResponse + policyKey
     -> persist receipt + ledger(event=DETECTED)
FE OfflineStore.markConflict (outbox.status=conflict)
Admin Conflict Store -> lista conflictos pendientes
Usuario decide acción -> /api/sync/conflicts/{operationId}/resolve
  -> SyncService.resolveConflict
     -> aplica acción + ledger(event=RESOLVED)
FE aplica efecto local:
  accept_server: snapshot <- serverState, outbox acked
  retry_local: outbox pending (nuevo intento)
  discard_local: outbox acked + snapshot server
```

## File Changes

| File | Action | Description |
|---|---|---|
| `hato-fe/src/app/core/offline/offline-types.ts` | Modify | Agregar contratos `ConflictDiffField`, `ResolutionPolicy`, `ManualResolutionAction`, estado de auditoría local. |
| `hato-fe/src/app/core/offline/offline-store.service.ts` | Modify | Persistir policy/diff por operación y helpers para aplicar resolución manual sobre outbox/snapshots. |
| `hato-fe/src/app/core/offline/sync-orchestrator.service.ts` | Modify | Consumir metadata V2 de conflicto, no solo `manual_refresh`; publicar refresh para UI de conflictos. |
| `hato-fe/src/app/features/admin/conflicts/data-access/admin-conflict-resolution.store.ts` | Create | Store signal-based para listar conflictos, cargar policy y ejecutar resolución manual. |
| `hato-fe/src/app/features/admin/conflicts/conflict-resolution-page.component.ts` | Create | UI de diff visual, acciones manuales y reason obligatorio. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/dto/sync/SyncConflictResponse.java` | Modify | Incluir `policy`, `diffFields`, `serverStateVersion`, `allowedActions`. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/dto/sync/SyncOperationResult.java` | Modify | Mantener clasificación actual + metadata V2 opcional backward-compatible. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/mapper/SyncPayloadMapper.java` | Modify | Exponer matriz policy por `entityType/opType` reutilizando capability matrix existente. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/SyncService.java` | Modify | Generar diff/policy en conflicto, resolver acciones manuales y registrar auditoría. |
| `hato-be/src/main/java/bo/pasorapa/hato/web/rest/SyncResource.java` | Modify | Agregar endpoints `/api/sync/conflicts` (list/query) y `/api/sync/conflicts/{operationId}/resolve`. |
| `hato-be/src/main/java/bo/pasorapa/hato/domain/SyncConflictAuditLedger.java` | Create | Entidad append-only para conflicto detectado/resuelto con actor/motivo/resultado/timestamp. |
| `hato-be/src/main/java/bo/pasorapa/hato/repository/SyncConflictAuditLedgerRepository.java` | Create | Consultas por `operationId`, `entityType`, rango temporal. |
| `hato-be/src/main/resources/db/changelog/010-offline-conflict-resolution-v2.yaml` | Create | Tabla/índices de ledger + columnas opcionales V2 si hicieran falta. |
| `hato-be/src/main/resources/db/changelog/master.yaml` | Modify | Incluir changelog `010`. |

## Interfaces / Contracts

```ts
type ManualResolutionAction = 'accept_server' | 'retry_local' | 'discard_local';
interface ConflictDiffField { path: string; localValue: unknown; serverValue: unknown; severity: 'low'|'medium'|'high'; }
interface ResolutionPolicy { entityType: OfflineEntityType; opType: OfflineOperationType; allowedActions: ManualResolutionAction[]; uxHint?: string; }
```

```java
public record ResolveConflictRequest(String action, String reason) {}
public record ResolveConflictResponse(UUID operationId, String status, String resultVersion) {}
```

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| FE unit | mapeo diff/policy, transiciones `conflict -> acked/pending` | specs de `offline-store` + `admin-conflict-resolution.store` |
| FE integration | flujo UI diff + acciones manuales + reason requerido | spec de página de conflictos con store fake y respuestas `/api/sync` |
| BE unit | cálculo de `allowedActions`, resolución por acción, append-only ledger | tests de `SyncService` por entidad/opType |
| BE REST | `/push` conflict payload V2 + `/conflicts/*` resolve/list + auth roles | `quarkus-junit5` + `rest-assured` |
| DB migration | creación índices ledger y compatibilidad receipts existentes | test Liquibase aplicado sobre schema actual |

## Migration / Rollout
Feature flag `offlineConflictResolutionV2` en FE y guard server-side por header de versión cliente. Rollout: (1) deploy BE con campos V2 opcionales + ledger; (2) activar FE en cohortes; (3) monitorear tasa de conflictos/resoluciones. Rollback: apagar flag y seguir con comportamiento V1 (`manual_refresh`) sin perder auditoría ya persistida.

## Open Questions
- [ ] Definir TTL/retención del ledger (operativo vs cumplimiento).
- [ ] Confirmar si `retry_local` debe permitir edición previa del payload en V2 o queda para V3.
