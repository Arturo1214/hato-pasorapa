import {
  BACKUP_DIGEST_ALGORITHM,
  BACKUP_VERSION_V1,
  cloneBackupEnvelopeForDigest,
  computeSha256Hex,
  serializeBackupEnvelopeCanonical,
  type BackupEnvelopeV1,
} from './offline-backup.types';
import { createEmptyOfflineState } from '../offline-store.migrations';

describe('offline backup types contract', () => {
  it('should require a digest placeholder when generating the canonical payload for hashing', async () => {
    const envelope = buildEnvelope();
    const withoutDigest = cloneBackupEnvelopeForDigest(envelope);

    expect(withoutDigest.integrity.digest).toBe('');
    await expect(computeSha256Hex(serializeBackupEnvelopeCanonical(withoutDigest))).resolves.toHaveLength(64);
  });

  it('should keep backupVersion pinned to v1 and reject ad-hoc version drift at contract level', () => {
    const envelope = buildEnvelope();

    expect(envelope.backupVersion).toBe(BACKUP_VERSION_V1);
    expect(envelope.backupVersion).not.toBe('2.0.0');
  });

  it('should model imagesExcluded without mixing image binaries into excluded packages', () => {
    const excludedEnvelope: BackupEnvelopeV1 = {
      ...buildEnvelope(),
      manifest: {
        imagesExcluded: true,
        entityCounts: { OUTBOX: 0 },
      },
      images: undefined,
      integrity: {
        digestAlgorithm: BACKUP_DIGEST_ALGORITHM,
        digest: 'a'.repeat(64),
        imageOperationIds: [],
      },
    };

    expect(excludedEnvelope.manifest.imagesExcluded).toBe(true);
    expect(excludedEnvelope.images).toBeUndefined();
    expect(excludedEnvelope.integrity.imageOperationIds).toEqual([]);
  });
});

function buildEnvelope(): BackupEnvelopeV1 {
  return {
    backupVersion: BACKUP_VERSION_V1,
    createdAt: '2026-04-28T14:00:00.000Z',
    sourceSchemaVersion: 8,
    manifest: {
      imagesExcluded: false,
      entityCounts: { OUTBOX: 0 },
    },
    offlineState: createEmptyOfflineState(),
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
      digest: 'a'.repeat(64),
      imageOperationIds: ['image-op-1'],
    },
  };
}
