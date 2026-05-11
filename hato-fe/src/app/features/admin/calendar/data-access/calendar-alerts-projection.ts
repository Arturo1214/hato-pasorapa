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
  const visit = readVisitBlock(event);
  if (event.healthEventType === 'FIELD_VET_VISIT' && !isActiveVisitStatus(visit?.['status'])) {
    return [];
  }

  const dueAt = normalizeDueAt(readHealthDueAt(event, visit));
  if (!dueAt) {
    return [];
  }

  const animalLabel = buildAnimalLabel(animalsByUuid.get(event.animalUuid) ?? {}, event.animalUuid);
  const status = classifyCalendarAlertStatus(dueAt, now);
  const visitMode = readVisitMode(visit);
  return [
    {
      id: `health:${event.id}`,
      animalUuid: event.animalUuid,
      animalLabel,
      sourceType: 'ANIMAL_HEALTH_EVENT',
      sourceId: event.id,
      dueAt,
      status,
      title: healthEventTitle(event.healthEventType, status, visitMode),
      detail: `${animalLabel}${event.notes ? ` · ${event.notes}` : ''}`,
      priorityScore: computeCalendarPriority('ANIMAL_HEALTH_EVENT', status),
      sortKey: buildCalendarSortKey('ANIMAL_HEALTH_EVENT', event.id),
      ...(visitMode ? { visitMode } : {}),
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
    case 'PREGNANCY_DIAGNOSIS':
      return isPositivePregnancyDiagnosis(event) ? event.metadata.expectedBirthDate : null;
    case 'PREGNANCY_CONFIRMED':
      return event.metadata.confirmationDate;
    case 'BIRTH':
      return event.metadata.birthDate;
    default:
      return null;
  }
}

function isPositivePregnancyDiagnosis(event: AnimalReproductionEventSnapshotPayload) {
  return event.metadata.result === 'PRENADA' && event.metadata.negativeResult !== true && event.metadata.status !== 'fallo';
}

function normalizeDueAt(value: string | null | undefined) {
  return parseCalendarDate(value)?.toISOString() ?? null;
}

function healthEventTitle(type: AnimalHealthEventSnapshotPayload['healthEventType'], status: CalendarDerivedAgendaItem['status'], visitMode?: 'GLOBAL' | 'SPECIFIC') {
  if (type === 'FIELD_VET_VISIT' && visitMode) {
    if (status === 'overdue') {
      return 'Control Veterinario Pendiente';
    }
    if (status === 'due_today') {
      return 'Control Veterinario Hoy';
    }
    return visitMode === 'GLOBAL' ? 'Control Veterinario - Campaña' : 'Control Veterinario - Específica';
  }

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

function readHealthDueAt(event: AnimalHealthEventSnapshotPayload, visit: Record<string, unknown> | undefined) {
  const protocolNextDueAt =
    'protocol' in event.metadata && typeof event.metadata.protocol === 'object' && event.metadata.protocol !== null
      ? ((event.metadata.protocol as Record<string, unknown>)['nextDueAt'] as string | undefined)
      : undefined;
  const fallbackNextDueAt = typeof event.metadata.nextDueAt === 'string' ? event.metadata.nextDueAt : undefined;
  const visitNextControlAt = typeof visit?.['nextControlAt'] === 'string' ? visit['nextControlAt'] as string : undefined;
  return visitNextControlAt ?? protocolNextDueAt ?? fallbackNextDueAt;
}

function readVisitBlock(event: AnimalHealthEventSnapshotPayload) {
  if (!('visit' in event.metadata) || typeof event.metadata.visit !== 'object' || event.metadata.visit === null) {
    return undefined;
  }
  return event.metadata.visit as Record<string, unknown>;
}

function readVisitMode(visit: Record<string, unknown> | undefined) {
  const mode = visit?.['mode'];
  return mode === 'GLOBAL' || mode === 'SPECIFIC' ? mode : undefined;
}

function isActiveVisitStatus(status: unknown) {
  return status === 'PENDING' || status === 'RESCHEDULED' || status === 'PROGRAMADA' || status === 'REPROGRAMADA';
}

function reproductionEventTitle(type: AnimalReproductionEventSnapshotPayload['reproductionEventType']) {
  return (
    {
      SERVICE: 'Servicio registrado',
      PREGNANCY_DIAGNOSIS: 'Fecha probable de parto',
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
