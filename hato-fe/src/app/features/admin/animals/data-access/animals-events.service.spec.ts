import { HttpClient, HttpHeaders } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { AuthService, type SessionUser } from '../../../../core/auth/data-access/auth.service';
import { ApplicationConfigService } from '../../../../core/config/application-config.service';
import { InMemoryOfflinePersistenceAdapter } from '../../../../core/offline/offline-store.migrations';
import { OfflineStatusService } from '../../../../core/offline/offline-status.service';
import { OfflineStoreService } from '../../../../core/offline/offline-store.service';
import { SyncMetricsStore } from '../../../../core/offline/sync-metrics.store';
import { AnimalsEventsService, type AnimalEventItem } from './animals-events.service';

describe('AnimalsEventsService', () => {
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

  const createEvent = (overrides: Partial<AnimalEventItem> = {}): AnimalEventItem => ({
    id: 'event-1',
    animalUuid: 'animal-uuid-1',
    type: 'OBSERVATION',
    occurredAt: '2026-04-26T10:00:00.000Z',
    notes: 'Observación 1',
    performedByUserId: 'user-1',
    sourceChannel: 'ONLINE',
    operationId: 'event-1',
    metadata: { reasonCode: 'GENERAL_NOTE' },
    clientCreatedAt: '2026-04-26T10:00:00.000Z',
    createdAt: '2026-04-26T10:00:01.000Z',
    updatedAt: '2026-04-26T10:00:01.000Z',
    ...overrides,
  });

  const setup = (options: {
    online: boolean;
    http?: Partial<Pick<HttpClient, 'get' | 'post'>>;
  }) => {
    TestBed.configureTestingModule({
      providers: [
        AnimalsEventsService,
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
          useValue: { getAccessToken: () => 'token', currentUser: () => currentUser },
        },
        {
          provide: OfflineStatusService,
          useValue: { isOnline: () => options.online },
        },
      ],
    });

    const service = TestBed.inject(AnimalsEventsService);
    const store = new OfflineStoreService(new InMemoryOfflinePersistenceAdapter());
    service.configureForTesting({
      store,
      now: () => '2026-04-26T10:05:00.000Z',
      windowRef: window,
    });
    return { service, store };
  };

  afterEach(() => {
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it('should request filtered animal timeline online and cache the snapshot by operation id', async () => {
    const get = vi.fn(() =>
      of({
        items: [
          createEvent(),
          createEvent({
            id: 'event-2',
            operationId: 'event-2',
            type: 'SOLD',
            occurredAt: '2026-04-26T12:00:00.000Z',
          }),
        ],
      }),
    );
    const { service, store } = setup({ online: true, http: { get: get as never } });

    await expect(
      firstValueFrom(
        service.listEvents('animal-uuid-1', {
          eventType: 'SOLD',
          occurredFrom: '2026-04-26T09:00:00.000Z',
          occurredTo: '2026-04-26T12:30:00.000Z',
        }),
      ),
    ).resolves.toEqual([
      expect.objectContaining({
        id: 'event-2',
        type: 'SOLD',
        syncStatus: 'synced',
        syncMessage: null,
      }),
    ]);

    const [requestedUrl, options] = get.mock.calls[0] as unknown as [
      string,
      { headers: HttpHeaders },
    ];
    expect(requestedUrl).toBe(
      '/api/animals/animal-uuid-1/events?eventType=SOLD&occurredFrom=2026-04-26T09%3A00%3A00.000Z&occurredTo=2026-04-26T12%3A30%3A00.000Z',
    );
    expect(options.headers.get('Authorization')).toBe('Bearer token');
    await expect(store.listSnapshots('ANIMAL_EVENT_LOG')).resolves.toEqual([
      expect.objectContaining({
        key: 'ANIMAL_EVENT_LOG:event-2',
        payload: expect.objectContaining({ eventCategory: 'GENERAL', eventType: 'SOLD' }),
      }),
    ]);
  });

  it('should filter local timeline snapshots offline and keep deterministic event order with conflict badges', async () => {
    const { service, store } = setup({ online: false });
    await store.saveSnapshot({
      key: 'ANIMAL_EVENT:event-1',
      entityType: 'ANIMAL_EVENT',
      entityId: 'event-1',
      payload: createEvent({
        occurredAt: '2026-04-26T10:00:00.000Z',
        createdAt: '2026-04-26T10:00:01.000Z',
        notes: 'Primero',
      }) as unknown as Record<string, unknown>,
      updatedAt: '2026-04-26T10:00:01.000Z',
    });
    await store.saveSnapshot({
      key: 'ANIMAL_EVENT:event-2',
      entityType: 'ANIMAL_EVENT',
      entityId: 'event-2',
      payload: createEvent({
        id: 'event-2',
        operationId: 'event-2',
        occurredAt: '2026-04-26T10:00:00.000Z',
        createdAt: '2026-04-26T10:00:02.000Z',
        notes: 'Segundo',
      }) as unknown as Record<string, unknown>,
      updatedAt: '2026-04-26T10:00:02.000Z',
    });
    const conflict = await store.enqueueOperation({
      entityType: 'ANIMAL_EVENT',
      entityId: 'event-2',
      opType: 'CREATE',
      payload: createEvent({ id: 'event-2', operationId: 'event-2' }) as unknown as Record<
        string,
        unknown
      >,
      clientCreatedAt: '2026-04-26T10:00:00.000Z',
      clientUpdatedAt: '2026-04-26T10:00:00.000Z',
      operationId: 'event-2',
    });
    await store.markConflict(
      conflict.operationId,
      { code: 'EVENT_CONFLICT', message: 'Hay un conflicto remoto.' },
      { serverVersion: 2, reason: 'Hay un conflicto remoto.' },
    );

    await expect(firstValueFrom(service.listEvents('animal-uuid-1'))).resolves.toEqual([
      expect.objectContaining({ id: 'event-1', notes: 'Primero', syncStatus: 'synced' }),
      expect.objectContaining({
        id: 'event-2',
        notes: 'Segundo',
        syncStatus: 'conflict',
        syncMessage: 'Hay un conflicto remoto.',
      }),
    ]);
  });

  it('should derive failed general event sync markers from the shared offline mapper', async () => {
    const { service, store } = setup({ online: false });
    await store.saveSnapshot({
      key: 'ANIMAL_EVENT:event-failed-1',
      entityType: 'ANIMAL_EVENT',
      entityId: 'event-failed-1',
      payload: createEvent({
        id: 'event-failed-1',
        operationId: 'event-failed-1',
      }) as unknown as Record<string, unknown>,
      updatedAt: '2026-04-26T10:00:01.000Z',
    });
    const failed = await store.enqueueOperation({
      entityType: 'ANIMAL_EVENT',
      entityId: 'event-failed-1',
      opType: 'CREATE',
      payload: createEvent({
        id: 'event-failed-1',
        operationId: 'event-failed-1',
      }) as unknown as Record<string, unknown>,
      clientCreatedAt: '2026-04-26T10:00:00.000Z',
      clientUpdatedAt: '2026-04-26T10:00:00.000Z',
      operationId: 'event-failed-1',
    });
    await store.markDeadLetter(failed.operationId, {
      code: 'EVENT_RETRY_EXHAUSTED',
      message: 'Evento no sincronizado.',
    });

    await expect(firstValueFrom(service.listEvents('animal-uuid-1'))).resolves.toEqual([
      expect.objectContaining({
        id: 'event-failed-1',
        syncStatus: 'failed',
        syncMessage: 'Evento no sincronizado.',
      }),
    ]);
  });

  it('should save animal events directly online without outbox retries', async () => {
    const post = vi.fn(() =>
      of({
        results: [
          {
            operationId: '11111111-1111-4111-8111-111111111111',
            entityType: 'ANIMAL_EVENT_LOG',
            entityId: 'event-online-1',
            classification: 'no_conflict',
          },
        ],
      }),
    );
    const { service, store } = setup({ online: true, http: { post: post as never } });
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(
      '11111111-1111-4111-8111-111111111111',
    );

    await expect(
      firstValueFrom(
        service.createEvent({
          animalUuid: 'animal-uuid-1',
          type: 'TRANSFERRED',
          occurredAt: '2026-04-26T10:15:00.000Z',
          notes: 'Transferencia al norte',
          metadata: {
            fromOwnerGanaderoId: 'owner-a',
            toOwnerGanaderoId: 'owner-b',
          },
        }),
      ),
    ).resolves.toEqual({
      outcome: 'saved',
      message: 'Evento animal guardado correctamente.',
    });

    expect(post).toHaveBeenCalledWith(
      '/api/sync/push',
      {
        operations: [
          expect.objectContaining({
            operationId: '11111111-1111-4111-8111-111111111111',
            entityType: 'ANIMAL_EVENT_LOG',
            entityId: '11111111-1111-4111-8111-111111111111',
            opType: 'CREATE',
            payload: expect.objectContaining({
              animalUuid: 'animal-uuid-1',
              eventCategory: 'GENERAL',
              eventType: 'TRANSFERRED',
              performedByUserId: 'user-1',
              sourceChannel: 'ONLINE',
            }),
          }),
        ],
      },
      { headers: expect.any(HttpHeaders) },
    );
    await expect(store.listOutbox()).resolves.toEqual([]);
    await expect(store.listSnapshots('ANIMAL_EVENT_LOG')).resolves.toEqual([
      expect.objectContaining({
        key: 'ANIMAL_EVENT_LOG:event-online-1',
        payload: expect.objectContaining({
          eventCategory: 'GENERAL',
          eventType: 'TRANSFERRED',
          type: 'TRANSFERRED',
          syncStatus: 'synced',
        }),
      }),
    ]);
  });

  it('should queue castration events and project BUEY immediately in the local animal snapshot', async () => {
    const { service, store } = setup({ online: false });
    await store.saveSnapshot({
      key: 'ANIMAL:animal-uuid-1',
      entityType: 'ANIMAL',
      entityId: 'animal-uuid-1',
      payload: {
        uuid: 'animal-uuid-1',
        ownerGanaderoId: 'ganadero-uuid-1',
        arete: 'AR-100',
        marca: null,
        tatuaje: null,
        category: 'BULL',
        active: true,
        admissionDate: '2026-04-26',
        birthDate: '2024-04-26',
        sex: 'MACHO',
        weightKg: 410,
        createdAt: '2026-04-26T10:00:00.000Z',
        updatedAt: '2026-04-26T10:00:00.000Z',
        version: 2,
        lastSyncedAt: null,
      } as Record<string, unknown>,
      updatedAt: '2026-04-26T10:00:00.000Z',
      version: 2,
    });

    await expect(
      firstValueFrom(
        service.createCastrationEvent('animal-uuid-1', {
          occurredAt: '2026-04-26T10:15:00.000Z',
          notes: 'Castración programada',
          metadata: { reasonCode: 'SCHEDULED' },
        }),
      ),
    ).resolves.toEqual({
      outcome: 'queued',
      message: 'Evento animal encolado. Se enviará al reconectar.',
    });

    const snapshot = await store.getSnapshot('ANIMAL', 'animal-uuid-1');
    expect(snapshot?.payload).toEqual(
      expect.objectContaining({
        category: 'BUEY',
        updatedAt: '2026-04-26T10:05:00.000Z',
      }),
    );
  });
});
