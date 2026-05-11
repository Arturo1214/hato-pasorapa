import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { DateTimeClock } from './vet-visit-form-dialog.component';
import { VetVisitDetailDialogComponent, type VetVisitDetailDialogData } from './vet-visit-detail-dialog.component';

describe('VetVisitDetailDialogComponent', () => {
  const chain: VetVisitDetailDialogData = {
    visit: {
      visitId: 'VISIT-PARENT',
      mode: 'SPECIFIC',
      status: 'ATTENDED',
      veterinarian: { name: 'Dra. Laguna', license: 'MV-77' },
      occurredAt: '2026-05-10T10:00:00.000Z',
      nextControlAt: '2026-05-17T10:00:00.000Z',
      parentVisitId: null,
      cancelReason: null,
      chainStatus: 'OPEN',
      animalUuid: 'animal-1',
      targetAnimalCount: null,
      atencionNotas: 'Responder al tratamiento y controlar fiebre.',
      findings: 'Fiebre persistente y mucosas pálidas.',
      costo: 180,
      costCurrency: 'BOB',
      treatmentPlan: ['Antibiótico 3 días', 'Controlar temperatura'],
    },
    chain: [
      {
        visitId: 'VISIT-PARENT',
        mode: 'SPECIFIC',
        status: 'ATTENDED',
        veterinarian: { name: 'Dra. Laguna', license: 'MV-77' },
        occurredAt: '2026-05-10T10:00:00.000Z',
        nextControlAt: '2026-05-17T10:00:00.000Z',
        parentVisitId: null,
        cancelReason: null,
        chainStatus: 'OPEN',
        animalUuid: 'animal-1',
        targetAnimalCount: null,
        atencionNotas: 'Responder al tratamiento y controlar fiebre.',
        findings: 'Fiebre persistente y mucosas pálidas.',
        costo: 180,
        costCurrency: 'BOB',
        treatmentPlan: ['Antibiótico 3 días', 'Controlar temperatura'],
      },
      {
        visitId: 'VISIT-CHILD-CANCELED',
        mode: 'SPECIFIC',
        status: 'CANCELED',
        veterinarian: { name: 'Dr. Río' },
        occurredAt: '2026-05-17T10:00:00.000Z',
        nextControlAt: null,
        parentVisitId: 'VISIT-PARENT',
        cancelReason: 'Animal vendido',
        chainStatus: null,
        animalUuid: 'animal-1',
        targetAnimalCount: null,
        atencionNotas: 'Cancelado por venta',
        findings: null,
        costo: null,
        costCurrency: null,
        treatmentPlan: null,
      },
      {
        visitId: 'VISIT-CHILD-PENDING',
        mode: 'SPECIFIC',
        status: 'PENDING',
        veterinarian: { name: 'Dra. Cielo' },
        occurredAt: '2026-05-24T10:00:00.000Z',
        nextControlAt: null,
        parentVisitId: 'VISIT-PARENT',
        cancelReason: null,
        chainStatus: null,
        animalUuid: 'animal-1',
        targetAnimalCount: null,
        atencionNotas: 'Próximo control programado',
        findings: null,
        costo: null,
        costCurrency: null,
        treatmentPlan: null,
      },
    ],
  };

  const createFixture = async (data: VetVisitDetailDialogData = chain): Promise<ComponentFixture<VetVisitDetailDialogComponent>> => {
    await TestBed.configureTestingModule({
      imports: [VetVisitDetailDialogComponent],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
        { provide: DateTimeClock, useValue: { nowIso: () => '2026-05-11T12:00:00.000Z' } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(VetVisitDetailDialogComponent);
    fixture.detectChanges();
    return fixture;
  };

  afterEach(() => TestBed.resetTestingModule());

  it('should render read-only parent clinical detail and treatment plan', async () => {
    const fixture = await createFixture();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Detalle de visita veterinaria');
    expect(text).toContain('VISIT-PARENT');
    expect(text).toContain('Atendida');
    expect(text).toContain('Cadena abierta');
    expect(text).toContain('Dra. Laguna · MV-77');
    expect(text).toContain('Fiebre persistente y mucosas pálidas.');
    expect(text).toContain('Responder al tratamiento y controlar fiebre.');
    expect(text).toContain('180 BOB');
    expect(text).toContain('Antibiótico 3 días');
    expect(text).toContain('Controlar temperatura');
    expect(fixture.nativeElement.querySelector('input, textarea, mat-select')).toBeNull();
  });

  it('should distinguish canceled and pending child follow-ups in the chain', async () => {
    const fixture = await createFixture();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Historial vinculado');
    expect(text).toContain('VISIT-CHILD-CANCELED');
    expect(text).toContain('Cancelada');
    expect(text).toContain('Motivo de cancelación');
    expect(text).toContain('Animal vendido');
    expect(text).toContain('VISIT-CHILD-PENDING');
    expect(text).toContain('Programada');
    expect(text).toContain('Próximo control programado');
    expect(text).toContain('24/5/26');
  });
});
