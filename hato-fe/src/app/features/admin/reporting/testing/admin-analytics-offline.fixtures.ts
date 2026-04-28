import type { OfflineSnapshotRecord } from '../../../../core/offline/offline-types';
import { OfflineStoreService } from '../../../../core/offline/offline-store.service';

export function userSnapshot(entityId: string, status: 'ACTIVE' | 'INACTIVE'): OfflineSnapshotRecord {
  return { key: `USER:${entityId}`, entityType: 'USER', entityId, updatedAt: '2026-04-27T08:00:00.000Z', payload: { id: entityId, status } };
}

export function ganaderoSnapshot(entityId: string, active: boolean): OfflineSnapshotRecord {
  return { key: `GANADERO:${entityId}`, entityType: 'GANADERO', entityId, updatedAt: '2026-04-27T08:00:00.000Z', payload: { id: entityId, active } };
}

export function animalSnapshot(entityId: string, active: boolean): OfflineSnapshotRecord {
  return {
    key: `ANIMAL:${entityId}`,
    entityType: 'ANIMAL',
    entityId,
    updatedAt: '2026-04-27T08:00:00.000Z',
    payload: {
      uuid: entityId,
      ownerGanaderoId: 'gan-a',
      arete: entityId.toUpperCase(),
      marca: null,
      tatuaje: null,
      category: 'COW',
      active,
      admissionDate: '2026-04-01T00:00:00.000Z',
      weightKg: 420,
      createdAt: '2026-04-01T00:00:00.000Z',
      updatedAt: '2026-04-27T08:00:00.000Z',
      version: 1,
      lastSyncedAt: null,
    },
  };
}

export function lotSnapshot(entityId: string, name: string, active: boolean): OfflineSnapshotRecord {
  return {
    key: `LOT:${entityId}`,
    entityType: 'LOT',
    entityId,
    updatedAt: '2026-04-27T08:00:00.000Z',
    payload: { id: entityId, name, description: null, active, createdAt: '2026-04-01T00:00:00.000Z', updatedAt: '2026-04-27T08:00:00.000Z', version: 1 },
  };
}

export function lotAssignmentSnapshot(entityId: string, animalUuid: string, lotId: string, fromDate: string): OfflineSnapshotRecord {
  return {
    key: `LOT_ASSIGNMENT:${entityId}`,
    entityType: 'LOT_ASSIGNMENT',
    entityId,
    updatedAt: '2026-04-27T08:30:00.000Z',
    payload: { id: entityId, animalUuid, lotId, fromDate, toDate: null, createdAt: '2026-04-01T00:00:00.000Z', updatedAt: '2026-04-27T08:30:00.000Z', version: 1 },
  };
}

export function productivitySnapshot(
  entityId: string,
  animalUuid: string,
  lotId: string,
  periodKey: string,
  metricType: string,
  value: number,
  updatedAt = '2026-04-27T08:45:00.000Z'
): OfflineSnapshotRecord {
  return {
    key: `PRODUCTIVITY_LEDGER:${entityId}`,
    entityType: 'PRODUCTIVITY_LEDGER',
    entityId,
    updatedAt,
    payload: { id: entityId, animalUuid, lotId, periodKey, metricType, value, identityKey: `${periodKey}|${animalUuid}|${lotId}|${metricType}`, createdAt: updatedAt, updatedAt, version: 1 },
  };
}

export function costSnapshot(
  entityId: string,
  lotId: string,
  periodKey: string,
  category: string,
  source: string,
  amount: number,
  currency: string,
  updatedAt = '2026-04-27T08:50:00.000Z'
): OfflineSnapshotRecord {
  return {
    key: `COST_LEDGER:${entityId}`,
    entityType: 'COST_LEDGER',
    entityId,
    updatedAt,
    payload: { id: entityId, lotId, periodKey, category, source, amount, currency, identityKey: `${periodKey}|${lotId}|${category}|${source}`, createdAt: updatedAt, updatedAt, version: 1 },
  };
}

export function eventSnapshot(
  entityType: OfflineSnapshotRecord['entityType'],
  entityId: string,
  animalUuid: string,
  eventType: string,
  occurredAt: string,
  eventTypeField: 'type' | 'healthEventType' | 'reproductionEventType' = 'type'
): OfflineSnapshotRecord {
  return { key: `${entityType}:${entityId}`, entityType, entityId, updatedAt: occurredAt, payload: { id: entityId, animalUuid, occurredAt, [eventTypeField]: eventType } };
}

export async function seedAdminAnalyticsSnapshots(store: OfflineStoreService) {
  await store.saveCheckpoint({ entityType: 'USER', cursorUpdatedAt: '2026-04-27T09:58:00.000Z', cursorId: 'user-a', lastSuccessAt: '2026-04-27T09:59:00.000Z' });
  await store.saveCheckpoint({ entityType: 'GANADERO', cursorUpdatedAt: '2026-04-27T09:58:00.000Z', cursorId: 'gan-a', lastSuccessAt: '2026-04-27T09:59:00.000Z' });
  await store.saveCheckpoint({ entityType: 'ANIMAL', cursorUpdatedAt: '2026-04-27T09:58:00.000Z', cursorId: 'animal-a', lastSuccessAt: '2026-04-27T09:59:00.000Z' });
  await store.saveCheckpoint({ entityType: 'LOT', cursorUpdatedAt: '2026-04-27T09:58:00.000Z', cursorId: 'lot-a', lastSuccessAt: '2026-04-27T09:59:00.000Z' });
  await store.saveCheckpoint({ entityType: 'LOT_ASSIGNMENT', cursorUpdatedAt: '2026-04-27T09:58:00.000Z', cursorId: 'assign-a', lastSuccessAt: '2026-04-27T09:59:00.000Z' });
  await store.saveCheckpoint({ entityType: 'PRODUCTIVITY_LEDGER', cursorUpdatedAt: '2026-04-27T09:58:00.000Z', cursorId: 'prod-a', lastSuccessAt: '2026-04-27T09:59:00.000Z' });
  await store.saveCheckpoint({ entityType: 'COST_LEDGER', cursorUpdatedAt: '2026-04-27T09:58:00.000Z', cursorId: 'cost-a', lastSuccessAt: '2026-04-27T09:59:00.000Z' });
  await store.saveCheckpoint({ entityType: 'ANIMAL_EVENT', cursorUpdatedAt: '2026-04-27T09:58:00.000Z', cursorId: 'event-a', lastSuccessAt: '2026-04-27T09:59:00.000Z' });
  await store.saveCheckpoint({ entityType: 'ANIMAL_HEALTH_EVENT', cursorUpdatedAt: '2026-04-27T09:58:00.000Z', cursorId: 'health-a', lastSuccessAt: '2026-04-27T09:59:00.000Z' });
  await store.saveCheckpoint({ entityType: 'ANIMAL_REPRODUCTION_EVENT', cursorUpdatedAt: '2026-04-27T09:58:00.000Z', cursorId: 'repro-a', lastSuccessAt: '2026-04-27T09:59:00.000Z' });

  await store.saveSnapshot(userSnapshot('user-a', 'ACTIVE'));
  await store.saveSnapshot(ganaderoSnapshot('gan-a', true));
  await store.saveSnapshot(animalSnapshot('animal-a', true));
  await store.saveSnapshot(lotSnapshot('lot-a', 'Lote A', true));
  await store.saveSnapshot(lotAssignmentSnapshot('assign-a', 'animal-a', 'lot-a', '2026-04-01'));
  await store.saveSnapshot(productivitySnapshot('prod-a', 'animal-a', 'lot-a', '2026-04', 'MILK_LITERS', 120));
  await store.saveSnapshot(costSnapshot('cost-a', 'lot-a', '2026-04', 'FEED', 'PURCHASE', 80, 'BOB'));
  await store.saveSnapshot(eventSnapshot('ANIMAL_EVENT', 'event-a', 'animal-a', 'OBSERVATION', '2026-04-27T09:58:00.000Z'));
  await store.saveSnapshot(eventSnapshot('ANIMAL_HEALTH_EVENT', 'health-a', 'animal-a', 'VACCINATION', '2026-04-26T08:00:00.000Z', 'healthEventType'));
  await store.saveSnapshot(eventSnapshot('ANIMAL_REPRODUCTION_EVENT', 'repro-a', 'animal-a', 'PREGNANCY_CHECK', '2026-04-20T08:00:00.000Z', 'reproductionEventType'));
}
