import type { FieldVetVisitMetadata } from '../../../../core/offline/offline-types';
import { mapVetVisitFormToCreateInput, normalizePlan } from './vet-visit-form.mapper';

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

  it('should map cancel action with persisted cancel reason', () => {
    const input = mapVetVisitFormToCreateInput({
      action: 'cancel',
      animalUuid: 'animal-6',
      visitId: 'visit-canceled-1',
      mode: 'SPECIFIC',
      status: 'PENDING',
      occurredAt: '2026-05-12T09:00',
      notes: null,
      checklist: [],
      clinicalNote: { reason: 'Control preventivo', findings: '', plan: '' },
      protocolStatus: 'STARTED',
      cancelReason: '  El productor reprogramó la atención  ',
    });
    const metadata = input.metadata as FieldVetVisitMetadata;

    expect(metadata.visit.status).toBe('CANCELED');
    expect(metadata.visit.cancelReason).toBe('El productor reprogramó la atención');
    expect(metadata.protocol.status).toBe('CLOSED');
  });

  it('should reject cancel action without a reason', () => {
    expect(() =>
      mapVetVisitFormToCreateInput({
        action: 'cancel',
        animalUuid: 'animal-7',
        visitId: 'visit-canceled-2',
        mode: 'SPECIFIC',
        status: 'PENDING',
        occurredAt: '2026-05-12T09:00',
        notes: null,
        checklist: [],
        clinicalNote: { reason: 'Control preventivo', findings: '', plan: '' },
        protocolStatus: 'STARTED',
        cancelReason: '   ',
      }),
    ).toThrow('VET_VISIT_CANCEL_REASON_REQUIRED');
  });

  it('should map attend action with findings, notes, cost, and structured treatment plan', () => {
    const input = mapVetVisitFormToCreateInput({
      action: 'attend',
      animalUuid: 'animal-8',
      visitId: 'visit-attended-2',
      mode: 'SPECIFIC',
      status: 'PENDING',
      occurredAt: '2026-05-12T09:00',
      notes: '  Se aplicó tratamiento inicial  ',
      checklist: [],
      clinicalNote: { reason: 'Cojera', findings: ' Inflamación leve ', plan: '' },
      protocolStatus: 'STARTED',
      cost: { amount: 150, currency: 'BOB' },
      treatmentPlan: [' Antibiótico por 3 días ', 'Control en 7 días'],
      followUpChoice: 'schedule',
      nextDueAt: '2026-05-19T09:00',
    });
    const metadata = input.metadata as FieldVetVisitMetadata;

    expect(metadata.visit.status).toBe('ATTENDED');
    expect(metadata.clinicalNote.findings).toBe('Inflamación leve');
    expect(metadata['atencionNotas']).toBe('Se aplicó tratamiento inicial');
    expect(metadata.cost).toEqual({ amount: 150, currency: 'BOB' });
    expect(metadata.treatmentPlan).toEqual(['Antibiótico por 3 días', 'Control en 7 días']);
    expect(metadata.clinicalNote.plan).toEqual(['Antibiótico por 3 días', 'Control en 7 días']);
    expect(metadata.protocol.status).toBe('FOLLOW_UP_REQUIRED');
    expect(metadata.protocol.nextDueAt).toBe('2026-05-19T09:00:00.000Z');
  });

  it('should map attend action with legacy plan string and finalized chain', () => {
    const input = mapVetVisitFormToCreateInput({
      action: 'attend',
      animalUuid: 'animal-9',
      visitId: 'visit-attended-3',
      mode: 'SPECIFIC',
      status: 'PENDING',
      occurredAt: '2026-05-12T09:00',
      notes: 'Atención finalizada',
      checklist: [],
      clinicalNote: { reason: 'Herida', findings: 'Cicatrización completa', plan: 'Alta y observación' },
      protocolStatus: 'STARTED',
      followUpChoice: 'finalize',
    });
    const metadata = input.metadata as FieldVetVisitMetadata;

    expect(metadata.visit.status).toBe('ATTENDED');
    expect(metadata.treatmentPlan).toEqual(['Alta y observación']);
    expect(metadata.clinicalNote.plan).toEqual(['Alta y observación']);
    expect(metadata.protocol.status).toBe('CLOSED');
    expect(metadata.protocol.nextDueAt).toBeUndefined();
  });

  it('should normalize plan values for backwards compatibility', () => {
    expect(normalizePlan(' Aplicar antibiótico ')).toEqual(['Aplicar antibiótico']);
    expect(normalizePlan([' Paso 1 ', ' ', 'Paso 2'])).toEqual(['Paso 1', 'Paso 2']);
  });
});
