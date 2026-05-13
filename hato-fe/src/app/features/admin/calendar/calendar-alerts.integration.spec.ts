import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../../core/auth/data-access/auth.service';
import { ApplicationConfigService } from '../../../core/config/application-config.service';
import { InMemoryOfflinePersistenceAdapter } from '../../../core/offline/offline-store.migrations';
import { OfflineStoreService } from '../../../core/offline/offline-store.service';
import { SyncMetricsStore } from '../../../core/offline/sync-metrics.store';
import { SyncOrchestratorService, type PullSyncResponse, type PushSyncResponse } from '../../../core/offline/sync-orchestrator.service';
import { SidebarComponent } from '../../../ui/layout/main-layout/sidebar/sidebar';
import { BrowserNotificationGateway } from './data-access/browser-notification.gateway';
import { CalendarAlertsStore } from './data-access/calendar-alerts.store';

describe('calendar alerts integration', () => {
  let fixture: ComponentFixture<SidebarComponent>;
  let calendarStore: CalendarAlertsStore;
  let offlineStore: OfflineStoreService;
  let notificationGateway: BrowserNotificationGateway;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SidebarComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        CalendarAlertsStore,
        BrowserNotificationGateway,
        {
          provide: ApplicationConfigService,
          useValue: { config: () => ({ apiBaseUrl: '/api' }) },
        },
        {
          provide: AuthService,
          useValue: {
            currentUser: () => ({ role: 'GANADERO', displayName: 'Ganadero Root', ganaderoId: 'gan-1' }),
            logout: vi.fn(),
          },
        },
      ],
    }).compileComponents();

    calendarStore = TestBed.inject(CalendarAlertsStore);
    notificationGateway = TestBed.inject(BrowserNotificationGateway);
    offlineStore = new OfflineStoreService(new InMemoryOfflinePersistenceAdapter());
    notificationGateway.configureForTesting({
      now: () => '2026-04-27T10:00:00.000Z',
      notificationApi: {
        permission: 'default',
        requestPermission: vi.fn(async (): Promise<NotificationPermission> => 'default'),
        create: vi.fn(),
      },
    });
    calendarStore.configureForTesting({ offlineStore, gateway: notificationGateway, now: () => '2026-04-27T10:00:00.000Z', windowRef: window });
    await offlineStore.saveSnapshot({
      key: 'ANIMAL:animal-1',
      entityType: 'ANIMAL',
      entityId: 'animal-1',
      updatedAt: '2026-04-27T08:00:00.000Z',
      version: 1,
      payload: {
        uuid: 'animal-1',
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
    });
    await calendarStore.initialize();

    fixture = TestBed.createComponent(SidebarComponent);
    fixture.detectChanges();
  });

  it('should rebuild after post-sync and update the sidebar badge', async () => {
    const orchestrator = new SyncOrchestratorService({
      store: offlineStore,
      metricsStore: new SyncMetricsStore(),
      offlineStatus: { isOnline: () => true },
      authSession: { getAccessToken: () => 'token' },
      now: () => '2026-04-27T10:03:00.000Z',
      random: () => 0,
      windowRef: window,
      supportedEntities: ['ANIMAL_HEALTH_EVENT'],
      apiClient: {
        push: vi.fn(async () => ({ results: [] } satisfies PushSyncResponse)),
        pull: vi.fn(async () => ({
          entityType: 'ANIMAL_HEALTH_EVENT',
          items: [
            {
              id: 'health-1',
              animalUuid: 'animal-1',
              healthEventType: 'VACCINATION',
              notes: 'Refuerzo',
              metadata: { nextDueAt: '2026-04-28T09:00:00.000Z' },
              updatedAt: '2026-04-27T10:02:00.000Z',
            },
          ],
          nextCursor: {
            entityType: 'ANIMAL_HEALTH_EVENT',
            cursorUpdatedAt: '2026-04-27T10:02:00.000Z',
            cursorId: 'health-1',
            lastSuccessAt: '2026-04-27T10:03:00.000Z',
          },
          hasMore: false,
        } satisfies PullSyncResponse)),
      },
    });

    await orchestrator.syncNow('manual');
    await vi.waitFor(() => expect(calendarStore.totalPending()).toBe(1));

    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('1');
  });
});
