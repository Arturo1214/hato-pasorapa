import { CURRENT_OFFLINE_SCHEMA_VERSION, migrateOfflineState } from './offline-store.migrations';
import { InMemoryOfflinePersistenceAdapter } from './offline-store.migrations';
import { OfflineStoreService } from './offline-store.service';
import type { PersistedOfflineState } from './offline-types';

describe('animal event log offline migration', () => {
  it('should migrate legacy event snapshots into unified animal event log snapshots without data loss', () => {
    const { state, appliedMigrations } = migrateOfflineState(createLegacyEventState());

    expect(state.schemaVersion).toBe(CURRENT_OFFLINE_SCHEMA_VERSION);
    expect(appliedMigrations).toContain('v10-to-v11-animal-event-log-consolidation');
    expect(state.snapshots.map((snapshot) => snapshot.key).sort()).toEqual([
      'ANIMAL_EVENT_LOG:general-1',
      'ANIMAL_EVENT_LOG:health-1',
      'ANIMAL_EVENT_LOG:repro-1',
    ]);
    expect(state.snapshots.map((snapshot) => snapshot.entityType)).toEqual([
      'ANIMAL_EVENT_LOG',
      'ANIMAL_EVENT_LOG',
      'ANIMAL_EVENT_LOG',
    ]);
    expect(state.snapshots.map((snapshot) => snapshot.payload['eventCategory'])).toEqual([
      'GENERAL',
      'HEALTH',
      'REPRODUCTION',
    ]);
    expect(state.snapshots.map((snapshot) => snapshot.payload['eventType'])).toEqual([
      'TRANSFERRED',
      'FIELD_VET_VISIT',
      'SERVICE',
    ]);
    expect(state.snapshots[1].payload['metadata']).toEqual(
      expect.objectContaining({ visit: { visitId: 'VISIT-1' } })
    );
  });

  it('should migrate legacy queued payloads and checkpoints to the unified cursor contract', () => {
    const { state } = migrateOfflineState(createLegacyEventState());

    expect(state.outbox.map((operation) => operation.entityType)).toEqual([
      'ANIMAL_EVENT_LOG',
      'ANIMAL_EVENT_LOG',
      'ANIMAL_EVENT_LOG',
    ]);
    expect(state.outbox.map((operation) => operation.payload['eventCategory'])).toEqual([
      'GENERAL',
      'HEALTH',
      'REPRODUCTION',
    ]);
    expect(state.outbox.map((operation) => operation.operationId)).toEqual(['op-general', 'op-health', 'op-repro']);
    expect(state.syncState.checkpoints['ANIMAL_EVENT_LOG']).toEqual(
      expect.objectContaining({
        entityType: 'ANIMAL_EVENT_LOG',
        cursorId: 'health-cursor',
        cursorUpdatedAt: '2026-05-13T12:00:00.000Z',
        lastSyncedEventId: 'health-cursor',
        lastSyncedAt: '2026-05-13T12:00:30.000Z',
      })
    );
  });

  it('should persist unified event log pull checkpoints with lastSyncedEventId and lastSyncedAt aliases', async () => {
    const store = new OfflineStoreService(new InMemoryOfflinePersistenceAdapter());

    await store.applyPullResponse(
      'ANIMAL_EVENT_LOG',
      [
        {
          id: 'event-log-1',
          animalUuid: 'animal-1',
          eventCategory: 'GENERAL',
          eventType: 'OBSERVATION',
          occurredAt: '2026-05-13T10:00:00.000Z',
          performedByUserId: 'user-1',
          sourceChannel: 'OFFLINE',
          operationId: 'op-1',
          metadata: {},
          updatedAt: '2026-05-13T10:00:00.000Z',
        },
      ],
      {
        entityType: 'ANIMAL_EVENT_LOG',
        cursorId: 'event-log-1',
        cursorUpdatedAt: '2026-05-13T10:00:00.000Z',
        lastSuccessAt: '2026-05-13T10:00:30.000Z',
      }
    );

    await expect(store.getCheckpoint('ANIMAL_EVENT_LOG')).resolves.toEqual(
      expect.objectContaining({
        cursorId: 'event-log-1',
        lastSyncedEventId: 'event-log-1',
        lastSyncedAt: '2026-05-13T10:00:30.000Z',
      })
    );
  });
});

function createLegacyEventState(): PersistedOfflineState {
  return {
    schemaVersion: 10,
    outbox: [
      legacyOperation('ANIMAL_EVENT', 'general-1', 'op-general', { type: 'TRANSFERRED' }),
      legacyOperation('ANIMAL_HEALTH_EVENT', 'health-1', 'op-health', { healthEventType: 'FIELD_VET_VISIT', metadata: { visit: { visitId: 'VISIT-1' } } }),
      legacyOperation('ANIMAL_REPRODUCTION_EVENT', 'repro-1', 'op-repro', { reproductionEventType: 'SERVICE' }),
    ],
    inbox: [],
    snapshots: [
      legacySnapshot('ANIMAL_EVENT', 'general-1', { type: 'TRANSFERRED' }),
      legacySnapshot('ANIMAL_HEALTH_EVENT', 'health-1', { healthEventType: 'FIELD_VET_VISIT', metadata: { visit: { visitId: 'VISIT-1' } } }),
      legacySnapshot('ANIMAL_REPRODUCTION_EVENT', 'repro-1', { reproductionEventType: 'SERVICE' }),
    ],
    syncState: {
      checkpoints: {
        ANIMAL_EVENT: checkpoint('ANIMAL_EVENT', 'general-cursor', '2026-05-13T10:00:00.000Z', '2026-05-13T10:00:30.000Z'),
        ANIMAL_HEALTH_EVENT: checkpoint('ANIMAL_HEALTH_EVENT', 'health-cursor', '2026-05-13T12:00:00.000Z', '2026-05-13T12:00:30.000Z'),
        ANIMAL_REPRODUCTION_EVENT: checkpoint('ANIMAL_REPRODUCTION_EVENT', 'repro-cursor', '2026-05-13T11:00:00.000Z', '2026-05-13T11:00:30.000Z'),
      },
      meta: { appliedMigrations: [] },
    },
  };
}

function legacyOperation(entityType: 'ANIMAL_EVENT' | 'ANIMAL_HEALTH_EVENT' | 'ANIMAL_REPRODUCTION_EVENT', id: string, operationId: string, payload: Record<string, unknown>) {
  return {
    operationId,
    entityType,
    entityId: id,
    opType: 'CREATE' as const,
    payload: legacyPayload(id, operationId, payload),
    clientCreatedAt: '2026-05-13T09:00:00.000Z',
    clientUpdatedAt: '2026-05-13T09:00:00.000Z',
    status: 'pending',
    attempts: 0,
  };
}

function legacySnapshot(entityType: 'ANIMAL_EVENT' | 'ANIMAL_HEALTH_EVENT' | 'ANIMAL_REPRODUCTION_EVENT', id: string, payload: Record<string, unknown>) {
  return {
    key: `${entityType}:${id}`,
    entityType,
    entityId: id,
    payload: legacyPayload(id, `op-${id}`, payload),
    updatedAt: '2026-05-13T09:00:00.000Z',
  };
}

function legacyPayload(id: string, operationId: string, overrides: Record<string, unknown>) {
  return {
    id,
    animalUuid: 'animal-1',
    occurredAt: '2026-05-13T09:00:00.000Z',
    performedByUserId: 'user-1',
    sourceChannel: 'OFFLINE',
    operationId,
    metadata: {},
    createdAt: '2026-05-13T09:00:00.000Z',
    updatedAt: '2026-05-13T09:00:00.000Z',
    ...overrides,
  };
}

function checkpoint(entityType: 'ANIMAL_EVENT' | 'ANIMAL_HEALTH_EVENT' | 'ANIMAL_REPRODUCTION_EVENT', cursorId: string, cursorUpdatedAt: string, lastSuccessAt: string) {
  return { entityType, cursorId, cursorUpdatedAt, lastSuccessAt };
}
