export const OFFLINE_ENTITY_TYPES = ['USER', 'GANADERO', 'ANIMAL'] as const;
export type OfflineEntityType = (typeof OFFLINE_ENTITY_TYPES)[number];

export const OFFLINE_OPERATION_TYPES = [
  'CREATE',
  'UPDATE',
  'DELETE',
  'STATUS_UPDATE',
  'PASSWORD_RESET',
] as const;
export type OfflineOperationType = (typeof OFFLINE_OPERATION_TYPES)[number];

export const OFFLINE_OPERATION_STATUSES = [
  'pending',
  'in_flight',
  'acked',
  'retry_scheduled',
  'failed',
  'dead_letter',
  'conflict',
] as const;
export type OfflineOperationStatus = (typeof OFFLINE_OPERATION_STATUSES)[number];

export interface OfflineConflictMetadata {
  clientVersion?: number;
  serverVersion: number;
  serverState?: unknown;
  reason: string;
  resolutionHint?: string;
}

export interface OfflineOperationEnvelope {
  operationId: string;
  entityType: OfflineEntityType;
  entityId?: string;
  opType: OfflineOperationType;
  payload: Record<string, unknown>;
  baseVersion?: number;
  clientCreatedAt: string;
  clientUpdatedAt: string;
  status: OfflineOperationStatus;
  attempts: number;
  nextAttemptAt?: string;
  lastErrorCode?: string;
  lastErrorMessage?: string;
  conflict?: OfflineConflictMetadata;
}

export interface OfflineInboxEntry {
  key: string;
  entityType: OfflineEntityType;
  entityId: string;
  payload: Record<string, unknown>;
  receivedAt: string;
}

export interface OfflineSnapshotRecord {
  key: string;
  entityType: OfflineEntityType;
  entityId: string;
  payload: Record<string, unknown>;
  updatedAt: string;
  version?: number;
}

export interface OfflineSyncCheckpoint {
  entityType: OfflineEntityType;
  cursorUpdatedAt: string;
  cursorId: string;
  lastSuccessAt: string;
}

export interface OfflineSyncStateMeta {
  appliedMigrations: string[];
}

export interface PersistedOfflineState {
  schemaVersion: number;
  outbox: Array<Omit<OfflineOperationEnvelope, 'status'> & { status: string }>;
  inbox: OfflineInboxEntry[];
  snapshots: OfflineSnapshotRecord[];
  syncState: {
    checkpoints: Partial<Record<OfflineEntityType, OfflineSyncCheckpoint>>;
    meta?: OfflineSyncStateMeta;
  };
}

export interface EnqueueOfflineOperationInput {
  operationId?: string;
  entityType: OfflineEntityType;
  opType: OfflineOperationType;
  payload: Record<string, unknown>;
  entityId?: string;
  baseVersion?: number;
  clientCreatedAt: string;
  clientUpdatedAt: string;
}

export interface OfflineFailureDescriptor {
  code: string;
  message: string;
}
