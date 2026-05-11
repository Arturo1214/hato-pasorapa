import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { VetVisitsPageComponent } from './vet-visits-page.component';
import { VetVisitsService, type VetVisitItem } from './data-access/vet-visits.service';
import { AnimalsHealthEventsService } from '../animals/data-access/animals-health-events.service';

describe('VetVisitsPageComponent', () => {
  const visits: VetVisitItem[] = [
    {
      visitId: 'VISIT-GLOBAL',
      mode: 'GLOBAL',
      status: 'PENDING',
      veterinarian: { name: 'Dra. Luna', license: 'MV-1' },
      occurredAt: '2026-05-01T10:00:00.000Z',
      nextControlAt: '2026-05-08T10:00:00.000Z',
      animalUuid: null,
      targetAnimalCount: 12,
      atencionNotas: 'Campaña anual',
    },
    {
      visitId: 'VISIT-SPECIFIC',
      mode: 'SPECIFIC',
      status: 'ATTENDED',
      veterinarian: { name: 'Dr. Río' },
      occurredAt: '2026-05-02T11:00:00.000Z',
      nextControlAt: null,
      animalUuid: 'animal-1',
      targetAnimalCount: null,
      atencionNotas: null,
    },
  ];

  const configure = async () => {
    const vetVisitsService = {
      listVetVisits: vi.fn(() => of(visits)),
    };
    const dialog = {
      open: vi.fn(() => ({ afterClosed: () => of(undefined) })),
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

    expect(pendingActions.map((action) => action.label)).toEqual(['Atender', 'Finalizar', 'Cancelar']);
    expect(attendedActions.map((action) => action.label)).toEqual(['Reprogramar', 'Finalizar']);

    component.openNewVisitDialog();

    expect(dialog.open).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ width: 'min(92vw, 960px)' }));
  });
});
