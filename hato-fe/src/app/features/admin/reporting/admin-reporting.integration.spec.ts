import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../../core/auth/data-access/auth.service';
import { ApplicationConfigService } from '../../../core/config/application-config.service';
import { InMemoryOfflinePersistenceAdapter } from '../../../core/offline/offline-store.migrations';
import { OfflineStoreService } from '../../../core/offline/offline-store.service';
import { SyncMetricsStore } from '../../../core/offline/sync-metrics.store';
import { SyncOrchestratorService, type PullSyncResponse, type PushSyncResponse } from '../../../core/offline/sync-orchestrator.service';
import { AdminReportingStore } from './data-access/admin-reporting.store';
import { AdminReportingPageComponent } from './admin-reporting-page.component';

describe('admin reporting integration', () => {
  let fixture: ComponentFixture<AdminReportingPageComponent>;
  let reportingStore: AdminReportingStore;
  let offlineStore: OfflineStoreService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminReportingPageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        AdminReportingStore,
        {
          provide: ApplicationConfigService,
          useValue: { config: () => ({ apiBaseUrl: '/api' }) },
        },
        {
          provide: AuthService,
          useValue: {
            currentUser: () => ({ role: 'ADMIN', displayName: 'Admin Root' }),
            logout: vi.fn(),
          },
        },
      ],
    }).compileComponents();

    reportingStore = TestBed.inject(AdminReportingStore);
    offlineStore = new OfflineStoreService(new InMemoryOfflinePersistenceAdapter());
    reportingStore.configureForTesting({
      offlineStore,
      offlineStatus: { isOnline: signal(true).asReadonly() },
      now: () => '2026-04-27T10:00:00.000Z',
      windowRef: window,
    });

    await seedBaseSnapshots(offlineStore);
    await reportingStore.initialize();

    fixture = TestBed.createComponent(AdminReportingPageComponent);
    fixture.detectChanges();
  });

  it('should rebuild after post-sync and update visible freshness and event counts', async () => {
    const orchestrator = new SyncOrchestratorService({
      store: offlineStore,
      metricsStore: new SyncMetricsStore(),
      offlineStatus: { isOnline: () => true },
      authSession: { getAccessToken: () => 'token' },
      now: () => '2026-04-27T10:03:00.000Z',
      random: () => 0,
      windowRef: window,
      supportedEntities: ['ANIMAL_EVENT', 'LOT', 'LOT_ASSIGNMENT', 'PRODUCTIVITY_LEDGER', 'COST_LEDGER'],
      apiClient: {
        push: vi.fn(async () => ({ results: [] } satisfies PushSyncResponse)),
        pull: vi.fn(async () => ({
          entityType: 'ANIMAL_EVENT',
          items: [
            {
              id: 'event-sync',
              animalUuid: 'animal-a',
              type: 'TRANSFERRED',
              occurredAt: '2026-04-27T09:54:00.000Z',
              updatedAt: '2026-04-27T10:02:00.000Z',
            },
          ],
          nextCursor: {
            entityType: 'ANIMAL_EVENT',
            cursorUpdatedAt: '2026-04-27T10:02:00.000Z',
            cursorId: 'event-sync',
            lastSuccessAt: '2026-04-27T10:03:00.000Z',
          },
          hasMore: false,
        } satisfies PullSyncResponse)),
      },
    });

    await orchestrator.syncNow('manual');
    await offlineStore.applyPullResponse(
      'ANIMAL_EVENT',
      [
        {
          id: 'event-sync',
          animalUuid: 'animal-a',
          type: 'TRANSFERRED',
          occurredAt: '2026-04-27T09:54:00.000Z',
          updatedAt: '2026-04-27T10:02:00.000Z',
        },
      ],
      {
        entityType: 'ANIMAL_EVENT',
        cursorUpdatedAt: '2026-04-27T10:02:00.000Z',
        cursorId: 'event-sync',
        lastSuccessAt: '2026-04-27T10:03:00.000Z',
      }
    );
    await offlineStore.saveCheckpoint({
      entityType: 'ANIMAL_EVENT',
      cursorUpdatedAt: '2026-04-27T10:02:00.000Z',
      cursorId: 'event-sync',
      lastSuccessAt: '2026-04-27T10:03:00.000Z',
    });
    await reportingStore.rebuild('post-sync');
    await vi.waitFor(() => expect(reportingStore.freshness().lastSyncAt).toBe('2026-04-27T09:59:00.000Z'));

    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Última sync: 2026-04-27T09:59:00.000Z');
    expect(text).toContain('Lotes: 1');
  });
});

async function seedBaseSnapshots(store: OfflineStoreService) {
  await store.saveSnapshot({
    key: 'USER:user-a',
    entityType: 'USER',
    entityId: 'user-a',
    updatedAt: '2026-04-27T09:58:00.000Z',
    payload: { id: 'user-a', status: 'ACTIVE' },
  });
  await store.saveSnapshot({
    key: 'GANADERO:gan-a',
    entityType: 'GANADERO',
    entityId: 'gan-a',
    updatedAt: '2026-04-27T09:58:00.000Z',
    payload: { id: 'gan-a', active: true },
  });
  await store.saveSnapshot({
    key: 'LOT:lot-a',
    entityType: 'LOT',
    entityId: 'lot-a',
    updatedAt: '2026-04-27T09:58:00.000Z',
    payload: { id: 'lot-a', name: 'Lote A', description: null, active: true, createdAt: '2026-04-01T00:00:00.000Z', updatedAt: '2026-04-27T09:58:00.000Z', version: 1 },
  });
  await store.saveSnapshot({
    key: 'LOT_ASSIGNMENT:assign-a',
    entityType: 'LOT_ASSIGNMENT',
    entityId: 'assign-a',
    updatedAt: '2026-04-27T09:58:00.000Z',
    payload: { id: 'assign-a', animalUuid: 'animal-a', lotId: 'lot-a', fromDate: '2026-04-01', toDate: null, createdAt: '2026-04-01T00:00:00.000Z', updatedAt: '2026-04-27T09:58:00.000Z', version: 1 },
  });
  await store.saveSnapshot({
    key: 'PRODUCTIVITY_LEDGER:prod-a',
    entityType: 'PRODUCTIVITY_LEDGER',
    entityId: 'prod-a',
    updatedAt: '2026-04-27T09:58:00.000Z',
    payload: { id: 'prod-a', animalUuid: 'animal-a', lotId: 'lot-a', periodKey: '2026-04', metricType: 'MILK_LITERS', value: 120, identityKey: '2026-04|animal-a|lot-a|MILK_LITERS', createdAt: '2026-04-01T00:00:00.000Z', updatedAt: '2026-04-27T09:58:00.000Z', version: 1 },
  });
  await store.saveSnapshot({
    key: 'COST_LEDGER:cost-a',
    entityType: 'COST_LEDGER',
    entityId: 'cost-a',
    updatedAt: '2026-04-27T09:58:00.000Z',
    payload: { id: 'cost-a', lotId: 'lot-a', periodKey: '2026-04', category: 'FEED', source: 'PURCHASE', amount: 80, currency: 'BOB', identityKey: '2026-04|lot-a|FEED|PURCHASE', createdAt: '2026-04-01T00:00:00.000Z', updatedAt: '2026-04-27T09:58:00.000Z', version: 1 },
  });
  await store.saveSnapshot({
    key: 'ANIMAL:animal-a',
    entityType: 'ANIMAL',
    entityId: 'animal-a',
    updatedAt: '2026-04-27T09:58:00.000Z',
    payload: {
      uuid: 'animal-a',
      ownerGanaderoId: 'gan-a',
      arete: 'BO-001',
      marca: null,
      tatuaje: null,
      category: 'COW',
      active: true,
      admissionDate: '2026-04-01T00:00:00.000Z',
      weightKg: 420,
      createdAt: '2026-04-01T00:00:00.000Z',
      updatedAt: '2026-04-27T09:58:00.000Z',
      version: 1,
      lastSyncedAt: null,
    },
  });
  await store.saveCheckpoint({
    entityType: 'LOT',
    cursorUpdatedAt: '2026-04-27T09:58:00.000Z',
    cursorId: 'lot-a',
    lastSuccessAt: '2026-04-27T09:59:00.000Z',
  });
  await store.saveCheckpoint({
    entityType: 'LOT_ASSIGNMENT',
    cursorUpdatedAt: '2026-04-27T09:58:00.000Z',
    cursorId: 'assign-a',
    lastSuccessAt: '2026-04-27T09:59:00.000Z',
  });
  await store.saveCheckpoint({
    entityType: 'PRODUCTIVITY_LEDGER',
    cursorUpdatedAt: '2026-04-27T09:58:00.000Z',
    cursorId: 'prod-a',
    lastSuccessAt: '2026-04-27T09:59:00.000Z',
  });
  await store.saveCheckpoint({
    entityType: 'COST_LEDGER',
    cursorUpdatedAt: '2026-04-27T09:58:00.000Z',
    cursorId: 'cost-a',
    lastSuccessAt: '2026-04-27T09:59:00.000Z',
  });
  await store.saveCheckpoint({
    entityType: 'USER',
    cursorUpdatedAt: '2026-04-27T09:58:00.000Z',
    cursorId: 'user-a',
    lastSuccessAt: '2026-04-27T09:59:00.000Z',
  });
  await store.saveCheckpoint({
    entityType: 'GANADERO',
    cursorUpdatedAt: '2026-04-27T09:58:00.000Z',
    cursorId: 'gan-a',
    lastSuccessAt: '2026-04-27T09:59:00.000Z',
  });
  await store.saveCheckpoint({
    entityType: 'ANIMAL',
    cursorUpdatedAt: '2026-04-27T09:58:00.000Z',
    cursorId: 'animal-a',
    lastSuccessAt: '2026-04-27T09:59:00.000Z',
  });
}
