import {
  OFFLINE_ENTITY_TYPES,
  type AnimalEventLogSnapshotPayload,
  type EnqueueOfflineOperationInput,
} from './offline-types';

describe('animal event log offline contract', () => {
  it('should expose ANIMAL_EVENT_LOG as the canonical animal event entity type', () => {
    expect(OFFLINE_ENTITY_TYPES).toContain('ANIMAL_EVENT_LOG');
  });

  it('should type unified event snapshots with category, type and global operationId idempotency', () => {
    const snapshot: AnimalEventLogSnapshotPayload = {
      id: 'event-log-1',
      animalUuid: 'animal-1',
      eventCategory: 'HEALTH',
      eventType: 'FIELD_VET_VISIT',
      occurredAt: '2026-05-13T10:00:00.000Z',
      performedByUserId: 'user-1',
      sourceChannel: 'OFFLINE',
      operationId: 'op-global-1',
      metadata: {
        visit: { visitId: 'VISIT-1', status: 'ATTENDED' },
        protocol: { status: 'CLOSED' },
      },
      createdAt: '2026-05-13T10:00:00.000Z',
      updatedAt: '2026-05-13T10:00:00.000Z',
    };

    const createOperation: EnqueueOfflineOperationInput = {
      entityType: 'ANIMAL_EVENT_LOG',
      entityId: snapshot.id,
      opType: 'CREATE',
      operationId: snapshot.operationId,
      payload: snapshot,
      clientCreatedAt: snapshot.createdAt,
      clientUpdatedAt: snapshot.updatedAt,
    };

    expect(createOperation.payload['eventCategory']).toBe('HEALTH');
    expect(createOperation.payload['eventType']).toBe('FIELD_VET_VISIT');
    expect(createOperation.operationId).toBe('op-global-1');
  });
});
