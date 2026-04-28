import {
  InMemoryOfflineImageBinaryPersistenceAdapter,
  OfflineImageBinaryStoreService,
} from './offline-image-binary-store.service';

describe('OfflineImageBinaryStoreService', () => {
  it('should persist blobs by operationId and return a base64 lookup', async () => {
    const service = new OfflineImageBinaryStoreService(new InMemoryOfflineImageBinaryPersistenceAdapter());

    await service.saveBinary({
      operationId: 'image-op-1',
      blob: new Blob(['hola'], { type: 'image/jpeg' }),
      mimeType: 'image/jpeg',
      sizeBytes: 4,
      capturedAt: '2026-04-27T10:00:00.000Z',
    });

    await expect(service.getBinary('image-op-1')).resolves.toEqual(
      expect.objectContaining({ operationId: 'image-op-1', sizeBytes: 4, mimeType: 'image/jpeg' })
    );
    await expect(service.getBase64Data('image-op-1')).resolves.toBe(globalThis.btoa('hola'));
  });

  it('should purge binaries after ack cleanup', async () => {
    const service = new OfflineImageBinaryStoreService(new InMemoryOfflineImageBinaryPersistenceAdapter());

    await service.saveBinary({
      operationId: 'image-op-2',
      blob: new Blob(['chau'], { type: 'image/png' }),
      mimeType: 'image/png',
      sizeBytes: 4,
      capturedAt: '2026-04-27T10:00:00.000Z',
    });

    await service.purgeBinary('image-op-2');

    await expect(service.getBinary('image-op-2')).resolves.toBeNull();
  });

  it('should export and restore the full binary set for backup round-trips', async () => {
    const service = new OfflineImageBinaryStoreService(new InMemoryOfflineImageBinaryPersistenceAdapter());

    await service.saveBinary({
      operationId: 'image-op-3',
      blob: new Blob(['rest'], { type: 'image/png' }),
      mimeType: 'image/png',
      sizeBytes: 4,
      capturedAt: '2026-04-28T14:00:00.000Z',
    });

    const backupEntries = await service.listForBackup();
    expect(backupEntries).toEqual([
      expect.objectContaining({
        operationId: 'image-op-3',
        mimeType: 'image/png',
        sizeBytes: 4,
        base64: globalThis.btoa('rest'),
      }),
    ]);

    await service.restoreBinarySetTx([
      {
        operationId: 'image-op-4',
        mimeType: 'image/jpeg',
        sizeBytes: 4,
        capturedAt: '2026-04-28T14:05:00.000Z',
        base64: globalThis.btoa('hola'),
      },
    ]);

    await expect(service.getBinary('image-op-3')).resolves.toBeNull();
    await expect(service.getBase64Data('image-op-4')).resolves.toBe(globalThis.btoa('hola'));
  });
});
