import {
  animalEventLogToGeneralEventItem,
  animalEventLogToHealthEventItem,
  animalEventLogToReproductionEventItem,
  filterAnimalEventLogsByCategory,
} from './animal-timeline.adapter';

describe('animal unified event log timeline adapter', () => {
  it('should filter unified logs by category before deriving category-specific timelines', () => {
    const logs = [
      eventLog({ id: 'general-1', eventCategory: 'GENERAL', eventType: 'OBSERVATION' }),
      eventLog({ id: 'health-1', eventCategory: 'HEALTH', eventType: 'FIELD_VET_VISIT' }),
      eventLog({ id: 'repro-1', eventCategory: 'REPRODUCTION', eventType: 'SERVICE' }),
    ];

    expect(filterAnimalEventLogsByCategory(logs, 'GENERAL').map((item) => item.id)).toEqual(['general-1']);
    expect(filterAnimalEventLogsByCategory(logs, 'HEALTH').map((item) => item.id)).toEqual(['health-1']);
    expect(filterAnimalEventLogsByCategory(logs, 'REPRODUCTION').map((item) => item.id)).toEqual(['repro-1']);
  });

  it('should map unified logs to legacy timeline item shapes without losing typed metadata', () => {
    const health = animalEventLogToHealthEventItem(
      eventLog({
        id: 'visit-log-1',
        eventCategory: 'HEALTH',
        eventType: 'FIELD_VET_VISIT',
        visitId: 'VISIT-1',
        parentVisitId: 'VISIT-0',
        nextDueAt: '2026-05-20T10:00:00.000Z',
        metadata: {
          visit: { visitId: 'VISIT-1', parentVisitId: 'VISIT-0', mode: 'SPECIFIC', status: 'ATTENDED', veterinarian: { name: 'Dra. Luna' } },
          clinicalNote: { reason: 'Control', findings: 'Sin fiebre', plan: ['Alta'] },
          protocol: { status: 'FOLLOW_UP_REQUIRED', nextDueAt: '2026-05-20T10:00:00.000Z' },
          treatmentPlan: ['Alta'],
        },
      })
    );
    const general = animalEventLogToGeneralEventItem(eventLog({ id: 'general-1', eventCategory: 'GENERAL', eventType: 'SOLD' }));
    const reproduction = animalEventLogToReproductionEventItem(eventLog({ id: 'repro-1', eventCategory: 'REPRODUCTION', eventType: 'BIRTH', metadata: { offspringCount: 1 } }));

    expect(general.type).toBe('SOLD');
    expect(health.healthEventType).toBe('FIELD_VET_VISIT');
    expect(health.visitId).toBe('VISIT-1');
    expect(health.parentVisitId).toBe('VISIT-0');
    expect(health.veterinarianName).toBe('Dra. Luna');
    expect(health.metadata).toEqual(expect.objectContaining({ treatmentPlan: ['Alta'] }));
    expect(reproduction.reproductionEventType).toBe('BIRTH');
    expect(reproduction.metadata).toEqual(expect.objectContaining({ offspringCount: 1 }));
  });
});

function eventLog(overrides: Record<string, unknown>) {
  return {
    id: 'event-log-1',
    animalUuid: 'animal-1',
    eventCategory: 'GENERAL',
    eventType: 'OBSERVATION',
    occurredAt: '2026-05-13T10:00:00.000Z',
    performedByUserId: 'user-1',
    sourceChannel: 'OFFLINE',
    operationId: 'op-1',
    metadata: {},
    createdAt: '2026-05-13T10:00:00.000Z',
    updatedAt: '2026-05-13T10:00:00.000Z',
    ...overrides,
  };
}
