import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { AnimalsHealthEventsService } from '../animals/data-access/animals-health-events.service';
import { CalendarPageComponent } from './calendar-page.component';
import { CalendarAlertsStore } from './data-access/calendar-alerts.store';

describe('CalendarPageComponent', () => {
  let fixture: ComponentFixture<CalendarPageComponent>;
  let fakeStore: ReturnType<typeof createFakeStore>;
  let dialogOpen: ReturnType<typeof vi.fn>;
  let createEvent: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    fakeStore = createFakeStore();
    dialogOpen = vi.fn(() => ({ afterClosed: () => of(createVetVisitResult()) }));
    createEvent = vi.fn(() => of({ message: 'Visita guardada' }));

    await TestBed.configureTestingModule({
      imports: [CalendarPageComponent],
      providers: [
        { provide: CalendarAlertsStore, useValue: fakeStore },
        { provide: MatDialog, useValue: { open: dialogOpen } },
        { provide: AnimalsHealthEventsService, useValue: { createEvent } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CalendarPageComponent);
    fixture.detectChanges();
  });

  it('should render a visual month calendar and select agenda days', () => {
    fixture.componentInstance.visibleMonth.set(new Date(2026, 3, 1));
    fixture.componentInstance.selectDay('2026-04-28');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Vista mensual');
    expect(fixture.nativeElement.textContent).toContain('1 ítems');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Vacunación');
    expect(fixture.nativeElement.textContent).toContain('Día seleccionado');
  });

  it('should navigate between months and return to today', () => {
    const initialMonth = fixture.componentInstance.monthView().monthKey;

    fixture.componentInstance.nextMonth();
    expect(fixture.componentInstance.monthView().monthKey).not.toBe(initialMonth);

    fixture.componentInstance.previousMonth();
    expect(fixture.componentInstance.monthView().monthKey).toBe(initialMonth);
  });

  it('should switch mobile month and agenda modes and close day detail', () => {
    fixture.componentInstance.visibleMonth.set(new Date(2026, 3, 1));
    fixture.componentInstance.selectDay('2026-04-28');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Agenda del mes');
    expect(fixture.componentInstance.dayDetailOpen()).toBe(true);

    fixture.componentInstance.setMobileViewMode('agenda');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Martes, 28 de abril');
    expect(fixture.nativeElement.textContent).toContain('Vacunación');

    fixture.componentInstance.closeDayDetail();
    fixture.detectChanges();

    expect(fixture.componentInstance.dayDetailOpen()).toBe(false);
  });

  it('should open the vet visit dialog for the selected calendar date', () => {
    fixture.componentInstance.selectDay('2026-06-15');

    fixture.componentInstance.openScheduleVisitDialog();

    expect(dialogOpen).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        data: expect.objectContaining({ initialVisitDate: '2026-06-15' }),
      }),
    );
    expect(createEvent).toHaveBeenCalled();
    expect(fakeStore.rebuild).toHaveBeenCalledWith('manual');
  });

  it('should render loading stale and empty states from the store', () => {
    fakeStore.loadingState.set(false);
    fakeStore.timelineState.set([]);
    fakeStore.agendaItemsState.set([]);
    fakeStore.staleState.set(true);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('La agenda estaba stale');
    expect(text).toContain('No hay agenda para este día');
  });

  it('should render loading state while a recomputation is running', () => {
    fakeStore.loadingState.set(true);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Actualizando agenda local');
  });

  it('should not render legacy alert preference controls or in-app alert table', () => {
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).not.toContain('Horizonte 1d');
    expect(text).not.toContain('Browser notifications');
    expect(text).not.toContain('Alertas in-app');
  });
});

function createVetVisitResult() {
  return {
    mode: 'GLOBAL' as const,
    creationMode: 'scheduled' as const,
    animalUuid: null,
    visitId: 'visit-1',
    status: 'PENDING' as const,
    occurredAt: '2026-06-15T00:00:00.000Z',
    nextDueAt: null,
    notes: null,
    reason: 'Control preventivo',
    veterinarianName: 'Dra. Luna',
    veterinarianLicense: null,
    targetAnimalCount: null,
    parentVisitId: null,
  };
}

function createFakeStore() {
  const countsState = signal({ total: 1, byStatus: { upcoming: 1, due_today: 0, overdue: 0 } });
  const timelineState = signal([
    {
      id: 'agenda-1',
      animalUuid: 'animal-1',
      sourceType: 'ANIMAL_HEALTH_EVENT',
      sourceId: 'health-1',
      dueAt: '2026-04-28T09:00:00.000Z',
      status: 'upcoming',
      title: 'Vacunación',
      priorityScore: 90,
      sortKey: 'ANIMAL_HEALTH_EVENT:health-1',
    },
  ]);
  const agendaItemsState = signal(timelineState());
  const staleState = signal(false);
  const loadingState = signal(false);
  const rangeState = signal<'today' | 'next_7_days' | 'next_30_days'>('today');

  return {
    counts: countsState.asReadonly(),
    timeline: timelineState.asReadonly(),
    agendaItems: agendaItemsState.asReadonly(),
    stale: staleState.asReadonly(),
    loading: loadingState.asReadonly(),
    range: rangeState.asReadonly(),
    ensureFresh: vi.fn(async () => undefined),
    setRange: vi.fn((range: 'today' | 'next_7_days' | 'next_30_days') => rangeState.set(range)),
    rebuild: vi.fn(async () => undefined),
    loadingState,
    staleState,
    timelineState,
    agendaItemsState,
  };
}
