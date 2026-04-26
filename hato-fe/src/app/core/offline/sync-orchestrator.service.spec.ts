import { InMemoryOfflinePersistenceAdapter } from './offline-store.migrations';
import { OfflineStoreService } from './offline-store.service';
import { SyncMetricsStore } from './sync-metrics.store';
import {
  SyncOrchestratorService,
  type PullSyncResponse,
  type PushSyncResponse,
  type SyncApiClient,
} from './sync-orchestrator.service';

describe('SyncOrchestratorService', () => {
  const createStore = (adapter = new InMemoryOfflinePersistenceAdapter()) =>
    new OfflineStoreService(adapter, {
      generateId: () => 'generated-op',
      now: () => '2026-04-26T10:00:00.000Z',
    });

  const createClient = () => {
    const callSequence: string[] = [];
    const push = vi.fn<SyncApiClient['push']>(async () => {
      callSequence.push('push');

      const response: PushSyncResponse = {
        results: [
          {
            operationId: 'operation-1',
            entityType: 'ANIMAL',
            entityId: 'e80fe14d-f451-4919-9c5c-0f24981eb1ec',
            classification: 'no_conflict',
            serverVersion: 1,
          },
        ],
      };

      return response;
    });
    const pull = vi.fn<SyncApiClient['pull']>(async () => {
      callSequence.push('pull');

      const response: PullSyncResponse = {
        entityType: 'ANIMAL',
        items: [
          {
            uuid: 'e80fe14d-f451-4919-9c5c-0f24981eb1ec',
            version: 1,
            updatedAt: '2026-04-26T10:02:00.000Z',
            tag: 'BO-8200',
          },
        ],
        nextCursor: {
          entityType: 'ANIMAL',
          cursorUpdatedAt: '2026-04-26T10:02:00.000Z',
          cursorId: 'e80fe14d-f451-4919-9c5c-0f24981eb1ec',
          lastSuccessAt: '2026-04-26T10:03:00.000Z',
        },
        hasMore: false,
      };

      return response;
    });

    return { client: { push, pull }, push, pull, callSequence };
  };

  it('should push eligible operations before pulling and advance the checkpoint atomically on manual sync', async () => {
    const store = createStore();
    const metrics = new SyncMetricsStore();
    const { client, push, pull, callSequence } = createClient();

    await store.enqueueOperation({
      entityType: 'ANIMAL',
      entityId: 'e80fe14d-f451-4919-9c5c-0f24981eb1ec',
      opType: 'UPDATE',
      payload: { tag: 'BO-8200' },
      baseVersion: 0,
      clientCreatedAt: '2026-04-26T10:00:00.000Z',
      clientUpdatedAt: '2026-04-26T10:00:00.000Z',
      operationId: 'operation-1',
    });
    await store.saveCheckpoint({
      entityType: 'ANIMAL',
      cursorUpdatedAt: '2026-04-26T09:59:00.000Z',
      cursorId: 'cursor-animal-1',
      lastSuccessAt: '2026-04-26T09:59:00.000Z',
    });

    const service = new SyncOrchestratorService({
      store,
      apiClient: client,
      metricsStore: metrics,
      offlineStatus: { isOnline: () => true },
      authSession: { getAccessToken: () => 'token' },
      now: () => '2026-04-26T10:03:00.000Z',
      random: () => 0,
      windowRef: window,
      supportedEntities: ['ANIMAL'],
    });

    await service.syncNow('manual');

    expect(callSequence).toEqual(['push', 'pull']);
    expect(push).toHaveBeenCalledTimes(1);
    expect(pull).toHaveBeenCalledWith({
      entityType: 'ANIMAL',
      cursor: {
        entityType: 'ANIMAL',
        cursorUpdatedAt: '2026-04-26T09:59:00.000Z',
        cursorId: 'cursor-animal-1',
        lastSuccessAt: '2026-04-26T09:59:00.000Z',
      },
    });

    const outbox = await store.listOutbox();
    const checkpoint = await store.getCheckpoint('ANIMAL');
    const inbox = await store.listInbox();
    const snapshots = await store.listSnapshots('ANIMAL');

    expect(outbox[0].status).toBe('acked');
    expect(checkpoint).toEqual({
      entityType: 'ANIMAL',
      cursorUpdatedAt: '2026-04-26T10:02:00.000Z',
      cursorId: 'e80fe14d-f451-4919-9c5c-0f24981eb1ec',
      lastSuccessAt: '2026-04-26T10:03:00.000Z',
    });
    expect(inbox).toHaveLength(1);
    expect(snapshots).toHaveLength(1);
    expect(metrics.snapshot()).toEqual({
      pending: 0,
      success: 1,
      failed: 0,
      lastSyncAt: '2026-04-26T10:03:00.000Z',
    });
  });

  it('should trigger one sync on startup and another on reconnect when connectivity returns', async () => {
    const store = createStore();
    const metrics = new SyncMetricsStore();
    const { client, push, pull } = createClient();
    let online = true;

    const service = new SyncOrchestratorService({
      store,
      apiClient: client,
      metricsStore: metrics,
      offlineStatus: { isOnline: () => online },
      authSession: { getAccessToken: () => 'token' },
      now: () => '2026-04-26T10:05:00.000Z',
      random: () => 0,
      windowRef: window,
      supportedEntities: ['ANIMAL'],
    });

    await service.initialize();

    online = false;
    online = true;
    window.dispatchEvent(new Event('online'));
    await vi.waitFor(() => expect(pull).toHaveBeenCalledTimes(2));

    expect(push).toHaveBeenCalledTimes(0);
  });

  it('should keep startup and reconnect dormant without session and allow manual runtime sync once a token exists', async () => {
    const store = createStore();
    const metrics = new SyncMetricsStore();
    const { client, pull } = createClient();
    let online = true;
    let accessToken: string | null = null;

    const service = new SyncOrchestratorService({
      store,
      apiClient: client,
      metricsStore: metrics,
      offlineStatus: { isOnline: () => online },
      authSession: { getAccessToken: () => accessToken },
      now: () => '2026-04-26T10:07:00.000Z',
      random: () => 0,
      windowRef: window,
      supportedEntities: ['ANIMAL'],
    });

    await service.initialize();
    expect(pull).toHaveBeenCalledTimes(0);

    window.dispatchEvent(new Event('online'));
    await vi.waitFor(() => expect(pull).toHaveBeenCalledTimes(0));

    accessToken = 'jwt-token';
    window.dispatchEvent(new CustomEvent('hato:sync-manual'));
    await vi.waitFor(() => expect(pull).toHaveBeenCalledTimes(1));
  });

  it('should schedule retry with jitter and keep metrics consistent after a transient push failure', async () => {
    const store = createStore();
    const metrics = new SyncMetricsStore();

    await store.enqueueOperation({
      entityType: 'ANIMAL',
      entityId: '9ed1e76d-6f46-46de-ad90-1fd75bbf53d3',
      opType: 'UPDATE',
      payload: { tag: 'BO-8300' },
      baseVersion: 0,
      clientCreatedAt: '2026-04-26T10:00:00.000Z',
      clientUpdatedAt: '2026-04-26T10:00:00.000Z',
      operationId: 'operation-retry-1',
    });

    const service = new SyncOrchestratorService({
      store,
      apiClient: {
        push: vi.fn(async () => {
          throw new Error('temporary network failure');
        }),
        pull: vi.fn(),
      },
      metricsStore: metrics,
      offlineStatus: { isOnline: () => true },
      authSession: { getAccessToken: () => 'token' },
      now: () => '2026-04-26T10:06:00.000Z',
      random: () => 0,
      windowRef: window,
      supportedEntities: ['ANIMAL'],
    });

    await service.syncNow('manual');

    const outbox = await store.listOutbox();

    expect(outbox[0].status).toBe('retry_scheduled');
    expect(outbox[0].attempts).toBe(1);
    expect(outbox[0].nextAttemptAt).toBe('2026-04-26T10:06:01.000Z');
    expect(metrics.snapshot()).toEqual({
      pending: 1,
      success: 0,
      failed: 1,
      lastSyncAt: '2026-04-26T10:06:00.000Z',
    });
  });
});
