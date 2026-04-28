# Design: Offline Sync Users y Ganaderos v1

## Technical Approach
Extender el contrato canónico `/api/sync` para que `USER` y `GANADERO` usen el mismo pipeline que `ANIMAL` (push idempotente + pull incremental por cursor), y retirar el replay HTTP feature-specific en FE. El diseño conserva guardrails de seguridad: `createUser` y `resetPassword` siguen online-only. La implementación mantiene capas Quarkus (REST → Service → Repository/Domain) y en FE mantiene queue-first con orquestador global.

## Architecture Decisions

| Decision | Options | Tradeoff | Selected |
|---|---|---|---|
| Canal de sync para USER/GANADERO | Replay por feature vs `/api/sync` único | Replay duplica reglas y riesgo de doble envío | `/api/sync` único para operaciones offline permitidas |
| Semántica offline por entidad | Permitir todas las mutaciones vs whitelist | Mayor cobertura vs riesgo de seguridad | Whitelist estricta por entidad/opType |
| Idempotencia cross-entity | `operation_log` solo feature vs `sync_operation_receipts` + `operation_log` | Una capa simplifica, dos capas dan replay estable + resourceId en CREATE | Mantener `sync_operation_receipts` como gate en `/sync` y `operation_log` en services admin |
| Pull incremental USER/GANADERO | Envelope vacío vs cursor real `updatedAt + id` | Placeholder simple pero inutilizable offline | Cursor real idéntico a ANIMAL (`updatedAt asc, id asc`) |

## Data Flow

```
Admin Users/Ganaderos UI
  -> AdminUsersService/GanaderosService (enqueue only)
  -> OfflineStore(outbox)
  -> SyncOrchestrator.syncNow()
      -> POST /api/sync/push (USER/GANADERO/ANIMAL mezclado)
      -> SyncService.processOperation by entity/opType
          -> AdminUserService/GanaderoService domain methods
          -> persist SyncOperationReceipt
      -> GET /api/sync/pull?entityType=USER|GANADERO|ANIMAL&cursor...
          -> Repository.listChangedSince(updatedAt,id)
      -> OfflineStore.applyPullResponse + checkpoints
  -> UI reload desde snapshots
```

## File Changes

| File | Action | Description |
|---|---|---|
| `hato-be/src/main/java/bo/pasorapa/hato/service/SyncService.java` | Modify | Agregar handlers push/pull para `USER` y `GANADERO`, whitelist opType, conflictos/version e idempotencia homogénea. |
| `hato-be/src/main/java/bo/pasorapa/hato/web/rest/SyncResource.java` | Modify | Pasar actor actual al service (`currentUserId`) para auditoría en mutaciones sync. |
| `hato-be/src/main/java/bo/pasorapa/hato/repository/UserRepository.java` | Modify | `listChangedSince(cursorUpdatedAt,cursorId,limitPlusOne)` ordenado por `updatedAt,id`. |
| `hato-be/src/main/java/bo/pasorapa/hato/repository/GanaderoRepository.java` | Modify | `listChangedSince(cursorUpdatedAt,cursorId,limitPlusOne)` con mismo criterio. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/AdminUserService.java` | Modify | Exponer método de dominio para `STATUS_UPDATE` reutilizable desde `/sync` sin pasar por REST admin. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/GanaderoService.java` | Modify | Exponer métodos de dominio para `CREATE` y `STATUS_UPDATE` reutilizables desde `/sync`. |
| `hato-be/src/main/java/bo/pasorapa/hato/service/mapper/SyncPayloadMapper.java` | Create | Mapper dedicado payload↔domain para `USER`/`GANADERO` en sync (evita lógica ad-hoc en `SyncService`). |
| `hato-be/src/test/java/bo/pasorapa/hato/service/SyncServiceTest.java` | Modify | Cobertura push/pull multi-entidad, whitelist de operaciones y cursor `updatedAt+id`. |
| `hato-be/src/test/java/bo/pasorapa/hato/web/rest/SyncResourceTest.java` | Modify | Contrato REST para `USER`/`GANADERO`, `409`, validation_error e idempotencia replay. |
| `hato-fe/src/app/features/admin/users/data-access/admin-users.service.ts` | Modify | Eliminar `replayQueuedMutations`; encolar + disparar `MANUAL_SYNC_EVENT` cuando online. |
| `hato-fe/src/app/features/admin/ganaderos/data-access/ganaderos.service.ts` | Modify | Igual: sin replay directo `/admin/ganaderos`, sólo canal orquestador `/sync`. |
| `hato-fe/src/app/core/offline/sync-orchestrator.service.ts` | Modify | Validar clasificaciones multi-entidad y reconciliar snapshots de creates (`pending:*` -> id real). |
| `hato-fe/src/app/features/admin/{users,ganaderos}/data-access/*.spec.ts` | Modify | Cambiar asserts de replay HTTP a asserts de encolado + sync trigger central. |
| `hato-fe/src/app/core/offline/sync-orchestrator.service.spec.ts` | Modify | Casos con `supportedEntities` múltiples y resultados mezclados por entidad. |
| `hato-fe/src/app/features/admin/{users,ganaderos}/*page.component.ts` | Modify | Mantener feedback UI con mensajes de cola/sync central y conflictos sin cambiar UX base. |

## Interfaces / Contracts

```text
Allowed offline operations (exact):
- USER: STATUS_UPDATE only
- GANADERO: CREATE, STATUS_UPDATE
- ANIMAL: UPDATE (sin cambios)
- Any other entity/opType -> classification=validation_error, reason=OPERATION_NOT_ALLOWED_OFFLINE
```

```text
Cursor contract (all entities):
query: cursorUpdatedAt?, cursorId?
order: updatedAt ASC, id/uuid ASC
nextCursor: { entityType, cursorUpdatedAt, cursorId, lastSuccessAt }
```

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| FE unit | Sin replay feature-specific; enqueue + manual sync event; snapshots pending/create reconciliation | Vitest en `admin-users.service.spec.ts`, `ganaderos.service.spec.ts`, `sync-orchestrator.service.spec.ts` |
| BE service | Whitelist por entidad/opType, conflictos por version, idempotencia por operationId, cursor incremental | `SyncServiceTest` con fixtures `USER/GANADERO/ANIMAL` |
| BE REST | `/api/sync/push` 200/409 + validation_error y `/pull` incremental multi-entidad | `SyncResourceTest` con `rest-assured` |

## Migration / Rollout
No migration de esquema requerida: `users`, `ganaderos`, `operation_log` y `sync_operation_receipts` ya contienen `id/version/updatedAt/operationId`. Rollout en 3 pasos: (1) habilitar BE multi-entidad en `/sync`, (2) quitar replay feature-specific FE detrás de flag local de orquestación única, (3) activar por defecto y remover flag tras estabilización.

## Open Questions
- [ ] Para `GANADERO CREATE`, ¿se normaliza `entityId` cliente a `operationId` (UUID) en outbox para evitar prefijo `pending:` no parseable en BE?
- [ ] ¿Necesitamos incluir `serverState` en `validation_error` de negocio (ej. businessIdentifier duplicado) o sólo `reason`?
