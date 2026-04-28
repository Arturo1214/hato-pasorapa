import type {
  AdminReportingAggregates,
  AdminReportingEventSourceType,
  AdminReportingKpiSummary,
  AdminReportingLotBreakdownItem,
  AdminReportingRecentActivityItem,
  AnimalOfflineSnapshotPayload,
  HerdCostLedgerSnapshotPayload,
  HerdLotAssignmentSnapshotPayload,
  HerdLotSnapshotPayload,
  HerdProductivityLedgerSnapshotPayload,
  OfflineSnapshotRecord,
  ReportingPresetId,
  ReportingWindow,
} from '../../../../core/offline/offline-types';
import {
  buildReportingAnimalLabel,
  buildReportingTitle,
  compareRecentActivityDesc,
  coerceReportingPreset,
  coerceReportingWindow,
  isWithinReportingWindow,
  matchesReportingPreset,
  parseReportingDate,
  RECENT_ACTIVITY_LIMIT,
  resolveReportingPresetExclusions,
} from './admin-reporting.utils';

export interface AdminReportingProjectionInput {
  users: OfflineSnapshotRecord[];
  ganaderos: OfflineSnapshotRecord[];
  animals: OfflineSnapshotRecord[];
  lots: OfflineSnapshotRecord[];
  lotAssignments: OfflineSnapshotRecord[];
  productivityLedger: OfflineSnapshotRecord[];
  costLedger: OfflineSnapshotRecord[];
  animalEvents: OfflineSnapshotRecord[];
  healthEvents: OfflineSnapshotRecord[];
  reproductionEvents: OfflineSnapshotRecord[];
  now: string;
  selectedWindow: ReportingWindow | string;
  selectedPreset: ReportingPresetId | string;
}

export interface AdminReportingProjectionResult {
  selectedWindow: ReportingWindow;
  selectedPreset: ReportingPresetId;
  aggregates: AdminReportingAggregates;
  eventsByType: Record<ReportingWindow, Record<string, number>>;
  descriptiveKpis: Record<ReportingWindow, AdminReportingKpiSummary>;
  lotBreakdown: AdminReportingLotBreakdownItem[];
  recentActivity: AdminReportingRecentActivityItem[];
}

export interface AdminReportingProjectionBase {
  selectedWindow: ReportingWindow;
  selectedPreset: ReportingPresetId;
  visibleProductivityLedger: Array<OfflineSnapshotRecord & { payload: HerdProductivityLedgerSnapshotPayload }>;
  visibleCostLedger: Array<OfflineSnapshotRecord & { payload: HerdCostLedgerSnapshotPayload }>;
  activities: AdminReportingRecentActivityItem[];
  lots: Array<OfflineSnapshotRecord & { payload: HerdLotSnapshotPayload }>;
  activeAssignments: Array<OfflineSnapshotRecord & { payload: HerdLotAssignmentSnapshotPayload }>;
}

export function projectAdminReportingV2(input: AdminReportingProjectionInput): AdminReportingProjectionResult {
  const base = buildAdminReportingProjectionBase(input);
  const { selectedWindow, selectedPreset, visibleProductivityLedger, visibleCostLedger, activities, lots, activeAssignments } = base;
  const activeAnimalsInAssignments = new Set(activeAssignments.map((snapshot) => snapshot.payload.animalUuid));
  const lotNames = new Map(lots.map((snapshot) => [snapshot.entityId, snapshot.payload.name]));

  const eventsByType = {
    '7d': buildEventsByTypeWindow(activities, '7d', input.now),
    '30d': buildEventsByTypeWindow(activities, '30d', input.now),
    '90d': buildEventsByTypeWindow(activities, '90d', input.now),
  } satisfies Record<ReportingWindow, Record<string, number>>;

  const descriptiveKpis = {
    '7d': buildDescriptiveKpiWindow('7d', input.now, activeAnimalsInAssignments, lots, visibleProductivityLedger, visibleCostLedger),
    '30d': buildDescriptiveKpiWindow('30d', input.now, activeAnimalsInAssignments, lots, visibleProductivityLedger, visibleCostLedger),
    '90d': buildDescriptiveKpiWindow('90d', input.now, activeAnimalsInAssignments, lots, visibleProductivityLedger, visibleCostLedger),
  } satisfies Record<ReportingWindow, AdminReportingKpiSummary>;

  const lotBreakdown = lots
    .filter((snapshot) => matchesReportingPreset(snapshot.payload.active, selectedPreset))
    .map((snapshot) => buildLotBreakdown(snapshot, activeAssignments, visibleProductivityLedger, visibleCostLedger, selectedWindow, input.now, lotNames))
    .sort((left, right) => left.lotName.localeCompare(right.lotName));

  const recentActivity = activities
    .filter((activity) => isWithinReportingWindow(activity.occurredAt, selectedWindow, input.now))
    .sort(compareRecentActivityDesc)
    .slice(0, RECENT_ACTIVITY_LIMIT);

  return {
    selectedWindow,
    selectedPreset,
    aggregates: {
      usersTotal: input.users.filter((snapshot) => matchesReportingPreset(resolveUserActive(snapshot.payload), selectedPreset)).length,
      ganaderosTotal: input.ganaderos.filter((snapshot) => matchesReportingPreset(resolveGanaderoActive(snapshot.payload), selectedPreset)).length,
      animalesTotal: input.animals.filter((snapshot) => matchesReportingPreset(resolveAnimalActive(snapshot.payload), selectedPreset)).length,
      animalesActivos: input.animals.filter(
        (snapshot) => resolveAnimalActive(snapshot.payload) === true && matchesReportingPreset(resolveAnimalActive(snapshot.payload), selectedPreset)
      ).length,
      lotesTotal: lots.filter((snapshot) => matchesReportingPreset(snapshot.payload.active, selectedPreset)).length,
      lotesActivos: lots.filter((snapshot) => snapshot.payload.active && matchesReportingPreset(snapshot.payload.active, selectedPreset)).length,
      asignacionesActivas: activeAssignments.length,
      productividadTotal: visibleProductivityLedger.length,
      costosTotal: visibleCostLedger.length,
      costoAcumulado: Number(visibleCostLedger.reduce((sum, snapshot) => sum + Number(snapshot.payload.amount), 0).toFixed(2)),
    },
    eventsByType,
    descriptiveKpis,
    lotBreakdown,
    recentActivity,
  };
}

export function buildAdminReportingProjectionBase(input: AdminReportingProjectionInput): AdminReportingProjectionBase {
  const selectedWindow = coerceReportingWindow(input.selectedWindow);
  const selectedPreset = coerceReportingPreset(input.selectedPreset);
  const presetExclusions = resolveReportingPresetExclusions(selectedPreset);
  const animalsByUuid = new Map(input.animals.map((snapshot) => [snapshot.entityId, snapshot.payload as AnimalOfflineSnapshotPayload]));
  const lots = dedupeByIdentity(input.lots, (snapshot) => snapshot.entityId) as Array<OfflineSnapshotRecord & { payload: HerdLotSnapshotPayload }>;
  const lotAssignments = dedupeByIdentity(input.lotAssignments, (snapshot) => snapshot.entityId) as Array<OfflineSnapshotRecord & {
    payload: HerdLotAssignmentSnapshotPayload;
  }>;
  const productivityLedger = dedupeByIdentity(input.productivityLedger, (snapshot) => String(snapshot.payload['identityKey'] ?? snapshot.entityId)) as Array<
    OfflineSnapshotRecord & { payload: HerdProductivityLedgerSnapshotPayload }
  >;
  const costLedger = dedupeByIdentity(input.costLedger, (snapshot) => String(snapshot.payload['identityKey'] ?? snapshot.entityId)) as Array<OfflineSnapshotRecord & {
    payload: HerdCostLedgerSnapshotPayload;
  }>;
  const visibleProductivityLedger = productivityLedger.filter(
    (snapshot) => !presetExclusions.productivityMetricTypes.includes(snapshot.payload.metricType)
  );
  const visibleCostLedger = costLedger.filter(
    (snapshot) => !presetExclusions.costCategories.includes(snapshot.payload.category)
  );
  const activeAssignments = lotAssignments.filter((snapshot) => assignmentIsActive(snapshot.payload, input.now));

  const activities = [
    ...input.animalEvents.flatMap((snapshot) =>
      toRecentActivity(snapshot, 'ANIMAL_EVENT', String(snapshot.payload['type'] ?? ''), String(snapshot.payload['occurredAt'] ?? ''), animalsByUuid)
    ),
    ...input.healthEvents.flatMap((snapshot) =>
      toRecentActivity(
        snapshot,
        'ANIMAL_HEALTH_EVENT',
        String(snapshot.payload['healthEventType'] ?? ''),
        String(snapshot.payload['occurredAt'] ?? ''),
        animalsByUuid
      )
    ),
    ...input.reproductionEvents.flatMap((snapshot) =>
      toRecentActivity(
        snapshot,
        'ANIMAL_REPRODUCTION_EVENT',
        String(snapshot.payload['reproductionEventType'] ?? ''),
        String(snapshot.payload['occurredAt'] ?? ''),
        animalsByUuid
      )
    ),
  ].filter((activity) => matchesReportingPreset(resolveAnimalActive(animalsByUuid.get(activity.animalUuid)), selectedPreset));

  return {
    selectedWindow,
    selectedPreset,
    visibleProductivityLedger,
    visibleCostLedger,
    activities,
    lots,
    activeAssignments,
  };
}

export const projectAdminReporting = projectAdminReportingV2;

function buildEventsByTypeWindow(activities: AdminReportingRecentActivityItem[], window: ReportingWindow, now: string) {
  return activities.reduce<Record<string, number>>((acc, activity) => {
    if (!isWithinReportingWindow(activity.occurredAt, window, now)) {
      return acc;
    }
    const key = `${activity.sourceType}:${activity.eventType}`;
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function buildDescriptiveKpiWindow(
  window: ReportingWindow,
  now: string,
  activeAnimalsInAssignments: Set<string>,
  lots: Array<OfflineSnapshotRecord & { payload: HerdLotSnapshotPayload }>,
  productivityLedger: Array<OfflineSnapshotRecord & { payload: HerdProductivityLedgerSnapshotPayload }>,
  costLedger: Array<OfflineSnapshotRecord & { payload: HerdCostLedgerSnapshotPayload }>
): AdminReportingKpiSummary {
  const productivity = productivityLedger.filter((snapshot) => isPeriodKeyWithinWindow(snapshot.payload.periodKey, window, now));
  const costs = costLedger.filter((snapshot) => isPeriodKeyWithinWindow(snapshot.payload.periodKey, window, now));
  return {
    animalesActivos: activeAnimalsInAssignments.size,
    lotesActivos: lots.filter((snapshot) => snapshot.payload.active).length,
    productividadTotal: productivity.length,
    costosTotal: costs.length,
    costoAcumulado: Number(costs.reduce((sum, snapshot) => sum + Number(snapshot.payload.amount), 0).toFixed(2)),
  };
}

function buildLotBreakdown(
  lot: OfflineSnapshotRecord & { payload: HerdLotSnapshotPayload },
  assignments: Array<OfflineSnapshotRecord & { payload: HerdLotAssignmentSnapshotPayload }>,
  productivityLedger: Array<OfflineSnapshotRecord & { payload: HerdProductivityLedgerSnapshotPayload }>,
  costLedger: Array<OfflineSnapshotRecord & { payload: HerdCostLedgerSnapshotPayload }>,
  window: ReportingWindow,
  now: string,
  lotNames: Map<string, string>
): AdminReportingLotBreakdownItem {
  const activeAnimals = new Set(assignments.filter((snapshot) => snapshot.payload.lotId === lot.entityId).map((snapshot) => snapshot.payload.animalUuid));
  const productivity = productivityLedger.filter(
    (snapshot) => snapshot.payload.lotId === lot.entityId && isPeriodKeyWithinWindow(snapshot.payload.periodKey, window, now)
  );
  const costs = costLedger.filter(
    (snapshot) => snapshot.payload.lotId === lot.entityId && isPeriodKeyWithinWindow(snapshot.payload.periodKey, window, now)
  );
  return {
    lotId: lot.entityId,
    lotName: lotNames.get(lot.entityId) ?? lot.payload.name,
    animalesActivos: activeAnimals.size,
    productividadTotal: productivity.length,
    costosTotal: costs.length,
    costoAcumulado: Number(costs.reduce((sum, snapshot) => sum + Number(snapshot.payload.amount), 0).toFixed(2)),
  };
}

function assignmentIsActive(payload: HerdLotAssignmentSnapshotPayload, now: string) {
  const today = now.slice(0, 10);
  return payload.fromDate <= today && (!payload.toDate || payload.toDate >= today);
}

function isPeriodKeyWithinWindow(periodKey: string, window: ReportingWindow, now: string) {
  if (periodKey === now.slice(0, 7)) {
    return true;
  }
  const periodDate = parseReportingDate(`${periodKey}-01T00:00:00.000Z`);
  const nowDate = parseReportingDate(now);
  if (!periodDate || !nowDate) {
    return false;
  }
  return isWithinReportingWindow(periodDate.toISOString(), window, nowDate.toISOString());
}

function dedupeByIdentity<T extends OfflineSnapshotRecord>(snapshots: T[], identityOf: (snapshot: T) => string) {
  // Deterministic V2 canonicalization: latest updatedAt wins; tie-breaker falls back to stable entity identifier.
  const canonical = new Map<string, T>();
  for (const snapshot of snapshots) {
    const key = identityOf(snapshot);
    const current = canonical.get(key);
    if (!current || compareSnapshotCanonical(snapshot, current) > 0) {
      canonical.set(key, snapshot);
    }
  }
  return [...canonical.values()];
}

function compareSnapshotCanonical(left: OfflineSnapshotRecord, right: OfflineSnapshotRecord) {
  const updatedAtComparison = left.updatedAt.localeCompare(right.updatedAt);
  if (updatedAtComparison !== 0) {
    return updatedAtComparison;
  }
  return left.entityId.localeCompare(right.entityId);
}

function toRecentActivity(
  snapshot: OfflineSnapshotRecord,
  sourceType: AdminReportingEventSourceType,
  eventType: string,
  occurredAt: string,
  animalsByUuid: Map<string, AnimalOfflineSnapshotPayload>
) {
  if (!eventType.trim() || !parseReportingDate(occurredAt)) {
    return [];
  }

  const animalUuid = String(snapshot.payload['animalUuid'] ?? '');
  if (!animalUuid) {
    return [];
  }

  return [
    {
      id: String(snapshot.payload['id'] ?? snapshot.entityId),
      sourceType,
      eventType,
      occurredAt,
      animalUuid,
      animalLabel: buildReportingAnimalLabel(animalsByUuid.get(animalUuid), animalUuid),
      title: buildReportingTitle(sourceType, eventType),
    } satisfies AdminReportingRecentActivityItem,
  ];
}

function resolveAnimalActive(value: Record<string, unknown> | AnimalOfflineSnapshotPayload | undefined) {
  return typeof value?.['active'] === 'boolean' ? (value['active'] as boolean) : null;
}

function resolveGanaderoActive(value: Record<string, unknown>) {
  return typeof value['active'] === 'boolean' ? (value['active'] as boolean) : null;
}

function resolveUserActive(value: Record<string, unknown>) {
  const status = String(value['status'] ?? '');
  if (!status) {
    return null;
  }
  return status === 'ACTIVE';
}
