import type {
  AnimalOfflineUiStatus,
  AnimalReproductionEventOfflineMetadata,
  OfflineOperationEnvelope,
} from '../../../../core/offline/offline-types';
import { mapAnimalOfflineUiStatus } from '../../../../core/offline/offline-types';
import type { AnimalReproductionEventItem, AnimalReproductionEventListFilters } from './animals-reproduction-events.service';

export function normalizeAnimalReproductionEventItem(raw: Record<string, unknown>): AnimalReproductionEventItem {
  return {
    id: String(raw['id'] ?? raw['operationId'] ?? ''),
    animalUuid: String(raw['animalUuid'] ?? ''),
    reproductionEventType: String(raw['reproductionEventType'] ?? raw['eventType'] ?? raw['type'] ?? 'SERVICE') as AnimalReproductionEventItem['reproductionEventType'],
    occurredAt: String(raw['occurredAt'] ?? ''),
    notes: typeof raw['notes'] === 'string' ? raw['notes'] : null,
    performedByUserId: String(raw['performedByUserId'] ?? ''),
    sourceChannel: String(raw['sourceChannel'] ?? 'OFFLINE') as AnimalReproductionEventItem['sourceChannel'],
    operationId: String(raw['operationId'] ?? raw['id'] ?? ''),
    metadata: (raw['metadata'] as AnimalReproductionEventOfflineMetadata | undefined) ?? {},
    clientCreatedAt: String(raw['clientCreatedAt'] ?? raw['createdAt'] ?? raw['occurredAt'] ?? ''),
    createdAt: String(raw['createdAt'] ?? raw['occurredAt'] ?? ''),
    updatedAt: String(raw['updatedAt'] ?? raw['createdAt'] ?? raw['occurredAt'] ?? ''),
  };
}

export function matchesAnimalReproductionEventFilters(
  item: AnimalReproductionEventItem,
  filters: AnimalReproductionEventListFilters
): boolean {
  if (filters.reproductionEventType && item.reproductionEventType !== filters.reproductionEventType) {
    return false;
  }

  if (filters.occurredFrom && item.occurredAt < filters.occurredFrom) {
    return false;
  }

  if (filters.occurredTo && item.occurredAt > filters.occurredTo) {
    return false;
  }

  return true;
}

export function compareAnimalReproductionEventTimeline(left: AnimalReproductionEventItem, right: AnimalReproductionEventItem): number {
  const occurredComparison = right.occurredAt.localeCompare(left.occurredAt);
  if (occurredComparison !== 0) {
    return occurredComparison;
  }

  const createdComparison = right.createdAt.localeCompare(left.createdAt);
  if (createdComparison !== 0) {
    return createdComparison;
  }

  return right.id.localeCompare(left.id);
}

export function decorateAnimalReproductionTimeline(
  items: AnimalReproductionEventItem[],
  outbox: OfflineOperationEnvelope[]
): AnimalReproductionEventItem[] {
  return [...items].sort(compareAnimalReproductionEventTimeline).map((item) => {
    const relatedOperations = outbox.filter(
      (operation) =>
        (operation.entityType === 'ANIMAL_REPRODUCTION_EVENT' || operation.entityType === 'ANIMAL_EVENT_LOG') &&
        operation.entityId === item.id &&
        (!operation.payload['eventCategory'] || operation.payload['eventCategory'] === 'REPRODUCTION')
    );
    const statusOperation = findHighestPriorityOfflineOperation(relatedOperations);
    const syncStatus = mapAnimalOfflineUiStatus(statusOperation?.status);

    return {
      ...item,
      syncStatus,
      syncState: mapReproductionSyncState(syncStatus),
      syncMessage: resolveReproductionSyncMessage(syncStatus, statusOperation),
    } satisfies AnimalReproductionEventItem;
  });
}

function findHighestPriorityOfflineOperation(operations: OfflineOperationEnvelope[]) {
  return (
    operations.find((operation) => operation.status === 'conflict') ??
    operations.find((operation) => operation.status === 'failed' || operation.status === 'dead_letter') ??
    operations.find((operation) => operation.status !== 'acked')
  );
}

function mapReproductionSyncState(status: AnimalOfflineUiStatus): AnimalReproductionEventItem['syncState'] {
  if (status === 'pending' || status === 'local_only') {
    return 'PENDING_SYNC';
  }
  if (status === 'conflict' || status === 'failed') {
    return 'CONFLICT';
  }
  return 'SYNCED';
}

function resolveReproductionSyncMessage(status: AnimalOfflineUiStatus, operation: OfflineOperationEnvelope | undefined) {
  if (status === 'conflict') {
    return operation?.conflict?.reason ?? operation?.lastErrorMessage ?? 'Hay un conflicto remoto.';
  }
  if (status === 'failed') {
    return operation?.lastErrorMessage ?? 'No se pudo sincronizar.';
  }
  if (status === 'pending' || status === 'local_only') {
    return 'Pendiente de sincronización.';
  }
  return null;
}
