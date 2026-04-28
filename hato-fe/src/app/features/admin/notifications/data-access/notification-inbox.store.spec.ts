import { InMemoryOfflinePersistenceAdapter } from '../../../../core/offline/offline-store.migrations';
import { OfflineStoreService } from '../../../../core/offline/offline-store.service';
import { NOTIFICATIONS_REFRESH_EVENT } from '../../../../core/offline/sync-orchestrator.service';
import { NotificationInboxStore } from './notification-inbox.store';

describe('NotificationInboxStore', () => {
  const createOfflineStore = (adapter = new InMemoryOfflinePersistenceAdapter()) =>
    new OfflineStoreService(adapter, {
      generateId: () => 'generated-op',
      now: () => '2026-04-26T10:00:00.000Z',
    });

  it('should rebuild on startup and after the shared notifications refresh event', async () => {
    const offlineStore = createOfflineStore();
    await offlineStore.saveSnapshot({
      key: 'NOTIFICATION:notification-a',
      entityType: 'NOTIFICATION',
      entityId: 'notification-a',
      updatedAt: '2026-04-26T10:00:00.000Z',
      payload: {
        id: 'notification-a',
        title: 'Aviso A',
        body: 'Primero',
        createdByUserId: 'admin-1',
        publishedAt: '2026-04-26T10:00:00.000Z',
        updatedAt: '2026-04-26T10:00:00.000Z',
      },
    });

    const store = new NotificationInboxStore();
    store.configureForTesting({ offlineStore, windowRef: window });
    await store.initialize();

    expect(store.unreadCount()).toBe(1);

    await offlineStore.saveSnapshot({
      key: 'NOTIFICATION:notification-b',
      entityType: 'NOTIFICATION',
      entityId: 'notification-b',
      updatedAt: '2026-04-26T11:00:00.000Z',
      payload: {
        id: 'notification-b',
        title: 'Aviso B',
        body: 'Segundo',
        createdByUserId: 'admin-1',
        publishedAt: '2026-04-26T11:00:00.000Z',
        updatedAt: '2026-04-26T11:00:00.000Z',
      },
    });

    window.dispatchEvent(new CustomEvent(NOTIFICATIONS_REFRESH_EVENT));
    await vi.waitFor(() => expect(store.unreadCount()).toBe(2));
    expect(store.items()[0].id).toBe('notification-b');
  });

  it('should keep local read-state on the same device but isolate it on a second device', async () => {
    const adapter = new InMemoryOfflinePersistenceAdapter();
    const offlineStore = createOfflineStore(adapter);
    await offlineStore.saveSnapshot({
      key: 'NOTIFICATION:notification-a',
      entityType: 'NOTIFICATION',
      entityId: 'notification-a',
      updatedAt: '2026-04-26T10:00:00.000Z',
      payload: {
        id: 'notification-a',
        title: 'Aviso A',
        body: 'Primero',
        createdByUserId: 'admin-1',
        publishedAt: '2026-04-26T10:00:00.000Z',
        updatedAt: '2026-04-26T10:00:00.000Z',
      },
    });
    await offlineStore.saveSnapshot({
      key: 'NOTIFICATION:notification-b',
      entityType: 'NOTIFICATION',
      entityId: 'notification-b',
      updatedAt: '2026-04-26T11:00:00.000Z',
      payload: {
        id: 'notification-b',
        title: 'Aviso B',
        body: 'Segundo',
        createdByUserId: 'admin-1',
        publishedAt: '2026-04-26T11:00:00.000Z',
        updatedAt: '2026-04-26T11:00:00.000Z',
      },
    });

    const sameDeviceStore = new NotificationInboxStore();
    sameDeviceStore.configureForTesting({ offlineStore, windowRef: window });
    await sameDeviceStore.initialize();
    await sameDeviceStore.markAsRead('notification-a');

    expect(sameDeviceStore.unreadCount()).toBe(1);

    const restartedSameDevice = new NotificationInboxStore();
    restartedSameDevice.configureForTesting({ offlineStore: createOfflineStore(adapter), windowRef: window });
    await restartedSameDevice.initialize();
    expect(restartedSameDevice.items().find((item) => item.id === 'notification-a')?.read).toBe(true);

    const secondDevice = new NotificationInboxStore();
    const secondDeviceStore = createOfflineStore();
    await secondDeviceStore.saveSnapshot({
      key: 'NOTIFICATION:notification-a',
      entityType: 'NOTIFICATION',
      entityId: 'notification-a',
      updatedAt: '2026-04-26T10:00:00.000Z',
      payload: {
        id: 'notification-a',
        title: 'Aviso A',
        body: 'Primero',
        createdByUserId: 'admin-1',
        publishedAt: '2026-04-26T10:00:00.000Z',
        updatedAt: '2026-04-26T10:00:00.000Z',
      },
    });
    await secondDeviceStore.saveSnapshot({
      key: 'NOTIFICATION:notification-b',
      entityType: 'NOTIFICATION',
      entityId: 'notification-b',
      updatedAt: '2026-04-26T11:00:00.000Z',
      payload: {
        id: 'notification-b',
        title: 'Aviso B',
        body: 'Segundo',
        createdByUserId: 'admin-1',
        publishedAt: '2026-04-26T11:00:00.000Z',
        updatedAt: '2026-04-26T11:00:00.000Z',
      },
    });
    secondDevice.configureForTesting({ offlineStore: secondDeviceStore, windowRef: window });
    await secondDevice.initialize();

    expect(secondDevice.unreadCount()).toBe(2);
  });
});
