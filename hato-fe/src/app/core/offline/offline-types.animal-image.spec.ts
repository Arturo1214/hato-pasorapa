import {
  ANIMAL_IMAGE_MIME_TYPES,
  OFFLINE_ENTITY_TYPES,
  type AnimalImageOfflineCreatePayload,
  type AnimalImageSnapshotPayload,
} from './offline-types';

describe('offline-types animal image contract', () => {
  it('should expose ANIMAL_IMAGE as a supported offline entity', () => {
    expect(OFFLINE_ENTITY_TYPES).toContain('ANIMAL_IMAGE');
  });

  it('should keep the v1 image allowlist bounded to jpeg/png', () => {
    expect(ANIMAL_IMAGE_MIME_TYPES).toEqual(['image/jpeg', 'image/png']);
  });

  it('should require the offline payload to keep binaryRef, checksumSha256 and operationId aligned', () => {
    const payload: AnimalImageOfflineCreatePayload = {
      animalUuid: 'animal-1',
      operationId: 'image-op-1',
      sourceChannel: 'OFFLINE',
      fileName: 'vaca.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 1024,
      checksumSha256: 'a'.repeat(64),
      capturedAt: '2026-04-27T10:00:00.000Z',
      binaryRef: 'image-op-1',
    };

    const snapshot: AnimalImageSnapshotPayload = {
      ...payload,
      id: 'image-op-1',
      clientCreatedAt: '2026-04-27T10:00:00.000Z',
      createdAt: '2026-04-27T10:00:00.000Z',
      updatedAt: '2026-04-27T10:00:00.000Z',
      syncState: 'PENDING',
    };

    expect(snapshot.binaryRef).toBe(snapshot.operationId);
    expect(snapshot.checksumSha256).toHaveLength(64);
  });
});
