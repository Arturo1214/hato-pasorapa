import {
  CURRENT_OFFLINE_SCHEMA_VERSION,
  isOfflineSchemaVersionSupported,
} from '../offline-store.migrations';
import type {
  OfflineOperationEnvelope,
  OfflineSnapshotRecord,
  PersistedOfflineState,
} from '../offline-types';
import {
  BACKUP_DIGEST_ALGORITHM,
  BACKUP_VERSION_V1,
  type BackupEnvelopeV1,
  type BackupImageBinaryEntry,
  type BackupValidationIssue,
  BackupValidationError,
  cloneBackupEnvelopeForDigest,
  computeSha256Hex,
  createBackupValidationIssue,
  serializeBackupEnvelopeCanonical,
} from './offline-backup.types';

export interface BackupValidationOptions {
  currentSchemaVersion?: number;
}

export async function validateBackupEnvelope(
  candidate: unknown,
  options: BackupValidationOptions = {},
): Promise<BackupEnvelopeV1> {
  const issues: BackupValidationIssue[] = [];
  const currentSchemaVersion = options.currentSchemaVersion ?? CURRENT_OFFLINE_SCHEMA_VERSION;

  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    throw new BackupValidationError('El archivo de respaldo no tiene un objeto JSON válido.', [
      createBackupValidationIssue(
        'BACKUP_FILE_CORRUPT',
        '$',
        'Se esperaba un objeto JSON en la raíz del respaldo.',
      ),
    ]);
  }

  const envelope = candidate as Partial<BackupEnvelopeV1>;
  if (envelope.backupVersion !== BACKUP_VERSION_V1) {
    issues.push(
      createBackupValidationIssue(
        'BACKUP_VERSION_UNSUPPORTED',
        'backupVersion',
        `La versión ${String(envelope.backupVersion ?? 'desconocida')} no es compatible con V1.`,
      ),
    );
  }

  if (!isIsoDate(envelope.createdAt)) {
    issues.push(
      createBackupValidationIssue(
        'BACKUP_CREATED_AT_INVALID',
        'createdAt',
        'El respaldo debe incluir una fecha ISO válida.',
      ),
    );
  }

  if (!Number.isInteger(envelope.sourceSchemaVersion)) {
    issues.push(
      createBackupValidationIssue(
        'BACKUP_SCHEMA_VERSION_INVALID',
        'sourceSchemaVersion',
        'El respaldo debe incluir un schemaVersion entero.',
      ),
    );
  } else if (
    !isOfflineSchemaVersionSupported(envelope.sourceSchemaVersion as number) ||
    (envelope.sourceSchemaVersion as number) > currentSchemaVersion
  ) {
    issues.push(
      createBackupValidationIssue(
        'BACKUP_SCHEMA_VERSION_UNSUPPORTED',
        'sourceSchemaVersion',
        `El schemaVersion ${String(envelope.sourceSchemaVersion)} no es compatible con este dispositivo.`,
      ),
    );
  }

  if (!envelope.manifest || typeof envelope.manifest !== 'object') {
    issues.push(
      createBackupValidationIssue(
        'BACKUP_MANIFEST_REQUIRED',
        'manifest',
        'El respaldo debe incluir manifest.',
      ),
    );
  }

  if (!isPersistedOfflineState(envelope.offlineState)) {
    issues.push(
      createBackupValidationIssue(
        'BACKUP_OFFLINE_STATE_INVALID',
        'offlineState',
        'El respaldo debe incluir un estado sin conexión estructuralmente válido.',
      ),
    );
  }

  if (!envelope.integrity || typeof envelope.integrity !== 'object') {
    issues.push(
      createBackupValidationIssue(
        'BACKUP_INTEGRITY_REQUIRED',
        'integrity',
        'El respaldo debe incluir metadatos de integridad.',
      ),
    );
  }

  if (issues.length > 0) {
    throw new BackupValidationError('El archivo de respaldo tiene errores estructurales.', issues);
  }

  const manifest = envelope.manifest as BackupEnvelopeV1['manifest'];
  const offlineState = envelope.offlineState as PersistedOfflineState;
  const integrity = envelope.integrity as BackupEnvelopeV1['integrity'];

  if (typeof manifest.imagesExcluded !== 'boolean') {
    issues.push(
      createBackupValidationIssue(
        'BACKUP_IMAGES_EXCLUDED_INVALID',
        'manifest.imagesExcluded',
        'manifest.imagesExcluded debe ser booleano.',
      ),
    );
  }

  if (
    !manifest.entityCounts ||
    typeof manifest.entityCounts !== 'object' ||
    Array.isArray(manifest.entityCounts)
  ) {
    issues.push(
      createBackupValidationIssue(
        'BACKUP_ENTITY_COUNTS_INVALID',
        'manifest.entityCounts',
        'manifest.entityCounts debe ser un mapa clave→cantidad.',
      ),
    );
  }

  if (integrity.digestAlgorithm !== BACKUP_DIGEST_ALGORITHM) {
    issues.push(
      createBackupValidationIssue(
        'BACKUP_DIGEST_ALGORITHM_INVALID',
        'integrity.digestAlgorithm',
        'El respaldo debe usar SHA-256 como algoritmo de digest.',
      ),
    );
  }

  if (typeof integrity.digest !== 'string' || !/^[a-f0-9]{64}$/i.test(integrity.digest)) {
    issues.push(
      createBackupValidationIssue(
        'BACKUP_DIGEST_REQUIRED',
        'integrity.digest',
        'El respaldo debe incluir un digest SHA-256 hexadecimal válido.',
      ),
    );
  }

  if (!Array.isArray(integrity.imageOperationIds)) {
    issues.push(
      createBackupValidationIssue(
        'BACKUP_IMAGE_OPERATION_IDS_INVALID',
        'integrity.imageOperationIds',
        'integrity.imageOperationIds debe ser un arreglo.',
      ),
    );
  }

  const referencedImageIds = collectReferencedImageOperationIds(offlineState);
  const expectedChecksums = collectExpectedImageChecksums(offlineState);
  const providedImages = Array.isArray(envelope.images)
    ? (envelope.images as BackupImageBinaryEntry[])
    : [];
  const providedImageIds = new Set(providedImages.map((entry) => entry.operationId));

  if (manifest.imagesExcluded) {
    if ((envelope.images?.length ?? 0) > 0) {
      issues.push(
        createBackupValidationIssue(
          'BACKUP_IMAGES_EXCLUDED_WITH_BINARIES',
          'images',
          'Si imagesExcluded=true, el respaldo no puede incluir blobs de imágenes.',
        ),
      );
    }

    if (referencedImageIds.size > 0) {
      issues.push(
        createBackupValidationIssue(
          'BACKUP_IMAGES_EXCLUDED_WITH_REFERENCES',
          'offlineState',
          'Si imagesExcluded=true, el estado sin conexión no puede conservar referencias ANIMAL_IMAGE.',
        ),
      );
    }

    if (integrity.imageOperationIds.length > 0) {
      issues.push(
        createBackupValidationIssue(
          'BACKUP_IMAGES_EXCLUDED_WITH_INTEGRITY_LINKS',
          'integrity.imageOperationIds',
          'Si imagesExcluded=true, integrity.imageOperationIds debe quedar vacío.',
        ),
      );
    }
  } else {
    for (const operationId of referencedImageIds) {
      if (!providedImageIds.has(operationId)) {
        issues.push(
          createBackupValidationIssue(
            'BACKUP_IMAGE_REFERENCE_MISSING',
            `images.${operationId}`,
            `Falta el binario para la referencia de imagen ${operationId}.`,
          ),
        );
      }
    }

    for (const operationId of integrity.imageOperationIds) {
      if (!referencedImageIds.has(operationId)) {
        issues.push(
          createBackupValidationIssue(
            'BACKUP_IMAGE_INTEGRITY_REFERENCE_ORPHAN',
            'integrity.imageOperationIds',
            `La referencia ${operationId} no existe en el offlineState restaurable.`,
          ),
        );
      }
    }

    for (const image of providedImages) {
      if (!image.operationId || !referencedImageIds.has(image.operationId)) {
        issues.push(
          createBackupValidationIssue(
            'BACKUP_IMAGE_REFERENCE_INVALID',
            `images.${image.operationId || 'unknown'}`,
            'Cada imagen debe apuntar a un operationId ANIMAL_IMAGE válido dentro del respaldo.',
          ),
        );
        continue;
      }

      if (
        !image.mimeType ||
        !image.base64 ||
        !Number.isInteger(image.sizeBytes) ||
        image.sizeBytes < 0 ||
        !isIsoDate(image.capturedAt)
      ) {
        issues.push(
          createBackupValidationIssue(
            'BACKUP_IMAGE_ENTRY_INVALID',
            `images.${image.operationId}`,
            'Cada imagen debe incluir mimeType, sizeBytes, capturedAt y base64 válidos.',
          ),
        );
        continue;
      }

      const bytes = decodeBase64(image.base64);
      if (bytes.byteLength !== image.sizeBytes) {
        issues.push(
          createBackupValidationIssue(
            'BACKUP_IMAGE_SIZE_MISMATCH',
            `images.${image.operationId}.sizeBytes`,
            `La imagen ${image.operationId} no coincide entre sizeBytes y el blob serializado.`,
          ),
        );
      }

      const binaryChecksum = await computeSha256Hex(bytes);
      const expectedChecksum = expectedChecksums.get(image.operationId);
      if (!expectedChecksum || binaryChecksum !== expectedChecksum) {
        issues.push(
          createBackupValidationIssue(
            'BACKUP_IMAGE_CHECKSUM_MISMATCH',
            `images.${image.operationId}`,
            `La imagen ${image.operationId} no coincide con el checksum declarado en offlineState.`,
          ),
        );
      }
    }
  }

  const normalizedEnvelope: BackupEnvelopeV1 = {
    backupVersion: BACKUP_VERSION_V1,
    createdAt: envelope.createdAt as string,
    sourceSchemaVersion: envelope.sourceSchemaVersion as number,
    manifest,
    offlineState,
    images: providedImages.length > 0 ? providedImages : undefined,
    integrity,
  };

  if (integrity.digest) {
    const digestSource = serializeBackupEnvelopeCanonical(
      cloneBackupEnvelopeForDigest(normalizedEnvelope),
    );
    const computedDigest = await computeSha256Hex(digestSource);
    if (computedDigest !== integrity.digest) {
      issues.push(
        createBackupValidationIssue(
          'BACKUP_DIGEST_MISMATCH',
          'integrity.digest',
          'El digest SHA-256 del respaldo no coincide con el contenido real del archivo.',
        ),
      );
    }
  }

  if (issues.length > 0) {
    throw new BackupValidationError(
      'El archivo de respaldo no pasó la validación fuerte previa a la restauración.',
      issues,
    );
  }

  return normalizedEnvelope;
}

function isPersistedOfflineState(value: unknown): value is PersistedOfflineState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Partial<PersistedOfflineState>;
  return (
    Number.isInteger(candidate.schemaVersion) &&
    Array.isArray(candidate.outbox) &&
    Array.isArray(candidate.inbox) &&
    Array.isArray(candidate.snapshots) &&
    !!candidate.syncState &&
    typeof candidate.syncState === 'object' &&
    !Array.isArray(candidate.syncState) &&
    !!candidate.syncState.checkpoints &&
    typeof candidate.syncState.checkpoints === 'object'
  );
}

function collectReferencedImageOperationIds(state: PersistedOfflineState) {
  const result = new Set<string>();

  const pushOperationId = (payload: Record<string, unknown>) => {
    const operationId = payload['operationId'];
    const binaryRef = payload['binaryRef'];
    if (typeof operationId === 'string') {
      result.add(operationId);
    }
    if (typeof binaryRef === 'string') {
      result.add(binaryRef);
    }
  };

  state.outbox
    .filter((operation) => operation.entityType === 'ANIMAL_IMAGE')
    .forEach((operation) => pushOperationId(operation.payload as Record<string, unknown>));
  state.snapshots
    .filter((snapshot) => snapshot.entityType === 'ANIMAL_IMAGE')
    .forEach((snapshot) => pushOperationId(snapshot.payload as Record<string, unknown>));

  return result;
}

function collectExpectedImageChecksums(state: PersistedOfflineState) {
  const result = new Map<string, string>();
  const saveChecksum = (operationId: unknown, payload: Record<string, unknown>) => {
    if (typeof operationId !== 'string') {
      return;
    }
    const checksum = payload['checksumSha256'];
    if (typeof checksum === 'string' && checksum.length === 64) {
      result.set(operationId, checksum);
    }
  };

  state.outbox
    .filter((operation) => operation.entityType === 'ANIMAL_IMAGE')
    .forEach((operation) => {
      const payload = operation.payload as Record<string, unknown>;
      saveChecksum(
        payload['operationId'] ?? payload['binaryRef'] ?? operation.operationId,
        payload,
      );
    });

  state.snapshots
    .filter((snapshot) => snapshot.entityType === 'ANIMAL_IMAGE')
    .forEach((snapshot) => {
      const payload = snapshot.payload as Record<string, unknown>;
      saveChecksum(payload['operationId'] ?? payload['binaryRef'] ?? snapshot.entityId, payload);
    });

  return result;
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function decodeBase64(value: string) {
  if (typeof globalThis.atob !== 'function') {
    throw new Error('El entorno no soporta atob().');
  }

  const binary = globalThis.atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
