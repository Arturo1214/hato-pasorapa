import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { InMemoryOfflinePersistenceAdapter } from '../../../../core/offline/offline-store.migrations';
import { OfflineStoreService } from '../../../../core/offline/offline-store.service';
import { REPORTING_REFRESH_EVENT } from '../../../../core/offline/sync-orchestrator.service';
import { AdminReportingStore } from './admin-reporting.store';
import { seedAdminAnalyticsSnapshots } from '../testing/admin-analytics-offline.fixtures';

describe('AdminReportingStore', () => {
  let offlineStore: OfflineStoreService;
  let store: AdminReportingStore;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [AdminReportingStore] });
    offlineStore = new OfflineStoreService(new InMemoryOfflinePersistenceAdapter());
    store = TestBed.inject(AdminReportingStore);
    store.configureForTesting({
      offlineStore,
      offlineStatus: { isOnline: signal(true).asReadonly() },
      now: () => '2026-04-27T10:00:00.000Z',
      windowRef: window,
    });
  });

  it('should recompute on startup from local snapshots and persist freshness metadata', async () => {
    await seedAdminAnalyticsSnapshots(offlineStore);

    await store.initialize();

    expect(store.summary()).toEqual(
      expect.objectContaining({ usersTotal: 1, ganaderosTotal: 1, animalesTotal: 1, animalesActivos: 1, lotesTotal: 1 })
    );
    expect(store.descriptiveKpis()).toEqual({
      animalesActivos: 1,
      lotesActivos: 1,
      productividadTotal: 1,
      costosTotal: 1,
      costoAcumulado: 80,
    });
    expect(store.freshness()).toEqual({
      lastSyncAt: '2026-04-27T09:59:00.000Z',
      lastComputedAt: '2026-04-27T10:00:00.000Z',
      stale: false,
    });
    await expect(offlineStore.getAdminReportingState()).resolves.toEqual(
      expect.objectContaining({ selectedWindow: '7d', selectedPreset: 'all' })
    );
  });

  it('should rebuild after the shared reporting refresh event and update freshness', async () => {
    await seedAdminAnalyticsSnapshots(offlineStore);
    await store.initialize();

    await offlineStore.saveCheckpoint({
      entityType: 'ANIMAL_EVENT',
      cursorUpdatedAt: '2026-04-27T10:04:00.000Z',
      cursorId: 'event-b',
      lastSuccessAt: '2026-04-27T10:05:00.000Z',
    });
    await offlineStore.saveSnapshot({
      key: 'ANIMAL_EVENT:event-b',
      entityType: 'ANIMAL_EVENT',
      entityId: 'event-b',
      updatedAt: '2026-04-27T10:04:00.000Z',
      payload: { id: 'event-b', animalUuid: 'animal-a', type: 'TRANSFERRED', occurredAt: '2026-04-27T09:54:00.000Z' },
    });

    window.dispatchEvent(new CustomEvent(REPORTING_REFRESH_EVENT));
    await vi.waitFor(() => expect(store.eventCounts()['ANIMAL_EVENT:TRANSFERRED']).toBe(1));

    expect(store.freshness().lastSyncAt).toBe('2026-04-27T10:05:00.000Z');
    expect(store.lastReason()).toBe('post-sync');
  });

  it('should invalidate by source signature and selected window preset signature, recomputing only when inputs change', async () => {
    await seedAdminAnalyticsSnapshots(offlineStore);
    await store.initialize();
    const firstComputedAt = store.freshness().lastComputedAt;

    await store.ensureFresh();
    expect(store.freshness().lastComputedAt).toBe(firstComputedAt);

    store.configureForTesting({
      offlineStore,
      offlineStatus: { isOnline: signal(true).asReadonly() },
      now: () => '2026-04-27T10:10:00.000Z',
      windowRef: window,
    });
    await store.setWindow('30d');
    expect(store.selectedWindow()).toBe('30d');
    expect(store.freshness().lastComputedAt).toBe('2026-04-27T10:10:00.000Z');

    await store.setPreset('invalid-free-filter');
    expect(store.selectedPreset()).toBe('all');
  });

  it('should keep cached reporting visible and expose deferred refresh copy while offline', async () => {
    await seedAdminAnalyticsSnapshots(offlineStore);
    await store.initialize();
    store.configureForTesting({
      offlineStore,
      offlineStatus: { isOnline: signal(false).asReadonly() },
      now: () => '2026-04-27T10:15:00.000Z',
      windowRef: window,
    });

    await store.refreshNow();

    expect(store.summary().animalesTotal).toBe(1);
    expect(store.statusMessage()).toContain('diferimos la actualización');
  });
});
