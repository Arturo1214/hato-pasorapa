import type {
  CalendarAlertPreferences,
  CalendarAlertStatus,
  CalendarDerivedAgendaItem,
  CalendarRange,
} from '../../../../core/offline/offline-types';

export const CALENDAR_STALE_TIME_MS = 15 * 60 * 1000;

export const DEFAULT_CALENDAR_ALERT_PREFERENCES: CalendarAlertPreferences = {
  horizonDays: 3,
  snoozedUntil: null,
  notificationsEnabled: false,
};

export function parseCalendarDate(value: string | null | undefined): Date | null {
  if (!value?.trim()) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function classifyCalendarAlertStatus(dueAt: string, nowIso: string): CalendarAlertStatus {
  const dueDate = parseCalendarDate(dueAt);
  const now = parseCalendarDate(nowIso) ?? new Date();

  if (!dueDate) {
    return 'upcoming';
  }

  const todayStart = startOfLocalDay(now);
  const tomorrowStart = addDays(todayStart, 1);

  if (dueDate < todayStart) {
    return 'overdue';
  }

  if (dueDate < tomorrowStart) {
    return 'due_today';
  }

  return 'upcoming';
}

export function compareCalendarAgenda(left: CalendarDerivedAgendaItem, right: CalendarDerivedAgendaItem): number {
  const dueComparison = left.dueAt.localeCompare(right.dueAt);
  if (dueComparison !== 0) {
    return dueComparison;
  }

  const statusComparison = statusWeight(left.status) - statusWeight(right.status);
  if (statusComparison !== 0) {
    return statusComparison;
  }

  const priorityComparison = right.priorityScore - left.priorityScore;
  if (priorityComparison !== 0) {
    return priorityComparison;
  }

  return left.sortKey.localeCompare(right.sortKey);
}

export function selectTimelineRange(items: CalendarDerivedAgendaItem[], range: CalendarRange, nowIso: string) {
  const now = parseCalendarDate(nowIso) ?? new Date();
  const start = startOfLocalDay(now);
  const end = addDays(start, range === 'today' ? 1 : range === 'next_7_days' ? 7 : 30);

  return items.filter((item) => {
    const dueDate = parseCalendarDate(item.dueAt);
    return !!dueDate && dueDate >= start && dueDate < end;
  });
}

export function isCalendarStateStale(lastComputedAt: string | null | undefined, nowIso: string, staleMs = CALENDAR_STALE_TIME_MS) {
  const lastComputed = parseCalendarDate(lastComputedAt ?? null);
  const now = parseCalendarDate(nowIso) ?? new Date();

  if (!lastComputed) {
    return true;
  }

  return now.getTime() - lastComputed.getTime() > staleMs;
}

export function buildCalendarWindows(items: CalendarDerivedAgendaItem[], preferences: CalendarAlertPreferences, nowIso: string) {
  const now = parseCalendarDate(nowIso) ?? new Date();
  const todayStart = startOfLocalDay(now);
  const tomorrowStart = addDays(todayStart, 1);
  const upcomingEnd = addDays(todayStart, preferences.horizonDays + 1);

  const windows = {
    overdue: [] as CalendarDerivedAgendaItem[],
    due_today: [] as CalendarDerivedAgendaItem[],
    upcoming: [] as CalendarDerivedAgendaItem[],
  };

  for (const item of items) {
    const dueDate = parseCalendarDate(item.dueAt);
    if (!dueDate) {
      continue;
    }

    if (dueDate < todayStart) {
      windows.overdue.push(item);
      continue;
    }

    if (dueDate < tomorrowStart) {
      windows.due_today.push(item);
      continue;
    }

    if (dueDate < upcomingEnd) {
      windows.upcoming.push(item);
    }
  }

  return windows;
}

export function buildCalendarCounts(items: CalendarDerivedAgendaItem[], preferences: CalendarAlertPreferences, nowIso: string) {
  const windows = buildCalendarWindows(items, preferences, nowIso);
  return {
    total: windows.overdue.length + windows.due_today.length + windows.upcoming.length,
    byStatus: {
      overdue: windows.overdue.length,
      due_today: windows.due_today.length,
      upcoming: windows.upcoming.length,
    },
  };
}

export function buildCalendarSortKey(sourceType: CalendarDerivedAgendaItem['sourceType'], sourceId: string) {
  return `${sourceType}:${sourceId}`;
}

export function buildAnimalLabel(snapshot: Record<string, unknown>, animalUuid: string) {
  const visible = [snapshot['arete'], snapshot['marca'], snapshot['tatuaje']]
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .find(Boolean);

  return visible || animalUuid;
}

export function computeCalendarPriority(sourceType: CalendarDerivedAgendaItem['sourceType'], status: CalendarAlertStatus) {
  const sourceWeight = sourceType === 'ANIMAL_HEALTH_EVENT' ? 30 : sourceType === 'ANIMAL_REPRODUCTION_EVENT' ? 20 : 10;
  const statusBonus = status === 'overdue' ? 100 : status === 'due_today' ? 80 : 60;
  return sourceWeight + statusBonus;
}

function startOfLocalDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 0, 0, 0, 0);
}

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

function statusWeight(status: CalendarAlertStatus) {
  return status === 'overdue' ? 0 : status === 'due_today' ? 1 : 2;
}
