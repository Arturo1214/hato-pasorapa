import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { VetVisitsPageComponent } from './vet-visits-page.component';
import { VetVisitsService, type VetVisitItem } from './data-access/vet-visits.service';
import { AnimalsHealthEventsService } from '../animals/data-access/animals-health-events.service';
import { VetVisitCancelDialogComponent } from './vet-visit-cancel-dialog.component';
import { VetVisitFormDialogComponent, type VetVisitDialogResult } from './vet-visit-form-dialog.component';

describe('VetVisitsPageComponent', () => {
  const visits: VetVisitItem[] = [
    {
      visitId: 'VISIT-GLOBAL',
      mode: 'GLOBAL',
      status: 'PENDING',
      veterinarian: { name: 'Dra. Luna', license: 'MV-1' },
      occurredAt: '2026-05-01T10:00:00.000Z',
      nextControlAt: '2026-05-08T10:00:00.000Z',
      parentVisitId: null,
      animalUuid: null,
      targetAnimalCount: 12,
      atencionNotas: 'Campaña anual',
      costo: null,
      costCurrency: null,
      treatmentPlan: null,
    },
    {
      visitId: 'VISIT-SPECIFIC',
      mode: 'SPECIFIC',
      status: 'ATTENDED',
      veterinarian: { name: 'Dr. Río' },
      occurredAt: '2026-05-02T11:00:00.000Z',
      nextControlAt: null,
      parentVisitId: null,
      animalUuid: 'animal-1',
      targetAnimalCount: null,
      atencionNotas: null,
      costo: null,
      costCurrency: null,
      treatmentPlan: null,
    },
    {
      visitId: 'VISIT-CANCELED',
      mode: 'GLOBAL',
      status: 'CANCELED',
      veterinarian: { name: 'Dra. Cielo', license: 'MV-9' },
      occurredAt: '2026-05-04T10:00:00.000Z',
      nextControlAt: null,
      parentVisitId: null,
      animalUuid: null,
      targetAnimalCount: 8,
      atencionNotas: 'Cancelada por lluvia',
      costo: null,
      costCurrency: null,
      treatmentPlan: null,
    },
  ];

  const newVisitResult = {
    mode: 'GLOBAL' as const,
    animalUuid: null,
    visitId: 'VISIT-NEW',
    status: 'PENDING' as const,
    occurredAt: '2026-05-03T12:00:00.000Z',
    nextDueAt: '2026-05-10T12:00:00.000Z',
    notes: 'Control preventivo',
    reason: 'Control preventivo',
    veterinarianName: 'Dra. Nueva',
    veterinarianLicense: 'MV-NEW',
    targetAnimalCount: 4,
    parentVisitId: null,
  };

  const attendResult: VetVisitDialogResult = {
    ...newVisitResult,
    visitId: 'VISIT-GLOBAL',
    status: 'ATTENDED',
    findings: 'Animal estable con signos leves de infección.',
    notes: 'Aplicar antibiótico y observar evolución.',
    cost: { amount: 150, currency: 'BOB' },
    treatmentPlan: ['Aplicar antibiótico', 'Revisar temperatura'],
    followUpChoice: 'schedule',
    nextDueAt: '2026-05-15T00:00:00.000Z',
  };

  const finalizeAttendResult: VetVisitDialogResult = {
    ...attendResult,
    followUpChoice: 'finalize',
    nextDueAt: null,
  };

  const configure = async (options: { dialogResults?: unknown[]; dialogResult?: typeof newVisitResult } = {}) => {
    const vetVisitsService = {
      listVetVisits: vi.fn(() => of(visits)),
    };
    const dialogResults = [...(options.dialogResults ?? (options.dialogResult ? [options.dialogResult] : []))];
    const dialog = {
      open: vi.fn(() => ({ afterClosed: () => of(dialogResults.shift()) })),
    };
    const healthEventsService = {
      createEvent: vi.fn(() => of({ outcome: 'queued', message: 'Evento sanitario encolado.' })),
    };

    await TestBed.configureTestingModule({
      imports: [VetVisitsPageComponent],
      providers: [
        provideRouter([]),
        { provide: VetVisitsService, useValue: vetVisitsService },
        { provide: MatDialog, useValue: dialog },
        { provide: AnimalsHealthEventsService, useValue: healthEventsService },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(VetVisitsPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, vetVisitsService, dialog, healthEventsService };
  };

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
  });

  it('should load the central visit list and render Spanish table columns without requiring animalUuid', async () => {
    const { fixture, vetVisitsService } = await configure();

    expect(vetVisitsService.listVetVisits).toHaveBeenCalledWith({ page: 0, size: 20 });
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Nueva Visita');
    expect(text).not.toContain('Listado central de campañas y visitas específicas, con filtros operativos y acciones por estado.');
    expect(text).toContain('Visita');
    expect(text).toContain('Modo');
    expect(text).toContain('Veterinario');
    expect(text).toContain('Estado');
    expect(text).toContain('Fecha');
    expect(text).toContain('Siguiente Control');
    expect(text).toContain('Campaña');
    expect(text).toContain('Específica');
    expect(text).not.toContain('UUID animal');
  });

  it('should place the create visit CTA in a standalone toolbar like the animals page', async () => {
    const { fixture } = await configure();

    const toolbar = fixture.nativeElement.querySelector('[aria-label="Acciones de visitas veterinarias"]');
    const createButton = toolbar?.querySelector('button');

    expect(toolbar?.textContent).toContain('Nueva Visita');
    expect(createButton?.textContent).toContain('Nueva Visita');
    expect(fixture.nativeElement.querySelector('mat-card [aria-label="Acciones de visitas veterinarias"]')).toBeNull();
  });

  it('should convert table filters into the backend list query', async () => {
    const { component, vetVisitsService } = await configure();

    component.handleFiltersChange({ mode: 'Campaña', status: 'Programada', veterinarianName: 'Dra. Luna' });

    expect(vetVisitsService.listVetVisits).toHaveBeenLastCalledWith({
      page: 0,
      size: 20,
      mode: 'GLOBAL',
      status: 'PENDING',
      veterinarian: 'Dra. Luna',
    });
  });

  it('should expose lifecycle actions according to visit status and open the registration dialog', async () => {
    const { component, dialog } = await configure();

    const pendingActions = component.visitActions.filter((action) => !action.visible || action.visible(visits[0]));
    const attendedActions = component.visitActions.filter((action) => !action.visible || action.visible(visits[1]));
    const canceledActions = component.visitActions.filter((action) => !action.visible || action.visible(visits[2]));

    expect(pendingActions.map((action) => action.label)).toEqual(['Atender', 'Cancelar']);
    expect(attendedActions.map((action) => action.label)).toEqual(['Reprogramar', 'Cancelar']);
    expect(canceledActions.map((action) => action.label)).toEqual([]);

    component.openNewVisitDialog();

    expect(dialog.open).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ width: 'min(92vw, 960px)' }));
  });

  it('should open the cancel dialog and create a canceled vet visit event with cancelReason', async () => {
    const { component, dialog, healthEventsService } = await configure({
      dialogResults: [{ cancelReason: 'El productor solicitó reprogramar la atención.' }],
    });

    component.handleRowAction({ actionId: 'cancel', row: component.visitRows()[0] });

    expect(dialog.open).toHaveBeenCalledWith(VetVisitCancelDialogComponent, expect.objectContaining({ width: 'min(92vw, 32rem)' }));
    expect(healthEventsService.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        healthEventType: 'FIELD_VET_VISIT',
        metadata: expect.objectContaining({
          visit: expect.objectContaining({
            visitId: 'VISIT-GLOBAL',
            status: 'CANCELED',
            cancelReason: 'El productor solicitó reprogramar la atención.',
          }),
          protocol: expect.objectContaining({ status: 'CLOSED' }),
        }),
      }),
    );
    expect(component.visitRows()[0]).toEqual(expect.objectContaining({
      visitId: 'VISIT-GLOBAL',
      status: 'CANCELED',
      statusLabel: 'Cancelada',
    }));
  });

  it('should pass the selected visit data into attend mode so the dialog is prepopulated', async () => {
    const { component, dialog } = await configure({ dialogResults: [undefined] });

    component.handleRowAction({ actionId: 'attend', row: component.visitRows()[0] });

    expect(dialog.open).toHaveBeenCalledWith(
      VetVisitFormDialogComponent,
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'attend',
          visitId: 'VISIT-GLOBAL',
          status: 'ATTENDED',
          mode: 'GLOBAL',
          animalUuid: null,
          occurredAt: '2026-05-01T10:00:00.000Z',
          nextDueAt: '2026-05-08T10:00:00.000Z',
          reason: 'Campaña anual',
          veterinarianName: 'Dra. Luna',
          veterinarianLicense: 'MV-1',
          parentVisitId: null,
        }),
      }),
    );
  });

  it('should ignore a stale attend action when the selected visit is already canceled', async () => {
    const { component, dialog, healthEventsService } = await configure({ dialogResults: [attendResult] });

    component.handleRowAction({ actionId: 'attend', row: component.visitRows()[2] });

    expect(dialog.open).not.toHaveBeenCalledWith(VetVisitFormDialogComponent, expect.anything());
    expect(healthEventsService.createEvent).not.toHaveBeenCalled();
  });

  it('should open attend mode and create attended plus linked follow-up events when scheduling next control', async () => {
    const { component, dialog, healthEventsService } = await configure({ dialogResults: [attendResult] });

    component.handleRowAction({ actionId: 'attend', row: component.visitRows()[0] });

    expect(dialog.open).toHaveBeenCalledWith(
      VetVisitFormDialogComponent,
      expect.objectContaining({ data: expect.objectContaining({ action: 'attend', visitId: 'VISIT-GLOBAL' }) }),
    );
    expect(healthEventsService.createEvent).toHaveBeenCalledTimes(2);
    expect(healthEventsService.createEvent).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        metadata: expect.objectContaining({
          visit: expect.objectContaining({ visitId: 'VISIT-GLOBAL', status: 'ATTENDED' }),
          clinicalNote: expect.objectContaining({ findings: 'Animal estable con signos leves de infección.' }),
          cost: { amount: 150, currency: 'BOB' },
          treatmentPlan: ['Aplicar antibiótico', 'Revisar temperatura'],
          protocol: expect.objectContaining({ status: 'FOLLOW_UP_REQUIRED', nextDueAt: '2026-05-15T00:00:00.000Z' }),
        }),
      }),
    );
    expect(healthEventsService.createEvent).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        metadata: expect.objectContaining({
          visit: expect.objectContaining({
            parentVisitId: 'VISIT-GLOBAL',
            status: 'PENDING',
          }),
          protocol: { status: 'STARTED' },
        }),
      }),
    );
    expect(component.visitRows().map((visit) => visit.visitId)).toEqual([
      'VISIT-GLOBAL',
      expect.stringMatching(/^vet-follow-up-|^[0-9a-f-]{36}$/),
      'VISIT-SPECIFIC',
      'VISIT-CANCELED',
    ]);
    expect(component.visitRows().filter((visit) => visit.visitId === 'VISIT-GLOBAL')).toEqual([
      expect.objectContaining({ status: 'ATTENDED', statusLabel: 'Atendida' }),
    ]);
    expect(component.visitRows()[1]).toEqual(expect.objectContaining({
      status: 'PENDING',
      statusLabel: 'Programada',
      occurredAt: '2026-05-15T00:00:00.000Z',
      nextControlAt: null,
    }));
  });

  it('should create a finalized chain event when attend flow chooses finalize', async () => {
    const { component, healthEventsService } = await configure({ dialogResults: [finalizeAttendResult] });

    component.handleRowAction({ actionId: 'attend', row: component.visitRows()[0] });

    expect(healthEventsService.createEvent).toHaveBeenCalledTimes(1);
    expect(healthEventsService.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          visit: expect.objectContaining({ visitId: 'VISIT-GLOBAL', status: 'FINALIZED' }),
          protocol: expect.objectContaining({ status: 'CLOSED' }),
        }),
      }),
    );
  });

  it('should keep a newly saved visit visible when the central backend list reload is stale', async () => {
    const { component, healthEventsService } = await configure({ dialogResult: newVisitResult });

    component.openNewVisitDialog();

    expect(healthEventsService.createEvent).toHaveBeenCalled();
    expect(component.visitRows().map((visit) => visit.visitId)).toEqual([
      'VISIT-NEW',
      'VISIT-GLOBAL',
      'VISIT-SPECIFIC',
      'VISIT-CANCELED',
    ]);
  });

  it('should not show a newly saved visit when the current filters exclude it', async () => {
    const { component } = await configure({ dialogResult: newVisitResult });

    component.handleFiltersChange({ mode: 'Específica' });
    component.openNewVisitDialog();

    expect(component.visitRows().map((visit) => visit.visitId)).toEqual(['VISIT-GLOBAL', 'VISIT-SPECIFIC', 'VISIT-CANCELED']);
  });
});
