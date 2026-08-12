import { mapAnimalOfflineUiStatus, type AnimalOfflineUiStatus, type OfflineOperationEnvelope } from '../../../../core/offline/offline-types';
import type { AnimalEventItem, AnimalEventListFilters } from './animals-events.service';

export function normalizeAnimalEventItem(raw: Record<string, unknown>): AnimalEventItem {
  return {
    id: String(raw['id'] ?? raw['operationId'] ?? ''),
    animalUuid: String(raw['animalUuid'] ?? ''),
    type: String(raw['type'] ?? raw['eventType'] ?? 'OBSERVATION') as AnimalEventItem['type'],
    occurredAt: String(raw['occurredAt'] ?? ''),
    notes: typeof raw['notes'] === 'string' ? raw['notes'] : null,
    performedByUserId: String(raw['performedByUserId'] ?? ''),
    sourceChannel: String(raw['sourceChannel'] ?? 'OFFLINE') as AnimalEventItem['sourceChannel'],
    operationId: String(raw['operationId'] ?? raw['id'] ?? ''),
    metadata: (raw['metadata'] as AnimalEventItem['metadata'] | undefined) ?? {},
    clientCreatedAt: String(raw['clientCreatedAt'] ?? raw['createdAt'] ?? raw['occurredAt'] ?? ''),
    createdAt: String(raw['createdAt'] ?? raw['occurredAt'] ?? ''),
    updatedAt: String(raw['updatedAt'] ?? raw['createdAt'] ?? raw['occurredAt'] ?? ''),
  };
}

export function matchesAnimalEventFilters(item: AnimalEventItem, filters: AnimalEventListFilters): boolean {
  if (filters.eventType && item.type !== filters.eventType) {
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

export function compareAnimalEventTimeline(left: AnimalEventItem, right: AnimalEventItem): number {
  const occurredComparison = left.occurredAt.localeCompare(right.occurredAt);
  if (occurredComparison !== 0) {
    return occurredComparison;
  }

  const createdComparison = left.createdAt.localeCompare(right.createdAt);
  if (createdComparison !== 0) {
    return createdComparison;
  }

  return left.id.localeCompare(right.id);
}

export function decorateAnimalEventSnapshot(
  item: AnimalEventItem,
  outbox: OfflineOperationEnvelope[]
): AnimalEventItem {
  const relatedOperations = outbox.filter(
    (operation) =>
      (operation.entityType === 'ANIMAL_EVENT' || operation.entityType === 'ANIMAL_EVENT_LOG') &&
      operation.entityId === item.id &&
      (!operation.payload['eventCategory'] || operation.payload['eventCategory'] === 'GENERAL')
  );
  const statusOperation = findHighestPriorityOfflineOperation(relatedOperations);
  const syncStatus = mapAnimalOfflineUiStatus(statusOperation?.status);

  return {
    ...item,
    syncStatus,
    syncMessage: resolveEventSyncMessage(syncStatus, statusOperation),
  };
}

function findHighestPriorityOfflineOperation(operations: OfflineOperationEnvelope[]) {
  return (
    operations.find((operation) => operation.status === 'conflict') ??
    operations.find((operation) => operation.status === 'failed' || operation.status === 'dead_letter') ??
    operations.find((operation) => operation.status !== 'acked')
  );
}

function resolveEventSyncMessage(status: AnimalOfflineUiStatus, operation: OfflineOperationEnvelope | undefined) {
  if (status === 'conflict') {
    return operation?.conflict?.reason ?? operation?.lastErrorMessage ?? 'Hay un conflicto remoto.';
  }
  if (status === 'failed') {
    return operation?.lastErrorMessage ?? 'No se pudo sincronizar.';
  }
  if (status === 'pending') {
    return 'Pendiente de sincronización.';
  }
  return null;
}
