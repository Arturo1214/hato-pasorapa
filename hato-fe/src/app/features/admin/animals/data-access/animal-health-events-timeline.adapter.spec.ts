import {
  decorateAnimalHealthTimeline,
  matchesAnimalHealthEventFilters,
  normalizeAnimalHealthEventItem,
} from './animal-health-events-timeline.adapter';

describe('animal-health-events-timeline.adapter', () => {
  it('should normalize health payloads and derive closed treatment status from the latest event', () => {
    const started = normalizeAnimalHealthEventItem({
      id: 'event-1',
      animalUuid: 'animal-1',
      healthEventType: 'TREATMENT_STARTED',
      occurredAt: '2026-04-26T10:00:00.000Z',
      createdAt: '2026-04-26T10:00:01.000Z',
      updatedAt: '2026-04-26T10:00:01.000Z',
      operationId: 'event-1',
      metadata: { treatmentCaseId: 'CASE-1', productName: 'Oxitetraciclina' },
    });
    const closed = normalizeAnimalHealthEventItem({
      id: 'event-2',
      animalUuid: 'animal-1',
      healthEventType: 'TREATMENT_CLOSED',
      occurredAt: '2026-04-26T11:00:00.000Z',
      createdAt: '2026-04-26T11:00:01.000Z',
      updatedAt: '2026-04-26T11:00:01.000Z',
      operationId: 'event-2',
      metadata: { treatmentCaseId: 'CASE-1', productName: 'Oxitetraciclina' },
    });

    const timeline = decorateAnimalHealthTimeline([closed, started], [
      {
        operationId: 'event-2',
        entityType: 'ANIMAL_HEALTH_EVENT',
        entityId: 'event-2',
        opType: 'CREATE',
        payload: {},
        clientCreatedAt: '2026-04-26T11:00:00.000Z',
        clientUpdatedAt: '2026-04-26T11:00:00.000Z',
        status: 'conflict',
        attempts: 1,
        conflict: { serverVersion: 2, reason: 'Hay un conflicto remoto.' },
      },
    ]);

    expect(timeline.map((item) => item.id)).toEqual(['event-1', 'event-2']);
    expect(timeline[0].treatmentStatus).toBe('closed');
    expect(timeline[1].syncStatus).toBe('conflict');
    expect(timeline[1].syncMessage).toBe('Hay un conflicto remoto.');
  });

  it('should project field vet visits with visitId, active follow-up and nextDueAt', () => {
    const started = normalizeAnimalHealthEventItem({
      id: 'visit-1',
      animalUuid: 'animal-1',
      healthEventType: 'FIELD_VET_VISIT',
      occurredAt: '2026-04-26T10:00:00.000Z',
      createdAt: '2026-04-26T10:00:01.000Z',
      updatedAt: '2026-04-26T10:00:01.000Z',
      operationId: 'visit-1',
      metadata: {
        visit: { visitId: 'VISIT-1' },
        checklist: [{ code: 'TEMPERATURE', ok: true }],
        clinicalNote: { reason: 'Control', findings: 'Ok', plan: 'Seguir' },
        protocol: { status: 'STARTED' },
      },
    });
    const followUp = normalizeAnimalHealthEventItem({
      id: 'visit-2',
      animalUuid: 'animal-1',
      healthEventType: 'FIELD_VET_VISIT',
      occurredAt: '2026-04-26T11:00:00.000Z',
      createdAt: '2026-04-26T11:00:01.000Z',
      updatedAt: '2026-04-26T11:00:01.000Z',
      operationId: 'visit-2',
      metadata: {
        visit: { visitId: 'VISIT-1' },
        checklist: [{ code: 'APPETITE', ok: false, note: 'Baja' }],
        clinicalNote: { reason: 'Seguimiento', findings: 'Leve fiebre', plan: 'Revisar' },
        protocol: { status: 'FOLLOW_UP_REQUIRED', nextDueAt: '2026-04-28T10:00:00.000Z' },
      },
    });

    const timeline = decorateAnimalHealthTimeline([followUp, started], []);

    expect(timeline[0].visitId).toBe('VISIT-1');
    expect(timeline[0].treatmentStatus).toBe('active');
    expect(timeline[0].nextDueAt).toBe('2026-04-28T10:00:00.000Z');
    expect(timeline[1].treatmentStatus).toBe('active');
  });

  it('should filter by visitId when requested', () => {
    const item = normalizeAnimalHealthEventItem({
      id: 'visit-1',
      animalUuid: 'animal-1',
      healthEventType: 'FIELD_VET_VISIT',
      occurredAt: '2026-04-26T10:00:00.000Z',
      operationId: 'visit-1',
      metadata: {
        visit: { visitId: 'VISIT-42' },
        checklist: [{ code: 'TEMPERATURE', ok: true }],
        clinicalNote: { reason: 'Control', findings: 'Ok', plan: 'Alta' },
        protocol: { status: 'STARTED' },
      },
    });

    expect(matchesAnimalHealthEventFilters(item, { visitId: 'VISIT-42' })).toBe(true);
    expect(matchesAnimalHealthEventFilters(item, { visitId: 'VISIT-99' })).toBe(false);
  });
});
