import { HttpClient, HttpHeaders } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { AuthService, type SessionUser } from '../../../../core/auth/data-access/auth.service';
import { ApplicationConfigService } from '../../../../core/config/application-config.service';
import { InMemoryOfflinePersistenceAdapter } from '../../../../core/offline/offline-store.migrations';
import { OfflineStatusService } from '../../../../core/offline/offline-status.service';
import { OfflineStoreService } from '../../../../core/offline/offline-store.service';
import { SyncMetricsStore } from '../../../../core/offline/sync-metrics.store';
import { MANUAL_SYNC_EVENT } from '../../../../core/offline/sync-orchestrator.service';
import { AnimalsReproductionEventsService, buildBirthMetadata, type AnimalReproductionEventItem } from './animals-reproduction-events.service';

describe('AnimalsReproductionEventsService', () => {
  const currentUser: SessionUser = {
    id: 'user-1',
    username: 'admin',
    email: 'admin@hato.bo',
    displayName: 'Admin',
    role: 'ADMIN',
    status: 'ACTIVE',
    version: 1,
    updatedAt: '2026-04-26T10:00:00.000Z',
    lastSyncedAt: null,
  };

  const createEvent = (overrides: Partial<AnimalReproductionEventItem> = {}): AnimalReproductionEventItem => ({
    id: 'repro-event-1',
    animalUuid: 'animal-uuid-1',
    reproductionEventType: 'SERVICE',
    occurredAt: '2026-04-26T10:00:00.000Z',
    notes: 'Servicio natural',
    performedByUserId: 'user-1',
    sourceChannel: 'ONLINE',
    operationId: 'repro-event-1',
    metadata: { serviceMethod: 'NATURAL' },
    clientCreatedAt: '2026-04-26T10:00:00.000Z',
    createdAt: '2026-04-26T10:00:01.000Z',
    updatedAt: '2026-04-26T10:00:01.000Z',
    ...overrides,
  });

  const setup = (options: { online: boolean; http?: Partial<Pick<HttpClient, 'get'>> }) => {
    TestBed.configureTestingModule({
      providers: [
        AnimalsReproductionEventsService,
        SyncMetricsStore,
        {
          provide: HttpClient,
          useValue: {
            get: vi.fn(),
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

    const service = TestBed.inject(AnimalsReproductionEventsService);
    const store = new OfflineStoreService(new InMemoryOfflinePersistenceAdapter());
    service.configureForTesting({ store, now: () => '2026-04-26T10:05:00.000Z', windowRef: window });
    return { service, store };
  };

  afterEach(() => {
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it('should request filtered reproduction timeline online and cache the snapshot by operation id', async () => {
    const get = vi.fn(() =>
      of({
        items: [createEvent({ id: 'repro-event-2', operationId: 'repro-event-2', reproductionEventType: 'BIRTH' })],
      })
    );
    const { service, store } = setup({ online: true, http: { get: get as never } });

    await expect(
      firstValueFrom(
        service.listEvents('animal-uuid-1', {
          reproductionEventType: 'BIRTH',
          occurredFrom: '2026-04-26T09:00:00.000Z',
          occurredTo: '2026-04-26T12:30:00.000Z',
        })
      )
    ).resolves.toEqual([
      expect.objectContaining({ id: 'repro-event-2', reproductionEventType: 'BIRTH', syncState: 'SYNCED', syncMessage: null }),
    ]);

    const [requestedUrl, options] = get.mock.calls[0] as unknown as [string, { headers: HttpHeaders }];
    expect(requestedUrl).toBe(
      '/api/animals/animal-uuid-1/reproduction-events?reproductionEventType=BIRTH&occurredFrom=2026-04-26T09%3A00%3A00.000Z&occurredTo=2026-04-26T12%3A30%3A00.000Z'
    );
    expect(options.headers.get('Authorization')).toBe('Bearer token');
    await expect(store.listSnapshots('ANIMAL_REPRODUCTION_EVENT')).resolves.toEqual([
      expect.objectContaining({ key: 'ANIMAL_REPRODUCTION_EVENT:repro-event-2' }),
    ]);
  });

  it('should queue birth events queue-first and keep pending snapshot metadata offline', async () => {
    const dispatchEvent = vi.spyOn(window, 'dispatchEvent');
    const { service, store } = setup({ online: false });

    await expect(
      firstValueFrom(
        service.createEvent({
          animalUuid: 'mother-1',
          reproductionEventType: 'BIRTH',
          occurredAt: '2026-04-26T10:15:00.000Z',
          notes: 'Parto simple',
          metadata: buildBirthMetadata({
            birthDate: '2026-04-26T10:15',
            offspringCount: 1,
            motherAnimalUuid: 'mother-1',
            fatherAnimalUuid: 'father-1',
            offspringAnimalUuids: ['calf-1'],
          }),
        })
      )
    ).resolves.toEqual({
      outcome: 'queued',
      message: 'Evento reproductivo encolado. Se enviará al reconectar.',
    });

    const outbox = await store.listOutbox();
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toEqual(
      expect.objectContaining({
        entityType: 'ANIMAL_REPRODUCTION_EVENT',
        payload: expect.objectContaining({
          reproductionEventType: 'BIRTH',
          sourceChannel: 'OFFLINE',
          metadata: expect.objectContaining({ offspringCount: 1, offspringAnimalUuids: ['calf-1'] }),
        }),
      })
    );
    await expect(store.listSnapshots('ANIMAL_REPRODUCTION_EVENT')).resolves.toEqual([
      expect.objectContaining({
        payload: expect.objectContaining({ syncState: 'PENDING_SYNC', syncMessage: 'Pendiente de sync.' }),
      }),
    ]);
    expect(dispatchEvent).not.toHaveBeenCalled();
  });

  it('should queue service events online and trigger manual sync', async () => {
    const dispatchEvent = vi.spyOn(window, 'dispatchEvent');
    const { service, store } = setup({ online: true });

    await expect(
      firstValueFrom(
        service.createEvent({
          animalUuid: 'animal-uuid-1',
          reproductionEventType: 'SERVICE',
          occurredAt: '2026-04-26T10:15:00.000Z',
          notes: 'Monta controlada',
          metadata: { serviceMethod: 'NATURAL' },
        })
      )
    ).resolves.toEqual({
      outcome: 'queued',
      message: 'Evento reproductivo encolado. Se disparó la sincronización automática.',
    });

    const outbox = await store.listOutbox();
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toEqual(
      expect.objectContaining({
        entityType: 'ANIMAL_REPRODUCTION_EVENT',
        entityId: outbox[0].operationId,
        payload: expect.objectContaining({ animalUuid: 'animal-uuid-1', performedByUserId: 'user-1', sourceChannel: 'ONLINE' }),
      })
    );
    expect(dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({ type: MANUAL_SYNC_EVENT }));
  });
});
