import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { InMemoryOfflinePersistenceAdapter } from '../../../../core/offline/offline-store.migrations';
import { OfflineStoreService } from '../../../../core/offline/offline-store.service';
import { seedAdminAnalyticsSnapshots } from '../../reporting/testing/admin-analytics-offline.fixtures';
import { AdminDecisionSupportStore } from './admin-decision-support.store';

describe('AdminDecisionSupportStore', () => {
  let offlineStore: OfflineStoreService;
  let store: AdminDecisionSupportStore;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [AdminDecisionSupportStore] });
    offlineStore = new OfflineStoreService(new InMemoryOfflinePersistenceAdapter());
    store = TestBed.inject(AdminDecisionSupportStore);
    store.configureForTesting({
      offlineStore,
      offlineStatus: { isOnline: signal(true).asReadonly() },
      now: () => '2026-04-27T10:00:00.000Z',
      windowRef: window,
    });
  });

  it('should reuse cached insights when sourceSignature and latestSyncAt do not change', async () => {
    await seedAdminAnalyticsSnapshots(offlineStore);

    await store.initialize();
    const firstComputedAt = store.freshness().lastComputedAt;
    const firstInsightIds = store.insights().map((insight) => insight.id);

    await store.ensureFresh();

    expect(store.freshness().lastComputedAt).toBe(firstComputedAt);
    expect(store.insights().map((insight) => insight.id)).toEqual(firstInsightIds);
  });

  it('should invalidate by sourceSignature and latestSyncAt and recompute without duplicate cards', async () => {
    await seedAdminAnalyticsSnapshots(offlineStore);
    await store.initialize();

    await offlineStore.saveCheckpoint({
      entityType: 'COST_LEDGER',
      cursorUpdatedAt: '2026-04-27T10:04:00.000Z',
      cursorId: 'cost-b',
      lastSuccessAt: '2026-04-27T10:05:00.000Z',
    });
    await offlineStore.saveSnapshot({
      key: 'COST_LEDGER:cost-b',
      entityType: 'COST_LEDGER',
      entityId: 'cost-b',
      updatedAt: '2026-04-27T10:04:00.000Z',
      payload: {
        id: 'cost-b',
        lotId: 'lot-a',
        periodKey: '2026-04',
        category: 'FEED',
        source: 'PURCHASE',
        amount: 125,
        currency: 'BOB',
        identityKey: '2026-04|lot-a|FEED|PURCHASE',
        createdAt: '2026-04-27T10:04:00.000Z',
        updatedAt: '2026-04-27T10:04:00.000Z',
        version: 2,
      },
    });

    store.configureForTesting({
      offlineStore,
      offlineStatus: { isOnline: signal(true).asReadonly() },
      now: () => '2026-04-27T10:10:00.000Z',
      windowRef: window,
    });

    await store.ensureFresh();

    expect(store.freshness().lastSyncAt).toBe('2026-04-27T10:05:00.000Z');
    expect(new Set(store.insights().map((insight) => insight.id)).size).toBe(store.insights().length);
  });

  it('should keep offline dashboard available from local snapshots without sync side-effects', async () => {
    const offlineSignal = signal(false);
    const dispatchEvent = vi.fn();

    await seedAdminAnalyticsSnapshots(offlineStore);

    store.configureForTesting({
      offlineStore,
      offlineStatus: { isOnline: offlineSignal.asReadonly() },
      now: () => '2026-04-27T10:00:00.000Z',
      windowRef: { addEventListener: vi.fn(), dispatchEvent },
    });

    await store.initialize();

    const persistedBeforeRefresh = await offlineStore.getDecisionSupportState();
    const firstComputedAt = store.freshness().lastComputedAt;

    await store.refreshNow();

    const persistedAfterRefresh = await offlineStore.getDecisionSupportState();

    expect(store.insights().map((insight) => insight.id)).toEqual(['cost-7d', 'health-7d', 'productivity-7d']);
    expect(store.statusMessage()).toBe('Sin conectividad: mostramos el último estado local persistido.');
    expect(store.freshness().lastComputedAt).toBe(firstComputedAt);
    expect(dispatchEvent).not.toHaveBeenCalled();
    expect(persistedAfterRefresh).toEqual(persistedBeforeRefresh);
  });
});
