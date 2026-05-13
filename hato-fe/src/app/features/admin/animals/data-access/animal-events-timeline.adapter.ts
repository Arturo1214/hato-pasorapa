import type { OfflineOperationEnvelope } from '../../../../core/offline/offline-types';
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
  const conflict = relatedOperations.find((operation) => operation.status === 'conflict');
  if (conflict) {
    return {
      ...item,
      syncStatus: 'conflict',
      syncMessage: conflict.conflict?.reason ?? conflict.lastErrorMessage ?? 'Hay un conflicto remoto.',
    };
  }

  const pending = relatedOperations.find(
    (operation) => operation.status === 'pending' || operation.status === 'retry_scheduled' || operation.status === 'in_flight'
  );
  if (pending) {
    return {
      ...item,
      syncStatus: 'pending',
      syncMessage: 'Pendiente de sync.',
    };
  }

  return {
    ...item,
    syncStatus: 'synced',
    syncMessage: null,
  };
}
