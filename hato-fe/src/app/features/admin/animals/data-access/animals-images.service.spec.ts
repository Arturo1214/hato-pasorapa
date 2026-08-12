import { HttpClient, HttpHeaders } from '@angular/common/http';
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

  afterEach(() => TestBed.resetTestingModule());

  it('should queue-first animal images offline and keep the binary by operationId', async () => {
    TestBed.configureTestingModule({
      providers: [
        AnimalsImagesService,
        SyncMetricsStore,
        { provide: HttpClient, useValue: { get: vi.fn() } },
        { provide: ApplicationConfigService, useValue: { config: () => ({ apiBaseUrl: '/api' }) } },
        {
          provide: AuthService,
          useValue: { getAccessToken: () => 'token', currentUser: () => currentUser },
        },
        { provide: OfflineStatusService, useValue: { isOnline: () => false } },
      ],
    });

    const service = TestBed.inject(AnimalsImagesService);
    const store = new OfflineStoreService(new InMemoryOfflinePersistenceAdapter());
    const imageBinaryStore = new OfflineImageBinaryStoreService(
      new InMemoryOfflineImageBinaryPersistenceAdapter(),
    );
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
    expect(binary).toEqual(
      expect.objectContaining({ operationId: outbox[0].operationId, sizeBytes: 3 }),
    );

    await expect(firstValueFrom(service.listImages('animal-1'))).resolves.toEqual([
      expect.objectContaining({
        id: outbox[0].operationId,
        syncState: 'PENDING',
        uiStatus: 'local_only',
      }),
    ]);
  });

  it('should save animal images directly online without outbox retries', async () => {
    const post = vi.fn(() =>
      of({
        results: [
          {
            operationId: '77777777-7777-4777-8777-777777777777',
            entityType: 'ANIMAL_IMAGE',
            entityId: 'image-online-1',
            classification: 'no_conflict',
          },
        ],
      }),
    );
    TestBed.configureTestingModule({
      providers: [
        AnimalsImagesService,
        SyncMetricsStore,
        { provide: HttpClient, useValue: { get: vi.fn(), post } },
        { provide: ApplicationConfigService, useValue: { config: () => ({ apiBaseUrl: '/api' }) } },
        {
          provide: AuthService,
          useValue: { getAccessToken: () => 'token', currentUser: () => currentUser },
        },
        { provide: OfflineStatusService, useValue: { isOnline: () => true } },
      ],
    });

    const service = TestBed.inject(AnimalsImagesService);
    const store = new OfflineStoreService(new InMemoryOfflinePersistenceAdapter());
    const imageBinaryStore = new OfflineImageBinaryStoreService(
      new InMemoryOfflineImageBinaryPersistenceAdapter(),
    );
    service.configureForTesting({
      store,
      imageBinaryStore,
      now: () => '2026-04-27T10:00:00.000Z',
      windowRef: window,
    });
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(
      '77777777-7777-4777-8777-777777777777',
    );

    const file = new File([new Uint8Array([1, 2, 3])], 'vaca.jpg', { type: 'image/jpeg' });

    await expect(firstValueFrom(service.addImages('animal-1', [file]))).resolves.toEqual({
      outcome: 'saved',
      message: 'Imágenes guardadas correctamente.',
    });

    expect(post).toHaveBeenCalledWith(
      '/api/sync/push',
      expect.objectContaining({
        operations: [
          expect.objectContaining({
            operationId: '77777777-7777-4777-8777-777777777777',
            entityType: 'ANIMAL_IMAGE',
            entityId: '77777777-7777-4777-8777-777777777777',
            payload: expect.objectContaining({
              animalUuid: 'animal-1',
              sourceChannel: 'ONLINE',
              base64Data: 'AQID',
            }),
          }),
        ],
      }),
      { headers: expect.any(HttpHeaders) },
    );
    await expect(store.listOutbox()).resolves.toEqual([]);
    await expect(
      imageBinaryStore.getBinary('77777777-7777-4777-8777-777777777777'),
    ).resolves.toBeNull();
    await expect(store.listSnapshots('ANIMAL_IMAGE')).resolves.toEqual([
      expect.objectContaining({
        key: 'ANIMAL_IMAGE:image-online-1',
        payload: expect.objectContaining({ syncState: 'SYNCED' }),
      }),
    ]);
  });

  it('should expose synced and failed image UI statuses through the shared media mapper', async () => {
    TestBed.configureTestingModule({
      providers: [
        AnimalsImagesService,
        SyncMetricsStore,
        { provide: HttpClient, useValue: { get: vi.fn() } },
        { provide: ApplicationConfigService, useValue: { config: () => ({ apiBaseUrl: '/api' }) } },
        {
          provide: AuthService,
          useValue: { getAccessToken: () => 'token', currentUser: () => currentUser },
        },
        { provide: OfflineStatusService, useValue: { isOnline: () => false } },
      ],
    });

    const service = TestBed.inject(AnimalsImagesService);
    const store = new OfflineStoreService(new InMemoryOfflinePersistenceAdapter());
    const imageBinaryStore = new OfflineImageBinaryStoreService(
      new InMemoryOfflineImageBinaryPersistenceAdapter(),
    );
    service.configureForTesting({ store, imageBinaryStore });
    await store.saveSnapshot({
      key: 'ANIMAL_IMAGE:image-synced-1',
      entityType: 'ANIMAL_IMAGE',
      entityId: 'image-synced-1',
      payload: {
        id: 'image-synced-1',
        animalUuid: 'animal-1',
        operationId: 'image-synced-1',
        fileName: 'synced.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 3,
        checksumSha256: 'checksum-1',
        capturedAt: '2026-04-27T10:00:00.000Z',
        sourceChannel: 'ONLINE',
        binaryRef: 'image-synced-1',
        clientCreatedAt: '2026-04-27T10:00:00.000Z',
        createdAt: '2026-04-27T10:00:00.000Z',
        updatedAt: '2026-04-27T10:00:00.000Z',
        syncState: 'SYNCED',
      },
      updatedAt: '2026-04-27T10:00:00.000Z',
    });
    await store.saveSnapshot({
      key: 'ANIMAL_IMAGE:image-failed-1',
      entityType: 'ANIMAL_IMAGE',
      entityId: 'image-failed-1',
      payload: {
        id: 'image-failed-1',
        animalUuid: 'animal-1',
        operationId: 'image-failed-1',
        fileName: 'failed.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 3,
        checksumSha256: 'checksum-2',
        capturedAt: '2026-04-27T11:00:00.000Z',
        sourceChannel: 'OFFLINE',
        binaryRef: 'image-failed-1',
        clientCreatedAt: '2026-04-27T11:00:00.000Z',
        createdAt: '2026-04-27T11:00:00.000Z',
        updatedAt: '2026-04-27T11:00:00.000Z',
        syncState: 'PENDING',
      },
      updatedAt: '2026-04-27T11:00:00.000Z',
    });
    const failed = await store.enqueueOperation({
      entityType: 'ANIMAL_IMAGE',
      entityId: 'image-failed-1',
      opType: 'CREATE',
      payload: { animalUuid: 'animal-1' },
      operationId: 'image-failed-1',
      clientCreatedAt: '2026-04-27T11:00:00.000Z',
      clientUpdatedAt: '2026-04-27T11:00:00.000Z',
    });
    await store.markDeadLetter(failed.operationId, {
      code: 'IMAGE_UPLOAD_FAILED',
      message: 'Upload agotado.',
    });

    await expect(firstValueFrom(service.listImages('animal-1'))).resolves.toEqual([
      expect.objectContaining({ id: 'image-synced-1', syncState: 'SYNCED', uiStatus: 'synced' }),
      expect.objectContaining({
        id: 'image-failed-1',
        syncState: 'FAILED',
        uiStatus: 'failed',
        syncMessage: 'Upload agotado.',
      }),
    ]);
  });

  it('should reject more than 3 images per animal sync cycle', async () => {
    TestBed.configureTestingModule({
      providers: [
        AnimalsImagesService,
        SyncMetricsStore,
        { provide: HttpClient, useValue: { get: vi.fn(() => of({ items: [] })) } },
        { provide: ApplicationConfigService, useValue: { config: () => ({ apiBaseUrl: '/api' }) } },
        {
          provide: AuthService,
          useValue: { getAccessToken: () => 'token', currentUser: () => currentUser },
        },
        { provide: OfflineStatusService, useValue: { isOnline: () => false } },
      ],
    });

    const service = TestBed.inject(AnimalsImagesService);
    const files = [0, 1, 2, 3].map(
      (index) => new File([String(index)], `file-${index}.jpg`, { type: 'image/jpeg' }),
    );

    await expect(firstValueFrom(service.addImages('animal-1', files))).resolves.toEqual({
      outcome: 'blocked',
      message: 'V1 permite como máximo 3 imágenes por animal por ciclo de sincronización.',
    });
  });
});
