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
    color: null,
    description: null,
    breedUuid: null,
    breedName: null,
    ...overrides,
  });

  const setup = (options: {
    online: boolean;
    http?: Partial<Pick<HttpClient, 'get' | 'post' | 'put'>>;
    currentUser?: {
      id: string;
      ganaderoId?: string | null;
      role: 'ADMIN' | 'GANADERO';
      status: 'ACTIVE';
    };
  }) => {
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
          useValue: {
            getAccessToken: () => 'token',
            currentUser: () =>
              options.currentUser ?? {
                id: 'user-1',
                ganaderoId: null,
                role: 'ADMIN',
                status: 'ACTIVE',
              },
          },
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
        }),
      ),
    ).resolves.toEqual([createAnimal({ syncStatus: 'synced', syncMessage: null })]);

    expect(get).toHaveBeenCalledTimes(1);
    const [requestedUrl, options] = get.mock.calls[0] as unknown as [
      string,
      { headers: HttpHeaders },
    ];
    expect(requestedUrl).toBe(
      '/api/animals?visible.contains=AR-100&ownerGanaderoId.equals=ganadero-uuid-1&active.equals=true&category.equals=VACA&page=0&size=20&sort=updatedAt,desc',
    );
    expect(options.headers.get('Authorization')).toBe('Bearer token');

    await expect(store.listSnapshots('ANIMAL')).resolves.toEqual([
      expect.objectContaining({
        key: 'ANIMAL:animal-uuid-1',
        entityId: 'animal-uuid-1',
      }),
    ]);
  });

  it('should list latest active animals for veterinary autocomplete with owner scope and pagination', async () => {
    const get = vi.fn(() =>
      of({ content: [createAnimal({ uuid: 'animal-latest', arete: 'BO-010' })] }),
    );
    const { service } = setup({ online: true, http: { get: get as never } });

    await expect(
      firstValueFrom(service.listActiveAnimals('ganadero-uuid-1', 0, 10)),
    ).resolves.toEqual([
      expect.objectContaining({
        uuid: 'animal-latest',
        arete: 'BO-010',
        active: true,
        syncStatus: 'synced',
      }),
    ]);

    const [requestedUrl, options] = get.mock.calls[0] as unknown as [
      string,
      { headers: HttpHeaders },
    ];
    expect(requestedUrl).toBe(
      '/api/animals?ownerGanaderoId.equals=ganadero-uuid-1&active.equals=true&page=0&size=10&sort=updatedAt,desc',
    );
    expect(options.headers.get('Authorization')).toBe('Bearer token');
  });

  it('should list active animals using visible search for arete marca or tatuaje', async () => {
    const get = vi.fn(() =>
      of({ content: [createAnimal({ uuid: 'animal-search', marca: 'M-77', tatuaje: 'T-88' })] }),
    );
    const { service } = setup({ online: true, http: { get: get as never } });

    await expect(
      firstValueFrom(service.listActiveAnimals('ganadero-uuid-1', 1, 5, 'M-77')),
    ).resolves.toEqual([
      expect.objectContaining({
        uuid: 'animal-search',
        marca: 'M-77',
        active: true,
        syncStatus: 'synced',
      }),
    ]);

    const [requestedUrl] = get.mock.calls[0] as unknown as [string];
    expect(requestedUrl).toBe(
      '/api/animals?visible.contains=M-77&ownerGanaderoId.equals=ganadero-uuid-1&active.equals=true&page=1&size=5&sort=updatedAt,desc',
    );
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
      { serverVersion: 4, reason: 'Hay un conflicto remoto.' },
    );

    await expect(
      firstValueFrom(
        service.listAnimals({
          visible: 'marca',
          ownerGanaderoId: 'ganadero-uuid-2',
          active: false,
          category: ANIMAL_CATEGORY.VAQUILLONA,
        }),
      ),
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

  it('should derive failed animal sync markers from the shared offline mapper', async () => {
    const { service, store } = setup({ online: false });
    await store.saveSnapshot({
      key: 'ANIMAL:animal-failed-1',
      entityType: 'ANIMAL',
      entityId: 'animal-failed-1',
      payload: { ...createAnimal({ uuid: 'animal-failed-1', arete: 'FAIL-1' }) },
      updatedAt: '2026-04-26T10:00:00.000Z',
      version: 1,
    });
    const operation = await store.enqueueOperation({
      entityType: 'ANIMAL',
      entityId: 'animal-failed-1',
      opType: 'UPDATE',
      payload: { arete: 'FAIL-1' },
      clientCreatedAt: '2026-04-26T10:06:00.000Z',
      clientUpdatedAt: '2026-04-26T10:06:00.000Z',
    });
    await store.markFailed(operation.operationId, {
      code: 'ANIMAL_RETRY_EXHAUSTED',
      message: 'No se pudo sincronizar.',
    });

    await expect(firstValueFrom(service.listAnimals({ visible: 'FAIL-1' }))).resolves.toEqual([
      expect.objectContaining({
        uuid: 'animal-failed-1',
        syncStatus: 'failed',
        syncMessage: 'No se pudo sincronizar.',
      }),
    ]);
  });

  it('should force ganadero owner scope for online requests and local snapshot reads', async () => {
    const get = vi.fn(() =>
      of({ content: [createAnimal({ ownerGanaderoId: 'ganadero-user-1' })] }),
    );
    const { service, store } = setup({
      online: true,
      http: { get: get as never },
      currentUser: {
        id: 'user-1',
        ganaderoId: 'ganadero-user-1',
        role: 'GANADERO',
        status: 'ACTIVE',
      },
    });

    await expect(
      firstValueFrom(service.listAnimals({ ownerGanaderoId: 'spoofed-owner' })),
    ).resolves.toEqual([
      createAnimal({ ownerGanaderoId: 'ganadero-user-1', syncStatus: 'synced', syncMessage: null }),
    ]);

    const [ganaderoRequestedUrl] = get.mock.calls[0] as unknown as [string];
    expect(ganaderoRequestedUrl).toBe(
      '/api/animals?ownerGanaderoId.equals=ganadero-user-1&page=0&size=20&sort=updatedAt,desc',
    );

    await store.saveSnapshot({
      key: 'ANIMAL:other-animal',
      entityType: 'ANIMAL',
      entityId: 'other-animal',
      payload: {
        ...createAnimal({
          uuid: 'other-animal',
          ownerGanaderoId: 'other-owner',
          updatedAt: '2026-04-26T11:00:00.000Z',
        }),
      },
      updatedAt: '2026-04-26T11:00:00.000Z',
      version: 1,
    });

    service.configureForTesting({ offlineStatus: { isOnline: (() => false) as never } });
    await expect(firstValueFrom(service.listAnimals())).resolves.toEqual([
      createAnimal({ ownerGanaderoId: 'ganadero-user-1', syncStatus: 'synced', syncMessage: null }),
    ]);
  });

  it('should read a single animal by uuid online and preserve canonical identifiers', async () => {
    const get = vi.fn(() =>
      of(createAnimal({ uuid: 'animal-detail-1', motherAnimalUuid: 'mother-1' })),
    );
    const { service, store } = setup({ online: true, http: { get: get as never } });

    await expect(firstValueFrom(service.getAnimal('animal-detail-1'))).resolves.toEqual(
      createAnimal({
        uuid: 'animal-detail-1',
        motherAnimalUuid: 'mother-1',
        syncStatus: 'synced',
        syncMessage: null,
      }),
    );

    expect(get).toHaveBeenCalledWith('/api/animals/animal-detail-1', {
      headers: expect.any(HttpHeaders),
    });
    await expect(store.listSnapshots('ANIMAL')).resolves.toEqual([
      expect.objectContaining({ key: 'ANIMAL:animal-detail-1', entityId: 'animal-detail-1' }),
    ]);
  });

  it('should read a safe immediate genealogy response from the backend', async () => {
    const get = vi.fn(() =>
      of({
        animal: createAnimal({ uuid: 'animal-detail-1', arete: 'CRIA-001' }),
        mother: createAnimal({ uuid: 'mother-1', arete: 'MADRE-001' }),
        father: null,
        offspring: [createAnimal({ uuid: 'offspring-1', arete: 'CRIA-002' })],
      }),
    );
    const { service } = setup({ online: true, http: { get: get as never } });

    await expect(firstValueFrom(service.getGenealogy('animal-detail-1'))).resolves.toEqual({
      animal: createAnimal({
        uuid: 'animal-detail-1',
        arete: 'CRIA-001',
        syncStatus: 'synced',
        syncMessage: null,
      }),
      mother: createAnimal({
        uuid: 'mother-1',
        arete: 'MADRE-001',
        syncStatus: 'synced',
        syncMessage: null,
      }),
      father: null,
      offspring: [
        createAnimal({
          uuid: 'offspring-1',
          arete: 'CRIA-002',
          syncStatus: 'synced',
          syncMessage: null,
        }),
      ],
      ancestors: null,
    });
    expect(get).toHaveBeenCalledWith('/api/animals/animal-detail-1/genealogy', {
      headers: expect.any(HttpHeaders),
    });
  });

  it('should request limited genealogy generations and map ancestor nodes', async () => {
    const get = vi.fn(() =>
      of({
        animal: createAnimal({ uuid: 'animal-detail-1', arete: 'CRIA-001' }),
        mother: createAnimal({ uuid: 'mother-1', arete: 'MADRE-001' }),
        father: createAnimal({
          uuid: 'father-1',
          arete: 'PADRE-001',
          category: ANIMAL_CATEGORY.TORO,
          sex: ANIMAL_SEX.MACHO,
        }),
        offspring: [],
        ancestors: {
          animal: createAnimal({ uuid: 'animal-detail-1', arete: 'CRIA-001' }),
          mother: {
            animal: createAnimal({ uuid: 'mother-1', arete: 'MADRE-001' }),
            mother: {
              animal: createAnimal({ uuid: 'maternal-grandmother-1', arete: 'ABUELA-M-001' }),
            },
          },
        },
      }),
    );
    const { service } = setup({ online: true, http: { get: get as never } });

    await expect(firstValueFrom(service.getGenealogy('animal-detail-1', 2))).resolves.toEqual({
      animal: createAnimal({
        uuid: 'animal-detail-1',
        arete: 'CRIA-001',
        syncStatus: 'synced',
        syncMessage: null,
      }),
      mother: createAnimal({
        uuid: 'mother-1',
        arete: 'MADRE-001',
        syncStatus: 'synced',
        syncMessage: null,
      }),
      father: createAnimal({
        uuid: 'father-1',
        arete: 'PADRE-001',
        category: ANIMAL_CATEGORY.TORO,
        sex: ANIMAL_SEX.MACHO,
        syncStatus: 'synced',
        syncMessage: null,
      }),
      offspring: [],
      ancestors: {
        animal: createAnimal({
          uuid: 'animal-detail-1',
          arete: 'CRIA-001',
          syncStatus: 'synced',
          syncMessage: null,
        }),
        father: null,
        mother: {
          animal: createAnimal({
            uuid: 'mother-1',
            arete: 'MADRE-001',
            syncStatus: 'synced',
            syncMessage: null,
          }),
          father: null,
          mother: {
            animal: createAnimal({
              uuid: 'maternal-grandmother-1',
              arete: 'ABUELA-M-001',
              syncStatus: 'synced',
              syncMessage: null,
            }),
            mother: null,
            father: null,
          },
        },
      },
    });
    expect(get).toHaveBeenCalledWith('/api/animals/animal-detail-1/genealogy?generations=2', {
      headers: expect.any(HttpHeaders),
    });
  });

  it('should post birth registration to the mother endpoint and return created offspring', async () => {
    const createdCalf = createAnimal({
      uuid: 'calf-uuid-1',
      arete: 'CRIA-001',
      category: ANIMAL_CATEGORY.TERNERA,
      sex: ANIMAL_SEX.HEMBRA,
      motherAnimalUuid: 'mother-uuid-1',
      fatherAnimalUuid: 'father-uuid-1',
      birthDate: '2026-05-10',
      admissionDate: '2026-05-10',
    });
    const post = vi.fn(() =>
      of({
        eventId: 'event-uuid-1',
        motherAnimalUuid: 'mother-uuid-1',
        fatherAnimalUuid: 'father-uuid-1',
        birthDate: '2026-05-10',
        offspringCount: 1,
        offspring: [createdCalf],
      }),
    );
    const { service, store } = setup({ online: true, http: { post: post as never } });

    await expect(
      firstValueFrom(
        service.registerBirth('mother-uuid-1', {
          birthDate: '2026-05-10',
          fatherAnimalUuid: 'father-uuid-1',
          notes: 'Parto en corral',
          offspring: [
            {
              arete: 'CRIA-001',
              category: ANIMAL_CATEGORY.TERNERA,
              sex: ANIMAL_SEX.HEMBRA,
              active: true,
              weightKg: 31.25,
            },
          ],
        }),
      ),
    ).resolves.toEqual({
      eventId: 'event-uuid-1',
      motherAnimalUuid: 'mother-uuid-1',
      fatherAnimalUuid: 'father-uuid-1',
      birthDate: '2026-05-10',
      offspringCount: 1,
      offspring: [createdCalf],
    });

    expect(post).toHaveBeenCalledWith(
      '/api/animals/mother-uuid-1/birth-registration',
      {
        birthDate: '2026-05-10',
        fatherAnimalUuid: 'father-uuid-1',
        notes: 'Parto en corral',
        offspring: [
          {
            arete: 'CRIA-001',
            category: ANIMAL_CATEGORY.TERNERA,
            sex: ANIMAL_SEX.HEMBRA,
            active: true,
            weightKg: 31.25,
          },
        ],
      },
      {
        headers: expect.any(HttpHeaders),
      },
    );
    await expect(store.listSnapshots('ANIMAL')).resolves.toEqual([
      expect.objectContaining({ key: 'ANIMAL:calf-uuid-1', entityId: 'calf-uuid-1' }),
    ]);
  });

  it('should fail closed for ganadero local and online reads when session has no ganaderoId', async () => {
    const get = vi.fn(() => of({ content: [] }));
    const { service, store } = setup({
      online: true,
      http: { get: get as never },
      currentUser: { id: 'user-1', ganaderoId: null, role: 'GANADERO', status: 'ACTIVE' },
    });

    await firstValueFrom(service.listAnimals());
    const [requestedUrl] = get.mock.calls[0] as unknown as [string];
    expect(requestedUrl).toBe(
      '/api/animals?ownerGanaderoId.equals=__NO_AUTHENTICATED_GANADERO__&page=0&size=20&sort=updatedAt,desc',
    );

    await store.saveSnapshot({
      key: 'ANIMAL:animal-uuid-1',
      entityType: 'ANIMAL',
      entityId: 'animal-uuid-1',
      payload: { ...createAnimal({ ownerGanaderoId: 'ganadero-user-1' }) },
      updatedAt: '2026-04-26T10:00:00.000Z',
      version: 1,
    });

    service.configureForTesting({ offlineStatus: { isOnline: (() => false) as never } });
    await expect(firstValueFrom(service.listAnimals())).resolves.toEqual([]);
  });

  it('should queue online animal updates by canonical uuid and preserve the uuid-based snapshot key', async () => {
    const updatedAnimal = createAnimal({ uuid: 'animal-uuid-9', arete: 'AR-999', version: 7 });
    const put = vi.fn(() => of(updatedAnimal));
    const { service, store } = setup({ online: true, http: { put: put as never } });

    await expect(
      firstValueFrom(
        service.updateAnimal('animal-uuid-9', {
          ownerGanaderoId: 'ganadero-uuid-1',
          motherAnimalUuid: 'mother-uuid-1',
          fatherAnimalUuid: 'father-uuid-1',
          arete: ' AR-999 ',
          category: ANIMAL_CATEGORY.VACA,
          active: true,
          admissionDate: '2026-04-26',
          weightKg: 420,
        }),
      ),
    ).resolves.toEqual({
      outcome: 'queued',
      message: 'Actualización de animal encolada. Se disparó la sincronización automática.',
    });

    expect(put).not.toHaveBeenCalled();

    await expect(store.listSnapshots('ANIMAL')).resolves.toEqual([
      expect.objectContaining({
        key: 'ANIMAL:animal-uuid-9',
        entityId: 'animal-uuid-9',
        payload: expect.objectContaining({
          motherAnimalUuid: 'mother-uuid-1',
          fatherAnimalUuid: 'father-uuid-1',
        }),
      }),
    ]);
  });

  it('should queue animal creation offline using the canonical uuid as entity identity and keep a stable local snapshot', async () => {
    const dispatchEvent = vi.spyOn(window, 'dispatchEvent');
    const { service, store } = setup({ online: true });
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(
      '11111111-2222-4333-8444-555555555555',
    );

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
        }),
      ),
    ).resolves.toEqual({
      outcome: 'queued',
      animalUuid: '11111111-2222-4333-8444-555555555555',
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
      }),
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
    expect(dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: MANUAL_SYNC_EVENT }),
    );
    expect(service.syncState().pending).toBe(1);
  });

  it('should keep a freshly created animal visible when the next online list response is still stale', async () => {
    const remoteAnimal = createAnimal({ uuid: 'remote-animal-1', arete: 'AR-100' });
    const get = vi.fn(() => of({ content: [remoteAnimal] }));
    const { service, store } = setup({ online: true, http: { get: get as never } });
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(
      '44444444-5555-4666-8777-888888888888',
    );

    await firstValueFrom(
      service.createAnimal({
        ownerGanaderoId: 'ganadero-uuid-1',
        arete: 'AR-NEW',
        category: ANIMAL_CATEGORY.VACA,
        sex: ANIMAL_SEX.HEMBRA,
        active: true,
        admissionDate: '2026-05-11',
      }),
    );
    const [createOperation] = await store.listOutbox();
    await store.markAcked(createOperation.operationId);

    await expect(firstValueFrom(service.listAnimals())).resolves.toEqual([
      expect.objectContaining({
        uuid: '44444444-5555-4666-8777-888888888888',
        arete: 'AR-NEW',
        syncStatus: 'synced',
      }),
      expect.objectContaining({ uuid: 'remote-animal-1', arete: 'AR-100', syncStatus: 'synced' }),
    ]);
    expect(get).toHaveBeenCalledWith('/api/animals?page=0&size=20&sort=updatedAt,desc', {
      headers: expect.any(HttpHeaders),
    });
  });

  it('should transition an offline animal update badge to synced after reconnect acknowledgement', async () => {
    const get = vi.fn(() => of({ content: [] }));
    const { service, store } = setup({ online: false, http: { get: get as never } });
    await store.saveSnapshot({
      key: 'ANIMAL:animal-uuid-sync-1',
      entityType: 'ANIMAL',
      entityId: 'animal-uuid-sync-1',
      payload: {
        ...createAnimal({ uuid: 'animal-uuid-sync-1', arete: 'AR-SYNC-OLD', version: 5 }),
      },
      updatedAt: '2026-04-26T10:00:00.000Z',
      version: 5,
    });

    await firstValueFrom(
      service.updateAnimal('animal-uuid-sync-1', {
        ownerGanaderoId: 'ganadero-uuid-1',
        arete: 'AR-SYNC-NEW',
        category: ANIMAL_CATEGORY.VACA,
        active: true,
        admissionDate: '2026-04-26',
      }),
    );
    const [updateOperation] = await store.listOutbox();
    await store.markAcked(updateOperation.operationId);
    service.configureForTesting({ offlineStatus: { isOnline: (() => true) as never } });

    await expect(firstValueFrom(service.listAnimals())).resolves.toEqual([
      expect.objectContaining({
        uuid: 'animal-uuid-sync-1',
        arete: 'AR-SYNC-NEW',
        syncStatus: 'synced',
        syncMessage: null,
      }),
    ]);
    expect(get).toHaveBeenCalledWith('/api/animals?page=0&size=20&sort=updatedAt,desc', {
      headers: expect.any(HttpHeaders),
    });
  });

  it('should apply current list filters before merging freshly created snapshots into a stale online response', async () => {
    const get = vi.fn(() => of({ content: [] }));
    const { service, store } = setup({ online: true, http: { get: get as never } });
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(
      '55555555-6666-4777-8888-999999999999',
    );

    await firstValueFrom(
      service.createAnimal({
        ownerGanaderoId: 'ganadero-uuid-1',
        arete: 'AR-FILTERED',
        category: ANIMAL_CATEGORY.VACA,
        sex: ANIMAL_SEX.HEMBRA,
        active: true,
        admissionDate: '2026-05-11',
      }),
    );
    const [createOperation] = await store.listOutbox();
    await store.markAcked(createOperation.operationId);

    await expect(
      firstValueFrom(service.listAnimals({ ownerGanaderoId: 'other-ganadero' })),
    ).resolves.toEqual([]);
  });

  it('should scope ganadero offline creates without owner uuid to the authenticated ganadero and keep them visible', async () => {
    const { service, store } = setup({
      online: false,
      currentUser: {
        id: 'user-1',
        ganaderoId: 'ganadero-user-1',
        role: 'GANADERO',
        status: 'ACTIVE',
      },
    });
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(
      '99999999-2222-4333-8444-555555555555',
    );

    await expect(
      firstValueFrom(
        service.createAnimal({
          arete: 'AR-551',
          category: ANIMAL_CATEGORY.VACA,
          sex: ANIMAL_SEX.HEMBRA,
          active: true,
          admissionDate: '2026-04-26',
        }),
      ),
    ).resolves.toEqual({
      outcome: 'queued',
      animalUuid: '99999999-2222-4333-8444-555555555555',
      message: 'Alta de animal encolada. Se enviará al reconectar.',
    });

    const outbox = await store.listOutbox();
    expect(outbox[0]?.payload).toEqual(
      expect.objectContaining({ ownerGanaderoId: 'ganadero-user-1' }),
    );
    await expect(store.listSnapshots('ANIMAL')).resolves.toEqual([
      expect.objectContaining({
        payload: expect.objectContaining({ ownerGanaderoId: 'ganadero-user-1' }),
      }),
    ]);
    await expect(
      firstValueFrom(service.listActiveAnimals('ganadero-user-1', 0, 10)),
    ).resolves.toEqual([
      expect.objectContaining({
        uuid: '99999999-2222-4333-8444-555555555555',
        ownerGanaderoId: 'ganadero-user-1',
        syncStatus: 'pending',
      }),
    ]);
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
        }),
      ),
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
      }),
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
    expect(dispatchEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: MANUAL_SYNC_EVENT }),
    );
    expect(service.syncState().pending).toBe(1);
  });

  it('should scope ganadero offline updates without owner uuid to the authenticated ganadero and keep them visible', async () => {
    const { service, store } = setup({
      online: false,
      currentUser: {
        id: 'user-1',
        ganaderoId: 'ganadero-user-1',
        role: 'GANADERO',
        status: 'ACTIVE',
      },
    });
    await store.saveSnapshot({
      key: 'ANIMAL:animal-ganadero-update',
      entityType: 'ANIMAL',
      entityId: 'animal-ganadero-update',
      payload: {
        ...createAnimal({
          uuid: 'animal-ganadero-update',
          ownerGanaderoId: 'ganadero-user-1',
          arete: 'AR-OLD',
          version: 5,
        }),
      },
      updatedAt: '2026-04-26T10:00:00.000Z',
      version: 5,
    });

    await expect(
      firstValueFrom(
        service.updateAnimal('animal-ganadero-update', {
          arete: 'AR-NEW',
          category: ANIMAL_CATEGORY.VACA,
          active: true,
          admissionDate: '2026-04-26',
        }),
      ),
    ).resolves.toEqual({
      outcome: 'queued',
      message: 'Actualización de animal encolada. Se enviará al reconectar.',
    });

    const outbox = await store.listOutbox();
    expect(outbox[0]?.payload).toEqual(
      expect.objectContaining({ ownerGanaderoId: 'ganadero-user-1' }),
    );
    await expect(
      firstValueFrom(service.listActiveAnimals('ganadero-user-1', 0, 10)),
    ).resolves.toEqual([
      expect.objectContaining({
        uuid: 'animal-ganadero-update',
        ownerGanaderoId: 'ganadero-user-1',
        arete: 'AR-NEW',
        syncStatus: 'pending',
      }),
    ]);
  });

  it('should fail closed when a ganadero without ganaderoId queues an animal without owner', async () => {
    const { service, store } = setup({
      online: false,
      currentUser: { id: 'user-1', ganaderoId: null, role: 'GANADERO', status: 'ACTIVE' },
    });

    await expect(
      firstValueFrom(
        service.createAnimal({
          arete: 'AR-NO-GANADERO',
          category: ANIMAL_CATEGORY.VACA,
          active: true,
          admissionDate: '2026-04-26',
        }),
      ),
    ).resolves.toEqual({
      outcome: 'blocked',
      message: 'No pudimos identificar el ganadero autenticado para encolar el animal.',
    });
    await expect(store.listOutbox()).resolves.toEqual([]);
    await expect(store.listSnapshots('ANIMAL')).resolves.toEqual([]);
  });

  it('should preserve sex and birthDate in optimistic offline animal snapshots', async () => {
    const { service, store } = setup({ online: false });
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(
      '22222222-3333-4444-8555-666666666666',
    );

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
      }),
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

  it('should preserve animal characteristics in queued create payloads and optimistic snapshots', async () => {
    const { service, store } = setup({ online: false });
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(
      '33333333-4444-4555-8666-777777777777',
    );

    await firstValueFrom(
      service.createAnimal({
        ownerGanaderoId: 'ganadero-uuid-1',
        arete: 'AR-881',
        category: ANIMAL_CATEGORY.VACA,
        active: true,
        admissionDate: '2026-04-26',
        color: ' Colorado ',
        description: ' Bueno para carne ',
        breedUuid: 'raza-criolla-uuid',
      }),
    );

    const outbox = await store.listOutbox();
    expect(outbox[0]?.payload).toEqual(
      expect.objectContaining({
        color: 'Colorado',
        description: 'Bueno para carne',
        breedUuid: 'raza-criolla-uuid',
      }),
    );
    await expect(store.listSnapshots('ANIMAL')).resolves.toEqual([
      expect.objectContaining({
        payload: expect.objectContaining({
          color: 'Colorado',
          description: 'Bueno para carne',
          breedUuid: 'raza-criolla-uuid',
        }),
      }),
    ]);
  });

  it('should preserve unchanged breed and description when only color changes in an optimistic update', async () => {
    const { service, store } = setup({ online: false });
    await store.saveSnapshot({
      key: 'ANIMAL:animal-uuid-88',
      entityType: 'ANIMAL',
      entityId: 'animal-uuid-88',
      payload: {
        ...createAnimal({
          uuid: 'animal-uuid-88',
          color: 'Colorado',
          description: 'Bueno para carne',
          breedUuid: 'raza-criolla-uuid',
          breedName: 'Criolla',
        }),
      },
      updatedAt: '2026-04-26T10:00:00.000Z',
      version: 5,
    });

    await firstValueFrom(
      service.updateAnimal('animal-uuid-88', {
        ownerGanaderoId: 'ganadero-uuid-1',
        arete: 'AR-881',
        category: ANIMAL_CATEGORY.VACA,
        active: true,
        admissionDate: '2026-04-26',
        color: 'Negro',
      }),
    );

    await expect(firstValueFrom(service.listAnimals())).resolves.toEqual([
      expect.objectContaining({
        uuid: 'animal-uuid-88',
        color: 'Negro',
        description: 'Bueno para carne',
        breedUuid: 'raza-criolla-uuid',
        breedName: 'Criolla',
      }),
    ]);
  });
});
