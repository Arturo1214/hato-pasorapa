import { expect } from 'vitest';
import type { OfflineStoreService } from '../offline-store.service';
import type { OfflineEntityType } from '../offline-types';
import type { SyncMetricsStore } from '../sync-metrics.store';

export function expectPushBeforePull(callSequence: string[]) {
  expect(callSequence[0]).toBe('push');
  expect(callSequence.slice(1).every((entry) => entry.startsWith('pull'))).toBe(true);
}

export async function expectCheckpointCursor(
  store: OfflineStoreService,
  entityType: OfflineEntityType,
  expected: { cursorId: string; cursorUpdatedAt: string; lastSuccessAt: string }
) {
  await expect(store.getCheckpoint(entityType)).resolves.toEqual({ entityType, ...expected });
}

export async function expectSnapshotIds(store: OfflineStoreService, entityType: OfflineEntityType, expectedIds: string[]) {
  const snapshots = await store.listSnapshots(entityType);
  expect(snapshots.map((snapshot) => snapshot.entityId)).toEqual(expectedIds);
}

export function expectRuntimeCycle(metrics: SyncMetricsStore, expected: Record<string, unknown>) {
  expect(metrics.runtime().cycle).toMatchObject(expected);
}

export function expectBatchComposition(metrics: SyncMetricsStore, expected: Record<string, number>) {
  expect(metrics.runtime().cycle).toMatchObject({ batchComposition: expected });
}
