import { TestBed } from '@angular/core/testing';
import { OfflineBackupService } from './offline-backup.service';
import { AuthService } from '../../auth/data-access/auth.service';
import {
  InMemoryOfflineImageBinaryPersistenceAdapter,
  OfflineImageBinaryStoreService,
} from '../offline-image-binary-store.service';
import { createEmptyOfflineState, InMemoryOfflinePersistenceAdapter } from '../offline-store.migrations';
import { OfflineStoreService } from '../offline-store.service';
import type { PersistedOfflineState } from '../offline-types';

describe('OfflineBackupService', () => {
  let service: OfflineBackupService;
  let store: OfflineStoreService;
  let imageBinaryStore: OfflineImageBinaryStoreService;
  let authService: { forceReauthAfterRestore: (now?: string) => Promise<void> };
  let runtimeRehydrator: () => Promise<void>;
  let downloads: Array<{ fileName: string; json: string }>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        OfflineBackupService,
        {
          provide: AuthService,
          useValue: { forceReauthAfterRestore: vi.fn(async () => undefined) },
        },
      ],
    });

    store = new OfflineStoreService(new InMemoryOfflinePersistenceAdapter());
    imageBinaryStore = new OfflineImageBinaryStoreService(new InMemoryOfflineImageBinaryPersistenceAdapter());
    authService = TestBed.inject(AuthService) as never;
    runtimeRehydrator = vi.fn(async () => undefined) as () => Promise<void>;
    downloads = [];

    service = TestBed.inject(OfflineBackupService);
    service.configureForTesting({
      store,
      imageBinaryStore,
      authService,
      now: () => '2026-04-28T14:00:00.000Z',
      runtimeRehydrator,
      downloadJson: (fileName, json) => downloads.push({ fileName, json }),
    });
  });

  it('should export a local backup with digest and optional image binaries', async () => {
    await seedImageState(store, imageBinaryStore);

    await service.downloadBackup({ includeImages: true });
    await service.downloadBackup({ includeImages: false });

    expect(downloads).toHaveLength(2);
    const fullBackup = JSON.parse(downloads[0].json) as { images?: unknown[]; integrity: { digest: string } };
    const withoutImages = JSON.parse(downloads[1].json) as { images?: unknown[]; manifest: { imagesExcluded: boolean } };

    expect(fullBackup.images).toHaveLength(1);
    expect(fullBackup.integrity.digest).toHaveLength(64);
    expect(withoutImages.images).toBeUndefined();
    expect(withoutImages.manifest.imagesExcluded).toBe(true);
  });

  it('should validate, restore, rehydrate and force reauth after a valid local import', async () => {
    await seedImageState(store, imageBinaryStore);
    const backupJson = await service.exportBackupJson({ includeImages: true });
    const destinationStore = new OfflineStoreService(new InMemoryOfflinePersistenceAdapter());
    const destinationImages = new OfflineImageBinaryStoreService(new InMemoryOfflineImageBinaryPersistenceAdapter());
    const executionOrder: string[] = [];

    service.configureForTesting({
      store: destinationStore,
      imageBinaryStore: destinationImages,
      authService: {
        forceReauthAfterRestore: async () => {
          executionOrder.push('reauth');
        },
      },
      runtimeRehydrator: async () => {
        executionOrder.push('rehydrate');
      },
    });

    const result = await service.importBackupJson(backupJson);

    expect(result.imagesRestored).toBe(1);
    expect(executionOrder).toEqual(['rehydrate', 'reauth']);
    expect(await destinationStore.listSnapshots('ANIMAL_IMAGE')).toHaveLength(1);
    await expect(destinationImages.getBase64Data('image-op-1')).resolves.toBe(globalThis.btoa('hola'));
  });

  it('should reject corrupt files before mutating local state', async () => {
    const baseline = await destinationSnapshot(store);

    await expect(service.importBackupJson('{"backupVersion":"1.0.0"}')).rejects.toMatchObject({
      name: 'BackupValidationError',
    });

    expect(await destinationSnapshot(store)).toEqual(baseline);
  });

  it('should rollback both stores when restore fails after validation', async () => {
    await seedImageState(store, imageBinaryStore);
    const backupJson = await service.exportBackupJson({ includeImages: true });
    const destinationStore = new OfflineStoreService(new InMemoryOfflinePersistenceAdapter());
    const destinationImages = new OfflineImageBinaryStoreService(new InMemoryOfflineImageBinaryPersistenceAdapter());

    await destinationStore.saveSnapshot({
      key: 'GANADERO:ganadero-1',
      entityType: 'GANADERO',
      entityId: 'ganadero-1',
      payload: { name: 'Ganadero base' },
      updatedAt: '2026-04-28T13:00:00.000Z',
    });
    await destinationImages.saveBinary({
      operationId: 'existing-image',
      blob: new Blob(['prev'], { type: 'image/png' }),
      mimeType: 'image/png',
      sizeBytes: 4,
      capturedAt: '2026-04-28T13:00:00.000Z',
    });

    service.configureForTesting({
      store: destinationStore,
      imageBinaryStore: destinationImages,
      runtimeRehydrator: vi.fn(async () => {
        throw new Error('rehydration failed');
      }),
    });

    await expect(service.importBackupJson(backupJson)).rejects.toMatchObject({ code: 'BACKUP_RESTORE_FAILED' });
    expect(await destinationStore.listSnapshots('GANADERO')).toEqual([expect.objectContaining({ entityId: 'ganadero-1' })]);
    await expect(destinationImages.getBase64Data('existing-image')).resolves.toBe(globalThis.btoa('prev'));
  });
});

async function seedImageState(store: OfflineStoreService, imageBinaryStore: OfflineImageBinaryStoreService) {
  await imageBinaryStore.saveBinary({
    operationId: 'image-op-1',
    blob: new Blob(['hola'], { type: 'image/jpeg' }),
    mimeType: 'image/jpeg',
    sizeBytes: 4,
    capturedAt: '2026-04-28T14:00:00.000Z',
  });

  const state = createImageState();
  await store.restoreFromBackupTx(state);
}

function createImageState(): PersistedOfflineState {
  const state = createEmptyOfflineState();
  state.outbox.push({
    operationId: 'image-op-1',
    entityType: 'ANIMAL_IMAGE',
    entityId: 'image-op-1',
    opType: 'CREATE',
    payload: {
      animalUuid: 'animal-1',
      operationId: 'image-op-1',
      sourceChannel: 'OFFLINE',
      fileName: 'vaca.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 4,
      checksumSha256: 'b221d9dbb083a7f33428d7c2a3c3198ae925614d70210e28716ccaa7cd4ddb79',
      capturedAt: '2026-04-28T14:00:00.000Z',
      binaryRef: 'image-op-1',
    },
    baseVersion: 0,
    clientCreatedAt: '2026-04-28T14:00:00.000Z',
    clientUpdatedAt: '2026-04-28T14:00:00.000Z',
    status: 'pending',
    attempts: 0,
  });
  state.snapshots.push({
    key: 'ANIMAL_IMAGE:image-op-1',
    entityType: 'ANIMAL_IMAGE',
    entityId: 'image-op-1',
    payload: {
      animalUuid: 'animal-1',
      operationId: 'image-op-1',
      sourceChannel: 'OFFLINE',
      fileName: 'vaca.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 4,
      checksumSha256: 'b221d9dbb083a7f33428d7c2a3c3198ae925614d70210e28716ccaa7cd4ddb79',
      capturedAt: '2026-04-28T14:00:00.000Z',
      binaryRef: 'image-op-1',
      id: 'image-op-1',
      clientCreatedAt: '2026-04-28T14:00:00.000Z',
      createdAt: '2026-04-28T14:00:00.000Z',
      updatedAt: '2026-04-28T14:00:00.000Z',
      syncState: 'PENDING',
    },
    updatedAt: '2026-04-28T14:00:00.000Z',
  });
  return state;
}

async function destinationSnapshot(store: OfflineStoreService) {
  return store.getStateSnapshotForBackup({ excludeSessionSecurity: false });
}
