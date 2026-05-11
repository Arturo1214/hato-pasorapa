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

  it('should map visit lifecycle metadata with veterinarian and target animal count', () => {
    const input = mapVetVisitFormToCreateInput({
      animalUuid: 'animal-2',
      visitId: 'visit-global-1',
      mode: 'GLOBAL',
      status: 'PENDING',
      occurredAt: '2026-05-10T08:00',
      notes: ' Jornada de control ',
      checklist: [],
      clinicalNote: { reason: 'Campaña', findings: 'Sin novedades', plan: 'Control general' },
      protocolStatus: 'STARTED',
      veterinarianName: ' Dra. Luna ',
      veterinarianLicense: ' MV-001 ',
      targetAnimalCount: 10,
      parentVisitId: ' parent-visit ',
    });
    const metadata = input.metadata as FieldVetVisitMetadata;

    expect(metadata.visit).toEqual({
      visitId: 'visit-global-1',
      mode: 'GLOBAL',
      status: 'PENDING',
      veterinarian: { name: 'Dra. Luna', license: 'MV-001' },
      targetAnimalCount: 10,
      parentVisitId: 'parent-visit',
    });
  });

  it('should omit nullable visit fields instead of sending empty veterinarian license or target count', () => {
    const input = mapVetVisitFormToCreateInput({
      animalUuid: 'animal-3',
      visitId: 'visit-specific-1',
      mode: 'SPECIFIC',
      status: 'ATTENDED',
      occurredAt: '2026-05-10T08:00',
      notes: null,
      checklist: [],
      clinicalNote: { reason: 'Control', findings: 'Estable', plan: 'Alta' },
      protocolStatus: 'CLOSED',
      veterinarianName: 'Dr. Soliz',
      veterinarianLicense: '   ',
      targetAnimalCount: null,
      parentVisitId: null,
    });
    const metadata = input.metadata as FieldVetVisitMetadata;

    expect(metadata.visit).toEqual({
      visitId: 'visit-specific-1',
      mode: 'SPECIFIC',
      status: 'ATTENDED',
      veterinarian: { name: 'Dr. Soliz' },
    });
  });

  it('should map scheduled visits with motive only and no attention notes', () => {
    const input = mapVetVisitFormToCreateInput({
      animalUuid: 'animal-4',
      visitId: 'visit-scheduled-1',
      mode: 'SPECIFIC',
      status: 'PENDING',
      occurredAt: '2026-05-12',
      notes: null,
      checklist: [],
      clinicalNote: { reason: 'Control preventivo', findings: '', plan: '' },
      protocolStatus: 'STARTED',
      veterinarianName: 'Dra. Luna',
    });
    const metadata = input.metadata as FieldVetVisitMetadata;

    expect(input.notes).toBeNull();
    expect(input.occurredAt).toBe('2026-05-12T00:00:00.000Z');
    expect(metadata.clinicalNote).toEqual({ reason: 'Control preventivo' });
    expect(metadata.checklist).toEqual([]);
  });

  it('should map attended visits with attention notes instead of findings and plan', () => {
    const input = mapVetVisitFormToCreateInput({
      animalUuid: 'animal-5',
      visitId: 'visit-attended-1',
      mode: 'SPECIFIC',
      status: 'ATTENDED',
      occurredAt: new Date('2026-05-12T00:00:00.000Z'),
      notes: ' Se atendió al animal y quedó estable. ',
      checklist: [],
      clinicalNote: { reason: 'Cojera', findings: '', plan: '' },
      protocolStatus: 'CLOSED',
      veterinarianName: 'Dr. Soliz',
    });
    const metadata = input.metadata as FieldVetVisitMetadata;

    expect(input.notes).toBe('Se atendió al animal y quedó estable.');
    expect(input.occurredAt).toBe('2026-05-12T00:00:00.000Z');
    expect(metadata['atencionNotas']).toBe('Se atendió al animal y quedó estable.');
    expect(metadata.visit.status).toBe('ATTENDED');
    expect(metadata.clinicalNote).toEqual({ reason: 'Cojera' });
  });
});
