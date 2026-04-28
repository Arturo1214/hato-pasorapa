import { HttpClient, HttpHeaders } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { AuthService } from '../../../../core/auth/data-access/auth.service';
import { ApplicationConfigService } from '../../../../core/config/application-config.service';
import { InMemoryOfflinePersistenceAdapter } from '../../../../core/offline/offline-store.migrations';
import { OfflineStatusService } from '../../../../core/offline/offline-status.service';
import { OfflineStoreService } from '../../../../core/offline/offline-store.service';
import { SyncMetricsStore } from '../../../../core/offline/sync-metrics.store';
import { MANUAL_SYNC_EVENT } from '../../../../core/offline/sync-orchestrator.service';
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

  it('should keep the ganadero create outbox identity canonical while exposing a pending snapshot offline', async () => {
    const { service, store } = setup({ online: false });

    await expect(
      firstValueFrom(service.createGanadero({ businessIdentifier: 'BO-100', name: 'Estancia Norte' }))
    ).resolves.toEqual({
      outcome: 'queued',
      message: 'Alta de ganadero encolada. Se enviará al reconectar.',
    });

    const outbox = await store.listOutbox();
    expect(outbox).toHaveLength(1);
    expect(outbox[0].entityId).toBe('operation-ganadero-create-1');

    await expect(firstValueFrom(service.listGanaderos())).resolves.toEqual([
      createGanadero({
        id: 'pending:operation-ganadero-create-1',
        version: 0,
        createdAt: '2026-04-26T10:06:00.000Z',
        updatedAt: '2026-04-26T10:06:00.000Z',
      }),
    ]);
  });

  it('should enqueue ganadero creation online and delegate replay to the global sync orchestrator', async () => {
    const dispatchEvent = vi.spyOn(window, 'dispatchEvent');
    const post = vi.fn();
    const { service, store } = setup({ online: true, http: { post: post as never } });

    await expect(
      firstValueFrom(service.createGanadero({ businessIdentifier: 'BO-100', name: 'Estancia Norte' }))
    ).resolves.toEqual({
      outcome: 'queued',
      message: 'Alta de ganadero encolada. Se disparó la sincronización automática.',
    });

    const outbox = await store.listOutbox();
    expect(outbox).toHaveLength(1);
    expect(outbox[0].entityId).toBe('operation-ganadero-create-1');
    expect(dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({ type: MANUAL_SYNC_EVENT }));
    expect(post).not.toHaveBeenCalled();
    expect(service.syncState().pending).toBe(1);
  });

  it('should enqueue ganadero status changes online and delegate replay to the global sync orchestrator', async () => {
    const dispatchEvent = vi.spyOn(window, 'dispatchEvent');
    const put = vi.fn();
    const { service, store } = setup({ online: true, http: { put: put as never } });
    await store.saveSnapshot({
      key: 'GANADERO:ganadero-1',
      entityType: 'GANADERO',
      entityId: 'ganadero-1',
      payload: { ...createGanadero() },
      updatedAt: '2026-04-26T10:00:00.000Z',
      version: 1,
    });

    await expect(firstValueFrom(service.updateStatus('ganadero-1', false))).resolves.toEqual({
      outcome: 'queued',
      message: 'Cambio de estado encolado. Se disparó la sincronización automática.',
    });

    await expect(firstValueFrom(service.listGanaderos())).resolves.toEqual([
      createGanadero({ active: false, updatedAt: '2026-04-26T10:06:00.000Z' }),
    ]);
    expect(dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({ type: MANUAL_SYNC_EVENT }));
    expect(put).not.toHaveBeenCalled();
    expect(service.syncState().pending).toBe(1);
  });
});
