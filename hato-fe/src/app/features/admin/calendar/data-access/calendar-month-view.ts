import type {
  CalendarAlertStatus,
  CalendarDerivedAgendaItem,
} from '../../../../core/offline/offline-types';

export type CalendarMobileViewMode = 'month' | 'agenda';

export interface CalendarMonthDayCounts {
  total: number;
  upcoming: number;
  dueToday: number;
  overdue: number;
}

export interface CalendarMonthDay {
  date: string;
  dayOfMonth: number;
  inCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  items: CalendarDerivedAgendaItem[];
  counts: CalendarMonthDayCounts;
}

export interface CalendarAgendaGroup {
  date: string;
  label: string;
  items: CalendarDerivedAgendaItem[];
}

export interface CalendarMonthViewInput {
  items: CalendarDerivedAgendaItem[];
  visibleMonth: Date;
  selectedDate?: string | null;
  today?: Date;
}

export interface CalendarMonthView {
  monthKey: string;
  monthLabel: string;
  days: CalendarMonthDay[];
  selectedDay: CalendarMonthDay | null;
  selectedDayItems: CalendarDerivedAgendaItem[];
  agendaGroups: CalendarAgendaGroup[];
}

const WEEKDAY_FORMATTER = new Intl.DateTimeFormat('es-BO', { weekday: 'short' });
const MONTH_FORMATTER = new Intl.DateTimeFormat('es-BO', { month: 'long', year: 'numeric' });
const DAY_LABEL_FORMATTER = new Intl.DateTimeFormat('es-BO', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

export const CALENDAR_WEEKDAY_LABELS = Array.from({ length: 7 }, (_, index) =>
  titleCase(WEEKDAY_FORMATTER.format(new Date(2026, 1, index + 1))),
);

export function buildCalendarMonthView(input: CalendarMonthViewInput): CalendarMonthView {
  const today = input.today ?? new Date();
  const monthStart = startOfMonth(input.visibleMonth);
  const monthEnd = endOfMonth(monthStart);
  const gridStart = startOfWeek(monthStart);
  const gridEnd = endOfWeek(monthEnd);
  const monthKey = toMonthKey(monthStart);
  const selectedDate = input.selectedDate ?? toLocalDateKey(today);
  const itemsByDate = groupItemsByDate(input.items);
  const days: CalendarMonthDay[] = [];

  for (const date = new Date(gridStart); date <= gridEnd; date.setDate(date.getDate() + 1)) {
    const dateKey = toLocalDateKey(date);
    const items = itemsByDate.get(dateKey) ?? [];

    days.push({
      date: dateKey,
      dayOfMonth: date.getDate(),
      inCurrentMonth:
        date.getMonth() === monthStart.getMonth() &&
        date.getFullYear() === monthStart.getFullYear(),
      isToday: dateKey === toLocalDateKey(today),
      isSelected: dateKey === selectedDate,
      items,
      counts: countItems(items),
    });
  }

  const selectedDay = days.find((day) => day.date === selectedDate) ?? null;

  return {
    monthKey,
    monthLabel: titleCase(MONTH_FORMATTER.format(monthStart)),
    days,
    selectedDay,
    selectedDayItems: selectedDay?.items ?? [],
    agendaGroups: buildAgendaGroups(input.items, monthStart),
  };
}

export function toLocalDateKey(value: Date): string {
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${value.getFullYear()}-${month}-${day}`;
}

export function parseLocalDateKey(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function addMonths(value: Date, amount: number): Date {
  return new Date(value.getFullYear(), value.getMonth() + amount, 1);
}

function groupItemsByDate(items: CalendarDerivedAgendaItem[]) {
  const grouped = new Map<string, CalendarDerivedAgendaItem[]>();

  for (const item of items) {
    const date = new Date(item.dueAt);
    if (Number.isNaN(date.getTime())) {
      continue;
    }

    const dateKey = toLocalDateKey(date);
    const bucket = grouped.get(dateKey) ?? [];
    bucket.push(item);
    grouped.set(dateKey, bucket);
  }

  for (const bucket of grouped.values()) {
    bucket.sort((left, right) => left.dueAt.localeCompare(right.dueAt));
  }

  return grouped;
}

function buildAgendaGroups(
  items: CalendarDerivedAgendaItem[],
  visibleMonth: Date,
): CalendarAgendaGroup[] {
  const monthKey = toMonthKey(visibleMonth);
  const grouped = groupItemsByDate(items);

  return [...grouped.entries()]
    .filter(([date]) => date.startsWith(monthKey))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, dayItems]) => ({
      date,
      label: titleCase(DAY_LABEL_FORMATTER.format(parseLocalDateKey(date))),
      items: dayItems,
    }));
}

function countItems(items: CalendarDerivedAgendaItem[]): CalendarMonthDayCounts {
  return {
    total: items.length,
    upcoming: countByStatus(items, 'upcoming'),
    dueToday: countByStatus(items, 'due_today'),
    overdue: countByStatus(items, 'overdue'),
  };
}

function countByStatus(items: CalendarDerivedAgendaItem[], status: CalendarAlertStatus) {
  return items.filter((item) => item.status === status).length;
}

function startOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function endOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth() + 1, 0);
}

function startOfWeek(value: Date) {
  const date = new Date(value);
  date.setDate(date.getDate() - date.getDay());
  return date;
}

function endOfWeek(value: Date) {
  const date = new Date(value);
  date.setDate(date.getDate() + (6 - date.getDay()));
  return date;
}

function toMonthKey(value: Date) {
  return toLocalDateKey(value).slice(0, 7);
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
