import type { FieldVetVisitMetadata } from '../../../../core/offline/offline-types';
import { mapVetVisitFormToCreateInput } from './vet-visit-form.mapper';

describe('vet-visit-form.mapper', () => {
  it('should map a typed field vet payload keeping visitId distinct from operationId', () => {
    const operationId = 'operation-123';
    const input = mapVetVisitFormToCreateInput({
      animalUuid: 'animal-1',
      visitId: 'visit-1',
      occurredAt: '2026-04-26T10:00',
      notes: ' Control veterinario ',
      checklist: [
        { code: 'TEMPERATURE', ok: true },
        { code: 'APPETITE', ok: false, note: ' Baja ' },
      ],
      clinicalNote: {
        reason: ' Control ',
        findings: ' Leve fiebre ',
        plan: ' Revisar en 48h ',
      },
      protocolStatus: 'FOLLOW_UP_REQUIRED',
      nextDueAt: '2026-04-28T10:00',
    });
    const metadata = input.metadata as FieldVetVisitMetadata;

    expect(input.healthEventType).toBe('FIELD_VET_VISIT');
    expect(metadata.visit.visitId).toBe('visit-1');
    expect(metadata.visit.visitId).not.toBe(operationId);
    expect(metadata.protocol.status).toBe('FOLLOW_UP_REQUIRED');
    expect(metadata.protocol.nextDueAt).toBe('2026-04-28T10:00:00.000Z');
    expect(metadata.checklist[1]).toEqual({ code: 'APPETITE', ok: false, note: 'Baja' });
  });
});
