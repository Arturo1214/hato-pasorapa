import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { InMemoryOfflinePersistenceAdapter } from './offline-store.migrations';
import { OfflineStoreService } from './offline-store.service';
import { SyncMetricsStore } from './sync-metrics.store';
import { AuthService } from '../auth/data-access/auth.service';
import {
  CALENDAR_ALERTS_REFRESH_EVENT,
  MANUAL_SYNC_EVENT,
  NOTIFICATIONS_REFRESH_EVENT,
  REPORTING_REFRESH_EVENT,
  SyncOrchestratorService,
  type PullSyncResponse,
  type PushSyncResponse,
  type SyncApiClient,
  triggerManualSync,
} from './sync-orchestrator.service';
import {
  buildAnimalPullPages,
  buildCheckpoint,
  buildNoConflictResult,
  buildOperation,
  buildOverflowPullPage,
  buildPushResponse,
  SYNC_HARNESS_MAX_HAS_MORE_PAGES,
} from './testing/sync-harness.fixtures';
import {
  expectBatchComposition,
  expectCheckpointCursor,
  expectPushBeforePull,
  expectRuntimeCycle,
  expectSnapshotIds,
} from './testing/sync-harness.assertions';

describe('SyncOrchestratorService', () => {
  // CI V1 gate: [smoke] corre siempre en pipeline por defecto; [stress] queda manual/on-demand.
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

  it('should resolve from Angular DI during bootstrap-style initialization', () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideRouter([]),
        {
          provide: SyncOrchestratorService,
          useFactory: () => new SyncOrchestratorService(),
        },
        {
          provide: AuthService,
          useValue: {
            getAccessToken: () => null,
            getOfflineSessionStatus: () => 'active',
          } satisfies Pick<AuthService, 'getAccessToken' | 'getOfflineSessionStatus'>,
        },
      ],
    });

    expect(TestBed.inject(SyncOrchestratorService)).toBeInstanceOf(SyncOrchestratorService);
  });

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
    expect(metrics.snapshot()).toMatchObject({
      pending: 0,
      success: 1,
      failed: 0,
      syncing: false,
      lastSyncAt: '2026-04-26T10:03:00.000Z',
      lastMessage: 'Sincronización central completada.',
      manualRefreshRequired: false,
      runtime: {
        cycle: {
          trigger: 'manual',
          finishedAt: '2026-04-26T10:03:00.000Z',
        },
      },
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

  it('should block push and pull when the offline session expired or requires reauthentication', async () => {
    const store = createStore();
    const metrics = new SyncMetricsStore();

    for (const status of ['expired', 'reauth_required'] as const) {
      const apiClient = {
        push: vi.fn<SyncApiClient['push']>(),
        pull: vi.fn<SyncApiClient['pull']>(),
      } satisfies SyncApiClient;

      const service = new SyncOrchestratorService({
        store,
        apiClient,
        metricsStore: metrics,
        offlineStatus: { isOnline: () => true },
        authSession: {
          getAccessToken: () => 'token',
          getOfflineSessionStatus: () => status,
        },
        now: () => '2026-04-26T10:07:00.000Z',
        random: () => 0,
        windowRef: window,
        supportedEntities: ['ANIMAL'],
      });

      await service.syncNow('manual');

      expect(apiClient.push).not.toHaveBeenCalled();
      expect(apiClient.pull).not.toHaveBeenCalled();
      expect(metrics.snapshot().lastMessage).toBe(
        status === 'expired'
          ? 'La sesión offline expiró. Iniciá sesión nuevamente antes de sincronizar.'
          : 'Este dispositivo requiere reautenticación antes de sincronizar.'
      );
    }
  });

  it('should expose a helper that dispatches the shared manual sync event exactly once', () => {
    const dispatchEvent = vi.fn();

    triggerManualSync({ dispatchEvent } as never);

    expect(dispatchEvent).toHaveBeenCalledTimes(1);
    expect(dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({ type: MANUAL_SYNC_EVENT }));
  });

  it('should emit calendar refresh only after a successful pull cycle', async () => {
    const store = createStore();
    const metrics = new SyncMetricsStore();
    const dispatchEvent = vi.fn();
    const service = new SyncOrchestratorService({
      store,
      apiClient: {
        push: vi.fn(async () => ({ results: [] } satisfies PushSyncResponse)),
        pull: vi.fn(async () => ({
          entityType: 'ANIMAL',
          items: [],
          nextCursor: {
            entityType: 'ANIMAL',
            cursorUpdatedAt: '2026-04-26T10:03:00.000Z',
            cursorId: 'cursor-1',
            lastSuccessAt: '2026-04-26T10:03:00.000Z',
          },
          hasMore: false,
        } satisfies PullSyncResponse)),
      },
      metricsStore: metrics,
      offlineStatus: { isOnline: () => true },
      authSession: { getAccessToken: () => 'token' },
      now: () => '2026-04-26T10:03:00.000Z',
      random: () => 0,
      windowRef: { addEventListener: vi.fn(), dispatchEvent } as never,
      supportedEntities: ['ANIMAL'],
    });

    await service.syncNow('manual');

    expect(dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({ type: CALENDAR_ALERTS_REFRESH_EVENT }));
    expect(dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({ type: NOTIFICATIONS_REFRESH_EVENT }));
    expect(dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({ type: REPORTING_REFRESH_EVENT }));
  });

  it('should preserve cached notification snapshots when a manual refresh is requested offline', async () => {
    const store = createStore();
    const metrics = new SyncMetricsStore();
    await store.saveSnapshot({
      key: 'NOTIFICATION:notification-a',
      entityType: 'NOTIFICATION',
      entityId: 'notification-a',
      updatedAt: '2026-04-26T10:00:00.000Z',
      payload: {
        id: 'notification-a',
        title: 'Aviso offline',
        body: 'Debe seguir visible sin red.',
        createdByUserId: 'admin-1',
        publishedAt: '2026-04-26T10:00:00.000Z',
        updatedAt: '2026-04-26T10:00:00.000Z',
      },
    });

    const apiClient = {
      push: vi.fn<SyncApiClient['push']>(),
      pull: vi.fn<SyncApiClient['pull']>(),
    } satisfies SyncApiClient;

    const service = new SyncOrchestratorService({
      store,
      apiClient,
      metricsStore: metrics,
      offlineStatus: { isOnline: () => false },
      authSession: { getAccessToken: () => 'token' },
      now: () => '2026-04-26T10:03:00.000Z',
      random: () => 0,
      windowRef: window,
      supportedEntities: ['NOTIFICATION'],
    });

    await service.syncNow('manual');

    expect(apiClient.push).not.toHaveBeenCalled();
    expect(apiClient.pull).not.toHaveBeenCalled();
    expect((await store.listSnapshots('NOTIFICATION')).map((snapshot) => snapshot.entityId)).toEqual(['notification-a']);
  });

  it('should push and pull ANIMAL_REPRODUCTION_EVENT operations without duplicating replayed snapshots', async () => {
    const store = createStore();
    const metrics = new SyncMetricsStore();

    await store.enqueueOperation({
      entityType: 'ANIMAL_REPRODUCTION_EVENT',
      entityId: 'repro-event-1',
      opType: 'CREATE',
      payload: {
        animalUuid: 'animal-1',
        reproductionEventType: 'BIRTH',
        metadata: { offspringCount: 1, motherAnimalUuid: 'animal-1', offspringAnimalUuids: ['calf-1'] },
      },
      baseVersion: 0,
      clientCreatedAt: '2026-04-26T10:00:00.000Z',
      clientUpdatedAt: '2026-04-26T10:00:00.000Z',
      operationId: 'repro-event-1',
    });

    const service = new SyncOrchestratorService({
      store,
      apiClient: {
        push: vi.fn(async () => ({
          results: [
            {
              operationId: 'repro-event-1',
              entityType: 'ANIMAL_REPRODUCTION_EVENT',
              entityId: 'repro-event-1',
              classification: 'no_conflict',
              serverVersion: 0,
            },
          ],
        } satisfies PushSyncResponse)),
        pull: vi.fn(async () => ({
          entityType: 'ANIMAL_REPRODUCTION_EVENT',
          items: [
            {
              id: 'repro-event-1',
              animalUuid: 'animal-1',
              reproductionEventType: 'BIRTH',
              updatedAt: '2026-04-26T10:02:00.000Z',
            },
          ],
          nextCursor: {
            entityType: 'ANIMAL_REPRODUCTION_EVENT',
            cursorUpdatedAt: '2026-04-26T10:02:00.000Z',
            cursorId: 'repro-event-1',
            lastSuccessAt: '2026-04-26T10:03:00.000Z',
          },
          hasMore: false,
        } satisfies PullSyncResponse)),
      },
      metricsStore: metrics,
      offlineStatus: { isOnline: () => true },
      authSession: { getAccessToken: () => 'token' },
      now: () => '2026-04-26T10:03:00.000Z',
      random: () => 0,
      windowRef: window,
      supportedEntities: ['ANIMAL_REPRODUCTION_EVENT'],
    });

    await service.syncNow('manual');

    const outbox = await store.listOutbox();
    const snapshots = await store.listSnapshots('ANIMAL_REPRODUCTION_EVENT');
    const checkpoint = await store.getCheckpoint('ANIMAL_REPRODUCTION_EVENT');

    expect(outbox[0].status).toBe('acked');
    expect(snapshots).toEqual([
      expect.objectContaining({
        key: 'ANIMAL_REPRODUCTION_EVENT:repro-event-1',
        payload: expect.objectContaining({ reproductionEventType: 'BIRTH' }),
      }),
    ]);
    expect(checkpoint).toEqual({
      entityType: 'ANIMAL_REPRODUCTION_EVENT',
      cursorUpdatedAt: '2026-04-26T10:02:00.000Z',
      cursorId: 'repro-event-1',
      lastSuccessAt: '2026-04-26T10:03:00.000Z',
    });
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
    expect(metrics.snapshot()).toMatchObject({
      pending: 1,
      success: 0,
      failed: 1,
      syncing: false,
      lastSyncAt: '2026-04-26T10:06:00.000Z',
      lastMessage: 'La sincronización falló temporalmente. Se reintentará automáticamente.',
      manualRefreshRequired: false,
      runtime: {
        queue: {
          totalByStatus: {
            retry_scheduled: 1,
          },
        },
      },
    });
  });

  it('[smoke] should drain paged pull responses until hasMore=false and expose runtime pagination fields', async () => {
    const store = createStore();
    const metrics = new SyncMetricsStore();
    const callSequence: string[] = [];
    const pages = buildAnimalPullPages();
    let pullIndex = 0;

    await store.saveCheckpoint(buildCheckpoint('ANIMAL', 'animal-baseline', '2026-04-28T09:59:00.000Z'));

    const service = new SyncOrchestratorService({
      store,
      apiClient: {
        push: vi.fn(async () => buildPushResponse([])),
        pull: vi.fn(async ({ cursor }) => {
          callSequence.push(`pull:${cursor?.cursorId ?? 'empty'}`);
          return pages[pullIndex++]!;
        }),
      },
      metricsStore: metrics,
      offlineStatus: { isOnline: () => true },
      authSession: { getAccessToken: () => 'token' },
      now: () => '2026-04-28T10:03:00.000Z',
      random: () => 0,
      windowRef: window,
      supportedEntities: ['ANIMAL'],
    });

    await service.syncNow('manual');

    expect(callSequence).toEqual(['pull:animal-baseline', 'pull:animal-page-1', 'pull:animal-page-2']);
    await expectSnapshotIds(store, 'ANIMAL', ['animal-page-1', 'animal-page-2', 'animal-page-3']);
    await expectCheckpointCursor(store, 'ANIMAL', {
      cursorId: 'animal-page-3',
      cursorUpdatedAt: '2026-04-28T10:03:00.000Z',
      lastSuccessAt: '2026-04-28T10:03:00.000Z',
    });
    expectRuntimeCycle(metrics, {
      trigger: 'manual',
      attempt: 1,
      reconnectCount: 0,
      hasMoreObserved: true,
    });
  });

  it('[smoke] should retry a mixed batch once, keep duplicate operation ids idempotent, and expose batch composition', async () => {
    const store = createStore();
    const metrics = new SyncMetricsStore();
    const callSequence: string[] = [];
    let firstAttempt = true;
    let nowValue = '2026-04-28T10:06:00.000Z';

    const operations = [
      buildOperation({ entityType: 'USER', entityId: 'user-1', opType: 'STATUS_UPDATE', operationId: 'user-op-1', payload: { status: 'INACTIVE' } }),
      buildOperation({ entityType: 'ANIMAL', entityId: 'animal-1', opType: 'UPDATE', operationId: 'animal-op-1', payload: { tag: 'BO-2200' } }),
    ];

    for (const operation of operations) {
      await store.enqueueOperation(operation);
    }

    const push = vi.fn<SyncApiClient['push']>(async () => {
      callSequence.push('push');
      if (firstAttempt) {
        firstAttempt = false;
        throw new Error('temporary network failure');
      }

      return buildPushResponse([
        buildNoConflictResult('user-op-1', 'USER', 'user-1', 2),
        buildNoConflictResult('animal-op-1', 'ANIMAL', 'animal-1', 3),
      ]);
    });
    const pull = vi.fn<SyncApiClient['pull']>(async ({ entityType }) => {
      callSequence.push(`pull:${entityType}`);
      if (entityType === 'USER') {
        return {
          entityType,
          items: [{ id: 'user-1', status: 'INACTIVE', version: 2, updatedAt: '2026-04-28T10:06:00.000Z' }],
          nextCursor: { entityType, cursorId: 'user-1', cursorUpdatedAt: '2026-04-28T10:06:00.000Z', lastSuccessAt: '2026-04-28T10:06:00.000Z' },
          hasMore: false,
        } satisfies PullSyncResponse;
      }

      return {
        entityType,
        items: [{ uuid: 'animal-1', tag: 'BO-2200', version: 3, updatedAt: '2026-04-28T10:06:30.000Z' }],
        nextCursor: { entityType, cursorId: 'animal-1', cursorUpdatedAt: '2026-04-28T10:06:30.000Z', lastSuccessAt: '2026-04-28T10:06:30.000Z' },
        hasMore: false,
      } satisfies PullSyncResponse;
    });

    const service = new SyncOrchestratorService({
      store,
      apiClient: { push, pull },
      metricsStore: metrics,
      offlineStatus: { isOnline: () => true },
      authSession: { getAccessToken: () => 'token' },
      now: () => nowValue,
      random: () => 0,
      windowRef: window,
      supportedEntities: ['USER', 'ANIMAL'],
    });

    await service.syncNow('manual');
    nowValue = '2026-04-28T10:06:02.000Z';
    await service.syncNow('manual');

    const outbox = await store.listOutbox();
    expect(outbox.map((operation) => [operation.operationId, operation.status, operation.attempts])).toEqual([
      ['user-op-1', 'acked', 2],
      ['animal-op-1', 'acked', 2],
    ]);
    expect(callSequence).toEqual(['push', 'push', 'pull:USER', 'pull:ANIMAL']);
    expectBatchComposition(metrics, {
      'USER:STATUS_UPDATE': 1,
      'ANIMAL:UPDATE': 1,
    });
    expectRuntimeCycle(metrics, {
      attempt: 2,
      hasMoreObserved: false,
    });
  });

  it('[stress] should reconcile mixed USER/GANADERO/ANIMAL batches, replace pending snapshots and expose post-sync conflict feedback centrally', async () => {
    const store = createStore();
    const metrics = new SyncMetricsStore();
    const callSequence: string[] = [];
    const push = vi.fn<SyncApiClient['push']>(async () => {
      callSequence.push('push');

      return {
        results: [
          {
            operationId: 'operation-user-1',
            entityType: 'USER',
            entityId: 'user-1',
            classification: 'no_conflict',
            serverVersion: 2,
          },
          {
            operationId: 'operation-ganadero-1',
            entityType: 'GANADERO',
            entityId: 'ganadero-server-1',
            classification: 'no_conflict',
            serverVersion: 1,
          },
          {
            operationId: 'operation-animal-1',
            entityType: 'ANIMAL',
            entityId: 'animal-1',
            classification: 'version_conflict',
            serverVersion: 7,
            conflict: {
              entityId: 'animal-1',
              clientVersion: 1,
              serverVersion: 7,
              reason: 'Hay un conflicto remoto.',
              resolutionHint: 'manual_refresh',
            },
          },
        ],
      } satisfies PushSyncResponse;
    });
    const pull = vi.fn<SyncApiClient['pull']>(async ({ entityType, cursor }) => {
      callSequence.push(`pull:${entityType}:${cursor?.cursorId ?? 'empty'}`);

      if (entityType === 'USER') {
        return {
          entityType,
          items: [
            {
              id: 'user-1',
              status: 'INACTIVE',
              version: 2,
              updatedAt: '2026-04-26T10:11:00.000Z',
            },
          ],
          nextCursor: {
            entityType,
            cursorUpdatedAt: '2026-04-26T10:11:00.000Z',
            cursorId: 'user-1',
            lastSuccessAt: '2026-04-26T10:12:00.000Z',
          },
          hasMore: false,
        } satisfies PullSyncResponse;
      }

      if (entityType === 'GANADERO') {
        return {
          entityType,
          items: [
            {
              id: 'ganadero-server-1',
              businessIdentifier: 'BO-100',
              name: 'Estancia Norte',
              active: true,
              version: 1,
              updatedAt: '2026-04-26T10:11:30.000Z',
            },
          ],
          nextCursor: {
            entityType,
            cursorUpdatedAt: '2026-04-26T10:11:30.000Z',
            cursorId: 'ganadero-server-1',
            lastSuccessAt: '2026-04-26T10:12:00.000Z',
          },
          hasMore: false,
        } satisfies PullSyncResponse;
      }

      return {
        entityType,
        items: [
          {
            uuid: 'animal-1',
            tag: 'BO-900',
            version: 7,
            updatedAt: '2026-04-26T10:11:45.000Z',
          },
        ],
        nextCursor: {
          entityType,
          cursorUpdatedAt: '2026-04-26T10:11:45.000Z',
          cursorId: 'animal-1',
          lastSuccessAt: '2026-04-26T10:12:00.000Z',
        },
        hasMore: false,
      } satisfies PullSyncResponse;
    });

    await store.enqueueOperation({
      entityType: 'USER',
      entityId: 'user-1',
      opType: 'STATUS_UPDATE',
      payload: { status: 'INACTIVE' },
      baseVersion: 1,
      clientCreatedAt: '2026-04-26T10:10:00.000Z',
      clientUpdatedAt: '2026-04-26T10:10:00.000Z',
      operationId: 'operation-user-1',
    });
    await store.enqueueOperation({
      entityType: 'GANADERO',
      entityId: 'operation-ganadero-1',
      opType: 'CREATE',
      payload: { businessIdentifier: 'BO-100', name: 'Estancia Norte' },
      baseVersion: 0,
      clientCreatedAt: '2026-04-26T10:10:05.000Z',
      clientUpdatedAt: '2026-04-26T10:10:05.000Z',
      operationId: 'operation-ganadero-1',
    });
    await store.enqueueOperation({
      entityType: 'ANIMAL',
      entityId: 'animal-1',
      opType: 'UPDATE',
      payload: { tag: 'BO-900' },
      baseVersion: 1,
      clientCreatedAt: '2026-04-26T10:10:10.000Z',
      clientUpdatedAt: '2026-04-26T10:10:10.000Z',
      operationId: 'operation-animal-1',
    });
    await store.saveSnapshot({
      key: 'GANADERO:operation-ganadero-1',
      entityType: 'GANADERO',
      entityId: 'operation-ganadero-1',
      payload: {
        id: 'pending:operation-ganadero-1',
        businessIdentifier: 'BO-100',
        name: 'Estancia Norte',
        active: true,
        version: 0,
      },
      updatedAt: '2026-04-26T10:10:05.000Z',
      version: 0,
    });
    await store.saveCheckpoint({
      entityType: 'USER',
      cursorUpdatedAt: '2026-04-26T10:00:00.000Z',
      cursorId: 'cursor-user-1',
      lastSuccessAt: '2026-04-26T10:00:00.000Z',
    });
    await store.saveCheckpoint({
      entityType: 'GANADERO',
      cursorUpdatedAt: '2026-04-26T10:00:00.000Z',
      cursorId: 'cursor-ganadero-1',
      lastSuccessAt: '2026-04-26T10:00:00.000Z',
    });
    await store.saveCheckpoint({
      entityType: 'ANIMAL',
      cursorUpdatedAt: '2026-04-26T10:00:00.000Z',
      cursorId: 'cursor-animal-1',
      lastSuccessAt: '2026-04-26T10:00:00.000Z',
    });

    const service = new SyncOrchestratorService({
      store,
      apiClient: { push, pull },
      metricsStore: metrics,
      offlineStatus: { isOnline: () => true },
      authSession: { getAccessToken: () => 'token' },
      now: () => '2026-04-26T10:12:00.000Z',
      random: () => 0,
      windowRef: window,
      supportedEntities: ['USER', 'GANADERO', 'ANIMAL'],
    });

    await service.syncNow('manual');

    expect(callSequence).toEqual([
      'push',
      'pull:USER:cursor-user-1',
      'pull:GANADERO:cursor-ganadero-1',
      'pull:ANIMAL:cursor-animal-1',
    ]);
    expectPushBeforePull(callSequence);

    const outbox = await store.listOutbox();
    expect(outbox.map((operation) => operation.status)).toEqual(['acked', 'acked', 'conflict']);

    const ganaderoSnapshots = await store.listSnapshots('GANADERO');
    expect(ganaderoSnapshots).toHaveLength(1);
    expect(ganaderoSnapshots[0].entityId).toBe('ganadero-server-1');
    expect(ganaderoSnapshots[0].payload).toEqual(
      expect.objectContaining({
        id: 'ganadero-server-1',
        businessIdentifier: 'BO-100',
        name: 'Estancia Norte',
      })
    );

    expect(await store.getCheckpoint('USER')).toEqual({
      entityType: 'USER',
      cursorUpdatedAt: '2026-04-26T10:11:00.000Z',
      cursorId: 'user-1',
      lastSuccessAt: '2026-04-26T10:12:00.000Z',
    });
    expect(await store.getCheckpoint('GANADERO')).toEqual({
      entityType: 'GANADERO',
      cursorUpdatedAt: '2026-04-26T10:11:30.000Z',
      cursorId: 'ganadero-server-1',
      lastSuccessAt: '2026-04-26T10:12:00.000Z',
    });
    expect(await store.getCheckpoint('ANIMAL')).toEqual({
      entityType: 'ANIMAL',
      cursorUpdatedAt: '2026-04-26T10:11:45.000Z',
      cursorId: 'animal-1',
      lastSuccessAt: '2026-04-26T10:12:00.000Z',
    });
    expect(metrics.snapshot()).toMatchObject({
      pending: 0,
      success: 2,
      failed: 1,
      syncing: false,
      lastSyncAt: '2026-04-26T10:12:00.000Z',
      lastMessage: 'Hay un conflicto remoto.',
      manualRefreshRequired: true,
      runtime: {
        cycle: {
          attempt: 1,
          reconnectCount: 0,
          batchComposition: {
            'USER:STATUS_UPDATE': 1,
            'GANADERO:CREATE': 1,
            'ANIMAL:UPDATE': 1,
          },
        },
        conflicts: {
          open: 1,
          blockedOperations: 1,
        },
      },
    });
  });

  it('[stress] should fail with an explicit message after 10 paged pulls during reconnect', async () => {
    const store = createStore();
    const metrics = new SyncMetricsStore();
    let page = 0;

    await store.saveCheckpoint(buildCheckpoint('ANIMAL', 'overflow-baseline', '2026-04-28T09:50:00.000Z'));

    const pull = vi.fn<SyncApiClient['pull']>(async () => buildOverflowPullPage(++page));
    const service = new SyncOrchestratorService({
      store,
      apiClient: {
        push: vi.fn(async () => buildPushResponse([])),
        pull,
      },
      metricsStore: metrics,
      offlineStatus: { isOnline: () => true },
      authSession: { getAccessToken: () => 'token' },
      now: () => '2026-04-28T10:10:00.000Z',
      random: () => 0,
      windowRef: window,
      supportedEntities: ['ANIMAL'],
    });

    await expect(service.syncNow('reconnect')).rejects.toThrow(
      `Sync harness pagination overflow after ${SYNC_HARNESS_MAX_HAS_MORE_PAGES} pages for ANIMAL.`
    );
    expect(pull).toHaveBeenCalledTimes(SYNC_HARNESS_MAX_HAS_MORE_PAGES);
  });

  it('should publish trigger and phase timings for a finished cycle', async () => {
    const store = createStore();
    const metrics = new SyncMetricsStore();
    const nowValues = [
      '2026-04-26T10:03:00.000Z',
      '2026-04-26T10:03:01.000Z',
      '2026-04-26T10:03:03.000Z',
      '2026-04-26T10:03:04.000Z',
      '2026-04-26T10:03:06.000Z',
      '2026-04-26T10:03:06.000Z',
    ];
    let nowIndex = 0;

    const service = new SyncOrchestratorService({
      store,
      apiClient: {
        push: vi.fn(async () => ({ results: [] } satisfies PushSyncResponse)),
        pull: vi.fn(async () => ({
          entityType: 'ANIMAL',
          items: [],
          nextCursor: {
            entityType: 'ANIMAL',
            cursorUpdatedAt: '2026-04-26T10:03:06.000Z',
            cursorId: 'cursor-1',
            lastSuccessAt: '2026-04-26T10:03:06.000Z',
          },
          hasMore: false,
        } satisfies PullSyncResponse)),
      },
      metricsStore: metrics,
      offlineStatus: { isOnline: () => true },
      authSession: { getAccessToken: () => 'token' },
      now: () => nowValues[nowIndex++] ?? nowValues.at(-1)!,
      random: () => 0,
      windowRef: window,
      supportedEntities: ['ANIMAL'],
    });

    await service.syncNow('startup');

    expect(metrics.runtime().cycle).toMatchObject({
      trigger: 'startup',
      startedAt: '2026-04-26T10:03:00.000Z',
      finishedAt: '2026-04-26T10:03:06.000Z',
      totalDurationMs: 6000,
      pushDurationMs: null,
      pullDurationMs: 2000,
    });
  });

  it('should keep the cycle open while sync is still in progress and expose in-flight queue metrics', async () => {
    const store = createStore();
    const metrics = new SyncMetricsStore();
    let resolvePush!: (value: PushSyncResponse) => void;

    await store.enqueueOperation({
      entityType: 'ANIMAL',
      entityId: 'animal-1',
      opType: 'UPDATE',
      payload: { tag: 'BO-2000' },
      baseVersion: 0,
      clientCreatedAt: '2026-04-26T10:00:00.000Z',
      clientUpdatedAt: '2026-04-26T10:00:00.000Z',
      operationId: 'operation-1',
    });

    const service = new SyncOrchestratorService({
      store,
      apiClient: {
        push: vi.fn(
          () =>
            new Promise<PushSyncResponse>((resolve) => {
              resolvePush = resolve;
            })
        ),
        pull: vi.fn(async () => ({
          entityType: 'ANIMAL',
          items: [],
          nextCursor: {
            entityType: 'ANIMAL',
            cursorUpdatedAt: '2026-04-26T10:05:00.000Z',
            cursorId: 'cursor-1',
            lastSuccessAt: '2026-04-26T10:05:00.000Z',
          },
          hasMore: false,
        } satisfies PullSyncResponse)),
      },
      metricsStore: metrics,
      offlineStatus: { isOnline: () => true },
      authSession: { getAccessToken: () => 'token' },
      now: () => '2026-04-26T10:05:00.000Z',
      random: () => 0,
      windowRef: window,
      supportedEntities: ['ANIMAL'],
    });

    const syncPromise = service.syncNow('manual');
    await vi.waitFor(() => expect(metrics.runtime().queue.totalByStatus.in_flight).toBe(1));

    expect(metrics.runtime().cycle.trigger).toBe('manual');
    expect(metrics.runtime().cycle.finishedAt).toBeNull();

    resolvePush({
      results: [
        {
          operationId: 'operation-1',
          entityType: 'ANIMAL',
          entityId: 'animal-1',
          classification: 'no_conflict',
          serverVersion: 1,
        },
      ],
    });
    await syncPromise;
  });

  it('should push and pull ANIMAL_EVENT operations without duplicating replayed snapshots', async () => {
    const store = createStore();
    const metrics = new SyncMetricsStore();
    const push = vi.fn<SyncApiClient['push']>(async () => ({
      results: [
        {
          operationId: 'event-operation-1',
          entityType: 'ANIMAL_EVENT',
          entityId: 'event-operation-1',
          classification: 'no_conflict',
          serverVersion: 0,
        },
      ],
    }));
    const pull = vi.fn<SyncApiClient['pull']>(async () => ({
      entityType: 'ANIMAL_EVENT',
      items: [
        {
          id: 'event-operation-1',
          animalUuid: 'animal-uuid-1',
          type: 'LOST',
          occurredAt: '2026-04-26T10:02:00.000Z',
          createdAt: '2026-04-26T10:02:01.000Z',
          updatedAt: '2026-04-26T10:02:01.000Z',
          performedByUserId: 'user-1',
          sourceChannel: 'OFFLINE',
          operationId: 'event-operation-1',
          metadata: { reasonCode: 'NOT_FOUND' },
        },
      ],
      nextCursor: {
        entityType: 'ANIMAL_EVENT',
        cursorUpdatedAt: '2026-04-26T10:02:01.000Z',
        cursorId: 'event-operation-1',
        lastSuccessAt: '2026-04-26T10:03:00.000Z',
      },
      hasMore: false,
    }));

    await store.enqueueOperation({
      entityType: 'ANIMAL_EVENT',
      entityId: 'event-operation-1',
      opType: 'CREATE',
      payload: {
        animalUuid: 'animal-uuid-1',
        type: 'LOST',
        occurredAt: '2026-04-26T10:02:00.000Z',
        performedByUserId: 'user-1',
        sourceChannel: 'OFFLINE',
        operationId: 'event-operation-1',
        metadata: { reasonCode: 'NOT_FOUND' },
      },
      clientCreatedAt: '2026-04-26T10:02:00.000Z',
      clientUpdatedAt: '2026-04-26T10:02:00.000Z',
      operationId: 'event-operation-1',
    });

    const service = new SyncOrchestratorService({
      store,
      apiClient: { push, pull },
      metricsStore: metrics,
      offlineStatus: { isOnline: () => true },
      authSession: { getAccessToken: () => 'token' },
      now: () => '2026-04-26T10:03:00.000Z',
      random: () => 0,
      windowRef: window,
      supportedEntities: ['ANIMAL_EVENT'],
    });

    await service.syncNow('manual');
    await service.syncNow('manual');

    const snapshots = await store.listSnapshots('ANIMAL_EVENT');
    const outbox = await store.listOutbox();

    expect(push).toHaveBeenCalledTimes(1);
    expect(pull).toHaveBeenCalledTimes(2);
    expect(outbox[0].status).toBe('acked');
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].entityId).toBe('event-operation-1');
  });

  it('should push and pull ANIMAL_HEALTH_EVENT operations without duplicating replayed snapshots', async () => {
    const store = createStore();
    const metrics = new SyncMetricsStore();
    const push = vi.fn<SyncApiClient['push']>(async () => ({
      results: [
        {
          operationId: 'health-operation-1',
          entityType: 'ANIMAL_HEALTH_EVENT',
          entityId: 'health-operation-1',
          classification: 'no_conflict',
          serverVersion: 0,
        },
      ],
    }));
    const pull = vi.fn<SyncApiClient['pull']>(async () => ({
      entityType: 'ANIMAL_HEALTH_EVENT',
      items: [
        {
          id: 'health-operation-1',
          animalUuid: 'animal-uuid-1',
          healthEventType: 'VACCINATION',
          occurredAt: '2026-04-26T10:02:00.000Z',
          createdAt: '2026-04-26T10:02:01.000Z',
          updatedAt: '2026-04-26T10:02:01.000Z',
          performedByUserId: 'user-1',
          sourceChannel: 'OFFLINE',
          operationId: 'health-operation-1',
          metadata: { productName: 'Brucelosis' },
        },
      ],
      nextCursor: {
        entityType: 'ANIMAL_HEALTH_EVENT',
        cursorUpdatedAt: '2026-04-26T10:02:01.000Z',
        cursorId: 'health-operation-1',
        lastSuccessAt: '2026-04-26T10:03:00.000Z',
      },
      hasMore: false,
    }));

    await store.enqueueOperation({
      entityType: 'ANIMAL_HEALTH_EVENT',
      entityId: 'health-operation-1',
      opType: 'CREATE',
      payload: {
        animalUuid: 'animal-uuid-1',
        healthEventType: 'VACCINATION',
        occurredAt: '2026-04-26T10:02:00.000Z',
        performedByUserId: 'user-1',
        sourceChannel: 'OFFLINE',
        operationId: 'health-operation-1',
        metadata: { productName: 'Brucelosis' },
      },
      clientCreatedAt: '2026-04-26T10:02:00.000Z',
      clientUpdatedAt: '2026-04-26T10:02:00.000Z',
      operationId: 'health-operation-1',
    });

    const service = new SyncOrchestratorService({
      store,
      apiClient: { push, pull },
      metricsStore: metrics,
      offlineStatus: { isOnline: () => true },
      authSession: { getAccessToken: () => 'token' },
      now: () => '2026-04-26T10:03:00.000Z',
      random: () => 0,
      windowRef: window,
      supportedEntities: ['ANIMAL_HEALTH_EVENT'],
    });

    await service.syncNow('manual');
    await service.syncNow('manual');

    const snapshots = await store.listSnapshots('ANIMAL_HEALTH_EVENT');
    const outbox = await store.listOutbox();

    expect(push).toHaveBeenCalledTimes(1);
    expect(pull).toHaveBeenCalledTimes(2);
    expect(outbox[0].status).toBe('acked');
    expect(snapshots).toHaveLength(1);
    expect(snapshots[0].entityId).toBe('health-operation-1');
  });

  it('should persist v2 conflict metadata from push responses and refresh the shared conflicts channel', async () => {
    const store = createStore();
    const metrics = new SyncMetricsStore();
    const dispatchEvent = vi.fn();

    await store.enqueueOperation({
      entityType: 'ANIMAL',
      entityId: 'animal-conflict-1',
      opType: 'UPDATE',
      payload: { tag: 'BO-9002' },
      baseVersion: 1,
      clientCreatedAt: '2026-04-28T10:00:00.000Z',
      clientUpdatedAt: '2026-04-28T10:00:00.000Z',
      operationId: 'animal-conflict-op-1',
    });

    const service = new SyncOrchestratorService({
      store,
      apiClient: {
        push: vi.fn(async () => ({
          results: [
            {
              operationId: 'animal-conflict-op-1',
              entityType: 'ANIMAL',
              entityId: 'animal-conflict-1',
              classification: 'validation_error',
              conflict: {
                entityId: 'animal-conflict-1',
                clientVersion: 1,
                serverVersion: 2,
                serverStateVersion: 2,
                reason: 'ANIMAL_OWNER_GANADERO_ID_REQUIRED',
                resolutionHint: 'manual_resolution',
                policyKey: 'offline-conflict-resolution/v2/ANIMAL/UPDATE',
                allowedActions: ['accept_server', 'retry_local', 'discard_local'],
                policy: {
                  entityType: 'ANIMAL',
                  opType: 'UPDATE',
                  allowedActions: ['accept_server', 'retry_local', 'discard_local'],
                  policyKey: 'offline-conflict-resolution/v2/ANIMAL/UPDATE',
                  policyVersion: 'v2',
                },
                diffFields: [{ path: 'tag', localValue: 'BO-9002', serverValue: 'BO-9001', severity: 'medium' }],
              },
            },
          ],
        } satisfies PushSyncResponse)),
        pull: vi.fn(async () => ({
          entityType: 'ANIMAL',
          items: [],
          nextCursor: {
            entityType: 'ANIMAL',
            cursorUpdatedAt: '2026-04-28T10:01:00.000Z',
            cursorId: 'animal-cursor',
            lastSuccessAt: '2026-04-28T10:01:00.000Z',
          },
          hasMore: false,
        } satisfies PullSyncResponse)),
      },
      metricsStore: metrics,
      offlineStatus: { isOnline: () => true },
      authSession: { getAccessToken: () => 'token' },
      now: () => '2026-04-28T10:01:00.000Z',
      random: () => 0,
      windowRef: { addEventListener: vi.fn(), dispatchEvent } as never,
      supportedEntities: ['ANIMAL'],
    });

    await service.syncNow('manual');

    const operation = await store.getOperation('animal-conflict-op-1');
    expect(operation?.status).toBe('conflict');
    expect(operation?.conflict?.policy?.policyKey).toBe('offline-conflict-resolution/v2/ANIMAL/UPDATE');
    expect(operation?.conflict?.diffFields).toHaveLength(1);
    expect(dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'sync-conflicts:refresh' }));
  });

  it('should keep the canonical animal uuid snapshot key untouched when an ANIMAL CREATE is acknowledged with the same entityId', async () => {
    const store = createStore();
    const metrics = new SyncMetricsStore();

    await store.enqueueOperation({
      entityType: 'ANIMAL',
      entityId: 'animal-uuid-create-1',
      opType: 'CREATE',
      payload: {
        uuid: 'animal-uuid-create-1',
        ownerGanaderoId: 'ganadero-uuid-1',
        arete: 'AR-900',
      },
      baseVersion: 0,
      clientCreatedAt: '2026-04-26T10:15:00.000Z',
      clientUpdatedAt: '2026-04-26T10:15:00.000Z',
      operationId: 'animal-create-op-1',
    });
    await store.saveSnapshot({
      key: 'ANIMAL:animal-uuid-create-1',
      entityType: 'ANIMAL',
      entityId: 'animal-uuid-create-1',
      payload: {
        uuid: 'animal-uuid-create-1',
        ownerGanaderoId: 'ganadero-uuid-1',
        arete: 'AR-900',
        version: 0,
        updatedAt: '2026-04-26T10:15:00.000Z',
      },
      updatedAt: '2026-04-26T10:15:00.000Z',
      version: 0,
    });

    const service = new SyncOrchestratorService({
      store,
      apiClient: {
        push: vi.fn(async () => ({
          results: [
            {
              operationId: 'animal-create-op-1',
              entityType: 'ANIMAL',
              entityId: 'animal-uuid-create-1',
              classification: 'no_conflict',
              serverVersion: 0,
            },
          ],
        } satisfies PushSyncResponse)),
        pull: vi.fn(async () => ({
          entityType: 'ANIMAL',
          items: [
            {
              uuid: 'animal-uuid-create-1',
              ownerGanaderoId: 'ganadero-uuid-1',
              arete: 'AR-900',
              version: 0,
              updatedAt: '2026-04-26T10:16:00.000Z',
            },
          ],
          nextCursor: {
            entityType: 'ANIMAL',
            cursorUpdatedAt: '2026-04-26T10:16:00.000Z',
            cursorId: 'animal-uuid-create-1',
            lastSuccessAt: '2026-04-26T10:17:00.000Z',
          },
          hasMore: false,
        } satisfies PullSyncResponse)),
      },
      metricsStore: metrics,
      offlineStatus: { isOnline: () => true },
      authSession: { getAccessToken: () => 'token' },
      now: () => '2026-04-26T10:17:00.000Z',
      random: () => 0,
      windowRef: window,
      supportedEntities: ['ANIMAL'],
    });

    await service.syncNow('manual');

    const outbox = await store.listOutbox();
    expect(outbox[0].status).toBe('acked');
    await expect(store.listSnapshots('ANIMAL')).resolves.toEqual([
      expect.objectContaining({
        key: 'ANIMAL:animal-uuid-create-1',
        entityId: 'animal-uuid-create-1',
        payload: expect.objectContaining({ uuid: 'animal-uuid-create-1', arete: 'AR-900' }),
      }),
    ]);
  });

  it('should retain local image binary data when image sync ends in conflict for badge visibility and retry', async () => {
    const store = createStore();
    const metrics = new SyncMetricsStore();
    const imageBinaryStore = {
      getBase64Data: vi.fn(async () => globalThis.btoa('image')),
      purgeBinary: vi.fn(async () => undefined),
    };

    await store.enqueueOperation({
      entityType: 'ANIMAL_IMAGE',
      entityId: 'image-conflict-1',
      opType: 'CREATE',
      payload: {
        animalUuid: 'animal-1',
        operationId: 'image-conflict-op-1',
        sourceChannel: 'OFFLINE',
        fileName: 'vaca.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 5,
        checksumSha256: 'a'.repeat(64),
        capturedAt: '2026-04-29T10:00:00.000Z',
        binaryRef: 'image-conflict-op-1',
      },
      clientCreatedAt: '2026-04-29T10:00:00.000Z',
      clientUpdatedAt: '2026-04-29T10:00:00.000Z',
      operationId: 'image-conflict-op-1',
    });

    const service = new SyncOrchestratorService({
      store,
      imageBinaryStore: imageBinaryStore as never,
      apiClient: {
        push: vi.fn(async () => ({
          results: [
            {
              operationId: 'image-conflict-op-1',
              entityType: 'ANIMAL_IMAGE',
              entityId: 'image-conflict-1',
              classification: 'version_conflict',
              conflict: { reason: 'Imagen duplicada', resolutionHint: 'manual_resolution', serverVersion: 2 },
            },
          ],
        } satisfies PushSyncResponse)),
        pull: vi.fn(async () => ({
          entityType: 'ANIMAL_IMAGE',
          items: [],
          nextCursor: {
            entityType: 'ANIMAL_IMAGE',
            cursorUpdatedAt: '2026-04-29T10:01:00.000Z',
            cursorId: 'image-cursor',
            lastSuccessAt: '2026-04-29T10:01:00.000Z',
          },
          hasMore: false,
        } satisfies PullSyncResponse)),
      },
      metricsStore: metrics,
      offlineStatus: { isOnline: () => true },
      authSession: { getAccessToken: () => 'token' },
      now: () => '2026-04-29T10:01:00.000Z',
      random: () => 0,
      windowRef: window,
      supportedEntities: ['ANIMAL_IMAGE'],
    });

    await service.syncNow('manual');

    const operation = await store.getOperation('image-conflict-op-1');
    expect(operation?.status).toBe('conflict');
    expect(imageBinaryStore.getBase64Data).toHaveBeenCalledWith('image-conflict-op-1');
    expect(imageBinaryStore.purgeBinary).not.toHaveBeenCalled();
  });
});
