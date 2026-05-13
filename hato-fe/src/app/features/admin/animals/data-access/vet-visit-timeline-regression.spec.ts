import { decorateAnimalHealthTimeline } from './animal-health-events-timeline.adapter';
import { animalEventLogToHealthEventItem } from './animal-timeline.adapter';

describe('vet visit timeline regression from unified event logs', () => {
  it('should preserve PROGRAMADA to ATENDIDA to FINALIZADA chain projection', () => {
    const timeline = decorateAnimalHealthTimeline([
      animalEventLogToHealthEventItem(vetLog('visit-programada', 'VISIT-1', undefined, 'PENDING', 'STARTED', '2026-05-13T09:00:00.000Z')),
      animalEventLogToHealthEventItem(vetLog('visit-atendida', 'VISIT-2', 'VISIT-1', 'ATTENDED', 'FOLLOW_UP_REQUIRED', '2026-05-13T10:00:00.000Z')),
      animalEventLogToHealthEventItem(vetLog('visit-finalizada', 'VISIT-3', 'VISIT-2', 'FINALIZED', 'CLOSED', '2026-05-13T11:00:00.000Z')),
    ], []);

    expect(timeline.map((item) => item.visitId)).toEqual(['VISIT-1', 'VISIT-2', 'VISIT-3']);
    expect(timeline.map((item) => item.parentVisitId)).toEqual([null, 'VISIT-1', 'VISIT-2']);
    expect(timeline.map((item) => item.visitStatus)).toEqual(['PENDING', 'ATTENDED', 'FINALIZED']);
    expect(timeline.map((item) => item.treatmentStatus)).toEqual(['closed', 'closed', 'closed']);
  });

  it('should preserve CANCELADA child visits with cancel reason metadata', () => {
    const [parent, canceled] = decorateAnimalHealthTimeline([
      animalEventLogToHealthEventItem(vetLog('visit-programada', 'VISIT-10', undefined, 'PENDING', 'STARTED', '2026-05-13T09:00:00.000Z')),
      animalEventLogToHealthEventItem({
        ...vetLog('visit-cancelada', 'VISIT-11', 'VISIT-10', 'CANCELED', 'CLOSED', '2026-05-13T10:00:00.000Z'),
        metadata: {
          visit: { visitId: 'VISIT-11', parentVisitId: 'VISIT-10', mode: 'SPECIFIC', status: 'CANCELED', cancelReason: 'Lluvia' },
          clinicalNote: { reason: 'Cancelación' },
          protocol: { status: 'CLOSED' },
        },
      }),
    ], []);

    expect(parent.treatmentStatus).toBe('closed');
    expect(canceled.visitStatus).toBe('CANCELED');
    expect(canceled.metadata).toEqual(expect.objectContaining({ visit: expect.objectContaining({ cancelReason: 'Lluvia' }) }));
  });
});

function vetLog(id: string, visitId: string, parentVisitId: string | undefined, visitStatus: string, protocolStatus: string, occurredAt: string) {
  return {
    id,
    animalUuid: 'animal-1',
    eventCategory: 'HEALTH',
    eventType: 'FIELD_VET_VISIT',
    occurredAt,
    performedByUserId: 'user-1',
    sourceChannel: 'OFFLINE',
    operationId: id,
    visitId,
    parentVisitId,
    metadata: {
      visit: { visitId, parentVisitId, mode: 'SPECIFIC', status: visitStatus, veterinarian: { name: 'Dra. Luna' } },
      clinicalNote: { reason: 'Control', findings: visitStatus, plan: ['Revisar'] },
      protocol: { status: protocolStatus },
    },
    createdAt: occurredAt,
    updatedAt: occurredAt,
  };
}
