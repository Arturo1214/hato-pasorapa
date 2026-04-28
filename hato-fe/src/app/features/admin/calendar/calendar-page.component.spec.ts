import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { CalendarPageComponent } from './calendar-page.component';
import { CalendarAlertsStore } from './data-access/calendar-alerts.store';

describe('CalendarPageComponent', () => {
  let fixture: ComponentFixture<CalendarPageComponent>;
  let fakeStore: ReturnType<typeof createFakeStore>;

  beforeEach(async () => {
    fakeStore = createFakeStore();

    await TestBed.configureTestingModule({
      imports: [CalendarPageComponent],
      providers: [{ provide: CalendarAlertsStore, useValue: fakeStore }],
    }).compileComponents();

    fixture = TestBed.createComponent(CalendarPageComponent);
    fixture.detectChanges();
  });

  it('should switch day week and month timeline windows', async () => {
    expect(fixture.nativeElement.textContent).toContain('Vacunación');

    await fixture.componentInstance.useRange('next_7_days');
    fixture.detectChanges();
    expect(fakeStore.setRange).toHaveBeenCalledWith('next_7_days');

    await fixture.componentInstance.useRange('next_30_days');
    fixture.detectChanges();
    expect(fakeStore.setRange).toHaveBeenCalledWith('next_30_days');
  });

  it('should render loading stale and empty states from the store', () => {
    fakeStore.loadingState.set(false);
    fakeStore.timelineState.set([]);
    fakeStore.staleState.set(true);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('La agenda estaba stale');
    expect(text).toContain('No hay ítems visibles');
  });

  it('should render loading state while a recomputation is running', () => {
    fakeStore.loadingState.set(true);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Actualizando agenda local');
  });

  it('should trigger manual refresh and allow editing reminder preferences', async () => {
    await fixture.componentInstance.refresh();
    await fixture.componentInstance.setHorizon(7);
    await fixture.componentInstance.snooze();

    expect(fakeStore.rebuild).toHaveBeenCalledWith('manual');
    expect(fakeStore.setHorizonDays).toHaveBeenCalledWith(7);
    expect(fakeStore.snooze).toHaveBeenCalledTimes(1);
  });
});

function createFakeStore() {
  const preferencesState = signal<{
    horizonDays: 1 | 3 | 7;
    snoozedUntil: string | null;
    notificationsEnabled: boolean;
  }>({ horizonDays: 3, snoozedUntil: null, notificationsEnabled: false });
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
  const inAppAlertsState = signal(timelineState());
  const staleState = signal(false);
  const loadingState = signal(false);
  const rangeState = signal<'today' | 'next_7_days' | 'next_30_days'>('today');

  return {
    counts: countsState.asReadonly(),
    timeline: timelineState.asReadonly(),
    stale: staleState.asReadonly(),
    loading: loadingState.asReadonly(),
    range: rangeState.asReadonly(),
    preferences: preferencesState.asReadonly(),
    inAppAlerts: inAppAlertsState.asReadonly(),
    ensureFresh: vi.fn(async () => undefined),
    setRange: vi.fn((range: 'today' | 'next_7_days' | 'next_30_days') => rangeState.set(range)),
    rebuild: vi.fn(async () => undefined),
    setHorizonDays: vi.fn(async (days: 1 | 3 | 7) => preferencesState.update((current) => ({ ...current, horizonDays: days }))),
    snooze: vi.fn(async () => undefined),
    clearSnooze: vi.fn(async () => undefined),
    setNotificationsEnabled: vi.fn(async (enabled: boolean) =>
      preferencesState.update((current) => ({ ...current, notificationsEnabled: enabled }))
    ),
    requestBrowserPermission: vi.fn(async () => 'default'),
    loadingState,
    staleState,
    timelineState,
  };
}
