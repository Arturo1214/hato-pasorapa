import type { AnimalImageSnapshotPayload, OfflineOperationEnvelope } from '../../../../core/offline/offline-types';
import type { AnimalImageItem } from './animals-images.service';

export function normalizeAnimalImageItem(raw: Record<string, unknown>): AnimalImageItem {
  return {
    id: String(raw['id'] ?? raw['operationId'] ?? ''),
    animalUuid: String(raw['animalUuid'] ?? ''),
    operationId: String(raw['operationId'] ?? raw['id'] ?? ''),
    fileName: String(raw['fileName'] ?? ''),
    mimeType: String(raw['mimeType'] ?? 'image/jpeg') as AnimalImageItem['mimeType'],
    sizeBytes: Number(raw['sizeBytes'] ?? 0),
    checksumSha256: String(raw['checksumSha256'] ?? ''),
    capturedAt: String(raw['capturedAt'] ?? raw['createdAt'] ?? ''),
    sourceChannel: String(raw['sourceChannel'] ?? 'OFFLINE') as AnimalImageItem['sourceChannel'],
    binaryRef: String(raw['binaryRef'] ?? raw['operationId'] ?? raw['id'] ?? ''),
    thumbnailRef: typeof raw['thumbnailRef'] === 'string' ? raw['thumbnailRef'] : null,
    previewUrl: typeof raw['previewUrl'] === 'string' ? raw['previewUrl'] : null,
    clientCreatedAt: String(raw['clientCreatedAt'] ?? raw['createdAt'] ?? raw['capturedAt'] ?? ''),
    createdAt: String(raw['createdAt'] ?? raw['capturedAt'] ?? ''),
    updatedAt: String(raw['updatedAt'] ?? raw['createdAt'] ?? raw['capturedAt'] ?? ''),
    syncState: String(raw['syncState'] ?? 'SYNCED') as AnimalImageItem['syncState'],
    syncMessage: typeof raw['syncMessage'] === 'string' ? raw['syncMessage'] : null,
  };
}

export function compareAnimalImageTimeline(left: AnimalImageItem, right: AnimalImageItem): number {
  const captured = left.capturedAt.localeCompare(right.capturedAt);
  if (captured !== 0) {
    return captured;
  }

  const created = left.createdAt.localeCompare(right.createdAt);
  if (created !== 0) {
    return created;
  }

  return left.id.localeCompare(right.id);
}

export function decorateAnimalImageTimeline(items: AnimalImageItem[], outbox: OfflineOperationEnvelope[]): AnimalImageItem[] {
  return [...items].sort(compareAnimalImageTimeline).map((item) => {
    const related = outbox.find((operation) => operation.entityType === 'ANIMAL_IMAGE' && operation.operationId === item.operationId);
    if (!related) {
      return { ...item, syncState: 'SYNCED', syncMessage: null } satisfies AnimalImageItem;
    }

    if (related.status === 'acked') {
      return { ...item, syncState: 'SYNCED', syncMessage: null } satisfies AnimalImageItem;
    }

    if (related.status === 'failed' || related.status === 'conflict' || related.status === 'dead_letter') {
      return {
        ...item,
        syncState: 'FAILED',
        syncMessage: related.conflict?.reason ?? related.lastErrorMessage ?? 'La imagen quedó en estado FAILED.',
      } satisfies AnimalImageItem;
    }

    return {
      ...item,
      syncState: 'PENDING',
      syncMessage: 'Pendiente de sync.',
    } satisfies AnimalImageItem;
  });
}

export function toSnapshotPayload(item: AnimalImageItem): AnimalImageSnapshotPayload {
  return { ...item };
}
