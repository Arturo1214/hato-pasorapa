import type {
  AnimalHealthEventOfflineMetadata,
  OfflineOperationEnvelope,
} from '../../../../core/offline/offline-types';
import type { AnimalHealthEventItem, AnimalHealthEventListFilters } from './animals-health-events.service';

export function normalizeAnimalHealthEventItem(raw: Record<string, unknown>): AnimalHealthEventItem {
  const metadata = (raw['metadata'] as AnimalHealthEventOfflineMetadata | undefined) ?? {};
  const visitId = typeof raw['visitId'] === 'string' ? raw['visitId'] : readVisitIdFromMetadata(metadata);
  const parentVisitId = typeof raw['parentVisitId'] === 'string' ? raw['parentVisitId'] : readParentVisitIdFromMetadata(metadata);
  const nextDueAt = typeof raw['nextDueAt'] === 'string' ? raw['nextDueAt'] : readNextDueAt(metadata);
  const followUpStatus = typeof raw['followUpStatus'] === 'string' ? raw['followUpStatus'] : undefined;
  const visitMode = readVisitMode(metadata);
  const visitStatus = readVisitStatus(metadata);
  const veterinarianName = readVeterinarianName(metadata);

  return {
    id: String(raw['id'] ?? raw['operationId'] ?? ''),
    animalUuid: String(raw['animalUuid'] ?? ''),
    healthEventType: String(raw['healthEventType'] ?? raw['eventType'] ?? raw['type'] ?? 'VACCINATION') as AnimalHealthEventItem['healthEventType'],
    occurredAt: String(raw['occurredAt'] ?? ''),
    notes: typeof raw['notes'] === 'string' ? raw['notes'] : null,
    performedByUserId: String(raw['performedByUserId'] ?? ''),
    sourceChannel: String(raw['sourceChannel'] ?? 'OFFLINE') as AnimalHealthEventItem['sourceChannel'],
    operationId: String(raw['operationId'] ?? raw['id'] ?? ''),
    metadata,
    clientCreatedAt: String(raw['clientCreatedAt'] ?? raw['createdAt'] ?? raw['occurredAt'] ?? ''),
    createdAt: String(raw['createdAt'] ?? raw['occurredAt'] ?? ''),
    updatedAt: String(raw['updatedAt'] ?? raw['createdAt'] ?? raw['occurredAt'] ?? ''),
    visitId,
    parentVisitId,
    nextDueAt,
    treatmentStatus: normalizeFollowUpStatus(followUpStatus),
    ...(visitMode ? { visitMode, visitProjection: visitMode === 'GLOBAL' ? 'CAMPAIGN' : 'SPECIFIC' } : {}),
    ...(visitStatus ? { visitStatus } : {}),
    ...(veterinarianName ? { veterinarianName } : {}),
  };
}

export function matchesAnimalHealthEventFilters(item: AnimalHealthEventItem, filters: AnimalHealthEventListFilters): boolean {
  if (filters.healthEventType && item.healthEventType !== filters.healthEventType) {
    return false;
  }

  if (filters.occurredFrom && item.occurredAt < filters.occurredFrom) {
    return false;
  }

  if (filters.occurredTo && item.occurredAt > filters.occurredTo) {
    return false;
  }

  if (filters.visitId && item.visitId !== filters.visitId) {
    return false;
  }

  return true;
}

export function compareAnimalHealthEventTimeline(left: AnimalHealthEventItem, right: AnimalHealthEventItem): number {
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

export function decorateAnimalHealthTimeline(items: AnimalHealthEventItem[], outbox: OfflineOperationEnvelope[]): AnimalHealthEventItem[] {
  const sorted = [...items].sort(compareAnimalHealthEventTimeline);
  const latestByTreatmentCase = new Map<string, AnimalHealthEventItem['healthEventType']>();
  const parentByVisitId = new Map<string, string>();
  const latestByChainRoot = new Map<string, { status: AnimalHealthEventItem['treatmentStatus']; nextDueAt: string | null }>();

  sorted.forEach((item) => {
    const treatmentCaseId = readTreatmentCaseId(item);
    if (treatmentCaseId) {
      latestByTreatmentCase.set(treatmentCaseId, item.healthEventType);
    }

    const visitId = readVisitId(item);
    const parentVisitId = item.parentVisitId ?? readParentVisitIdFromMetadata(item.metadata);
    if (visitId && parentVisitId) {
      parentByVisitId.set(visitId, parentVisitId);
    }
  });

  sorted.forEach((item) => {
    const visitId = readVisitId(item);
    if (visitId) {
      latestByChainRoot.set(resolveVisitChainRoot(visitId, parentByVisitId), {
        status: readProtocolStatus(item) === 'CLOSED' ? 'closed' : 'active',
        nextDueAt: readNextDueAt(item.metadata) ?? null,
      });
    }
  });

  return sorted.map((item) => {
    const relatedOperations = outbox.filter(
      (operation) =>
        (operation.entityType === 'ANIMAL_HEALTH_EVENT' || operation.entityType === 'ANIMAL_EVENT_LOG') &&
        operation.entityId === item.id &&
        (!operation.payload['eventCategory'] || operation.payload['eventCategory'] === 'HEALTH')
    );
    const conflict = relatedOperations.find((operation) => operation.status === 'conflict');
    const pending = relatedOperations.find(
      (operation) => operation.status === 'pending' || operation.status === 'retry_scheduled' || operation.status === 'in_flight'
    );

    const treatmentCaseId = readTreatmentCaseId(item);
    const latestType = treatmentCaseId ? latestByTreatmentCase.get(treatmentCaseId) : undefined;
    const visitProjection = item.visitId ? latestByChainRoot.get(resolveVisitChainRoot(item.visitId, parentByVisitId)) : undefined;
    const treatmentStatus = visitProjection?.status ?? (treatmentCaseId ? (latestType === 'TREATMENT_CLOSED' ? 'closed' : 'active') : item.treatmentStatus);
    const nextDueAt = visitProjection?.nextDueAt ?? item.nextDueAt ?? null;

    if (conflict) {
      return {
        ...item,
        syncStatus: 'conflict',
        syncMessage: conflict.conflict?.reason ?? conflict.lastErrorMessage ?? 'Hay un conflicto remoto.',
        treatmentStatus,
        nextDueAt,
      } satisfies AnimalHealthEventItem;
    }

    if (pending) {
      return {
        ...item,
        syncStatus: 'pending',
        syncMessage: 'Pendiente de sync.',
        treatmentStatus,
        nextDueAt,
      } satisfies AnimalHealthEventItem;
    }

    return {
      ...item,
      syncStatus: 'synced',
      syncMessage: null,
      treatmentStatus,
      nextDueAt,
    } satisfies AnimalHealthEventItem;
  });
}

function readTreatmentCaseId(item: AnimalHealthEventItem) {
  const value = 'treatmentCaseId' in item.metadata ? item.metadata.treatmentCaseId : undefined;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readVisitId(item: AnimalHealthEventItem) {
  return item.visitId ?? readVisitIdFromMetadata(item.metadata);
}

function readVisitIdFromMetadata(metadata: AnimalHealthEventOfflineMetadata) {
  if (!('visit' in metadata) || typeof metadata.visit !== 'object' || metadata.visit === null) {
    return null;
  }
  const visitId = (metadata.visit as Record<string, unknown>)['visitId'];
  return typeof visitId === 'string' && visitId.trim() ? visitId.trim() : null;
}

function readParentVisitIdFromMetadata(metadata: AnimalHealthEventOfflineMetadata) {
  const visit = readVisitBlock(metadata);
  const parentVisitId = visit?.['parentVisitId'];
  return typeof parentVisitId === 'string' && parentVisitId.trim() ? parentVisitId.trim() : null;
}

function resolveVisitChainRoot(visitId: string, parentByVisitId: Map<string, string>) {
  let current = visitId;
  const seen = new Set<string>();
  while (parentByVisitId.has(current) && !seen.has(current)) {
    seen.add(current);
    current = parentByVisitId.get(current)!;
  }
  return current;
}

function readVisitMode(metadata: AnimalHealthEventOfflineMetadata) {
  const visit = readVisitBlock(metadata);
  const mode = visit?.['mode'];
  return mode === 'GLOBAL' || mode === 'SPECIFIC' ? mode : undefined;
}

function readVisitStatus(metadata: AnimalHealthEventOfflineMetadata) {
  const visit = readVisitBlock(metadata);
  const status = visit?.['status'];
  return typeof status === 'string' && status.trim() ? status.trim() : undefined;
}

function readVeterinarianName(metadata: AnimalHealthEventOfflineMetadata) {
  const visit = readVisitBlock(metadata);
  const veterinarian = visit?.['veterinarian'];
  if (typeof veterinarian !== 'object' || veterinarian === null) {
    return undefined;
  }
  const name = (veterinarian as Record<string, unknown>)['name'];
  return typeof name === 'string' && name.trim() ? name.trim() : undefined;
}

function readVisitBlock(metadata: AnimalHealthEventOfflineMetadata): Record<string, unknown> | null {
  if (!('visit' in metadata) || typeof metadata.visit !== 'object' || metadata.visit === null) {
    return null;
  }
  return metadata.visit as Record<string, unknown>;
}

function readProtocolStatus(item: AnimalHealthEventItem) {
  if (!('protocol' in item.metadata) || typeof item.metadata.protocol !== 'object' || item.metadata.protocol === null) {
    return null;
  }
  const status = (item.metadata.protocol as Record<string, unknown>)['status'];
  return typeof status === 'string' ? status : null;
}

function readNextDueAt(metadata: AnimalHealthEventOfflineMetadata) {
  if ('protocol' in metadata && typeof metadata.protocol === 'object' && metadata.protocol !== null) {
    const value = (metadata.protocol as Record<string, unknown>)['nextDueAt'];
    return typeof value === 'string' ? value : null;
  }
  if ('nextDueAt' in metadata) {
    return typeof metadata.nextDueAt === 'string' ? metadata.nextDueAt : null;
  }
  return null;
}

function normalizeFollowUpStatus(value: string | undefined) {
  if (value === 'ACTIVE') {
    return 'active';
  }
  if (value === 'CLOSED') {
    return 'closed';
  }
  return undefined;
}
