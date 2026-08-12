import { HttpClient, HttpHeaders } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { AuthService, type SessionUser } from '../../../../core/auth/data-access/auth.service';
import { ApplicationConfigService } from '../../../../core/config/application-config.service';
import { InMemoryOfflinePersistenceAdapter } from '../../../../core/offline/offline-store.migrations';
import { OfflineStatusService } from '../../../../core/offline/offline-status.service';
import { OfflineEntityChangeBus } from '../../../../core/offline/offline-entity-change-bus.service';
import { OfflineStoreService } from '../../../../core/offline/offline-store.service';
import { SyncMetricsStore } from '../../../../core/offline/sync-metrics.store';
import { AnimalsService, type AnimalItem } from './animals.service';
import {
  AnimalsHealthEventsService,
  type AnimalHealthEventItem,
} from './animals-health-events.service';

describe('AnimalsHealthEventsService', () => {
  const currentUser: SessionUser = {
    id: 'user-1',
    ganaderoId: null,
    username: 'admin',
    email: 'admin@hato.bo',
    displayName: 'Admin',
    role: 'ADMIN',
    status: 'ACTIVE',
    version: 1,
    updatedAt: '2026-04-26T10:00:00.000Z',
    lastSyncedAt: null,
  };

  const ganaderoUser: SessionUser = {
    ...currentUser,
    id: 'gan-user-1',
    ganaderoId: 'gan-1',
    username: 'ganadero',
    role: 'GANADERO',
  };

  const createAnimal = (overrides: Partial<AnimalItem> = {}): AnimalItem => ({
    uuid: 'animal-uuid-1',
    ownerGanaderoId: 'gan-1',
    motherAnimalUuid: null,
    fatherAnimalUuid: null,
    arete: 'BO-001',
    marca: null,
    tatuaje: null,
    color: null,
    description: null,
    breedUuid: null,
    breedName: null,
    category: 'VACA',
    sex: 'HEMBRA',
    active: true,
    birthDate: null,
    admissionDate: '2026-04-01T00:00:00.000Z',
    weightKg: 420,
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-27T08:00:00.000Z',
    version: 1,
    lastSyncedAt: null,
    ...overrides,
  });

  const createEvent = (overrides: Partial<AnimalHealthEventItem> = {}): AnimalHealthEventItem => ({
    id: 'health-event-1',
    animalUuid: 'animal-uuid-1',
    healthEventType: 'VACCINATION',
    occurredAt: '2026-04-26T10:00:00.000Z',
    notes: 'Vacuna aplicada',
    performedByUserId: 'user-1',
    sourceChannel: 'ONLINE',
    operationId: 'health-event-1',
    metadata: { productName: 'Brucelosis' },
    clientCreatedAt: '2026-04-26T10:00:00.000Z',
    createdAt: '2026-04-26T10:00:01.000Z',
    updatedAt: '2026-04-26T10:00:01.000Z',
    ...overrides,
  });

  const setup = (options: {
    online: boolean;
    http?: Partial<Pick<HttpClient, 'get' | 'post'>>;
    user?: SessionUser;
    animalsService?: Pick<AnimalsService, 'listActiveAnimals' | 'listAnimals'>;
  }) => {
    TestBed.configureTestingModule({
      providers: [
        AnimalsHealthEventsService,
        SyncMetricsStore,
        {
          provide: HttpClient,
          useValue: {
            get: vi.fn(),
            post: vi.fn(() => of({ results: [] })),
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
            currentUser: () => options.user ?? currentUser,
          },
        },
        {
          provide: OfflineStatusService,
          useValue: { isOnline: () => options.online },
        },
        {
          provide: AnimalsService,
          useValue: options.animalsService ?? {
            listActiveAnimals: vi.fn(() => of([])),
            listAnimals: vi.fn(() => of([])),
          },
        },
      ],
    });

    const service = TestBed.inject(AnimalsHealthEventsService);
    const store = new OfflineStoreService(new InMemoryOfflinePersistenceAdapter());
    const entityChangeBus = new OfflineEntityChangeBus();
    service.configureForTesting({
      store,
      entityChangeBus,
      now: () => '2026-04-26T10:05:00.000Z',
      windowRef: window,
      animalsService: options.animalsService,
    });
    return { service, store, entityChangeBus };
  };

  afterEach(() => {
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it('should request filtered health timeline online and cache the snapshot by operation id', async () => {
    const get = vi.fn(() =>
      of({
        items: [
          createEvent(),
          createEvent({
            id: 'health-event-2',
            operationId: 'health-event-2',
            healthEventType: 'DEWORMING',
          }),
        ],
      }),
    );
    const { service, store } = setup({ online: true, http: { get: get as never } });

    await expect(
      firstValueFrom(
        service.listEvents('animal-uuid-1', {
          healthEventType: 'DEWORMING',
          occurredFrom: '2026-04-26T09:00:00.000Z',
          occurredTo: '2026-04-26T12:30:00.000Z',
        }),
      ),
    ).resolves.toEqual([
      expect.objectContaining({
        id: 'health-event-2',
        healthEventType: 'DEWORMING',
        syncStatus: 'synced',
        syncMessage: null,
      }),
    ]);

    const [requestedUrl, options] = get.mock.calls[0] as unknown as [
      string,
      { headers: HttpHeaders },
    ];
    expect(requestedUrl).toBe(
      '/api/animals/animal-uuid-1/health-events?healthEventType=DEWORMING&occurredFrom=2026-04-26T09%3A00%3A00.000Z&occurredTo=2026-04-26T12%3A30%3A00.000Z',
    );
    expect(options.headers.get('Authorization')).toBe('Bearer token');
    await expect(store.listSnapshots('ANIMAL_EVENT_LOG')).resolves.toEqual([
      expect.objectContaining({
        key: 'ANIMAL_EVENT_LOG:health-event-2',
        payload: expect.objectContaining({ eventCategory: 'HEALTH', eventType: 'DEWORMING' }),
      }),
    ]);
  });

  it('should derive treatment status from local timeline snapshots offline', async () => {
    const { service, store } = setup({ online: false });
    await store.saveSnapshot({
      key: 'ANIMAL_HEALTH_EVENT:event-1',
      entityType: 'ANIMAL_HEALTH_EVENT',
      entityId: 'event-1',
      payload: createEvent({
        id: 'event-1',
        operationId: 'event-1',
        healthEventType: 'TREATMENT_STARTED',
        metadata: { treatmentCaseId: 'CASE-1', productName: 'Oxitetraciclina' },
      }) as unknown as Record<string, unknown>,
      updatedAt: '2026-04-26T10:00:01.000Z',
    });
    await store.saveSnapshot({
      key: 'ANIMAL_HEALTH_EVENT:event-2',
      entityType: 'ANIMAL_HEALTH_EVENT',
      entityId: 'event-2',
      payload: createEvent({
        id: 'event-2',
        operationId: 'event-2',
        healthEventType: 'TREATMENT_CLOSED',
        occurredAt: '2026-04-26T11:00:00.000Z',
        createdAt: '2026-04-26T11:00:01.000Z',
        updatedAt: '2026-04-26T11:00:01.000Z',
        metadata: { treatmentCaseId: 'CASE-1', productName: 'Oxitetraciclina' },
      }) as unknown as Record<string, unknown>,
      updatedAt: '2026-04-26T11:00:01.000Z',
    });

    await expect(firstValueFrom(service.listEvents('animal-uuid-1'))).resolves.toEqual([
      expect.objectContaining({ id: 'event-1', treatmentStatus: 'closed', syncStatus: 'synced' }),
      expect.objectContaining({ id: 'event-2', treatmentStatus: 'closed', syncStatus: 'synced' }),
    ]);
  });

  it('should derive failed health event sync markers from the shared offline mapper', async () => {
    const { service, store } = setup({ online: false });
    await store.saveSnapshot({
      key: 'ANIMAL_HEALTH_EVENT:health-failed-1',
      entityType: 'ANIMAL_HEALTH_EVENT',
      entityId: 'health-failed-1',
      payload: createEvent({
        id: 'health-failed-1',
        operationId: 'health-failed-1',
      }) as unknown as Record<string, unknown>,
      updatedAt: '2026-04-26T10:00:01.000Z',
    });
    const failed = await store.enqueueOperation({
      entityType: 'ANIMAL_HEALTH_EVENT',
      entityId: 'health-failed-1',
      opType: 'CREATE',
      payload: createEvent({
        id: 'health-failed-1',
        operationId: 'health-failed-1',
      }) as unknown as Record<string, unknown>,
      clientCreatedAt: '2026-04-26T10:00:00.000Z',
      clientUpdatedAt: '2026-04-26T10:00:00.000Z',
      operationId: 'health-failed-1',
    });
    await store.markFailed(failed.operationId, {
      code: 'HEALTH_SYNC_FAILED',
      message: 'Sanidad no sincronizada.',
    });

    await expect(firstValueFrom(service.listEvents('animal-uuid-1'))).resolves.toEqual([
      expect.objectContaining({
        id: 'health-failed-1',
        syncStatus: 'failed',
        syncMessage: 'Sanidad no sincronizada.',
      }),
    ]);
  });

  it('should request visitId filtering and normalize typed field vet visits online', async () => {
    const get = vi.fn(() =>
      of({
        items: [
          createEvent({
            id: 'visit-event-1',
            operationId: 'visit-event-1',
            healthEventType: 'FIELD_VET_VISIT',
            metadata: {
              visit: { visitId: 'VISIT-1' },
              checklist: [{ code: 'TEMPERATURE', ok: true }],
              clinicalNote: { reason: 'Control', findings: 'Ok', plan: 'Seguir' },
              protocol: { status: 'FOLLOW_UP_REQUIRED', nextDueAt: '2026-04-28T10:00:00.000Z' },
            },
            visitId: 'VISIT-1',
            nextDueAt: '2026-04-28T10:00:00.000Z',
          }),
        ],
      }),
    );
    const { service } = setup({ online: true, http: { get: get as never } });

    await expect(
      firstValueFrom(
        service.listEvents('animal-uuid-1', {
          healthEventType: 'FIELD_VET_VISIT',
          visitId: 'VISIT-1',
        }),
      ),
    ).resolves.toEqual([
      expect.objectContaining({
        healthEventType: 'FIELD_VET_VISIT',
        visitId: 'VISIT-1',
        nextDueAt: '2026-04-28T10:00:00.000Z',
      }),
    ]);

    const [requestedUrl] = get.mock.calls[0] as unknown as [string];
    expect(requestedUrl).toBe(
      '/api/animals/animal-uuid-1/health-events?healthEventType=FIELD_VET_VISIT&visitId=VISIT-1',
    );
  });

  it('should queue health events offline without dispatching manual sync', async () => {
    const dispatchEvent = vi.spyOn(window, 'dispatchEvent');
    const { service, store } = setup({ online: false });

    await expect(
      firstValueFrom(
        service.createEvent({
          animalUuid: 'animal-uuid-1',
          healthEventType: 'DISEASE_REPORTED',
          occurredAt: '2026-04-26T10:15:00.000Z',
          notes: 'Tos y fiebre',
          metadata: {
            diagnosisCode: 'RESP-01',
          },
        }),
      ),
    ).resolves.toEqual({
      outcome: 'queued',
      message: 'Evento sanitario encolado. Se enviará al reconectar.',
    });

    const outbox = await store.listOutbox();
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toEqual(
      expect.objectContaining({
        entityType: 'ANIMAL_EVENT_LOG',
        payload: expect.objectContaining({
          eventCategory: 'HEALTH',
          eventType: 'DISEASE_REPORTED',
          healthEventType: 'DISEASE_REPORTED',
          sourceChannel: 'OFFLINE',
        }),
      }),
    );
    await expect(store.listSnapshots('ANIMAL_EVENT_LOG')).resolves.toEqual([
      expect.objectContaining({
        payload: expect.objectContaining({
          eventCategory: 'HEALTH',
          eventType: 'DISEASE_REPORTED',
          syncStatus: 'pending',
          syncMessage: 'Pendiente de sincronización.',
        }),
      }),
    ]);
    expect(dispatchEvent).not.toHaveBeenCalled();
  });

  it('should emit ANIMAL_EVENT_LOG and VET_VISIT changes for offline field vet visit creation', async () => {
    const { service, store, entityChangeBus } = setup({ online: false });
    const changes: Array<unknown> = [];
    entityChangeBus.changes$.subscribe((change) => changes.push(change));

    await expect(
      firstValueFrom(
        service.createEvent({
          animalUuid: 'animal-uuid-1',
          healthEventType: 'FIELD_VET_VISIT',
          occurredAt: '2026-05-11T09:00:00.000Z',
          notes: 'Control en campo',
          metadata: {
            visit: { visitId: 'VISIT-OFFLINE-1', mode: 'SPECIFIC', status: 'PENDING' },
            checklist: [],
            clinicalNote: { reason: 'Control', findings: 'Ok', plan: 'Seguimiento' },
            protocol: { status: 'STARTED' },
          },
        }),
      ),
    ).resolves.toEqual({
      outcome: 'queued',
      message: 'Evento sanitario encolado. Se enviará al reconectar.',
    });

    const [operation] = await store.listOutbox();
    expect(changes).toEqual([
      expect.objectContaining({
        entity: 'ANIMAL_EVENT_LOG',
        source: 'local-mutation',
        operation: 'create',
        ids: [operation.operationId],
      }),
      expect.objectContaining({
        entity: 'VET_VISIT',
        source: 'local-mutation',
        operation: 'snapshot-upsert',
        ids: ['VISIT-OFFLINE-1'],
      }),
    ]);
  });

  it('should emit online mutation changes for online field vet visit creation', async () => {
    const post = vi.fn(() =>
      of({
        results: [
          {
            operationId: '22222222-2222-4222-8222-222222222222',
            entityType: 'ANIMAL_EVENT_LOG',
            entityId: 'health-online-visit-1',
            classification: 'no_conflict',
          },
        ],
      }),
    );
    const { service, store, entityChangeBus } = setup({
      online: true,
      http: { post: post as never },
    });
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(
      '22222222-2222-4222-8222-222222222222',
    );
    const changes: Array<unknown> = [];
    entityChangeBus.changes$.subscribe((change) => changes.push(change));

    await firstValueFrom(
      service.createEvent({
        animalUuid: 'animal-uuid-1',
        healthEventType: 'FIELD_VET_VISIT',
        occurredAt: '2026-05-11T09:00:00.000Z',
        notes: 'Control en campo',
        metadata: {
          visit: { visitId: 'VISIT-ONLINE-1', mode: 'SPECIFIC', status: 'PENDING' },
          checklist: [],
          clinicalNote: { reason: 'Control', findings: 'Ok', plan: 'Seguimiento' },
          protocol: { status: 'STARTED' },
        },
      }),
    );

    await expect(store.listOutbox()).resolves.toEqual([]);
    expect(changes).toEqual([
      expect.objectContaining({
        entity: 'ANIMAL_EVENT_LOG',
        source: 'online-mutation',
        operation: 'create',
        ids: ['22222222-2222-4222-8222-222222222222'],
      }),
      expect.objectContaining({
        entity: 'VET_VISIT',
        source: 'online-mutation',
        operation: 'snapshot-upsert',
        ids: ['VISIT-ONLINE-1'],
      }),
    ]);
  });

  it('should save health events directly online without outbox retries', async () => {
    const post = vi.fn(() =>
      of({
        results: [
          {
            operationId: '33333333-3333-4333-8333-333333333333',
            entityType: 'ANIMAL_EVENT_LOG',
            entityId: 'health-online-1',
            classification: 'no_conflict',
          },
        ],
      }),
    );
    const { service, store } = setup({ online: true, http: { post: post as never } });
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(
      '33333333-3333-4333-8333-333333333333',
    );

    await expect(
      firstValueFrom(
        service.createEvent({
          animalUuid: 'animal-uuid-1',
          healthEventType: 'TREATMENT_STARTED',
          occurredAt: '2026-04-26T10:15:00.000Z',
          notes: 'Inicio del tratamiento',
          metadata: {
            treatmentCaseId: 'CASE-77',
            productName: 'Oxitetraciclina',
          },
        }),
      ),
    ).resolves.toEqual({
      outcome: 'saved',
      message: 'Evento sanitario guardado correctamente.',
    });

    expect(post).toHaveBeenCalledWith(
      '/api/sync/push',
      expect.objectContaining({
        operations: [
          expect.objectContaining({
            operationId: '33333333-3333-4333-8333-333333333333',
            entityType: 'ANIMAL_EVENT_LOG',
            entityId: '33333333-3333-4333-8333-333333333333',
            opType: 'CREATE',
            payload: expect.objectContaining({
              animalUuid: 'animal-uuid-1',
              eventCategory: 'HEALTH',
              eventType: 'TREATMENT_STARTED',
              performedByUserId: 'user-1',
              sourceChannel: 'ONLINE',
            }),
          }),
        ],
      }),
      { headers: expect.any(HttpHeaders) },
    );
    await expect(store.listOutbox()).resolves.toEqual([]);
    await expect(store.listSnapshots('ANIMAL_EVENT_LOG')).resolves.toEqual([
      expect.objectContaining({
        key: 'ANIMAL_EVENT_LOG:health-online-1',
        payload: expect.objectContaining({
          eventCategory: 'HEALTH',
          eventType: 'TREATMENT_STARTED',
          healthEventType: 'TREATMENT_STARTED',
          syncStatus: 'synced',
        }),
      }),
    ]);
  });

  it('should save global veterinary visits directly online for all active animals of the authenticated ganadero', async () => {
    const post = vi.fn(() =>
      of({
        results: [
          {
            operationId: '44444444-4444-4444-8444-444444444444',
            entityType: 'ANIMAL_EVENT_LOG',
            entityId: 'global-health-online-1',
            classification: 'no_conflict',
          },
          {
            operationId: '55555555-5555-4555-8555-555555555555',
            entityType: 'ANIMAL_EVENT_LOG',
            entityId: 'global-health-online-2',
            classification: 'no_conflict',
          },
        ],
      }),
    );
    const animalsService = {
      listActiveAnimals: vi.fn(() =>
        of([
          createAnimal({
            uuid: 'animal-active-1',
            arete: 'BO-001',
            updatedAt: '2026-04-27T08:00:00.000Z',
          }),
          createAnimal({
            uuid: 'animal-active-2',
            arete: 'BO-002',
            updatedAt: '2026-04-27T09:00:00.000Z',
          }),
        ]),
      ),
      listAnimals: vi.fn(() => of([])),
    } satisfies Pick<AnimalsService, 'listActiveAnimals' | 'listAnimals'>;
    const { service, store } = setup({
      online: true,
      user: ganaderoUser,
      animalsService,
      http: { post: post as never },
    });
    vi.spyOn(globalThis.crypto, 'randomUUID')
      .mockReturnValueOnce('44444444-4444-4444-8444-444444444444')
      .mockReturnValueOnce('55555555-5555-4555-8555-555555555555');

    await expect(
      firstValueFrom(
        service.createEvent({
          animalUuid: '',
          healthEventType: 'FIELD_VET_VISIT',
          occurredAt: '2026-05-11T09:00',
          notes: 'Campaña anual',
          metadata: {
            visit: {
              visitId: 'VISIT-GLOBAL-1',
              mode: 'GLOBAL',
              status: 'PENDING',
              veterinarian: { name: 'Dra. Luna' },
            },
            checklist: [],
            clinicalNote: {
              reason: 'Control anual',
              findings: 'Sin hallazgos',
              plan: 'Seguimiento',
            },
            protocol: { status: 'FOLLOW_UP_REQUIRED', nextDueAt: '2026-05-18T09:00:00.000Z' },
          },
        }),
      ),
    ).resolves.toEqual({
      outcome: 'saved',
      message: 'Campaña veterinaria guardada para 2 animales activos.',
    });

    expect(animalsService.listActiveAnimals).toHaveBeenCalledWith('gan-1', 0, 1000);
    expect(post).toHaveBeenCalledWith(
      '/api/sync/push',
      expect.objectContaining({
        operations: [
          expect.objectContaining({
            operationId: '44444444-4444-4444-8444-444444444444',
            payload: expect.objectContaining({ animalUuid: 'animal-active-1' }),
          }),
          expect.objectContaining({
            operationId: '55555555-5555-4555-8555-555555555555',
            payload: expect.objectContaining({ animalUuid: 'animal-active-2' }),
          }),
        ],
      }),
      { headers: expect.any(HttpHeaders) },
    );
    await expect(store.listOutbox()).resolves.toEqual([]);
    await expect(store.listSnapshots('ANIMAL_EVENT_LOG')).resolves.toEqual([
      expect.objectContaining({ key: 'ANIMAL_EVENT_LOG:global-health-online-1' }),
      expect.objectContaining({ key: 'ANIMAL_EVENT_LOG:global-health-online-2' }),
    ]);
  });

  it('should block global veterinary campaigns when the authenticated ganadero has no active animals', async () => {
    const dispatchEvent = vi.spyOn(window, 'dispatchEvent');
    const animalsService = {
      listActiveAnimals: vi.fn(() => of([])),
      listAnimals: vi.fn(() => of([])),
    } satisfies Pick<AnimalsService, 'listActiveAnimals' | 'listAnimals'>;
    const { service, store } = setup({ online: true, user: ganaderoUser, animalsService });

    await expect(
      firstValueFrom(
        service.createEvent({
          animalUuid: '',
          healthEventType: 'FIELD_VET_VISIT',
          occurredAt: '2026-05-11T09:00',
          notes: 'Campaña anual',
          metadata: {
            visit: {
              visitId: 'VISIT-GLOBAL-EMPTY',
              mode: 'GLOBAL',
              status: 'PENDING',
              veterinarian: { name: 'Dra. Luna' },
            },
            checklist: [],
            clinicalNote: {
              reason: 'Control anual',
              findings: 'Sin hallazgos',
              plan: 'Seguimiento',
            },
            protocol: { status: 'FOLLOW_UP_REQUIRED', nextDueAt: '2026-05-18T09:00:00.000Z' },
          },
        }),
      ),
    ).resolves.toEqual({
      outcome: 'blocked',
      message: 'No hay animales activos para registrar la campaña veterinaria.',
    });

    expect(animalsService.listActiveAnimals).toHaveBeenCalledWith('gan-1', 0, 1000);
    await expect(store.listOutbox()).resolves.toEqual([]);
    expect(dispatchEvent).not.toHaveBeenCalled();
  });
});
