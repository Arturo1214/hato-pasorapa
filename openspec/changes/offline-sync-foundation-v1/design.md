# Design: Offline Sync Foundation V1

## Technical Approach
V1 se implementa como **foundation vertical FE/BE**: en FE, patrón queue-first con IndexedDB (outbox/inbox/sync_state), PWA shell y un sync loop explícito; en BE, endpoints de sync (`push` + `pull incremental`) con idempotencia por `operationId`, cursor de cambios por entidad y conflicto mínimo por `version` (409). Se mantiene el flujo por capas actual (REST → Service → Repository/Domain) y en FE se adapta data-access existente para encolar mutaciones antes de intentar envío.

## Architecture Decisions

| Decision | Option | Tradeoff | Chosen |
|---|---|---|---|
| Almacenamiento offline FE | LocalStorage / IndexedDB | LocalStorage no sirve para colas robustas ni queries; IndexedDB agrega complejidad | **IndexedDB** con stores `outbox`, `inbox`, `snapshots`, `sync_state` |
| Contrato de sync BE | Endpoint por entidad / envelope canónico | Por entidad simplifica inicio, pero fragmenta semántica | **Envelope canónico** + `entityType` para uniformar retries/conflictos |
| Pull incremental | Full reload / cursor por entidad | Full reload simple pero costoso y frágil offline | **Cursor/checkpoint por entidad** usando `updatedAt` + tie-breaker `id` |
| Conflictos V1 | Merge automático / fail-fast | Merge automático reduce fricción pero eleva riesgo funcional | **Fail-fast 409** con metadata para resolución manual posterior |

## Data Flow

```
UI Feature (Admin Users/Ganaderos/Animals)
   -> Data Access Service (queue-first)
      -> OfflineStore (IndexedDB: outbox)
         -> SyncOrchestrator (start/manual/online)
            -> POST /api/sync/push (batch operations)
            -> GET  /api/sync/pull?entity=...&cursor=...
            -> apply inbox/snapshots + update checkpoints
```

**Push**: FE toma operaciones `PENDING|RETRY_SCHEDULED`, envía lote, actualiza status (`ACKED`, `CONFLICT`, `FAILED`, `DEAD_LETTER`) y programa siguiente intento.

**Pull**: FE pide cambios por entidad desde último checkpoint; BE responde `items[] + nextCursor + hasMore`; FE actualiza snapshots/inbox y checkpoint atómico.

## File Changes

| File | Action | Description |
|---|---|---|
| `hato-fe/angular.json` | Modify | habilitar service worker + `ngswConfigPath` |
| `hato-fe/public/manifest.webmanifest` | Create | metadatos PWA instalable |
| `hato-fe/src/app/app.config.ts` | Modify | registrar `provideServiceWorker` y bootstrap de sync |
| `hato-fe/src/app/core/offline/{offline-store.service.ts,sync-orchestrator.service.ts,offline-types.ts}` | Create | IndexedDB, envelope, loop y métricas cliente |
| `hato-fe/src/app/features/admin/{users,ganaderos}/data-access/*.service.ts` | Modify | mutaciones queue-first y fallback online |
| `hato-be/src/main/java/bo/pasorapa/hato/web/rest/SyncResource.java` | Create | endpoints `/api/sync/push` y `/api/sync/pull` |
| `hato-be/src/main/java/bo/pasorapa/hato/service/SyncService.java` | Create | idempotencia, retries metadata y resolución mínima |
| `hato-be/src/main/java/bo/pasorapa/hato/service/dto/sync/*.java` | Create | DTOs envelope, ack, conflict, cursor |
| `hato-be/src/main/java/bo/pasorapa/hato/domain/Animal.java` | Modify | agregar `uuid`, `version`, `updatedAt`, `lastSyncedAt` |
| `hato-be/src/main/resources/db/changelog/003-offline-sync-foundation.yaml` | Create | tablas/índices sync + migración transicional `animals` |
| `hato-be/src/main/resources/db/changelog/master.yaml` | Modify | incluir changelog `003` |

## Interfaces / Contracts

```ts
type OfflineOperationStatus =
  | 'PENDING' | 'IN_FLIGHT' | 'ACKED' | 'RETRY_SCHEDULED'
  | 'CONFLICT' | 'FAILED' | 'DEAD_LETTER';

interface OfflineOperationEnvelope {
  operationId: string;        // UUID idempotencia extremo a extremo
  entityType: 'USER'|'GANADERO'|'ANIMAL';
  entityId?: string;          // UUID lógico (puede faltar en CREATE)
  opType: 'CREATE'|'UPDATE'|'DELETE'|'STATUS_UPDATE'|'PASSWORD_RESET';
  payload: Record<string, unknown>;
  baseVersion?: number;       // optimistic concurrency
  clientCreatedAt: string;    // ISO-8601
  clientUpdatedAt: string;
  status: OfflineOperationStatus;
  attempts: number;
  nextAttemptAt?: string;
  lastErrorCode?: string;
  lastErrorMessage?: string;
  conflict?: { serverVersion: number; serverState?: unknown; reason: string };
}
```

Cursor/checkpoint V1 (por entidad): `{ entityType, cursorUpdatedAt, cursorId, lastSuccessAt }`.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| FE unit (`*.spec.ts`) | encolado, transiciones de estado, backoff | tests de `offline-store` y `sync-orchestrator` con reloj fake |
| FE integration | servicios admin usan queue-first | adaptar specs de `admin-users`/`ganaderos` para verificar encolado y replay visual |
| BE unit | mapping envelope→casos de uso + conflicto/version | tests de `SyncService` con repos fake/in-memory |
| BE REST | push/pull, 409 conflicto, idempotencia repetida | `quarkus-junit5` + `rest-assured` siguiendo patrón `AdminUsersResourceTest` |
| DB migration | transición `animals` sin pérdida | test Liquibase sobre dataset semilla (id BIGSERIAL existente) |

## Migration / Rollout
`animals` se alinea sin romper datos en 2 pasos dentro de un changelog: (1) agregar columnas `uuid` (nullable), `version` default 0, `updated_at`, `last_synced_at`; backfill `uuid` para filas existentes; índices únicos sobre `uuid`; (2) adaptar código a usar UUID externo y mantener `id` BIGSERIAL solo como surrogate legado en V1. Rollout con feature flag FE `offlineSyncEnabled` para activar sync loop gradualmente.

## Open Questions
- [ ] Definir orden de prioridad de entidades en push batch (hoy propuesta: USER/GANADERO antes de ANIMAL por dependencias de ownership).
