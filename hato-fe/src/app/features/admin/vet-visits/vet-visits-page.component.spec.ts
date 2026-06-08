import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { VetVisitsPageComponent } from './vet-visits-page.component';
import { VetVisitsService, type VetVisitItem } from './data-access/vet-visits.service';
import { AnimalsHealthEventsService } from '../animals/data-access/animals-health-events.service';
import { VetVisitCancelDialogComponent } from './vet-visit-cancel-dialog.component';
import { VetVisitDetailDialogComponent } from './vet-visit-detail-dialog.component';
import {
  VetVisitFormDialogComponent,
  type VetVisitDialogResult,
} from './vet-visit-form-dialog.component';
import { DataTableComponent } from '../../../shared/ui/data-table/data-table.component';
import { OfflineEntityChangeBus } from '../../../core/offline/offline-entity-change-bus.service';

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
      cancelReason: null,
      chainStatus: null,
      animalUuid: null,
      targetAnimalCount: 12,
      atencionNotas: 'Campaña anual',
      costo: null,
      costCurrency: null,
      treatmentPlan: null,
      findings: null,
    },
    {
      visitId: 'VISIT-SPECIFIC',
      mode: 'SPECIFIC',
      status: 'ATTENDED',
      veterinarian: { name: 'Dr. Río' },
      occurredAt: '2026-05-02T11:00:00.000Z',
      nextControlAt: null,
      parentVisitId: null,
      cancelReason: null,
      chainStatus: 'OPEN',
      animalUuid: 'animal-1',
      targetAnimalCount: null,
      atencionNotas: null,
      costo: null,
      costCurrency: null,
      treatmentPlan: null,
      findings: 'Herida limpia y sin infección.',
    },
    {
      visitId: 'VISIT-CANCELED',
      mode: 'GLOBAL',
      status: 'CANCELED',
      veterinarian: { name: 'Dra. Cielo', license: 'MV-9' },
      occurredAt: '2026-05-04T10:00:00.000Z',
      nextControlAt: null,
      parentVisitId: null,
      cancelReason: 'Cancelada por lluvia',
      chainStatus: null,
      animalUuid: null,
      targetAnimalCount: 8,
      atencionNotas: 'Cancelada por lluvia',
      costo: null,
      costCurrency: null,
      treatmentPlan: null,
      findings: null,
    },
    {
      visitId: 'VISIT-CLOSED',
      mode: 'SPECIFIC',
      status: 'ATTENDED',
      veterinarian: { name: 'Dra. Alta' },
      occurredAt: '2026-05-05T10:00:00.000Z',
      nextControlAt: null,
      parentVisitId: null,
      cancelReason: null,
      chainStatus: 'CLOSED',
      animalUuid: 'animal-closed',
      targetAnimalCount: null,
      atencionNotas: 'Alta clínica',
      costo: null,
      costCurrency: null,
      treatmentPlan: null,
      findings: 'Sin novedades clínicas.',
    },
  ];

  const newVisitResult = {
    mode: 'GLOBAL' as const,
    creationMode: 'scheduled' as const,
    animalUuid: null,
    visitId: 'VISIT-NEW',
    status: 'PENDING' as const,
    occurredAt: '2026-05-03T12:00:00.000Z',
    nextDueAt: null,
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
    creationMode: 'attendedNow',
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

  const attendedNowCreateResult: VetVisitDialogResult = {
    ...newVisitResult,
    mode: 'SPECIFIC',
    creationMode: 'attendedNow',
    animalUuid: 'animal-2',
    visitId: 'VISIT-ATTENDED-NOW',
    status: 'ATTENDED',
    occurredAt: '2026-05-12T14:30:00.000Z',
    nextDueAt: '2026-05-13T00:00:00.000Z',
    notes: 'Tratamiento iniciado en corral.',
    reason: 'Cojera leve',
    veterinarianName: 'Dra. Seguimiento',
    veterinarianLicense: 'MV-FOLLOW',
    targetAnimalCount: null,
    findings: 'Inflamación leve en pata posterior.',
    cost: { amount: 90, currency: 'BOB' },
    treatmentPlan: ['Antiinflamatorio', 'Reposo 24 horas'],
    followUpChoice: 'schedule',
  };

  const backendRowsAfterAttendedNowCreate: VetVisitItem[] = [
    {
      visitId: 'VISIT-ATTENDED-NOW-CHILD-BACKEND',
      mode: 'SPECIFIC',
      status: 'PENDING',
      veterinarian: { name: 'Dra. Seguimiento', license: 'MV-FOLLOW' },
      occurredAt: '2026-05-13T00:00:00.000Z',
      nextControlAt: null,
      parentVisitId: 'VISIT-ATTENDED-NOW',
      cancelReason: null,
      chainStatus: null,
      animalUuid: 'animal-2',
      targetAnimalCount: null,
      atencionNotas: null,
      costo: null,
      costCurrency: null,
      treatmentPlan: null,
      findings: null,
    },
    {
      visitId: 'VISIT-ATTENDED-NOW',
      mode: 'SPECIFIC',
      status: 'ATTENDED',
      veterinarian: { name: 'Dra. Seguimiento', license: 'MV-FOLLOW' },
      occurredAt: '2026-05-12T14:30:00.000Z',
      nextControlAt: '2026-05-13T00:00:00.000Z',
      parentVisitId: null,
      cancelReason: null,
      chainStatus: 'OPEN',
      animalUuid: 'animal-2',
      targetAnimalCount: null,
      atencionNotas: 'Tratamiento iniciado en corral.',
      costo: 90,
      costCurrency: 'BOB',
      treatmentPlan: ['Antiinflamatorio', 'Reposo 24 horas'],
      findings: 'Inflamación leve en pata posterior.',
    },
    ...visits,
  ];

  const backendRowsAfterAttendWithFollowUp: VetVisitItem[] = [
    {
      visitId: 'VISIT-GLOBAL-CHILD-BACKEND',
      mode: 'GLOBAL',
      status: 'PENDING',
      veterinarian: { name: 'Dra. Luna', license: 'MV-1' },
      occurredAt: '2026-05-15T00:00:00.000Z',
      nextControlAt: null,
      parentVisitId: 'VISIT-GLOBAL',
      cancelReason: null,
      chainStatus: null,
      animalUuid: null,
      targetAnimalCount: 12,
      atencionNotas: null,
      costo: null,
      costCurrency: null,
      treatmentPlan: null,
      findings: null,
    },
    {
      ...visits[0],
      status: 'ATTENDED',
      chainStatus: 'OPEN',
      nextControlAt: '2026-05-15T00:00:00.000Z',
      atencionNotas: 'Aplicar antibiótico y observar evolución.',
      findings: 'Animal estable con signos leves de infección.',
    },
    visits[1],
    visits[2],
    visits[3],
  ];

  const pendingGlobalFollowUp: VetVisitItem = {
    visitId: 'VISIT-GLOBAL-CHILD-PENDING',
    mode: 'GLOBAL',
    status: 'PENDING',
    veterinarian: { name: 'Dra. Luna', license: 'MV-1' },
    occurredAt: '2026-05-15T00:00:00.000Z',
    nextControlAt: null,
    parentVisitId: 'VISIT-GLOBAL',
    cancelReason: null,
    chainStatus: null,
    animalUuid: null,
    targetAnimalCount: 12,
    atencionNotas: null,
    costo: null,
    costCurrency: null,
    treatmentPlan: null,
    findings: null,
  };

  const configure = async (
    options: {
      dialogResults?: unknown[];
      dialogResult?: VetVisitDialogResult;
      listResponses?: VetVisitItem[][];
    } = {},
  ) => {
    const listResponses = [...(options.listResponses ?? [visits])];
    const vetVisitsService = {
      listVetVisits: vi.fn(() => of(listResponses.shift() ?? listResponses.at(-1) ?? visits)),
      getVetVisitChain: vi.fn((visitId: string) =>
        of(visits.filter((visit) => visit.visitId === visitId || visit.parentVisitId === visitId)),
      ),
    };
    const dialogResults = [
      ...(options.dialogResults ?? (options.dialogResult ? [options.dialogResult] : [])),
    ];
    const dialog = {
      open: vi.fn(() => ({ afterClosed: () => of(dialogResults.shift()) })),
    };
    const healthEventsService = {
      createEvent: vi.fn(() => of({ outcome: 'queued', message: 'Evento sanitario encolado.' })),
    };

    const entityChangeBus = new OfflineEntityChangeBus();

    await TestBed.configureTestingModule({
      imports: [VetVisitsPageComponent],
      providers: [
        provideRouter([]),
        { provide: VetVisitsService, useValue: vetVisitsService },
        { provide: MatDialog, useValue: dialog },
        { provide: AnimalsHealthEventsService, useValue: healthEventsService },
        { provide: OfflineEntityChangeBus, useValue: entityChangeBus },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(VetVisitsPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return {
      fixture,
      component: fixture.componentInstance,
      vetVisitsService,
      dialog,
      healthEventsService,
      entityChangeBus,
    };
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
    expect(text).not.toContain(
      'Listado central de campañas y visitas específicas, con filtros operativos y acciones por estado.',
    );
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

    const toolbar = fixture.nativeElement.querySelector(
      '[aria-label="Acciones de visitas veterinarias"]',
    );
    const createButton = toolbar?.querySelector('button');

    expect(toolbar?.textContent).toContain('Nueva Visita');
    expect(createButton?.textContent).toContain('Nueva Visita');
    expect(
      fixture.nativeElement.querySelector(
        'mat-card [aria-label="Acciones de visitas veterinarias"]',
      ),
    ).toBeNull();
  });

  it('should convert table filters into the backend list query', async () => {
    const { component, vetVisitsService } = await configure();

    component.handleFiltersChange({
      mode: 'Campaña',
      status: 'Programada',
      veterinarianName: 'Dra. Luna',
    });

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

    const pendingActions = component.visitActions.filter(
      (action) => !action.visible || action.visible(visits[0]),
    );
    const attendedActions = component.visitActions.filter(
      (action) => !action.visible || action.visible(visits[1]),
    );
    const canceledActions = component.visitActions.filter(
      (action) => !action.visible || action.visible(visits[2]),
    );

    expect(pendingActions.map((action) => action.label)).toEqual(['Ver', 'Atender', 'Cancelar']);
    expect(attendedActions.map((action) => action.label)).toEqual(['Ver']);
    expect(canceledActions.map((action) => action.label)).toEqual(['Ver']);
    expect(component.visitActions.map((action) => action.label)).not.toContain('Reprogramar');
    expect(component.visitColumns[3].filterOptions?.map((option) => option.label)).toEqual([
      'Programada',
      'Atendida',
      'Reprogramada',
      'Finalizada',
      'Cancelada',
    ]);

    component.openNewVisitDialog();

    expect(dialog.open).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ width: 'min(92vw, 960px)' }),
    );
  });

  it('should keep Ver visible for terminal visits while blocking attend and cancel transitions', async () => {
    const { component, dialog, healthEventsService } = await configure();

    const closedActions = component.visitActions.filter(
      (action) => !action.visible || action.visible(component.visitRows()[3]),
    );
    const canceledActions = component.visitActions.filter(
      (action) => !action.visible || action.visible(component.visitRows()[2]),
    );

    expect(closedActions.map((action) => action.label)).toEqual(['Ver']);
    expect(canceledActions.map((action) => action.label)).toEqual(['Ver']);

    component.handleRowAction({ actionId: 'cancel', row: component.visitRows()[3] });
    component.handleRowAction({ actionId: 'attend', row: component.visitRows()[3] });

    expect(dialog.open).not.toHaveBeenCalledWith(VetVisitCancelDialogComponent, expect.anything());
    expect(dialog.open).not.toHaveBeenCalledWith(VetVisitFormDialogComponent, expect.anything());
    expect(healthEventsService.createEvent).not.toHaveBeenCalled();
  });

  it('should fetch chain detail and open the read-only Ver dialog for any row', async () => {
    const { component, dialog, vetVisitsService } = await configure();

    component.handleRowAction({ actionId: 'view', row: component.visitRows()[2] });

    expect(vetVisitsService.getVetVisitChain).toHaveBeenCalledWith('VISIT-CANCELED');
    expect(dialog.open).toHaveBeenCalledWith(
      VetVisitDetailDialogComponent,
      expect.objectContaining({
        width: 'min(92vw, 960px)',
        data: {
          visit: component.visitRows()[2],
          chain: [visits[2]],
        },
      }),
    );
  });

  it('should open the cancel dialog and create a canceled vet visit event with cancelReason', async () => {
    const { component, dialog, healthEventsService } = await configure({
      dialogResults: [{ cancelReason: 'El productor solicitó reprogramar la atención.' }],
    });

    component.handleRowAction({ actionId: 'cancel', row: component.visitRows()[0] });

    expect(dialog.open).toHaveBeenCalledWith(
      VetVisitCancelDialogComponent,
      expect.objectContaining({ width: 'min(92vw, 32rem)' }),
    );
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
    expect(component.visitRows()[0]).toEqual(
      expect.objectContaining({
        visitId: 'VISIT-GLOBAL',
        status: 'CANCELED',
        statusLabel: 'Cancelada',
      }),
    );
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
    const { component, dialog, healthEventsService } = await configure({
      dialogResults: [attendResult],
    });

    component.handleRowAction({ actionId: 'attend', row: component.visitRows()[2] });

    expect(dialog.open).not.toHaveBeenCalledWith(VetVisitFormDialogComponent, expect.anything());
    expect(healthEventsService.createEvent).not.toHaveBeenCalled();
  });

  it('should open attend mode and create attended plus linked follow-up events when scheduling next control', async () => {
    const { component, dialog, healthEventsService } = await configure({
      dialogResults: [attendResult],
    });

    component.handleRowAction({ actionId: 'attend', row: component.visitRows()[0] });

    expect(dialog.open).toHaveBeenCalledWith(
      VetVisitFormDialogComponent,
      expect.objectContaining({
        data: expect.objectContaining({ action: 'attend', visitId: 'VISIT-GLOBAL' }),
      }),
    );
    expect(healthEventsService.createEvent).toHaveBeenCalledTimes(2);
    expect(healthEventsService.createEvent).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        metadata: expect.objectContaining({
          visit: expect.objectContaining({ visitId: 'VISIT-GLOBAL', status: 'ATTENDED' }),
          clinicalNote: expect.objectContaining({
            findings: 'Animal estable con signos leves de infección.',
          }),
          cost: { amount: 150, currency: 'BOB' },
          treatmentPlan: ['Aplicar antibiótico', 'Revisar temperatura'],
          protocol: expect.objectContaining({
            status: 'FOLLOW_UP_REQUIRED',
            nextDueAt: '2026-05-15T00:00:00.000Z',
          }),
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
      expect.stringMatching(/.+/),
      'VISIT-SPECIFIC',
      'VISIT-CANCELED',
      'VISIT-CLOSED',
    ]);
    expect(component.visitRows()[0]).toEqual(
      expect.objectContaining({
        visitId: 'VISIT-GLOBAL',
        status: 'ATTENDED',
        statusLabel: 'Atendida',
        chainStatus: 'OPEN',
        nextControlAt: '2026-05-15T00:00:00.000Z',
        findings: 'Animal estable con signos leves de infección.',
      }),
    );
    expect(component.visitRows()[1]).toEqual(
      expect.objectContaining({
        parentVisitId: 'VISIT-GLOBAL',
        status: 'PENDING',
        statusLabel: 'Programada',
      }),
    );
  });

  it('should keep attend finalize overlay visible when the backend reload is stale', async () => {
    const { component } = await configure({
      dialogResults: [finalizeAttendResult],
      listResponses: [visits, visits],
    });

    component.handleRowAction({ actionId: 'attend', row: component.visitRows()[0] });

    expect(component.visitRows()[0]).toEqual(
      expect.objectContaining({
        visitId: 'VISIT-GLOBAL',
        status: 'ATTENDED',
        statusLabel: 'Atendida',
        chainStatus: 'CLOSED',
        nextControlAt: null,
        findings: 'Animal estable con signos leves de infección.',
        costo: 150,
        costCurrency: 'BOB',
        treatmentPlan: ['Aplicar antibiótico', 'Revisar temperatura'],
      }),
    );
    expect(
      component.visitActions
        .filter((action) => !action.visible || action.visible(component.visitRows()[0]))
        .map((action) => action.label),
    ).toEqual(['Ver']);
  });

  it('should keep attend schedule parent and follow-up overlays visible when the backend reload is stale', async () => {
    const { component } = await configure({
      dialogResults: [attendResult],
      listResponses: [visits, visits],
    });

    component.handleRowAction({ actionId: 'attend', row: component.visitRows()[0] });

    expect(component.visitRows()[0]).toEqual(
      expect.objectContaining({
        visitId: 'VISIT-GLOBAL',
        status: 'ATTENDED',
        chainStatus: 'OPEN',
        nextControlAt: '2026-05-15T00:00:00.000Z',
      }),
    );
    expect(component.visitRows()[1]).toEqual(
      expect.objectContaining({
        parentVisitId: 'VISIT-GLOBAL',
        status: 'PENDING',
        occurredAt: '2026-05-15T00:00:00.000Z',
      }),
    );
  });

  it('should preserve cancel overlay after a bus-triggered stale reload', async () => {
    const { component, entityChangeBus, vetVisitsService } = await configure({
      dialogResults: [{ cancelReason: 'El productor solicitó reprogramar la atención.' }],
      listResponses: [visits, visits, visits],
    });

    component.handleRowAction({ actionId: 'cancel', row: component.visitRows()[0] });
    entityChangeBus.emit({
      entity: 'VET_VISIT',
      source: 'local-mutation',
      operation: 'snapshot-upsert',
      ids: ['VISIT-GLOBAL'],
    });
    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(vetVisitsService.listVetVisits).toHaveBeenCalledTimes(3);
    expect(component.visitRows()[0]).toEqual(
      expect.objectContaining({
        visitId: 'VISIT-GLOBAL',
        status: 'CANCELED',
        statusLabel: 'Cancelada',
        cancelReason: 'El productor solicitó reprogramar la atención.',
      }),
    );
  });

  it('should reload from backend after attend scheduling and replace optimistic follow-up rows', async () => {
    const { component, vetVisitsService } = await configure({
      dialogResults: [attendResult],
      listResponses: [visits, backendRowsAfterAttendWithFollowUp],
    });

    component.handleRowAction({ actionId: 'attend', row: component.visitRows()[0] });

    expect(vetVisitsService.listVetVisits).toHaveBeenCalledTimes(2);
    expect(component.visitRows().map((visit) => visit.visitId)).toEqual([
      'VISIT-GLOBAL-CHILD-BACKEND',
      'VISIT-GLOBAL',
      'VISIT-SPECIFIC',
      'VISIT-CANCELED',
      'VISIT-CLOSED',
    ]);
    expect(component.visitRows()[0]).toEqual(
      expect.objectContaining({
        status: 'PENDING',
        statusLabel: 'Programada',
        parentVisitId: 'VISIT-GLOBAL',
      }),
    );
    expect(component.visitRows()[1]).toEqual(
      expect.objectContaining({
        status: 'ATTENDED',
        statusLabel: 'Atendida',
        chainStatus: 'OPEN',
        nextControlAt: '2026-05-15T00:00:00.000Z',
      }),
    );
  });

  it('should refresh the visible DataTable page immediately when attend reload returns different backend rows', async () => {
    const { fixture, component } = await configure({
      dialogResults: [attendResult],
      listResponses: [visits, backendRowsAfterAttendWithFollowUp],
    });
    const dataTable = fixture.debugElement.query(By.directive(DataTableComponent))
      .componentInstance as DataTableComponent;
    dataTable.dataSource.paginator!.pageSize = 2;
    dataTable.dataSource.paginator!.pageIndex = 1;

    component.handleRowAction({ actionId: 'attend', row: component.visitRows()[0] });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(dataTable.dataSource.paginator?.pageIndex).toBe(0);
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('VISIT-GLOBAL-CHILD-BACKEND');
    expect(text).toContain('Atendida');
    expect(text).not.toContain('0 de 5');
  });

  it('should expose only Ver on attended parents with an active follow-up and keep pending children actionable', async () => {
    const { component } = await configure({ listResponses: [backendRowsAfterAttendWithFollowUp] });

    const pendingChildActions = component.visitActions.filter(
      (action) => !action.visible || action.visible(component.visitRows()[0]),
    );
    const attendedParentActions = component.visitActions.filter(
      (action) => !action.visible || action.visible(component.visitRows()[1]),
    );

    expect(pendingChildActions.map((action) => action.label)).toEqual([
      'Ver',
      'Atender',
      'Cancelar',
    ]);
    expect(attendedParentActions.map((action) => action.label)).toEqual(['Ver']);
  });

  it('should create a finalized chain event when attend flow chooses finalize', async () => {
    const { component, healthEventsService } = await configure({
      dialogResults: [finalizeAttendResult],
    });

    component.handleRowAction({ actionId: 'attend', row: component.visitRows()[0] });

    expect(healthEventsService.createEvent).toHaveBeenCalledTimes(1);
    expect(healthEventsService.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          visit: expect.objectContaining({ visitId: 'VISIT-GLOBAL', status: 'ATTENDED' }),
          protocol: expect.objectContaining({ status: 'CLOSED' }),
        }),
      }),
    );
  });

  it('should finalize an existing pending follow-up by reusing the selected child visitId', async () => {
    const dialogGeneratedResult: VetVisitDialogResult = {
      ...finalizeAttendResult,
      visitId: 'VISIT-DIALOG-GENERATED-SHOULD-NOT-BE-USED',
      parentVisitId: null,
    };
    const { component, dialog, healthEventsService } = await configure({
      dialogResults: [dialogGeneratedResult],
      listResponses: [[pendingGlobalFollowUp, ...visits]],
    });

    component.handleRowAction({ actionId: 'attend', row: component.visitRows()[0] });

    expect(dialog.open).toHaveBeenCalledWith(
      VetVisitFormDialogComponent,
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'attend',
          creationMode: 'attendedNow',
          visitId: 'VISIT-GLOBAL-CHILD-PENDING',
          parentVisitId: 'VISIT-GLOBAL',
        }),
      }),
    );
    expect(healthEventsService.createEvent).toHaveBeenCalledTimes(1);
    expect(healthEventsService.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          visit: expect.objectContaining({
            visitId: 'VISIT-GLOBAL-CHILD-PENDING',
            parentVisitId: 'VISIT-GLOBAL',
            status: 'ATTENDED',
          }),
          protocol: expect.objectContaining({ status: 'CLOSED' }),
        }),
      }),
    );
    expect(healthEventsService.createEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          visit: expect.objectContaining({
            visitId: 'VISIT-DIALOG-GENERATED-SHOULD-NOT-BE-USED',
            status: 'PENDING',
          }),
        }),
      }),
    );
  });

  it('should create attended-now parent plus pending follow-up child when scheduling next control from create', async () => {
    const { component, healthEventsService, vetVisitsService } = await configure({
      dialogResult: attendedNowCreateResult,
      listResponses: [visits, backendRowsAfterAttendedNowCreate],
    });

    component.openNewVisitDialog();

    expect(healthEventsService.createEvent).toHaveBeenCalledTimes(2);
    expect(healthEventsService.createEvent).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        metadata: expect.objectContaining({
          visit: expect.objectContaining({ visitId: 'VISIT-ATTENDED-NOW', status: 'ATTENDED' }),
          clinicalNote: expect.objectContaining({
            findings: 'Inflamación leve en pata posterior.',
          }),
          protocol: expect.objectContaining({
            status: 'FOLLOW_UP_REQUIRED',
            nextDueAt: '2026-05-13T00:00:00.000Z',
          }),
        }),
      }),
    );
    expect(healthEventsService.createEvent).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        animalUuid: 'animal-2',
        metadata: expect.objectContaining({
          visit: expect.objectContaining({
            visitId: expect.stringMatching(/^vet-follow-up-|[0-9a-f-]{36}$/),
            parentVisitId: 'VISIT-ATTENDED-NOW',
            status: 'PENDING',
          }),
          protocol: { status: 'STARTED' },
        }),
      }),
    );
    expect(vetVisitsService.listVetVisits).toHaveBeenCalledTimes(2);
    expect(component.visitRows().map((visit) => visit.visitId)).toEqual([
      'VISIT-ATTENDED-NOW-CHILD-BACKEND',
      'VISIT-ATTENDED-NOW',
      'VISIT-GLOBAL',
      'VISIT-SPECIFIC',
      'VISIT-CANCELED',
      'VISIT-CLOSED',
    ]);
  });

  it('should keep fallback parent and pending child actionable when attended-now create reload is stale', async () => {
    const { component } = await configure({ dialogResult: attendedNowCreateResult });

    component.openNewVisitDialog();

    expect(
      component
        .visitRows()
        .slice(0, 2)
        .map((visit) => visit.statusLabel),
    ).toEqual(['Atendida', 'Programada']);
    expect(component.visitRows()[1]).toEqual(
      expect.objectContaining({
        parentVisitId: 'VISIT-ATTENDED-NOW',
        status: 'PENDING',
      }),
    );
    expect(
      component.visitActions
        .filter((action) => !action.visible || action.visible(component.visitRows()[0]))
        .map((action) => action.label),
    ).toEqual(['Ver']);
    expect(
      component.visitActions
        .filter((action) => !action.visible || action.visible(component.visitRows()[1]))
        .map((action) => action.label),
    ).toEqual(['Ver', 'Atender', 'Cancelar']);
  });

  it('should reload canonical backend rows immediately after scheduled create before updating the visible table', async () => {
    const backendRowsAfterCreate = [
      {
        ...visits[0],
        visitId: 'VISIT-NEW',
        veterinarian: { name: 'Dra. Nueva', license: 'MV-NEW' },
      },
      ...visits,
    ];
    const { component, vetVisitsService } = await configure({
      dialogResult: newVisitResult,
      listResponses: [visits, backendRowsAfterCreate],
    });

    component.openNewVisitDialog();

    expect(vetVisitsService.listVetVisits).toHaveBeenCalledTimes(2);
    expect(component.visitRows().map((visit) => visit.visitId)).toEqual([
      'VISIT-NEW',
      'VISIT-GLOBAL',
      'VISIT-SPECIFIC',
      'VISIT-CANCELED',
      'VISIT-CLOSED',
    ]);
    expect(component.visitRows()[0].veterinarianName).toBe('Dra. Nueva');
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
      'VISIT-CLOSED',
    ]);
  });

  it('should not show a newly saved visit when the current filters exclude it', async () => {
    const { component } = await configure({ dialogResult: newVisitResult });

    component.handleFiltersChange({ mode: 'Específica' });
    component.openNewVisitDialog();

    expect(component.visitRows().map((visit) => visit.visitId)).toEqual([
      'VISIT-GLOBAL',
      'VISIT-SPECIFIC',
      'VISIT-CANCELED',
      'VISIT-CLOSED',
    ]);
  });
});
