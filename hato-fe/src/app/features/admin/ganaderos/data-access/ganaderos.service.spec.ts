import { HttpClient, HttpHeaders } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { AuthService } from '../../../../core/auth/data-access/auth.service';
import { ApplicationConfigService } from '../../../../core/config/application-config.service';
import { InMemoryOfflinePersistenceAdapter } from '../../../../core/offline/offline-store.migrations';
import { OfflineStatusService } from '../../../../core/offline/offline-status.service';
import { OfflineStoreService } from '../../../../core/offline/offline-store.service';
import { SyncMetricsStore } from '../../../../core/offline/sync-metrics.store';
import { GanaderosService, type GanaderoItem } from './ganaderos.service';

describe('GanaderosService', () => {
  const createGanadero = (overrides: Partial<GanaderoItem> = {}): GanaderoItem => ({
    id: 'ganadero-1',
    businessIdentifier: 'BO-100',
    name: 'Estancia Norte',
    active: true,
    version: 1,
    createdAt: '2026-04-26T10:00:00.000Z',
    updatedAt: '2026-04-26T10:00:00.000Z',
    lastSyncedAt: null,
    ...overrides,
  });

  const setup = (options: { online: boolean; http?: Partial<Pick<HttpClient, 'get' | 'post' | 'put'>> }) => {
    let onlineHandler: (() => void | Promise<void>) | undefined;
    vi.spyOn(window, 'addEventListener').mockImplementation((event, listener) => {
      if (event === 'online') {
        onlineHandler = () => {
          if (typeof listener === 'function') {
            return listener(new Event('online'));
          }

          return listener.handleEvent(new Event('online'));
        };
      }
    });

    TestBed.configureTestingModule({
      providers: [
        GanaderosService,
        SyncMetricsStore,
        {
          provide: HttpClient,
          useValue: {
            get: vi.fn(),
            post: vi.fn(),
            put: vi.fn(),
            ...options.http,
          },
        },
        {
          provide: ApplicationConfigService,
          useValue: { config: () => ({ apiBaseUrl: '/api' }) },
        },
        {
          provide: AuthService,
          useValue: { getAccessToken: () => 'token' },
        },
        {
          provide: OfflineStatusService,
          useValue: { isOnline: () => options.online },
        },
      ],
    });

    const service = TestBed.inject(GanaderosService);
    const store = new OfflineStoreService(new InMemoryOfflinePersistenceAdapter(), {
      generateId: () => 'operation-ganadero-create-1',
    });
    service.configureForTesting({
      store,
      now: () => '2026-04-26T10:06:00.000Z',
    });

    return { service, store, fireOnline: async () => await onlineHandler?.() };
  };

  afterEach(() => {
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it('should enqueue ganadero creation offline and replay it on reconnect', async () => {
    let online = false;
    const syncedGanadero = createGanadero({ id: 'ganadero-remote-1', version: 2, updatedAt: '2026-04-26T10:06:00.000Z' });
    const post = vi.fn().mockImplementation((_url: string, _body: unknown, options: { headers: HttpHeaders }) => {
      expect(options.headers.get('X-Operation-Id')).toBe('operation-ganadero-create-1');
      return of(syncedGanadero);
    });
    const get = vi.fn(() => of({ ganaderos: [syncedGanadero] }));
    const { service, store, fireOnline } = setup({ online, http: { get: get as never, post: post as never } });

    await expect(
      firstValueFrom(service.createGanadero({ businessIdentifier: 'BO-100', name: 'Estancia Norte' }))
    ).resolves.toEqual({
      outcome: 'queued',
      message: 'Alta de ganadero encolada. Se enviará al reconectar.',
    });
    await expect(firstValueFrom(service.listGanaderos())).resolves.toEqual([
      createGanadero({
        id: 'pending:operation-ganadero-create-1',
        version: 0,
        createdAt: '2026-04-26T10:06:00.000Z',
        updatedAt: '2026-04-26T10:06:00.000Z',
      }),
    ]);

    online = true;
    service.configureForTesting({ offlineStatus: { isOnline: () => online } as never });
    await fireOnline();
    await vi.waitFor(async () => expect(await store.countPendingOperations()).toBe(0));

    await expect(firstValueFrom(service.listGanaderos())).resolves.toEqual([syncedGanadero]);
  });
});
