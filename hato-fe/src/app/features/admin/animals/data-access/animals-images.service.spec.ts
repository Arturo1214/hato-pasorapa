import { HttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { AuthService, type SessionUser } from '../../../../core/auth/data-access/auth.service';
import { ApplicationConfigService } from '../../../../core/config/application-config.service';
import {
  InMemoryOfflineImageBinaryPersistenceAdapter,
  OfflineImageBinaryStoreService,
} from '../../../../core/offline/offline-image-binary-store.service';
import { InMemoryOfflinePersistenceAdapter } from '../../../../core/offline/offline-store.migrations';
import { OfflineStatusService } from '../../../../core/offline/offline-status.service';
import { OfflineStoreService } from '../../../../core/offline/offline-store.service';
import { SyncMetricsStore } from '../../../../core/offline/sync-metrics.store';
import { AnimalsImagesService } from './animals-images.service';

describe('AnimalsImagesService', () => {
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

  afterEach(() => TestBed.resetTestingModule());

  it('should queue-first animal images offline and keep the binary by operationId', async () => {
    TestBed.configureTestingModule({
      providers: [
        AnimalsImagesService,
        SyncMetricsStore,
        { provide: HttpClient, useValue: { get: vi.fn() } },
        { provide: ApplicationConfigService, useValue: { config: () => ({ apiBaseUrl: '/api' }) } },
        { provide: AuthService, useValue: { getAccessToken: () => 'token', currentUser: () => currentUser } },
        { provide: OfflineStatusService, useValue: { isOnline: () => false } },
      ],
    });

    const service = TestBed.inject(AnimalsImagesService);
    const store = new OfflineStoreService(new InMemoryOfflinePersistenceAdapter());
    const imageBinaryStore = new OfflineImageBinaryStoreService(new InMemoryOfflineImageBinaryPersistenceAdapter());
    service.configureForTesting({
      store,
      imageBinaryStore,
      now: () => '2026-04-27T10:00:00.000Z',
      windowRef: window,
    });

    const file = new File([new Uint8Array([1, 2, 3])], 'vaca.jpg', { type: 'image/jpeg' });

    await expect(firstValueFrom(service.addImages('animal-1', [file]))).resolves.toEqual({
      outcome: 'queued',
      message: 'Imágenes encoladas. Se enviarán al reconectar.',
    });

    const outbox = await store.listOutbox();
    expect(outbox).toHaveLength(1);
    expect(outbox[0]).toEqual(expect.objectContaining({ entityType: 'ANIMAL_IMAGE' }));

    const binary = await imageBinaryStore.getBinary(outbox[0].operationId);
    expect(binary).toEqual(expect.objectContaining({ operationId: outbox[0].operationId, sizeBytes: 3 }));
  });

  it('should reject more than 3 images per animal sync cycle', async () => {
    TestBed.configureTestingModule({
      providers: [
        AnimalsImagesService,
        SyncMetricsStore,
        { provide: HttpClient, useValue: { get: vi.fn(() => of({ items: [] })) } },
        { provide: ApplicationConfigService, useValue: { config: () => ({ apiBaseUrl: '/api' }) } },
        { provide: AuthService, useValue: { getAccessToken: () => 'token', currentUser: () => currentUser } },
        { provide: OfflineStatusService, useValue: { isOnline: () => false } },
      ],
    });

    const service = TestBed.inject(AnimalsImagesService);
    const files = [0, 1, 2, 3].map((index) => new File([String(index)], `file-${index}.jpg`, { type: 'image/jpeg' }));

    await expect(firstValueFrom(service.addImages('animal-1', files))).resolves.toEqual({
      outcome: 'blocked',
      message: 'V1 permite como máximo 3 imágenes por animal por ciclo de sync.',
    });
  });
});
