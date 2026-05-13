import { firstValueFrom } from 'rxjs';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { ApplicationConfigService } from '../../../core/config/application-config.service';
import { AuthService } from '../../../core/auth/data-access/auth.service';
import { OfflineStatusService } from '../../../core/offline/offline-status.service';
import { InMemoryOfflinePersistenceAdapter } from '../../../core/offline/offline-store.migrations';
import { OfflineStoreService } from '../../../core/offline/offline-store.service';
import { SyncMetricsStore } from '../../../core/offline/sync-metrics.store';
import { AnimalsHealthEventsService } from '../animals/data-access/animals-health-events.service';
import { AnimalsService } from '../animals/data-access/animals.service';

describe('vet visit offline unified event log regression', () => {
  it('should queue, snapshot and retrieve field vet visits through ANIMAL_EVENT_LOG locally', async () => {
    const store = new OfflineStoreService(new InMemoryOfflinePersistenceAdapter(), {
      now: () => '2026-05-13T10:00:00.000Z',
    });
    const offline = signal(false);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        AnimalsHealthEventsService,
        { provide: ApplicationConfigService, useValue: { config: () => ({ apiBaseUrl: '/api' }) } },
        { provide: AuthService, useValue: { getAccessToken: () => 'token', currentUser: signal({ id: 'user-1', role: 'ADMIN', ganaderoId: null }) } },
        { provide: OfflineStatusService, useValue: { isOnline: offline } },
        { provide: SyncMetricsStore, useValue: { patch: () => undefined } },
        { provide: AnimalsService, useValue: { listActiveAnimals: () => { throw new Error('not used'); }, listAnimals: () => { throw new Error('not used'); } } },
      ],
    });
    const service = TestBed.inject(AnimalsHealthEventsService);
    service.configureForTesting({
      store,
      offlineStatus: { isOnline: offline },
      authService: {
        getAccessToken: () => 'token',
        currentUser: signal({ id: 'user-1', role: 'ADMIN', ganaderoId: null }) as never,
      },
      metricsStore: { patch: () => undefined } as never,
      animalsService: { listActiveAnimals: () => { throw new Error('not used'); }, listAnimals: () => { throw new Error('not used'); } },
      now: () => '2026-05-13T10:00:00.000Z',
      windowRef: { dispatchEvent: () => true },
    });

    await firstValueFrom(service.createEvent({
      animalUuid: 'animal-1',
      healthEventType: 'FIELD_VET_VISIT',
      occurredAt: '2026-05-13T09:30',
      notes: 'Control',
      metadata: {
        visit: { visitId: 'VISIT-1', mode: 'SPECIFIC', status: 'PENDING', veterinarian: { name: 'Dra. Luna' } },
        checklist: [{ code: 'TEMPERATURE', ok: true }],
        clinicalNote: { reason: 'Control', findings: 'Sin fiebre', plan: 'Seguimiento' },
        protocol: { status: 'FOLLOW_UP_REQUIRED', nextDueAt: '2026-05-20T10:00:00.000Z' },
      },
    }));

    const [operation] = await store.listOutbox();
    const [snapshot] = await store.listSnapshots('ANIMAL_EVENT_LOG');
    const [localEvent] = await firstValueFrom(service.listEvents('animal-1', { visitId: 'VISIT-1' }));

    expect(operation.entityType).toBe('ANIMAL_EVENT_LOG');
    expect(operation.payload['eventCategory']).toBe('HEALTH');
    expect(operation.payload['eventType']).toBe('FIELD_VET_VISIT');
    expect(snapshot.entityType).toBe('ANIMAL_EVENT_LOG');
    expect(snapshot.payload['eventCategory']).toBe('HEALTH');
    expect(localEvent.visitId).toBe('VISIT-1');
    expect(localEvent.syncStatus).toBe('pending');
    expect(localEvent.nextDueAt).toBe('2026-05-20T10:00:00.000Z');
  });
});
