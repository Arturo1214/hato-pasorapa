import { TestBed } from '@angular/core/testing';
import { InMemoryOfflinePersistenceAdapter } from '../../../../core/offline/offline-store.migrations';
import { OfflineStoreService } from '../../../../core/offline/offline-store.service';
import { SYNC_CONFLICTS_REFRESH_EVENT } from '../../../../core/offline/sync-orchestrator.service';
import { AdminConflictResolutionStore } from './admin-conflict-resolution.store';

describe('AdminConflictResolutionStore', () => {
  let offlineStore: OfflineStoreService;
  let store: AdminConflictResolutionStore;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [AdminConflictResolutionStore] });
    offlineStore = new OfflineStoreService(new InMemoryOfflinePersistenceAdapter(), {
      generateId: () => 'generated-op',
      now: () => '2026-04-28T10:00:00.000Z',
    });
    store = TestBed.inject(AdminConflictResolutionStore);
  });

  it('should list local conflicts with server policy and diff metadata on startup', async () => {
    await offlineStore.enqueueOperation({
      operationId: 'op-animal-1',
      entityType: 'ANIMAL',
      entityId: 'animal-1',
      opType: 'UPDATE',
      payload: { tag: 'BO-1002' },
      baseVersion: 1,
      clientCreatedAt: '2026-04-28T09:59:00.000Z',
      clientUpdatedAt: '2026-04-28T09:59:00.000Z',
    });
    await offlineStore.markConflict(
      'op-animal-1',
      { code: 'VERSION_CONFLICT', message: 'Hay un conflicto remoto.' },
      { serverVersion: 3, reason: 'Hay un conflicto remoto.' }
    );

    store.configureForTesting({
      offlineStore,
      apiClient: {
        listConflicts: vi.fn(async (): Promise<any> => [
          {
            operationId: 'op-animal-1',
            entityType: 'ANIMAL' as const,
            entityId: 'animal-1',
            opType: 'UPDATE' as const,
            classification: 'version_conflict' as const,
            reason: 'Hay un conflicto remoto.',
            localPayload: { tag: 'BO-1002' },
            clientUpdatedAt: '2026-04-28T09:59:00.000Z',
            serverVersion: 3,
            serverState: { uuid: 'animal-1', tag: 'BO-1001', updatedAt: '2026-04-28T09:58:00.000Z', version: 3 },
            diffFields: [{ path: 'tag', localValue: 'BO-1002', serverValue: 'BO-1001', severity: 'medium' as const }],
            policy: {
              entityType: 'ANIMAL' as const,
              opType: 'UPDATE' as const,
              allowedActions: ['accept_server', 'retry_local', 'discard_local'],
              uxHint: 'Compará diff campo por campo.',
              policyKey: 'offline-conflict-resolution/v2/ANIMAL/UPDATE',
              policyVersion: 'v2',
            },
            allowedActions: ['accept_server', 'retry_local', 'discard_local'],
            auditTrail: [{ eventType: 'DETECTED' as const, reason: 'Hay un conflicto remoto.', createdAt: '2026-04-28T10:00:00.000Z' }],
          },
        ]),
        resolveConflict: vi.fn(),
      },
      now: () => '2026-04-28T10:00:00.000Z',
      onlineStatus: { isOnline: () => true },
      windowRef: window,
    });

    await store.initialize();

    expect(store.unresolvedCount()).toBe(1);
    expect(store.selectedConflict()?.policy?.policyKey).toBe('offline-conflict-resolution/v2/ANIMAL/UPDATE');
    expect(store.selectedConflict()?.diffFields).toHaveLength(1);
  });

  it('should resolve accept_server by acking the outbox and replacing the local snapshot', async () => {
    await offlineStore.enqueueOperation({
      operationId: 'op-animal-2',
      entityType: 'ANIMAL',
      entityId: 'animal-2',
      opType: 'UPDATE',
      payload: { tag: 'BO-2002' },
      baseVersion: 1,
      clientCreatedAt: '2026-04-28T09:59:00.000Z',
      clientUpdatedAt: '2026-04-28T09:59:00.000Z',
    });
    await offlineStore.markConflict('op-animal-2', { code: 'VERSION_CONFLICT', message: 'Hay un conflicto remoto.' }, { serverVersion: 4, reason: 'Hay un conflicto remoto.' });

    const apiClient = {
      listConflicts: vi.fn(async (): Promise<any> => [
        {
          operationId: 'op-animal-2',
          entityType: 'ANIMAL' as const,
          entityId: 'animal-2',
          opType: 'UPDATE' as const,
          classification: 'version_conflict' as const,
          reason: 'Hay un conflicto remoto.',
          localPayload: { tag: 'BO-2002' },
          clientUpdatedAt: '2026-04-28T09:59:00.000Z',
          serverVersion: 4,
          serverState: { uuid: 'animal-2', tag: 'BO-2001', updatedAt: '2026-04-28T10:00:00.000Z', version: 4 },
          diffFields: [],
          policy: {
            entityType: 'ANIMAL' as const,
            opType: 'UPDATE' as const,
            allowedActions: ['accept_server', 'retry_local', 'discard_local'],
            policyKey: 'offline-conflict-resolution/v2/ANIMAL/UPDATE',
            policyVersion: 'v2',
          },
          allowedActions: ['accept_server', 'retry_local', 'discard_local'],
          auditTrail: [],
        },
      ]),
      resolveConflict: vi.fn(async (): Promise<any> => ({
        operationId: 'op-animal-2',
        status: 'resolved' as const,
        resultVersion: 'v2',
        nextLocalStatus: 'acked' as const,
        entityId: 'animal-2',
        serverVersion: 4,
        serverState: { uuid: 'animal-2', tag: 'BO-2001', updatedAt: '2026-04-28T10:00:00.000Z', version: 4 },
      })),
    };

    store.configureForTesting({ offlineStore, apiClient, now: () => '2026-04-28T10:00:00.000Z', onlineStatus: { isOnline: () => true }, windowRef: window });

    await store.initialize();
    await store.resolveSelected('accept_server', 'Aceptamos el snapshot remoto.');

    expect((await offlineStore.getOperation('op-animal-2'))?.status).toBe('acked');
    expect((await offlineStore.getSnapshot('ANIMAL', 'animal-2'))?.payload).toEqual(
      expect.objectContaining({ uuid: 'animal-2', tag: 'BO-2001' })
    );
  });

  it('should rebuild after the shared conflict refresh event', async () => {
    const apiClient = {
      listConflicts: vi.fn(async (): Promise<any> => []),
      resolveConflict: vi.fn(),
    };
    store.configureForTesting({ offlineStore, apiClient, now: () => '2026-04-28T10:00:00.000Z', onlineStatus: { isOnline: () => true }, windowRef: window });

    await store.initialize();
    window.dispatchEvent(new CustomEvent(SYNC_CONFLICTS_REFRESH_EVENT));
    await vi.waitFor(() => expect(apiClient.listConflicts).toHaveBeenCalledTimes(2));
  });
});
