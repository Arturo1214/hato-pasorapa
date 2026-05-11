import { TestBed } from '@angular/core/testing';
import { AuthService } from '../../../../core/auth/data-access/auth.service';
import { InMemoryOfflinePersistenceAdapter } from '../../../../core/offline/offline-store.migrations';
import { OfflineStoreService } from '../../../../core/offline/offline-store.service';
import { CALENDAR_ALERTS_REFRESH_EVENT } from '../../../../core/offline/sync-orchestrator.service';
import { BrowserNotificationGateway } from './browser-notification.gateway';
import { CalendarAlertsStore } from './calendar-alerts.store';

describe('CalendarAlertsStore', () => {
  let offlineStore: OfflineStoreService;
  let store: CalendarAlertsStore;
  let gateway: BrowserNotificationGateway;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        CalendarAlertsStore,
        BrowserNotificationGateway,
        { provide: AuthService, useValue: { currentUser: () => ({ id: 'admin-1', ganaderoId: null, role: 'ADMIN', status: 'ACTIVE' }) } },
      ],
    });
    offlineStore = new OfflineStoreService(new InMemoryOfflinePersistenceAdapter());
    store = TestBed.inject(CalendarAlertsStore);
    gateway = TestBed.inject(BrowserNotificationGateway);
    gateway.configureForTesting({
      now: () => '2026-04-27T10:00:00.000Z',
      notificationApi: {
        permission: 'default',
        requestPermission: vi.fn(async (): Promise<NotificationPermission> => 'default'),
        create: vi.fn(),
      },
    });
    store.configureForTesting({ offlineStore, gateway, now: () => '2026-04-27T10:00:00.000Z', windowRef: window });
  });

  it('should rebuild on startup manual prefs and post-sync, compute badges and persist cache', async () => {
    await seedSnapshots(offlineStore, '2026-04-28T09:00:00.000Z');

    await store.initialize();
    expect(store.totalPending()).toBe(1);
    expect(store.badgeSeverity()).toBe('upcoming');

    await store.setHorizonDays(7);
    expect(store.preferences().horizonDays).toBe(7);

    await store.rebuild('manual');
    expect(store.lastReason()).toBe('manual');

    await offlineStore.saveSnapshot({
      key: 'ANIMAL_EVENT:event-1',
      entityType: 'ANIMAL_EVENT',
      entityId: 'event-1',
      updatedAt: '2026-04-27T10:00:00.000Z',
      payload: {
        id: 'event-1',
        animalUuid: 'animal-1',
        type: 'OBSERVATION',
        occurredAt: '2026-04-27T12:00:00.000Z',
        metadata: {},
      },
    });
    window.dispatchEvent(new CustomEvent(CALENDAR_ALERTS_REFRESH_EVENT));

    await vi.waitFor(() => expect(store.counts().byStatus.due_today).toBe(1));
    const persisted = await offlineStore.getCalendarAlertsState();
    expect(persisted?.counts.total).toBe(2);
  });

  it('should trigger stale guard after fifteen minutes and expose overdue highest severity badges', async () => {
    await seedSnapshots(offlineStore, '2026-04-25T09:00:00.000Z');
    await store.initialize();

    store.configureForTesting({ offlineStore, gateway, now: () => '2026-04-27T10:20:01.000Z', windowRef: window });
    await store.ensureFresh();

    expect(store.stale()).toBe(false);
    expect(store.badgeSeverity()).toBe('overdue');
    expect(store.totalPending()).toBe(1);
  });

  it('should keep reminder preferences isolated on a second device', async () => {
    const firstDeviceStore = new OfflineStoreService(new InMemoryOfflinePersistenceAdapter());
    const secondDeviceStore = new OfflineStoreService(new InMemoryOfflinePersistenceAdapter());
    const firstDeviceGateway = new BrowserNotificationGateway();
    const secondDeviceGateway = new BrowserNotificationGateway();
    const firstDeviceCalendarStore = new CalendarAlertsStore();
    const secondDeviceCalendarStore = new CalendarAlertsStore();

    firstDeviceGateway.configureForTesting({
      now: () => '2026-04-27T10:00:00.000Z',
      notificationApi: {
        permission: 'default',
        requestPermission: vi.fn(async (): Promise<NotificationPermission> => 'default'),
        create: vi.fn(),
      },
    });
    secondDeviceGateway.configureForTesting({
      now: () => '2026-04-27T10:00:00.000Z',
      notificationApi: {
        permission: 'default',
        requestPermission: vi.fn(async (): Promise<NotificationPermission> => 'default'),
        create: vi.fn(),
      },
    });

    firstDeviceCalendarStore.configureForTesting({
      offlineStore: firstDeviceStore,
      gateway: firstDeviceGateway,
      now: () => '2026-04-27T10:00:00.000Z',
      windowRef: window,
    });
    secondDeviceCalendarStore.configureForTesting({
      offlineStore: secondDeviceStore,
      gateway: secondDeviceGateway,
      now: () => '2026-04-27T10:00:00.000Z',
      windowRef: window,
    });

    await seedSnapshots(firstDeviceStore, '2026-04-28T09:00:00.000Z');
    await seedSnapshots(secondDeviceStore, '2026-04-28T09:00:00.000Z');

    await firstDeviceCalendarStore.initialize();
    await firstDeviceCalendarStore.setHorizonDays(7);
    await firstDeviceCalendarStore.setNotificationsEnabled(true);
    await firstDeviceCalendarStore.snooze(6);

    await secondDeviceCalendarStore.initialize();

    expect(firstDeviceCalendarStore.preferences().horizonDays).toBe(7);
    expect(firstDeviceCalendarStore.preferences().notificationsEnabled).toBe(true);
    expect(firstDeviceCalendarStore.preferences().snoozedUntil).toBe('2026-04-27T16:00:00.000Z');

    expect(secondDeviceCalendarStore.preferences()).toEqual({
      horizonDays: 3,
      notificationsEnabled: false,
      snoozedUntil: null,
    });
    expect(secondDeviceCalendarStore.totalPending()).toBe(1);

    const firstDevicePersisted = await firstDeviceStore.getCalendarAlertsState();
    const secondDevicePersisted = await secondDeviceStore.getCalendarAlertsState();

    expect(firstDevicePersisted?.preferences).toEqual({
      horizonDays: 7,
      notificationsEnabled: true,
      snoozedUntil: '2026-04-27T16:00:00.000Z',
    });
    expect(secondDevicePersisted?.preferences).toEqual({
      horizonDays: 3,
      notificationsEnabled: false,
      snoozedUntil: null,
    });
  });

  it('should filter local calendar snapshots to the authenticated ganadero owner', async () => {
    await seedSnapshots(offlineStore, '2026-04-28T09:00:00.000Z');
    await offlineStore.saveSnapshot({
      key: 'ANIMAL:animal-2',
      entityType: 'ANIMAL',
      entityId: 'animal-2',
      updatedAt: '2026-04-27T08:00:00.000Z',
      payload: {
        uuid: 'animal-2',
        ownerGanaderoId: 'gan-2',
        arete: 'BO-002',
        category: 'COW',
        active: true,
        admissionDate: '2026-04-01T00:00:00.000Z',
        weightKg: 420,
        createdAt: '2026-04-01T00:00:00.000Z',
        updatedAt: '2026-04-27T08:00:00.000Z',
        version: 1,
        lastSyncedAt: null,
      },
    });
    await offlineStore.saveSnapshot({
      key: 'ANIMAL_HEALTH_EVENT:health-2',
      entityType: 'ANIMAL_HEALTH_EVENT',
      entityId: 'health-2',
      updatedAt: '2026-04-27T08:00:00.000Z',
      payload: {
        id: 'health-2',
        animalUuid: 'animal-2',
        healthEventType: 'VACCINATION',
        notes: 'No debe verse',
        metadata: { nextDueAt: '2026-04-28T09:00:00.000Z' },
      },
    });

    store.configureForTesting({
      authService: { currentUser: (() => ({ id: 'user-1', ganaderoId: 'gan-1', role: 'GANADERO', status: 'ACTIVE', username: 'gan-1', email: 'gan-1@hato.bo', displayName: 'Gan 1', version: 1, updatedAt: '2026-04-27T00:00:00.000Z', lastSyncedAt: null })) as never },
    });

    await store.initialize();

    expect(store.totalPending()).toBe(1);
    expect(store.windows().upcoming.map((item) => item.animalUuid)).toEqual(['animal-1']);
  });

  it('should fail closed for ganadero calendar snapshots when session has no ganaderoId', async () => {
    await seedSnapshots(offlineStore, '2026-04-28T09:00:00.000Z');
    store.configureForTesting({
      authService: { currentUser: (() => ({ id: 'user-1', ganaderoId: null, role: 'GANADERO', status: 'ACTIVE', username: 'gan-1', email: 'gan-1@hato.bo', displayName: 'Gan 1', version: 1, updatedAt: '2026-04-27T00:00:00.000Z', lastSyncedAt: null })) as never },
    });

    await store.initialize();

    expect(store.totalPending()).toBe(0);
    expect(store.windows().upcoming).toEqual([]);
  });

  it('should exclude closed global veterinary visit chains from local reminders', async () => {
    await seedAnimal(offlineStore, 'animal-1');
    await Promise.all([
      seedVetVisitSnapshot(offlineStore, 'closed-finalized', 'VISIT-CLOSED', 'FINALIZED', '2026-04-28T09:00:00.000Z'),
      seedVetVisitSnapshot(offlineStore, 'closed-canceled', 'VISIT-CLOSED', 'CANCELED', '2026-04-28T09:00:00.000Z'),
      seedVetVisitSnapshot(offlineStore, 'active-programmed', 'VISIT-ACTIVE', 'PENDING', '2026-04-28T10:00:00.000Z'),
    ]);

    await store.initialize();

    expect(store.totalPending()).toBe(1);
    expect(store.windows().upcoming.map((item) => item.sourceId)).toEqual(['active-programmed']);
  });
});

async function seedSnapshots(store: OfflineStoreService, nextDueAt: string) {
  await seedAnimal(store, 'animal-1');
  await store.saveSnapshot({
    key: 'ANIMAL_HEALTH_EVENT:health-1',
    entityType: 'ANIMAL_HEALTH_EVENT',
    entityId: 'health-1',
    updatedAt: '2026-04-27T08:00:00.000Z',
    payload: {
      id: 'health-1',
      animalUuid: 'animal-1',
      healthEventType: 'VACCINATION',
      notes: 'Refuerzo',
      metadata: { nextDueAt },
    },
  });
}

async function seedAnimal(store: OfflineStoreService, animalUuid: string) {
  await store.saveSnapshot({
    key: 'ANIMAL:animal-1',
    entityType: 'ANIMAL',
    entityId: animalUuid,
    updatedAt: '2026-04-27T08:00:00.000Z',
    payload: {
      uuid: animalUuid,
      ownerGanaderoId: 'gan-1',
      arete: 'BO-001',
      marca: null,
      tatuaje: null,
      category: 'COW',
      active: true,
      admissionDate: '2026-04-01T00:00:00.000Z',
      weightKg: 420,
      createdAt: '2026-04-01T00:00:00.000Z',
      updatedAt: '2026-04-27T08:00:00.000Z',
      version: 1,
      lastSyncedAt: null,
    },
    version: 1,
  });
}

async function seedVetVisitSnapshot(store: OfflineStoreService, id: string, visitId: string, status: string, nextControlAt: string) {
  await store.saveSnapshot({
    key: `ANIMAL_HEALTH_EVENT:${id}`,
    entityType: 'ANIMAL_HEALTH_EVENT',
    entityId: id,
    updatedAt: '2026-04-27T08:00:00.000Z',
    payload: {
      id,
      animalUuid: 'animal-1',
      healthEventType: 'FIELD_VET_VISIT',
      notes: 'Campaña',
      metadata: { visit: { visitId, mode: 'GLOBAL', status, nextControlAt } },
    },
  });
}
