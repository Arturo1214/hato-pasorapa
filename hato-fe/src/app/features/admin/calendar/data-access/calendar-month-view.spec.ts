import { buildCalendarMonthView, toLocalDateKey } from './calendar-month-view';
import type { CalendarDerivedAgendaItem } from '../../../../core/offline/offline-types';

describe('calendar-month-view', () => {
  it('builds a complete month grid with leading and trailing days', () => {
    const view = buildCalendarMonthView({
      items: [],
      visibleMonth: new Date(2026, 3, 1),
      selectedDate: '2026-04-15',
      today: new Date(2026, 3, 20),
    });

    expect(view.monthKey).toBe('2026-04');
    expect(view.days.length).toBe(35);
    expect(view.days[0].date).toBe('2026-03-29');
    expect(view.days.at(-1)?.date).toBe('2026-05-02');
    expect(view.days.find((day) => day.date === '2026-04-15')?.isSelected).toBe(true);
    expect(view.days.find((day) => day.date === '2026-04-20')?.isToday).toBe(true);
  });

  it('groups mixed agenda items by local day and exposes selected day items', () => {
    const items = [
      calendarItem('visit-1', 'ANIMAL_HEALTH_EVENT', '2026-04-10T09:00:00', 'due_today'),
      calendarItem('repro-1', 'ANIMAL_REPRODUCTION_EVENT', '2026-04-10T14:00:00', 'upcoming'),
      calendarItem('event-1', 'ANIMAL_EVENT', '2026-04-11T10:00:00', 'overdue'),
    ];

    const view = buildCalendarMonthView({
      items,
      visibleMonth: new Date(2026, 3, 1),
      selectedDate: '2026-04-10',
      today: new Date(2026, 3, 10),
    });

    const selectedDay = view.days.find((day) => day.date === '2026-04-10');
    expect(selectedDay?.counts).toEqual({ total: 2, upcoming: 1, dueToday: 1, overdue: 0 });
    expect(view.selectedDayItems.map((item) => item.id)).toEqual(['visit-1', 'repro-1']);
    expect(view.agendaGroups.map((group) => group.date)).toEqual(['2026-04-10', '2026-04-11']);
  });

  it('formats dates as stable local date keys', () => {
    expect(toLocalDateKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});

function calendarItem(
  id: string,
  sourceType: CalendarDerivedAgendaItem['sourceType'],
  dueAt: string,
  status: CalendarDerivedAgendaItem['status'],
): CalendarDerivedAgendaItem {
  return {
    id,
    animalUuid: 'animal-1',
    animalLabel: 'Animal 1',
    sourceType,
    sourceId: id,
    dueAt,
    status,
    title: id,
    priorityScore: 10,
    sortKey: `${sourceType}:${id}`,
  };
}
