import {
  CURRENT_OFFLINE_SCHEMA_VERSION,
  InMemoryOfflinePersistenceAdapter,
} from './offline-store.migrations';
import { OfflineStoreService } from './offline-store.service';

describe('OfflineStoreService', () => {
  const createService = (
    adapter = new InMemoryOfflinePersistenceAdapter(),
    ids = ['op-1', 'op-2', 'op-3'],
    timestamps = ['2026-04-26T10:00:00.000Z', '2026-04-26T10:05:00.000Z', '2026-04-26T10:10:00.000Z']
  ) => {
    let idIndex = 0;
    let timestampIndex = 0;

    return new OfflineStoreService(adapter, {
      generateId: () => ids[idIndex++] ?? `generated-${idIndex}`,
      now: () => timestamps[timestampIndex++] ?? timestamps.at(-1) ?? '2026-04-26T10:10:00.000Z',
    });
  };

  it('should recover queued operations and checkpoints after a restart', async () => {
    const adapter = new InMemoryOfflinePersistenceAdapter();
    const store = createService(adapter);

    await store.enqueueOperation({
      entityType: 'USER',
      opType: 'CREATE',
      payload: { username: 'gestion-admin' },
      clientCreatedAt: '2026-04-26T09:55:00.000Z',
      clientUpdatedAt: '2026-04-26T09:55:00.000Z',
    });
    await store.saveCheckpoint({
      entityType: 'USER',
      cursorUpdatedAt: '2026-04-26T09:50:00.000Z',
      cursorId: 'cursor-user-1',
      lastSuccessAt: '2026-04-26T09:58:00.000Z',
    });

    const restartedStore = createService(adapter, ['op-9'], ['2026-04-26T11:00:00.000Z']);
    const outbox = await restartedStore.listOutbox();
    const checkpoint = await restartedStore.getCheckpoint('USER');

    expect(outbox).toHaveLength(1);
    expect(outbox[0].status).toBe('pending');
    expect(outbox[0].payload).toEqual({ username: 'gestion-admin' });
    expect(checkpoint).toEqual({
      entityType: 'USER',
      cursorUpdatedAt: '2026-04-26T09:50:00.000Z',
      cursorId: 'cursor-user-1',
      lastSuccessAt: '2026-04-26T09:58:00.000Z',
    });
  });

  it('should run local schema migration exactly once and preserve compatible records', async () => {
    const adapter = new InMemoryOfflinePersistenceAdapter({
      schemaVersion: 1,
      outbox: [
        {
          operationId: 'legacy-op',
          entityType: 'ANIMAL',
          opType: 'UPDATE',
          payload: { tag: 'BO-0009' },
          clientCreatedAt: '2026-04-20T10:00:00.000Z',
          clientUpdatedAt: '2026-04-20T10:00:00.000Z',
          status: 'PENDING',
          attempts: 0,
        },
      ],
      inbox: [],
      snapshots: [],
      syncState: {
        checkpoints: {
          ANIMAL: {
            entityType: 'ANIMAL',
            cursorUpdatedAt: '2026-04-20T10:00:00.000Z',
            cursorId: 'legacy-cursor',
            lastSuccessAt: '2026-04-20T10:05:00.000Z',
          },
        },
      },
    });

    const firstBoot = createService(adapter, ['op-9'], ['2026-04-26T11:00:00.000Z']);
    const migratedOutbox = await firstBoot.listOutbox();
    const migratedState = adapter.snapshot();

    expect(migratedOutbox[0].status).toBe('pending');
    expect(migratedState.schemaVersion).toBe(CURRENT_OFFLINE_SCHEMA_VERSION);
    expect(migratedState.syncState.meta?.appliedMigrations).toEqual(['v1-to-v2-status-normalization']);

    const saveCountAfterMigration = adapter.saveCount;
    const secondBoot = createService(adapter, ['op-10'], ['2026-04-26T11:10:00.000Z']);
    await secondBoot.listOutbox();

    expect(adapter.saveCount).toBe(saveCountAfterMigration);
  });

  it('should persist pending to in-flight to acked and dead-letter transitions', async () => {
    const adapter = new InMemoryOfflinePersistenceAdapter();
    const store = createService(adapter);

    const queued = await store.enqueueOperation({
      entityType: 'GANADERO',
      opType: 'STATUS_UPDATE',
      entityId: 'ganadero-1',
      payload: { active: false },
      clientCreatedAt: '2026-04-26T09:55:00.000Z',
      clientUpdatedAt: '2026-04-26T09:55:00.000Z',
    });

    await store.markInFlight(queued.operationId);
    await store.markAcked(queued.operationId);

    const secondQueued = await store.enqueueOperation({
      entityType: 'GANADERO',
      opType: 'STATUS_UPDATE',
      entityId: 'ganadero-2',
      payload: { active: true },
      clientCreatedAt: '2026-04-26T09:57:00.000Z',
      clientUpdatedAt: '2026-04-26T09:57:00.000Z',
    });

    await store.markInFlight(secondQueued.operationId);
    await store.markDeadLetter(secondQueued.operationId, {
      code: 'RETRY_LIMIT_EXCEEDED',
      message: 'Se agotó la política de retry.',
    });

    const outbox = await store.listOutbox();

    expect(outbox.map((operation) => operation.status)).toEqual(['acked', 'dead_letter']);
    expect(outbox[1].lastErrorCode).toBe('RETRY_LIMIT_EXCEEDED');
    expect(outbox[1].lastErrorMessage).toBe('Se agotó la política de retry.');
  });
});
