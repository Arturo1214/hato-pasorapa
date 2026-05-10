import { HttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { AuthService, type SessionUser } from '../../../core/auth/data-access/auth.service';
import { ApplicationConfigService } from '../../../core/config/application-config.service';
import {
  InMemoryOfflineImageBinaryPersistenceAdapter,
  OfflineImageBinaryStoreService,
} from '../../../core/offline/offline-image-binary-store.service';
import { InMemoryOfflinePersistenceAdapter } from '../../../core/offline/offline-store.migrations';
import { OfflineStatusService } from '../../../core/offline/offline-status.service';
import { OfflineStoreService } from '../../../core/offline/offline-store.service';
import { SyncMetricsStore } from '../../../core/offline/sync-metrics.store';
import { SyncOrchestratorService, type PullSyncResponse, type PushSyncResponse } from '../../../core/offline/sync-orchestrator.service';
import { AnimalsImagesService } from './data-access/animals-images.service';

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

describe('animals images offline flow', () => {

  afterEach(() => TestBed.resetTestingModule());

  it('should reconcile a pending image from PENDING to SYNCED after ack + pull', async () => {
    let online = false;
    const store = new OfflineStoreService(new InMemoryOfflinePersistenceAdapter());
    const imageBinaryStore = new OfflineImageBinaryStoreService(new InMemoryOfflineImageBinaryPersistenceAdapter());
    const metricsStore = new SyncMetricsStore();

    const onlineRef = { current: online };
    const service = createService({ onlineRef, store, imageBinaryStore, metricsStore });
    const file = new File(['image-a'], 'vaca-a.jpg', { type: 'image/jpeg' });

    await firstValueFrom(service.addImages('animal-1', [file]));

    const pendingItems = await firstValueFrom(service.listImages('animal-1'));
    expect(pendingItems).toHaveLength(1);
    expect(pendingItems[0].syncState).toBe('PENDING');

    const operationId = (await store.listOutbox())[0].operationId;
    online = true;
    onlineRef.current = true;

    const orchestrator = new SyncOrchestratorService({
      store,
      imageBinaryStore,
      metricsStore,
      offlineStatus: { isOnline: () => onlineRef.current },
      authSession: { getAccessToken: () => 'token' },
      now: () => '2026-04-27T10:05:00.000Z',
      random: () => 0,
      windowRef: window,
      supportedEntities: ['ANIMAL_IMAGE'],
      apiClient: {
        push: vi.fn(async () => ({
          results: [
            {
              operationId,
              entityType: 'ANIMAL_IMAGE',
              entityId: operationId,
              classification: 'no_conflict',
              serverVersion: 0,
            },
          ],
        } satisfies PushSyncResponse)),
        pull: vi.fn(async () => ({
          entityType: 'ANIMAL_IMAGE',
          items: [
            {
              id: operationId,
              animalUuid: 'animal-1',
              operationId,
              fileName: 'vaca-a.jpg',
              mimeType: 'image/jpeg',
              sizeBytes: file.size,
              checksumSha256: pendingItems[0].checksumSha256,
              capturedAt: '2026-04-27T10:00:00.000Z',
              sourceChannel: 'OFFLINE',
              binaryRef: operationId,
              thumbnailRef: null,
              createdAt: '2026-04-27T10:05:00.000Z',
              updatedAt: '2026-04-27T10:05:00.000Z',
            },
          ],
          nextCursor: {
            entityType: 'ANIMAL_IMAGE',
            cursorUpdatedAt: '2026-04-27T10:05:00.000Z',
            cursorId: operationId,
            lastSuccessAt: '2026-04-27T10:05:00.000Z',
          },
          hasMore: false,
        } satisfies PullSyncResponse)),
      },
    });

    await orchestrator.syncNow('manual');

    online = false;
    onlineRef.current = false;
    const reconciledItems = await firstValueFrom(service.listImages('animal-1'));

    expect(reconciledItems).toHaveLength(1);
    expect(reconciledItems[0].syncState).toBe('SYNCED');
    expect(reconciledItems[0].syncMessage).toBeNull();
    await expect(imageBinaryStore.getBinary(operationId)).resolves.toBeNull();
  });

  it('should keep partial sync failures as FAILED while accepted images become SYNCED', async () => {
    let online = false;
    const store = new OfflineStoreService(new InMemoryOfflinePersistenceAdapter());
    const imageBinaryStore = new OfflineImageBinaryStoreService(new InMemoryOfflineImageBinaryPersistenceAdapter());
    const metricsStore = new SyncMetricsStore();

    const onlineRef = { current: online };
    const service = createService({ onlineRef, store, imageBinaryStore, metricsStore });
    await firstValueFrom(
      service.addImages('animal-1', [
        new File(['image-a'], 'vaca-a.jpg', { type: 'image/jpeg' }),
        new File(['image-b'], 'vaca-b.png', { type: 'image/png' }),
      ])
    );

    const [acceptedOperation, failedOperation] = await store.listOutbox();
    online = true;
    onlineRef.current = true;

    const orchestrator = new SyncOrchestratorService({
      store,
      imageBinaryStore,
      metricsStore,
      offlineStatus: { isOnline: () => onlineRef.current },
      authSession: { getAccessToken: () => 'token' },
      now: () => '2026-04-27T10:10:00.000Z',
      random: () => 0,
      windowRef: window,
      supportedEntities: ['ANIMAL_IMAGE'],
      apiClient: {
        push: vi.fn(async () => ({
          results: [
            {
              operationId: acceptedOperation.operationId,
              entityType: 'ANIMAL_IMAGE',
              entityId: acceptedOperation.operationId,
              classification: 'no_conflict',
              serverVersion: 0,
            },
            {
              operationId: failedOperation.operationId,
              entityType: 'ANIMAL_IMAGE',
              entityId: failedOperation.operationId,
              classification: 'validation_error',
              conflict: {
                reason: 'ANIMAL_IMAGE_MIME_TYPE_NOT_ALLOWED',
              },
            },
          ],
        } satisfies PushSyncResponse)),
        pull: vi.fn(async () => ({
          entityType: 'ANIMAL_IMAGE',
          items: [
            {
              id: acceptedOperation.operationId,
              animalUuid: 'animal-1',
              operationId: acceptedOperation.operationId,
              fileName: 'vaca-a.jpg',
              mimeType: 'image/jpeg',
              sizeBytes: 7,
              checksumSha256: String(acceptedOperation.payload['checksumSha256']),
              capturedAt: String(acceptedOperation.payload['capturedAt']),
              sourceChannel: 'OFFLINE',
              binaryRef: acceptedOperation.operationId,
              thumbnailRef: null,
              createdAt: '2026-04-27T10:10:00.000Z',
              updatedAt: '2026-04-27T10:10:00.000Z',
            },
          ],
          nextCursor: {
            entityType: 'ANIMAL_IMAGE',
            cursorUpdatedAt: '2026-04-27T10:10:00.000Z',
            cursorId: acceptedOperation.operationId,
            lastSuccessAt: '2026-04-27T10:10:00.000Z',
          },
          hasMore: false,
        } satisfies PullSyncResponse)),
      },
    });

    await orchestrator.syncNow('manual');

    online = false;
    onlineRef.current = false;
    const reconciledItems = await firstValueFrom(service.listImages('animal-1'));

    expect(reconciledItems.map((item) => item.syncState).sort()).toEqual(['FAILED', 'SYNCED']);
    expect(reconciledItems.find((item) => item.syncState === 'FAILED')?.syncMessage).toContain('ANIMAL_IMAGE_MIME_TYPE_NOT_ALLOWED');
  });
});

function createService({
  onlineRef,
  store,
  imageBinaryStore,
  metricsStore,
}: {
  onlineRef: { current: boolean };
  store: OfflineStoreService;
  imageBinaryStore: OfflineImageBinaryStoreService;
  metricsStore: SyncMetricsStore;
}) {
  TestBed.configureTestingModule({
    providers: [
      AnimalsImagesService,
      SyncMetricsStore,
      {
        provide: HttpClient,
        useValue: { get: vi.fn() },
      },
      {
        provide: ApplicationConfigService,
        useValue: { config: (() => ({ appName: 'Hato FE', domain: 'bo.pasorapa.hato', apiBaseUrl: '/api' })) as never },
      },
      {
        provide: AuthService,
        useValue: { getAccessToken: () => 'token', currentUser: (() => currentUser) as never },
      },
      {
        provide: OfflineStatusService,
        useValue: { isOnline: (() => onlineRef.current) as never },
      },
    ],
  });

  const service = TestBed.inject(AnimalsImagesService);
  service.configureForTesting({
    store,
    imageBinaryStore,
    metricsStore,
    appConfig: { config: (() => ({ appName: 'Hato FE', domain: 'bo.pasorapa.hato', apiBaseUrl: '/api' })) as never },
    authService: { getAccessToken: () => 'token', currentUser: (() => currentUser) as never },
    offlineStatus: { isOnline: (() => onlineRef.current) as never },
    now: () => '2026-04-27T10:00:00.000Z',
    windowRef: window,
  });
  return service;
}
