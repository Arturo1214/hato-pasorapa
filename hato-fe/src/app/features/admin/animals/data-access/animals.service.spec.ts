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
import { ANIMAL_CATEGORY, ANIMAL_SEX, AnimalsService, type AnimalItem } from './animals.service';

describe('AnimalsService', () => {
  const createAnimal = (overrides: Partial<AnimalItem> = {}): AnimalItem => ({
    uuid: 'animal-uuid-1',
    ownerGanaderoId: 'ganadero-uuid-1',
    arete: 'AR-100',
    marca: null,
    tatuaje: null,
    category: ANIMAL_CATEGORY.VACA,
    sex: ANIMAL_SEX.HEMBRA,
    active: true,
    birthDate: null,
    admissionDate: '2026-04-26',
    weightKg: 420,
    createdAt: '2026-04-26T10:00:00.000Z',
    version: 1,
    updatedAt: '2026-04-26T10:00:00.000Z',
    lastSyncedAt: null,
    ...overrides,
  });

  const setup = (options: { online: boolean; http?: Partial<Pick<HttpClient, 'get' | 'post' | 'put'>> }) => {
    TestBed.configureTestingModule({
      providers: [
        AnimalsService,
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

    const service = TestBed.inject(AnimalsService);
    const store = new OfflineStoreService(new InMemoryOfflinePersistenceAdapter());
    service.configureForTesting({ store });
    return { service, store };
  };

  afterEach(() => {
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it('should request table filters online and cache canonical categories with sex data', async () => {
    const get = vi.fn(() => of({ content: [createAnimal()] }));
    const { service, store } = setup({ online: true, http: { get: get as never } });

    await expect(
      firstValueFrom(
        service.listAnimals({
          visible: 'AR-100',
          ownerGanaderoId: 'ganadero-uuid-1',
          active: true,
            category: ANIMAL_CATEGORY.VACA,
          })
      )
    ).resolves.toEqual([createAnimal({ syncStatus: 'synced', syncMessage: null })]);

    expect(get).toHaveBeenCalledTimes(1);
    const [requestedUrl, options] = get.mock.calls[0] as unknown as [string, { headers: HttpHeaders }];
    expect(requestedUrl).toBe(
      '/api/animals?visible.contains=AR-100&ownerGanaderoId.equals=ganadero-uuid-1&active.equals=true&category.equals=VACA&page=0&size=20&sort=updatedAt,desc'
    );
    expect(options.headers.get('Authorization')).toBe('Bearer token');

    await expect(store.listSnapshots('ANIMAL')).resolves.toEqual([
      expect.objectContaining({
        key: 'ANIMAL:animal-uuid-1',
        entityId: 'animal-uuid-1',
      }),
    ]);
  });

  it('should filter local snapshots offline and expose pending/conflict sync markers by animal uuid', async () => {
    const { service, store } = setup({ online: false });
    await store.saveSnapshot({
      key: 'ANIMAL:animal-uuid-1',
      entityType: 'ANIMAL',
      entityId: 'animal-uuid-1',
      payload: { ...createAnimal(), updatedAt: '2026-04-26T10:00:00.000Z' },
      updatedAt: '2026-04-26T10:00:00.000Z',
      version: 1,
    });
    await store.saveSnapshot({
      key: 'ANIMAL:animal-uuid-2',
      entityType: 'ANIMAL',
      entityId: 'animal-uuid-2',
      payload: {
        ...createAnimal({
          uuid: 'animal-uuid-2',
          ownerGanaderoId: 'ganadero-uuid-2',
          arete: null,
          marca: 'Marca Norte',
          category: 'VAQUILLONA',
          sex: ANIMAL_SEX.HEMBRA,
          active: false,
          updatedAt: '2026-04-26T11:00:00.000Z',
          version: 3,
        }),
      },
      updatedAt: '2026-04-26T11:00:00.000Z',
      version: 3,
    });
    await store.enqueueOperation({
      entityType: 'ANIMAL',
      entityId: 'animal-uuid-1',
      opType: 'UPDATE',
      payload: { arete: 'AR-100' },
      clientCreatedAt: '2026-04-26T10:06:00.000Z',
      clientUpdatedAt: '2026-04-26T10:06:00.000Z',
    });
    const conflict = await store.enqueueOperation({
      entityType: 'ANIMAL',
      entityId: 'animal-uuid-2',
      opType: 'UPDATE',
      payload: { marca: 'Marca Norte' },
      clientCreatedAt: '2026-04-26T11:06:00.000Z',
      clientUpdatedAt: '2026-04-26T11:06:00.000Z',
    });
    await store.markConflict(
      conflict.operationId,
      { code: 'ANIMAL_VERSION_CONFLICT', message: 'Hay un conflicto remoto.' },
      { serverVersion: 4, reason: 'Hay un conflicto remoto.' }
    );

    await expect(
      firstValueFrom(
        service.listAnimals({
          visible: 'marca',
          ownerGanaderoId: 'ganadero-uuid-2',
          active: false,
          category: ANIMAL_CATEGORY.VAQUILLONA,
        })
      )
    ).resolves.toEqual([
      createAnimal({
        uuid: 'animal-uuid-2',
        ownerGanaderoId: 'ganadero-uuid-2',
        arete: null,
        marca: 'Marca Norte',
        category: ANIMAL_CATEGORY.VAQUILLONA,
        sex: ANIMAL_SEX.HEMBRA,
        active: false,
        updatedAt: '2026-04-26T11:00:00.000Z',
        version: 3,
        syncStatus: 'conflict',
        syncMessage: 'Hay un conflicto remoto.',
      }),
    ]);
  });

  it('should queue online animal updates by canonical uuid and preserve the uuid-based snapshot key', async () => {
    const updatedAnimal = createAnimal({ uuid: 'animal-uuid-9', arete: 'AR-999', version: 7 });
    const put = vi.fn(() => of(updatedAnimal));
    const { service, store } = setup({ online: true, http: { put: put as never } });

    await expect(
      firstValueFrom(
        service.updateAnimal('animal-uuid-9', {
          ownerGanaderoId: 'ganadero-uuid-1',
          arete: ' AR-999 ',
          category: ANIMAL_CATEGORY.VACA,
          active: true,
          admissionDate: '2026-04-26',
          weightKg: 420,
        })
      )
    ).resolves.toEqual({
      outcome: 'queued',
      message: 'Actualización de animal encolada. Se disparó la sincronización automática.',
    });

    expect(put).not.toHaveBeenCalled();

    await expect(store.listSnapshots('ANIMAL')).resolves.toEqual([
      expect.objectContaining({ key: 'ANIMAL:animal-uuid-9', entityId: 'animal-uuid-9' }),
    ]);
  });

  it('should queue animal creation offline using the canonical uuid as entity identity and keep a stable local snapshot', async () => {
    const dispatchEvent = vi.spyOn(window, 'dispatchEvent');
    const { service, store } = setup({ online: true });
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('11111111-2222-4333-8444-555555555555');

    await expect(
      firstValueFrom(
        service.createAnimal({
          ownerGanaderoId: 'ganadero-uuid-1',
          arete: ' AR-550 ',
          marca: 'Marca Centro',
          category: ANIMAL_CATEGORY.VAQUILLONA,
          sex: ANIMAL_SEX.HEMBRA,
          active: true,
          admissionDate: '2026-04-26',
          weightKg: 410,
        })
      )
    ).resolves.toEqual({
      outcome: 'queued',
      message: 'Alta de animal encolada. Se disparó la sincronización automática.',
    });

    const outbox = await store.listOutbox();
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toEqual(
      expect.objectContaining({
        entityType: 'ANIMAL',
        entityId: '11111111-2222-4333-8444-555555555555',
        opType: 'CREATE',
        payload: expect.objectContaining({
          ownerGanaderoId: 'ganadero-uuid-1',
          arete: 'AR-550',
          marca: 'Marca Centro',
        }),
      })
    );
    await expect(store.listSnapshots('ANIMAL')).resolves.toEqual([
      expect.objectContaining({
        key: 'ANIMAL:11111111-2222-4333-8444-555555555555',
        entityId: '11111111-2222-4333-8444-555555555555',
        payload: expect.objectContaining({
          uuid: '11111111-2222-4333-8444-555555555555',
          arete: 'AR-550',
          syncStatus: 'pending',
        }),
      }),
    ]);
    expect(dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({ type: MANUAL_SYNC_EVENT }));
    expect(service.syncState().pending).toBe(1);
  });

  it('should queue animal updates by canonical uuid, preserve the snapshot key and reflect the optimistic pending state', async () => {
    const dispatchEvent = vi.spyOn(window, 'dispatchEvent');
    const { service, store } = setup({ online: false });
    await store.saveSnapshot({
      key: 'ANIMAL:animal-uuid-77',
      entityType: 'ANIMAL',
      entityId: 'animal-uuid-77',
      payload: { ...createAnimal({ uuid: 'animal-uuid-77', arete: 'AR-770', version: 5 }) },
      updatedAt: '2026-04-26T10:00:00.000Z',
      version: 5,
    });

    await expect(
      firstValueFrom(
        service.updateAnimal('animal-uuid-77', {
          ownerGanaderoId: 'ganadero-uuid-1',
          arete: 'AR-771',
          marca: 'Marca Norte',
          category: ANIMAL_CATEGORY.VACA,
          active: false,
          admissionDate: '2026-04-26',
          weightKg: 415,
        })
      )
    ).resolves.toEqual({
      outcome: 'queued',
      message: 'Actualización de animal encolada. Se enviará al reconectar.',
    });

    const outbox = await store.listOutbox();
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toEqual(
      expect.objectContaining({
        entityType: 'ANIMAL',
        entityId: 'animal-uuid-77',
        opType: 'UPDATE',
        baseVersion: 5,
      })
    );
    await expect(firstValueFrom(service.listAnimals())).resolves.toEqual([
      expect.objectContaining({
        uuid: 'animal-uuid-77',
        arete: 'AR-771',
        marca: 'Marca Norte',
        active: false,
        syncStatus: 'pending',
      }),
    ]);
    expect(dispatchEvent).not.toHaveBeenCalledWith(expect.objectContaining({ type: MANUAL_SYNC_EVENT }));
    expect(service.syncState().pending).toBe(1);
  });

  it('should preserve sex and birthDate in optimistic offline animal snapshots', async () => {
    const { service, store } = setup({ online: false });
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('22222222-3333-4444-8555-666666666666');

    await firstValueFrom(
      service.createAnimal({
        ownerGanaderoId: 'ganadero-uuid-1',
        arete: 'AR-880',
        category: ANIMAL_CATEGORY.VACA,
        active: true,
        admissionDate: '2026-04-26',
        weightKg: 410,
        sex: ANIMAL_SEX.HEMBRA,
        birthDate: '2025-10-26',
      })
    );

    await expect(store.listSnapshots('ANIMAL')).resolves.toEqual([
      expect.objectContaining({
        key: 'ANIMAL:22222222-3333-4444-8555-666666666666',
        payload: expect.objectContaining({
          sex: 'HEMBRA',
          birthDate: '2025-10-26',
        }),
      }),
    ]);
  });
});
