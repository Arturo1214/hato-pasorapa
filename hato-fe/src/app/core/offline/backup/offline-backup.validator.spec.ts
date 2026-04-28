import { createEmptyOfflineState } from '../offline-store.migrations';
import type { PersistedOfflineState } from '../offline-types';
import {
  BACKUP_DIGEST_ALGORITHM,
  BACKUP_VERSION_V1,
  cloneBackupEnvelopeForDigest,
  computeSha256Hex,
  type BackupEnvelopeV1,
} from './offline-backup.types';
import { validateBackupEnvelope } from './offline-backup.validator';
import { serializeBackupEnvelopeCanonical } from './offline-backup.types';

describe('validateBackupEnvelope', () => {
  it('should accept a valid payload with matching digest and image references', async () => {
    const envelope = await buildValidEnvelope();

    await expect(validateBackupEnvelope(envelope)).resolves.toMatchObject({
      backupVersion: BACKUP_VERSION_V1,
      manifest: { imagesExcluded: false },
      integrity: { digestAlgorithm: BACKUP_DIGEST_ALGORITHM },
    });
  });

  it('should reject packages without a valid digest or with tampered content', async () => {
    const envelope = await buildValidEnvelope();
    const tampered = {
      ...envelope,
      integrity: {
        ...envelope.integrity,
        digest: 'b'.repeat(64),
      },
    } satisfies BackupEnvelopeV1;

    await expect(validateBackupEnvelope({ ...envelope, integrity: { ...envelope.integrity, digest: '' } })).rejects.toMatchObject({
      name: 'BackupValidationError',
    });
    await expect(validateBackupEnvelope(tampered)).rejects.toMatchObject({
      issues: expect.arrayContaining([expect.objectContaining({ code: 'BACKUP_DIGEST_MISMATCH' })]),
    });
  });

  it('should reject corrupt image references before restore starts', async () => {
    const envelope = await buildValidEnvelope();
    const corrupt = {
      ...envelope,
      images: envelope.images?.map((image) =>
        image.operationId === 'image-op-1'
          ? {
              ...image,
              base64: globalThis.btoa('otro'),
            }
          : image
      ),
    } satisfies BackupEnvelopeV1;
    corrupt.integrity.digest = await computeSha256Hex(serializeBackupEnvelopeCanonical(cloneBackupEnvelopeForDigest(corrupt)));

    await expect(validateBackupEnvelope(corrupt)).rejects.toMatchObject({
      issues: expect.arrayContaining([expect.objectContaining({ code: 'BACKUP_IMAGE_CHECKSUM_MISMATCH' })]),
    });
  });

  it('should reject excluded-image packages that still keep ANIMAL_IMAGE references', async () => {
    const envelope = await buildValidEnvelope();
    const excluded = {
      ...envelope,
      manifest: {
        ...envelope.manifest,
        imagesExcluded: true,
      },
      images: undefined,
      integrity: {
        ...envelope.integrity,
        imageOperationIds: [],
      },
    } satisfies BackupEnvelopeV1;
    excluded.integrity.digest = await computeSha256Hex(serializeBackupEnvelopeCanonical(cloneBackupEnvelopeForDigest(excluded)));

    await expect(validateBackupEnvelope(excluded)).rejects.toMatchObject({
      issues: expect.arrayContaining([expect.objectContaining({ code: 'BACKUP_IMAGES_EXCLUDED_WITH_REFERENCES' })]),
    });
  });
});

async function buildValidEnvelope(): Promise<BackupEnvelopeV1> {
  const offlineState = createOfflineStateWithImage();
  const envelope: BackupEnvelopeV1 = {
    backupVersion: BACKUP_VERSION_V1,
    createdAt: '2026-04-28T14:00:00.000Z',
    sourceSchemaVersion: 8,
    manifest: {
      imagesExcluded: false,
      entityCounts: { OUTBOX: 1, ANIMAL_IMAGE: 2 },
    },
    offlineState,
    images: [
      {
        operationId: 'image-op-1',
        mimeType: 'image/jpeg',
        sizeBytes: 4,
        capturedAt: '2026-04-28T14:00:00.000Z',
        base64: globalThis.btoa('hola'),
      },
    ],
    integrity: {
      digestAlgorithm: BACKUP_DIGEST_ALGORITHM,
      digest: '',
      imageOperationIds: ['image-op-1'],
    },
  };

  envelope.integrity.digest = await computeSha256Hex(serializeBackupEnvelopeCanonical(cloneBackupEnvelopeForDigest(envelope)));
  return envelope;
}

function createOfflineStateWithImage(): PersistedOfflineState {
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
