import type {
  AnimalHealthEventSnapshotPayload,
  AnimalOfflineSnapshotPayload,
  AnimalReproductionEventSnapshotPayload,
  AnimalEventSnapshotPayload,
  CalendarAlertPreferences,
  CalendarDerivedAgendaItem,
  CalendarRange,
  CalendarDerivedState,
  OfflineSnapshotRecord,
} from '../../../../core/offline/offline-types';
import {
  buildAnimalLabel,
  buildCalendarCounts,
  buildCalendarSortKey,
  buildCalendarWindows,
  classifyCalendarAlertStatus,
  compareCalendarAgenda,
  computeCalendarPriority,
  DEFAULT_CALENDAR_ALERT_PREFERENCES,
  parseCalendarDate,
  selectTimelineRange,
} from './calendar-alerts.utils';

export interface CalendarProjectionInput {
  animals: OfflineSnapshotRecord[];
  animalEvents: OfflineSnapshotRecord[];
  healthEvents: OfflineSnapshotRecord[];
  reproductionEvents: OfflineSnapshotRecord[];
  now: string;
  preferences?: CalendarAlertPreferences;
}

export function projectCalendarAlerts(input: CalendarProjectionInput): CalendarDerivedState {
  // V1 scope rule: if a source cannot provide an explicit next actionable date,
  // it is excluded from the derived schedule instead of inferring expert rules.
  const preferences = {
    ...DEFAULT_CALENDAR_ALERT_PREFERENCES,
    ...(input.preferences ?? {}),
  } satisfies CalendarAlertPreferences;
  const animalsByUuid = new Map(
    input.animals.map((snapshot) => [snapshot.entityId, snapshot.payload as AnimalOfflineSnapshotPayload])
  );

  const items = [
    ...input.healthEvents.flatMap((snapshot) => toHealthAgendaItems(snapshot.payload as AnimalHealthEventSnapshotPayload, animalsByUuid, input.now)),
    ...input.reproductionEvents.flatMap((snapshot) =>
      toReproductionAgendaItems(snapshot.payload as AnimalReproductionEventSnapshotPayload, animalsByUuid, input.now)
    ),
    ...input.animalEvents.flatMap((snapshot) => toAnimalEventAgendaItems(snapshot.payload as AnimalEventSnapshotPayload, animalsByUuid, input.now)),
  ].sort(compareCalendarAgenda);

  const windows = buildCalendarWindows(items, preferences, input.now);
  const counts = buildCalendarCounts(items, preferences, input.now);

  return {
    version: 1,
    preferences,
    items,
    windows,
    counts,
    lastComputedAt: input.now,
  };
}

export function selectCalendarTimeline(state: Pick<CalendarDerivedState, 'items'>, range: CalendarRange, now: string) {
  return selectTimelineRange(state.items, range, now);
}

function toHealthAgendaItems(
  event: AnimalHealthEventSnapshotPayload,
  animalsByUuid: Map<string, AnimalOfflineSnapshotPayload>,
  now: string
): CalendarDerivedAgendaItem[] {
  const protocolNextDueAt =
    'protocol' in event.metadata && typeof event.metadata.protocol === 'object' && event.metadata.protocol !== null
      ? ((event.metadata.protocol as Record<string, unknown>)['nextDueAt'] as string | undefined)
      : undefined;
  const fallbackNextDueAt = typeof event.metadata.nextDueAt === 'string' ? event.metadata.nextDueAt : undefined;
  const dueAt = normalizeDueAt(protocolNextDueAt ?? fallbackNextDueAt);
  if (!dueAt) {
    return [];
  }

  const animalLabel = buildAnimalLabel(animalsByUuid.get(event.animalUuid) ?? {}, event.animalUuid);
  const status = classifyCalendarAlertStatus(dueAt, now);
  return [
    {
      id: `health:${event.id}`,
      animalUuid: event.animalUuid,
      animalLabel,
      sourceType: 'ANIMAL_HEALTH_EVENT',
      sourceId: event.id,
      dueAt,
      status,
      title: healthEventTitle(event.healthEventType),
      detail: `${animalLabel}${event.notes ? ` · ${event.notes}` : ''}`,
      priorityScore: computeCalendarPriority('ANIMAL_HEALTH_EVENT', status),
      sortKey: buildCalendarSortKey('ANIMAL_HEALTH_EVENT', event.id),
    },
  ];
}

function toReproductionAgendaItems(
  event: AnimalReproductionEventSnapshotPayload,
  animalsByUuid: Map<string, AnimalOfflineSnapshotPayload>,
  now: string
): CalendarDerivedAgendaItem[] {
  const dueAt = normalizeDueAt(readReproductionDueAt(event));
  if (!dueAt) {
    return [];
  }

  const animalLabel = buildAnimalLabel(animalsByUuid.get(event.animalUuid) ?? {}, event.animalUuid);
  const status = classifyCalendarAlertStatus(dueAt, now);
  return [
    {
      id: `reproduction:${event.id}`,
      animalUuid: event.animalUuid,
      animalLabel,
      sourceType: 'ANIMAL_REPRODUCTION_EVENT',
      sourceId: event.id,
      dueAt,
      status,
      title: reproductionEventTitle(event.reproductionEventType),
      detail: `${animalLabel}${event.notes ? ` · ${event.notes}` : ''}`,
      priorityScore: computeCalendarPriority('ANIMAL_REPRODUCTION_EVENT', status),
      sortKey: buildCalendarSortKey('ANIMAL_REPRODUCTION_EVENT', event.id),
    },
  ];
}

function toAnimalEventAgendaItems(
  event: AnimalEventSnapshotPayload,
  animalsByUuid: Map<string, AnimalOfflineSnapshotPayload>,
  now: string
): CalendarDerivedAgendaItem[] {
  const dueAt = normalizeDueAt(event.occurredAt);
  if (!dueAt) {
    return [];
  }

  const animalLabel = buildAnimalLabel(animalsByUuid.get(event.animalUuid) ?? {}, event.animalUuid);
  const status = classifyCalendarAlertStatus(dueAt, now);
  return [
    {
      id: `event:${event.id}`,
      animalUuid: event.animalUuid,
      animalLabel,
      sourceType: 'ANIMAL_EVENT',
      sourceId: event.id,
      dueAt,
      status,
      title: animalEventTitle(event.type),
      detail: `${animalLabel}${event.notes ? ` · ${event.notes}` : ''}`,
      priorityScore: computeCalendarPriority('ANIMAL_EVENT', status),
      sortKey: buildCalendarSortKey('ANIMAL_EVENT', event.id),
    },
  ];
}

function readReproductionDueAt(event: AnimalReproductionEventSnapshotPayload) {
  // Default decision documented for V1: no implicit reproductive milestones.
  // Missing explicit metadata means the item does not enter the derived schedule.
  switch (event.reproductionEventType) {
    case 'PREGNANCY_CONFIRMED':
      return event.metadata.confirmationDate;
    case 'BIRTH':
      return event.metadata.birthDate;
    default:
      return null;
  }
}

function normalizeDueAt(value: string | null | undefined) {
  return parseCalendarDate(value)?.toISOString() ?? null;
}

function healthEventTitle(type: AnimalHealthEventSnapshotPayload['healthEventType']) {
  return (
    {
      VACCINATION: 'Vacunación pendiente',
      DEWORMING: 'Desparasitación pendiente',
      DISEASE_REPORTED: 'Seguimiento sanitario',
      TREATMENT_STARTED: 'Tratamiento en seguimiento',
      TREATMENT_FOLLOW_UP: 'Control de tratamiento',
      TREATMENT_CLOSED: 'Cierre sanitario programado',
      FIELD_VET_VISIT: 'Control veterinario de campo',
    } as const
  )[type];
}

function reproductionEventTitle(type: AnimalReproductionEventSnapshotPayload['reproductionEventType']) {
  return (
    {
      SERVICE: 'Servicio registrado',
      PREGNANCY_CONFIRMED: 'Control de preñez',
      PREGNANCY_LOSS: 'Seguimiento de pérdida',
      BIRTH: 'Parto programado',
    } as const
  )[type];
}

function animalEventTitle(type: AnimalEventSnapshotPayload['type']) {
  return (
    {
      SOLD: 'Venta programada',
      DECEASED: 'Seguimiento operativo',
      LOST: 'Seguimiento por extravío',
      TRANSFERRED: 'Transferencia programada',
      CASTRATION: 'Castración programada',
      OBSERVATION: 'Observación operativa',
    } as const
  )[type];
}
