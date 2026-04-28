import type { PersistedOfflineState } from '../offline-types';

export const BACKUP_VERSION_V1 = '1.0.0' as const;
export const BACKUP_DIGEST_ALGORITHM = 'SHA-256' as const;

export interface BackupManifest {
  imagesExcluded: boolean;
  entityCounts: Record<string, number>;
}

export interface BackupImageBinaryEntry {
  operationId: string;
  mimeType: string;
  sizeBytes: number;
  capturedAt: string;
  base64: string;
}

export interface BackupIntegritySection {
  digestAlgorithm: typeof BACKUP_DIGEST_ALGORITHM;
  digest: string;
  imageOperationIds: string[];
}

export interface BackupEnvelopeV1 {
  backupVersion: typeof BACKUP_VERSION_V1;
  createdAt: string;
  sourceSchemaVersion: number;
  manifest: BackupManifest;
  offlineState: PersistedOfflineState;
  images?: BackupImageBinaryEntry[];
  integrity: BackupIntegritySection;
}

export interface BackupExportOptions {
  includeImages: boolean;
}

export interface BackupImportResult {
  restoredAt: string;
  imagesRestored: number;
  entityCounts: Record<string, number>;
}

export interface BackupValidationIssue {
  code: string;
  path: string;
  message: string;
}

export class BackupValidationError extends Error {
  readonly issues: BackupValidationIssue[];

  constructor(message: string, issues: BackupValidationIssue[]) {
    super(message);
    this.name = 'BackupValidationError';
    this.issues = issues;
  }
}

export class BackupImportError extends Error {
  readonly code: string;
  readonly causeValue?: unknown;

  constructor(code: string, message: string, causeValue?: unknown) {
    super(message);
    this.name = 'BackupImportError';
    this.code = code;
    this.causeValue = causeValue;
  }
}

export function createBackupValidationIssue(code: string, path: string, message: string): BackupValidationIssue {
  return { code, path, message };
}

export function serializeBackupEnvelopeCanonical(envelope: BackupEnvelopeV1): string {
  return JSON.stringify(sortJsonValue(envelope));
}

export function cloneBackupEnvelopeForDigest(envelope: BackupEnvelopeV1): BackupEnvelopeV1 {
  return {
    ...envelope,
    integrity: {
      ...envelope.integrity,
      digest: '',
      imageOperationIds: [...envelope.integrity.imageOperationIds].sort(),
    },
    manifest: {
      ...envelope.manifest,
      entityCounts: sortRecord(envelope.manifest.entityCounts),
    },
    images: envelope.images?.map((entry) => ({ ...entry })),
  };
}

export async function computeSha256Hex(value: string | Uint8Array | ArrayBuffer): Promise<string> {
  const inputBytes =
    typeof value === 'string'
      ? new TextEncoder().encode(value)
      : value instanceof Uint8Array
        ? value
        : new Uint8Array(value);
  const bytes = new Uint8Array(Array.from(inputBytes));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => sortJsonValue(entry));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nestedValue]) => [key, sortJsonValue(nestedValue)])
    );
  }

  return value;
}

function sortRecord(record: Record<string, number>) {
  return Object.fromEntries(Object.entries(record).sort(([left], [right]) => left.localeCompare(right)));
}
