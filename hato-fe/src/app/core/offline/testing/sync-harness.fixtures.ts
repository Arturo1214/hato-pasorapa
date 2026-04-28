import type { OfflineOperationEnvelope, OfflineSyncCheckpoint, OfflineEntityType } from '../offline-types';
import type { PullSyncResponse, PushSyncResponse, SyncOperationResult } from '../sync-orchestrator.service';

export const SYNC_HARNESS_MAX_HAS_MORE_PAGES = 10;

export function buildOperation(overrides: Partial<OfflineOperationEnvelope> & Pick<OfflineOperationEnvelope, 'entityType' | 'entityId' | 'opType' | 'operationId'>): OfflineOperationEnvelope {
  return {
    entityType: overrides.entityType,
    entityId: overrides.entityId,
    opType: overrides.opType,
    payload: overrides.payload ?? {},
    baseVersion: overrides.baseVersion ?? 0,
    clientCreatedAt: overrides.clientCreatedAt ?? '2026-04-28T10:00:00.000Z',
    clientUpdatedAt: overrides.clientUpdatedAt ?? '2026-04-28T10:00:00.000Z',
    operationId: overrides.operationId,
    status: overrides.status ?? 'pending',
    attempts: overrides.attempts ?? 0,
    nextAttemptAt: overrides.nextAttemptAt,
    lastErrorCode: overrides.lastErrorCode,
    lastErrorMessage: overrides.lastErrorMessage,
    conflict: overrides.conflict,
  };
}

export function buildCheckpoint(entityType: OfflineEntityType, cursorId: string, cursorUpdatedAt: string): OfflineSyncCheckpoint {
  return {
    entityType,
    cursorId,
    cursorUpdatedAt,
    lastSuccessAt: cursorUpdatedAt,
  };
}

export function buildNoConflictResult(
  operationId: string,
  entityType: OfflineEntityType,
  entityId: string,
  serverVersion = 1
): SyncOperationResult {
  return {
    operationId,
    entityType,
    entityId,
    classification: 'no_conflict',
    serverVersion,
  };
}

export function buildConflictResult(operationId: string, entityId: string, serverVersion = 7): SyncOperationResult {
  return {
    operationId,
    entityType: 'ANIMAL',
    entityId,
    classification: 'version_conflict',
    serverVersion,
    conflict: {
      entityId,
      clientVersion: 1,
      serverVersion,
      reason: 'Hay un conflicto remoto.',
      resolutionHint: 'manual_refresh',
    },
  };
}

export function buildPushResponse(results: SyncOperationResult[]): PushSyncResponse {
  return { results };
}

export function buildPullResponse(params: {
  entityType: OfflineEntityType;
  cursorId: string;
  cursorUpdatedAt: string;
  lastSuccessAt?: string;
  hasMore: boolean;
  items: Array<Record<string, unknown>>;
}): PullSyncResponse {
  return {
    entityType: params.entityType,
    items: params.items,
    nextCursor: {
      entityType: params.entityType,
      cursorId: params.cursorId,
      cursorUpdatedAt: params.cursorUpdatedAt,
      lastSuccessAt: params.lastSuccessAt ?? params.cursorUpdatedAt,
    },
    hasMore: params.hasMore,
  };
}

export function buildAnimalPullPages(): PullSyncResponse[] {
  return [
    buildPullResponse({
      entityType: 'ANIMAL',
      cursorId: 'animal-page-1',
      cursorUpdatedAt: '2026-04-28T10:01:00.000Z',
      lastSuccessAt: '2026-04-28T10:03:00.000Z',
      hasMore: true,
      items: [{ uuid: 'animal-page-1', tag: 'BO-1001', version: 1, updatedAt: '2026-04-28T10:01:00.000Z' }],
    }),
    buildPullResponse({
      entityType: 'ANIMAL',
      cursorId: 'animal-page-2',
      cursorUpdatedAt: '2026-04-28T10:02:00.000Z',
      lastSuccessAt: '2026-04-28T10:03:00.000Z',
      hasMore: true,
      items: [{ uuid: 'animal-page-2', tag: 'BO-1002', version: 2, updatedAt: '2026-04-28T10:02:00.000Z' }],
    }),
    buildPullResponse({
      entityType: 'ANIMAL',
      cursorId: 'animal-page-3',
      cursorUpdatedAt: '2026-04-28T10:03:00.000Z',
      lastSuccessAt: '2026-04-28T10:03:00.000Z',
      hasMore: false,
      items: [{ uuid: 'animal-page-3', tag: 'BO-1003', version: 3, updatedAt: '2026-04-28T10:03:00.000Z' }],
    }),
  ];
}

export function buildOverflowPullPage(step: number): PullSyncResponse {
  return buildPullResponse({
    entityType: 'ANIMAL',
    cursorId: `overflow-page-${step}`,
    cursorUpdatedAt: `2026-04-28T10:${String(step).padStart(2, '0')}:00.000Z`,
    lastSuccessAt: `2026-04-28T10:${String(step).padStart(2, '0')}:00.000Z`,
    hasMore: true,
    items: [{ uuid: `overflow-page-${step}`, tag: `BO-${step}`, version: step, updatedAt: `2026-04-28T10:${String(step).padStart(2, '0')}:00.000Z` }],
  });
}
