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
import { AnimalsHealthEventsService, type AnimalHealthEventItem } from './animals-health-events.service';

describe('AnimalsHealthEventsService', () => {
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

  const setup = (options: { online: boolean; http?: Partial<Pick<HttpClient, 'get'>> }) => {
    TestBed.configureTestingModule({
      providers: [
        AnimalsHealthEventsService,
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

    const service = TestBed.inject(AnimalsHealthEventsService);
    const store = new OfflineStoreService(new InMemoryOfflinePersistenceAdapter());
    service.configureForTesting({ store, now: () => '2026-04-26T10:05:00.000Z', windowRef: window });
    return { service, store };
  };

  afterEach(() => {
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it('should request filtered health timeline online and cache the snapshot by operation id', async () => {
    const get = vi.fn(() =>
      of({
        items: [createEvent(), createEvent({ id: 'health-event-2', operationId: 'health-event-2', healthEventType: 'DEWORMING' })],
      })
    );
    const { service, store } = setup({ online: true, http: { get: get as never } });

    await expect(
      firstValueFrom(
        service.listEvents('animal-uuid-1', {
          healthEventType: 'DEWORMING',
          occurredFrom: '2026-04-26T09:00:00.000Z',
          occurredTo: '2026-04-26T12:30:00.000Z',
        })
      )
    ).resolves.toEqual([
      expect.objectContaining({ id: 'health-event-2', healthEventType: 'DEWORMING', syncStatus: 'synced', syncMessage: null }),
    ]);

    const [requestedUrl, options] = get.mock.calls[0] as unknown as [string, { headers: HttpHeaders }];
    expect(requestedUrl).toBe(
      '/api/animals/animal-uuid-1/health-events?healthEventType=DEWORMING&occurredFrom=2026-04-26T09%3A00%3A00.000Z&occurredTo=2026-04-26T12%3A30%3A00.000Z'
    );
    expect(options.headers.get('Authorization')).toBe('Bearer token');
    await expect(store.listSnapshots('ANIMAL_HEALTH_EVENT')).resolves.toEqual([
      expect.objectContaining({ key: 'ANIMAL_HEALTH_EVENT:health-event-2' }),
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
      })
    );
    const { service } = setup({ online: true, http: { get: get as never } });

    await expect(
      firstValueFrom(
        service.listEvents('animal-uuid-1', {
          healthEventType: 'FIELD_VET_VISIT',
          visitId: 'VISIT-1',
        })
      )
    ).resolves.toEqual([
      expect.objectContaining({ healthEventType: 'FIELD_VET_VISIT', visitId: 'VISIT-1', nextDueAt: '2026-04-28T10:00:00.000Z' }),
    ]);

    const [requestedUrl] = get.mock.calls[0] as unknown as [string];
    expect(requestedUrl).toBe('/api/animals/animal-uuid-1/health-events?healthEventType=FIELD_VET_VISIT&visitId=VISIT-1');
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
        })
      )
    ).resolves.toEqual({
      outcome: 'queued',
      message: 'Evento sanitario encolado. Se enviará al reconectar.',
    });

    const outbox = await store.listOutbox();
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toEqual(
      expect.objectContaining({
        entityType: 'ANIMAL_HEALTH_EVENT',
        payload: expect.objectContaining({
          healthEventType: 'DISEASE_REPORTED',
          sourceChannel: 'OFFLINE',
        }),
      })
    );
    await expect(store.listSnapshots('ANIMAL_HEALTH_EVENT')).resolves.toEqual([
      expect.objectContaining({
        payload: expect.objectContaining({ syncStatus: 'pending', syncMessage: 'Pendiente de sync.' }),
      }),
    ]);
    expect(dispatchEvent).not.toHaveBeenCalled();
  });

  it('should queue health events offline and trigger manual sync when online', async () => {
    const dispatchEvent = vi.spyOn(window, 'dispatchEvent');
    const { service, store } = setup({ online: true });

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
        })
      )
    ).resolves.toEqual({
      outcome: 'queued',
      message: 'Evento sanitario encolado. Se disparó la sincronización automática.',
    });

    const outbox = await store.listOutbox();
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toEqual(
      expect.objectContaining({
        entityType: 'ANIMAL_HEALTH_EVENT',
        entityId: outbox[0].operationId,
        opType: 'CREATE',
        payload: expect.objectContaining({
          animalUuid: 'animal-uuid-1',
          performedByUserId: 'user-1',
          sourceChannel: 'ONLINE',
        }),
      })
    );
    await expect(store.listSnapshots('ANIMAL_HEALTH_EVENT')).resolves.toEqual([
      expect.objectContaining({
        key: `ANIMAL_HEALTH_EVENT:${outbox[0].operationId}`,
        payload: expect.objectContaining({ healthEventType: 'TREATMENT_STARTED', syncStatus: 'pending' }),
      }),
    ]);
    expect(dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({ type: MANUAL_SYNC_EVENT }));
  });
});
