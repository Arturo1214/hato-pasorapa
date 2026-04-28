import { decorateAnimalReproductionTimeline, normalizeAnimalReproductionEventItem } from './animal-reproduction-events-timeline.adapter';
import type { AnimalReproductionEventItem } from './animals-reproduction-events.service';

describe('animal reproduction timeline adapter', () => {
  const createItem = (overrides: Partial<AnimalReproductionEventItem> = {}): AnimalReproductionEventItem => ({
    id: 'event-1',
    animalUuid: 'animal-1',
    reproductionEventType: 'SERVICE',
    occurredAt: '2026-04-27T10:00:00.000Z',
    notes: null,
    performedByUserId: 'user-1',
    sourceChannel: 'ONLINE',
    operationId: 'event-1',
    metadata: { serviceMethod: 'NATURAL' },
    clientCreatedAt: '2026-04-27T10:00:00.000Z',
    createdAt: '2026-04-27T10:00:01.000Z',
    updatedAt: '2026-04-27T10:00:01.000Z',
    ...overrides,
  });

  it('should normalize server items and preserve reproduction type', () => {
    expect(
      normalizeAnimalReproductionEventItem({
        id: 'event-10',
        animalUuid: 'animal-1',
        reproductionEventType: 'BIRTH',
        occurredAt: '2026-04-27T12:00:00.000Z',
        metadata: { offspringCount: 1 },
      })
    ).toEqual(
      expect.objectContaining({
        id: 'event-10',
        reproductionEventType: 'BIRTH',
        metadata: expect.objectContaining({ offspringCount: 1 }),
      })
    );
  });

  it('should sort descending, keep only matching items and decorate pending/conflict badges', () => {
    const decorated = decorateAnimalReproductionTimeline(
      [
        createItem({ id: 'event-older', operationId: 'event-older', occurredAt: '2026-04-27T10:00:00.000Z' }),
        createItem({ id: 'event-newer', operationId: 'event-newer', occurredAt: '2026-04-27T11:00:00.000Z', reproductionEventType: 'BIRTH' }),
      ],
      [
        {
          operationId: 'event-newer',
          entityType: 'ANIMAL_REPRODUCTION_EVENT',
          entityId: 'event-newer',
          opType: 'CREATE',
          payload: {},
          clientCreatedAt: '2026-04-27T11:00:00.000Z',
          clientUpdatedAt: '2026-04-27T11:00:00.000Z',
          status: 'pending',
          attempts: 0,
        },
        {
          operationId: 'event-older',
          entityType: 'ANIMAL_REPRODUCTION_EVENT',
          entityId: 'event-older',
          opType: 'CREATE',
          payload: {},
          clientCreatedAt: '2026-04-27T10:00:00.000Z',
          clientUpdatedAt: '2026-04-27T10:00:00.000Z',
          status: 'conflict',
          attempts: 1,
          conflict: { serverVersion: 0, reason: 'ANIMAL_REPRODUCTION_EVENT_PARENTAGE_CONFLICT' },
        },
      ]
    );

    expect(decorated.map((item) => item.id)).toEqual(['event-newer', 'event-older']);
    expect(decorated[0]).toEqual(expect.objectContaining({ syncState: 'PENDING_SYNC', syncStatus: 'pending' }));
    expect(decorated[1]).toEqual(
      expect.objectContaining({
        syncState: 'CONFLICT',
        syncStatus: 'conflict',
        syncMessage: 'ANIMAL_REPRODUCTION_EVENT_PARENTAGE_CONFLICT',
      })
    );
  });
});
