import type { OfflineStoreService } from '../../../../core/offline/offline-store.service';
import type { AnimalEventLogSnapshotPayload } from '../../../../core/offline/offline-types';

export interface QueueAnimalEventLogCreateInput<TSnapshot> {
  store: OfflineStoreService;
  operationId: string;
  snapshot: TSnapshot;
  now: string;
  toPayload: (snapshot: TSnapshot) => AnimalEventLogSnapshotPayload;
  saveSnapshot: (snapshot: TSnapshot) => Promise<void>;
}

export async function queueAnimalEventLogCreate<TSnapshot>({
  store,
  operationId,
  snapshot,
  now,
  toPayload,
  saveSnapshot,
}: QueueAnimalEventLogCreateInput<TSnapshot>) {
  await store.enqueueOperation({
    entityType: 'ANIMAL_EVENT_LOG',
    entityId: operationId,
    opType: 'CREATE',
    payload: toPayload(snapshot) as unknown as Record<string, unknown>,
    baseVersion: 0,
    clientCreatedAt: now,
    clientUpdatedAt: now,
    operationId,
  });
  await saveSnapshot(snapshot);
}

export function runSequentially<T>(
  items: readonly T[],
  action: (item: T, index: number) => Promise<void>,
): Promise<void> {
  return items.reduce(
    (chain, item, index) => chain.then(() => action(item, index)),
    Promise.resolve(),
  );
}
