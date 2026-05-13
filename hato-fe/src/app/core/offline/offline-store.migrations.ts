import {
  type ConflictAuditEntry,
  OFFLINE_OPERATION_STATUSES,
  REPORTING_PRESET_IDS,
  REPORTING_WINDOWS,
  type AdminReportingDerivedState,
  type DecisionSupportDerivedState,
  type CalendarAlertPreferences,
  type CalendarDerivedState,
  type NotificationReadState,
  type AnimalEventCategory,
  type OfflineEntityType,
  type OfflineOperationEnvelope,
  type OfflineSnapshotRecord,
  type OfflineSyncCheckpoint,
  type PersistedOfflineState,
  type ReportingPresetId,
  type ReportingWindow,
} from './offline-types';

export const CURRENT_OFFLINE_SCHEMA_VERSION = 11;

export function isOfflineSchemaVersionSupported(schemaVersion: number) {
  return Number.isInteger(schemaVersion) && schemaVersion > 0 && schemaVersion <= CURRENT_OFFLINE_SCHEMA_VERSION;
}

export const DEFAULT_CALENDAR_ALERT_PREFERENCES: CalendarAlertPreferences = {
  horizonDays: 3,
  snoozedUntil: null,
  notificationsEnabled: false,
};

export const DEFAULT_REPORTING_WINDOW: ReportingWindow = '7d';
export const DEFAULT_REPORTING_PRESET: ReportingPresetId = 'all';

export interface OfflinePersistenceAdapter {
  load(): Promise<PersistedOfflineState | undefined>;
  save(state: PersistedOfflineState): Promise<void>;
}

export interface OfflineMigrationResult {
  state: PersistedOfflineState;
  appliedMigrations: string[];
}

export class InMemoryOfflinePersistenceAdapter implements OfflinePersistenceAdapter {
  private state?: PersistedOfflineState;
  saveCount = 0;

  constructor(seed?: PersistedOfflineState) {
    this.state = seed ? cloneState(seed) : undefined;
  }

  async load() {
    return this.state ? cloneState(this.state) : undefined;
  }

  async save(state: PersistedOfflineState) {
    this.state = cloneState(state);
    this.saveCount += 1;
  }

  snapshot() {
    return cloneState(this.state ?? createEmptyOfflineState());
  }
}

export function createEmptyOfflineState(): PersistedOfflineState {
  return {
    schemaVersion: CURRENT_OFFLINE_SCHEMA_VERSION,
    outbox: [],
    inbox: [],
    snapshots: [],
    syncState: {
      checkpoints: {},
      meta: {
        appliedMigrations: [],
        calendarAlerts: createEmptyCalendarDerivedState(),
        reporting: createEmptyAdminReportingDerivedState(),
        decisionSupport: createEmptyDecisionSupportDerivedState(),
        notifications: {
          readState: createEmptyNotificationReadState(),
        },
        conflictResolution: {
          auditByOperationId: {},
        },
        sessionSecurity: createEmptySessionSecurityState(),
      },
    },
  };
}

export function createEmptySessionSecurityState() {
  return {
    fallbackStatus: 'active' as const,
    cleanupPolicy: 'soft_retention' as const,
    lastBoundaryReason: null,
    lastBoundaryAt: null,
  };
}

export function createEmptyNotificationReadState(): NotificationReadState {
  return {
    readAtById: {},
  };
}

export function createEmptyCalendarDerivedState(
  preferences: CalendarAlertPreferences = DEFAULT_CALENDAR_ALERT_PREFERENCES
): CalendarDerivedState {
  return {
    version: 1,
    preferences: { ...preferences },
    items: [],
    windows: {
      upcoming: [],
      due_today: [],
      overdue: [],
    },
    counts: {
      total: 0,
      byStatus: {
        upcoming: 0,
        due_today: 0,
        overdue: 0,
      },
    },
    lastComputedAt: null,
  };
}

export function createEmptyAdminReportingDerivedState(
  selectedWindow: ReportingWindow = DEFAULT_REPORTING_WINDOW,
  selectedPreset: ReportingPresetId = DEFAULT_REPORTING_PRESET
): AdminReportingDerivedState {
  return {
    version: 2,
    selectedWindow,
    selectedPreset,
    freshness: {
      lastSyncAt: null,
      lastComputedAt: null,
      stale: true,
    },
    aggregates: {
      usersTotal: 0,
      ganaderosTotal: 0,
      animalesTotal: 0,
      animalesActivos: 0,
      lotesTotal: 0,
      lotesActivos: 0,
      asignacionesActivas: 0,
      productividadTotal: 0,
      costosTotal: 0,
      costoAcumulado: 0,
    },
    eventsByType: {
      '7d': {},
      '30d': {},
      '90d': {},
    },
    descriptiveKpis: {
      '7d': { animalesActivos: 0, lotesActivos: 0, productividadTotal: 0, costosTotal: 0, costoAcumulado: 0 },
      '30d': { animalesActivos: 0, lotesActivos: 0, productividadTotal: 0, costosTotal: 0, costoAcumulado: 0 },
      '90d': { animalesActivos: 0, lotesActivos: 0, productividadTotal: 0, costosTotal: 0, costoAcumulado: 0 },
    },
    lotBreakdown: [],
    recentActivity: [],
    sourceSignature: {
      USER: null,
      GANADERO: null,
      ANIMAL: null,
      LOT: null,
      LOT_ASSIGNMENT: null,
      PRODUCTIVITY_LEDGER: null,
      COST_LEDGER: null,
      ANIMAL_EVENT: null,
      ANIMAL_HEALTH_EVENT: null,
      ANIMAL_REPRODUCTION_EVENT: null,
      ANIMAL_EVENT_LOG: null,
      selection: `${selectedWindow}:${selectedPreset}`,
    },
  };
}

export function createEmptyDecisionSupportDerivedState(selectedWindow: ReportingWindow = DEFAULT_REPORTING_WINDOW): DecisionSupportDerivedState {
  return {
    version: 1,
    selectedWindow,
    freshness: {
      lastSyncAt: null,
      lastComputedAt: null,
      stale: true,
    },
    insights: [],
    sourceSignature: {
      USER: null,
      GANADERO: null,
      ANIMAL: null,
      LOT: null,
      LOT_ASSIGNMENT: null,
      PRODUCTIVITY_LEDGER: null,
      COST_LEDGER: null,
      ANIMAL_EVENT: null,
      ANIMAL_HEALTH_EVENT: null,
      ANIMAL_REPRODUCTION_EVENT: null,
      ANIMAL_EVENT_LOG: null,
      selection: selectedWindow,
    },
  };
}

export function migrateOfflineState(existing?: PersistedOfflineState): OfflineMigrationResult {
  if (!existing) {
    return {
      state: createEmptyOfflineState(),
      appliedMigrations: [],
    };
  }

  const state = cloneState(existing);
  const appliedMigrations: string[] = [];

  if (state.schemaVersion < 2) {
    state.outbox = state.outbox.map((operation) => ({
      ...operation,
      status: normalizeOperationStatus(operation.status),
    }));

    state.syncState.meta = {
      appliedMigrations: ['v1-to-v2-status-normalization'],
    };
    state.schemaVersion = 2;
    appliedMigrations.push('v1-to-v2-status-normalization');
  }

  if (state.schemaVersion < 3) {
    state.syncState.meta = {
      appliedMigrations: [...(state.syncState.meta?.appliedMigrations ?? []), 'v2-to-v3-animal-image-binary-store'],
    };
    state.schemaVersion = 3;
    appliedMigrations.push('v2-to-v3-animal-image-binary-store');
  }

  if (state.schemaVersion < 4) {
    state.syncState.meta = {
      appliedMigrations: [...(state.syncState.meta?.appliedMigrations ?? []), 'v3-to-v4-calendar-alerts-derived-state'],
      calendarAlerts: normalizeCalendarDerivedState(state.syncState.meta?.calendarAlerts),
    };
    state.schemaVersion = 4;
    appliedMigrations.push('v3-to-v4-calendar-alerts-derived-state');
  }

  if (state.schemaVersion < 5) {
    state.syncState.meta = {
      appliedMigrations: [...(state.syncState.meta?.appliedMigrations ?? []), 'v4-to-v5-notification-read-state'],
      calendarAlerts: normalizeCalendarDerivedState(state.syncState.meta?.calendarAlerts),
      notifications: {
        readState: normalizeNotificationReadState(state.syncState.meta?.notifications?.readState),
      },
    };
    state.schemaVersion = 5;
    appliedMigrations.push('v4-to-v5-notification-read-state');
  }

  if (state.schemaVersion < 6) {
    state.syncState.meta = {
      appliedMigrations: [...(state.syncState.meta?.appliedMigrations ?? []), 'v5-to-v6-admin-reporting-derived-state'],
      calendarAlerts: normalizeCalendarDerivedState(state.syncState.meta?.calendarAlerts),
      reporting: normalizeAdminReportingDerivedState(state.syncState.meta?.reporting),
      notifications: {
        readState: normalizeNotificationReadState(state.syncState.meta?.notifications?.readState),
      },
    };
    state.schemaVersion = 6;
    appliedMigrations.push('v5-to-v6-admin-reporting-derived-state');
  }

  if (state.schemaVersion < 7) {
    state.syncState.meta = {
      appliedMigrations: [...(state.syncState.meta?.appliedMigrations ?? []), 'v6-to-v7-conflict-resolution-audit'],
      calendarAlerts: normalizeCalendarDerivedState(state.syncState.meta?.calendarAlerts),
      reporting: normalizeAdminReportingDerivedState(state.syncState.meta?.reporting),
      notifications: {
        readState: normalizeNotificationReadState(state.syncState.meta?.notifications?.readState),
      },
      conflictResolution: normalizeConflictResolutionState(state.syncState.meta?.conflictResolution),
    };
    state.schemaVersion = 7;
    appliedMigrations.push('v6-to-v7-conflict-resolution-audit');
  }

  if (state.schemaVersion < 8) {
    state.syncState.meta = {
      appliedMigrations: [...(state.syncState.meta?.appliedMigrations ?? []), 'v7-to-v8-session-security'],
      calendarAlerts: normalizeCalendarDerivedState(state.syncState.meta?.calendarAlerts),
      reporting: normalizeAdminReportingDerivedState(state.syncState.meta?.reporting),
      notifications: {
        readState: normalizeNotificationReadState(state.syncState.meta?.notifications?.readState),
      },
      conflictResolution: normalizeConflictResolutionState(state.syncState.meta?.conflictResolution),
      sessionSecurity: normalizeSessionSecurityState(state.syncState.meta?.sessionSecurity, 'reauth_required'),
    };
    state.schemaVersion = 8;
    appliedMigrations.push('v7-to-v8-session-security');
  }

  if (state.schemaVersion < 9) {
    state.syncState.meta = {
      appliedMigrations: [...(state.syncState.meta?.appliedMigrations ?? []), 'v8-to-v9-integral-herd-management-v2'],
      calendarAlerts: normalizeCalendarDerivedState(state.syncState.meta?.calendarAlerts),
      reporting: normalizeAdminReportingDerivedState(state.syncState.meta?.reporting),
      notifications: {
        readState: normalizeNotificationReadState(state.syncState.meta?.notifications?.readState),
      },
      conflictResolution: normalizeConflictResolutionState(state.syncState.meta?.conflictResolution),
      sessionSecurity: normalizeSessionSecurityState(state.syncState.meta?.sessionSecurity),
    };
    state.schemaVersion = 9;
    appliedMigrations.push('v8-to-v9-integral-herd-management-v2');
  }

  if (state.schemaVersion < 10) {
    state.syncState.meta = {
      appliedMigrations: [...(state.syncState.meta?.appliedMigrations ?? []), 'v9-to-v10-decision-support-derived-state'],
      calendarAlerts: normalizeCalendarDerivedState(state.syncState.meta?.calendarAlerts),
      reporting: normalizeAdminReportingDerivedState(state.syncState.meta?.reporting),
      decisionSupport: normalizeDecisionSupportDerivedState(state.syncState.meta?.decisionSupport),
      notifications: {
        readState: normalizeNotificationReadState(state.syncState.meta?.notifications?.readState),
      },
      conflictResolution: normalizeConflictResolutionState(state.syncState.meta?.conflictResolution),
      sessionSecurity: normalizeSessionSecurityState(state.syncState.meta?.sessionSecurity),
    };
    state.schemaVersion = 10;
    appliedMigrations.push('v9-to-v10-decision-support-derived-state');
  }

  if (state.schemaVersion < 11) {
    migrateLegacyAnimalEventsToUnifiedLog(state);
    state.syncState.meta = {
      appliedMigrations: [...(state.syncState.meta?.appliedMigrations ?? []), 'v10-to-v11-animal-event-log-consolidation'],
      calendarAlerts: normalizeCalendarDerivedState(state.syncState.meta?.calendarAlerts),
      reporting: normalizeAdminReportingDerivedState(state.syncState.meta?.reporting),
      decisionSupport: normalizeDecisionSupportDerivedState(state.syncState.meta?.decisionSupport),
      notifications: {
        readState: normalizeNotificationReadState(state.syncState.meta?.notifications?.readState),
      },
      conflictResolution: normalizeConflictResolutionState(state.syncState.meta?.conflictResolution),
      sessionSecurity: normalizeSessionSecurityState(state.syncState.meta?.sessionSecurity),
    };
    state.schemaVersion = 11;
    appliedMigrations.push('v10-to-v11-animal-event-log-consolidation');
  }

  state.schemaVersion = CURRENT_OFFLINE_SCHEMA_VERSION;
  state.syncState.checkpoints ??= {};
  state.syncState.meta = {
    appliedMigrations: state.syncState.meta?.appliedMigrations ?? [],
    calendarAlerts: normalizeCalendarDerivedState(state.syncState.meta?.calendarAlerts),
    reporting: normalizeAdminReportingDerivedState(state.syncState.meta?.reporting),
    decisionSupport: normalizeDecisionSupportDerivedState(state.syncState.meta?.decisionSupport),
    notifications: {
      readState: normalizeNotificationReadState(state.syncState.meta?.notifications?.readState),
    },
    conflictResolution: normalizeConflictResolutionState(state.syncState.meta?.conflictResolution),
    sessionSecurity: normalizeSessionSecurityState(state.syncState.meta?.sessionSecurity),
  };

  return {
    state,
    appliedMigrations,
  };
}

function migrateLegacyAnimalEventsToUnifiedLog(state: PersistedOfflineState) {
  state.outbox = state.outbox.map((operation) => {
    const category = legacyEventCategory(operation.entityType);
    if (!category) {
      return operation;
    }

    return {
      ...operation,
      entityType: 'ANIMAL_EVENT_LOG',
      payload: toAnimalEventLogPayload(operation.payload, operation.entityType, operation.entityId ?? operation.operationId, operation.operationId),
    };
  });

  state.inbox = state.inbox.map((entry) => {
    const category = legacyEventCategory(entry.entityType);
    if (!category) {
      return entry;
    }

    const entityId = entry.entityId;
    return {
      ...entry,
      key: `ANIMAL_EVENT_LOG:${entityId}`,
      entityType: 'ANIMAL_EVENT_LOG',
      payload: toAnimalEventLogPayload(entry.payload, entry.entityType, entityId, readOperationId(entry.payload, entityId)),
    };
  });

  state.snapshots = state.snapshots.map((snapshot) => {
    const category = legacyEventCategory(snapshot.entityType);
    if (!category) {
      return snapshot;
    }

    const entityId = snapshot.entityId;
    return {
      ...snapshot,
      key: `ANIMAL_EVENT_LOG:${entityId}`,
      entityType: 'ANIMAL_EVENT_LOG',
      payload: toAnimalEventLogPayload(snapshot.payload, snapshot.entityType, entityId, readOperationId(snapshot.payload, entityId)),
    } satisfies OfflineSnapshotRecord;
  });

  const unifiedCheckpoint = latestLegacyEventCheckpoint(state.syncState.checkpoints);
  if (unifiedCheckpoint) {
    state.syncState.checkpoints['ANIMAL_EVENT_LOG'] = unifiedCheckpoint;
  }
  delete state.syncState.checkpoints.ANIMAL_EVENT;
  delete state.syncState.checkpoints.ANIMAL_HEALTH_EVENT;
  delete state.syncState.checkpoints.ANIMAL_REPRODUCTION_EVENT;
}

function toAnimalEventLogPayload(
  payload: Record<string, unknown>,
  entityType: OfflineEntityType,
  fallbackId: string,
  fallbackOperationId: string
) {
  const category = legacyEventCategory(entityType);
  if (!category) {
    return { ...payload };
  }

  const id = String(payload['id'] ?? payload['uuid'] ?? fallbackId);
  const eventType = readEventType(payload, category);

  return {
    ...payload,
    id,
    animalUuid: String(payload['animalUuid'] ?? ''),
    eventCategory: category,
    eventType,
    type: category === 'GENERAL' ? eventType : payload['type'],
    healthEventType: category === 'HEALTH' ? eventType : payload['healthEventType'],
    reproductionEventType: category === 'REPRODUCTION' ? eventType : payload['reproductionEventType'],
    occurredAt: String(payload['occurredAt'] ?? payload['createdAt'] ?? ''),
    performedByUserId: String(payload['performedByUserId'] ?? ''),
    sourceChannel: payload['sourceChannel'] === 'ONLINE' ? 'ONLINE' : 'OFFLINE',
    operationId: readOperationId(payload, fallbackOperationId),
    metadata: isRecord(payload['metadata']) ? { ...payload['metadata'] } : {},
    createdAt: String(payload['createdAt'] ?? payload['occurredAt'] ?? ''),
    updatedAt: String(payload['updatedAt'] ?? payload['createdAt'] ?? payload['occurredAt'] ?? ''),
  };
}

function legacyEventCategory(entityType: OfflineEntityType): AnimalEventCategory | null {
  if (entityType === 'ANIMAL_EVENT') return 'GENERAL';
  if (entityType === 'ANIMAL_HEALTH_EVENT') return 'HEALTH';
  if (entityType === 'ANIMAL_REPRODUCTION_EVENT') return 'REPRODUCTION';
  return null;
}

function readEventType(payload: Record<string, unknown>, category: AnimalEventCategory) {
  const key = category === 'GENERAL' ? 'type' : category === 'HEALTH' ? 'healthEventType' : 'reproductionEventType';
  return String(payload['eventType'] ?? payload[key] ?? '');
}

function readOperationId(payload: Record<string, unknown>, fallback: string) {
  return String(payload['operationId'] ?? fallback);
}

function latestLegacyEventCheckpoint(checkpoints: PersistedOfflineState['syncState']['checkpoints']): OfflineSyncCheckpoint | null {
  const legacy = [checkpoints.ANIMAL_EVENT, checkpoints.ANIMAL_HEALTH_EVENT, checkpoints.ANIMAL_REPRODUCTION_EVENT]
    .filter((checkpoint): checkpoint is OfflineSyncCheckpoint => Boolean(checkpoint))
    .sort((left, right) => right.cursorUpdatedAt.localeCompare(left.cursorUpdatedAt) || right.cursorId.localeCompare(left.cursorId));

  const latest = legacy[0];
  if (!latest) {
    return null;
  }

  return {
    entityType: 'ANIMAL_EVENT_LOG',
    cursorId: latest.cursorId,
    cursorUpdatedAt: latest.cursorUpdatedAt,
    lastSuccessAt: latest.lastSuccessAt,
    lastSyncedEventId: latest.cursorId,
    lastSyncedAt: latest.lastSuccessAt,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function normalizeOperationStatus(status: string): OfflineOperationEnvelope['status'] {
  const normalized = status.toLowerCase();
  return OFFLINE_OPERATION_STATUSES.includes(normalized as OfflineOperationEnvelope['status'])
    ? (normalized as OfflineOperationEnvelope['status'])
    : 'pending';
}

function normalizeConflictResolutionState(
  value: { auditByOperationId?: Record<string, ConflictAuditEntry[]> } | undefined
): { auditByOperationId: Record<string, ConflictAuditEntry[]> } {
  return {
    auditByOperationId: Object.fromEntries(
      Object.entries(value?.auditByOperationId ?? {}).map(([operationId, entries]) => [
        operationId,
        Array.isArray(entries) ? entries.map((entry) => ({ ...entry })) : [],
      ])
    ),
  };
}

function normalizeSessionSecurityState(
  value:
    | {
        fallbackStatus?: 'active' | 'reauth_required' | 'expired';
        cleanupPolicy?: 'soft_retention' | 'shared_device_hard';
        lastBoundaryReason?: 'ttl_elapsed' | 'logout' | 'user_switch' | 'manual_lock' | 'migration_reauth_required' | null;
        lastBoundaryAt?: string | null;
      }
    | undefined,
  fallbackStatus: 'active' | 'reauth_required' | 'expired' = 'active'
) {
  return {
    fallbackStatus: value?.fallbackStatus ?? fallbackStatus,
    cleanupPolicy: value?.cleanupPolicy ?? 'soft_retention',
    lastBoundaryReason: value?.lastBoundaryReason ?? null,
    lastBoundaryAt: value?.lastBoundaryAt ?? null,
  };
}

function cloneState(state: PersistedOfflineState): PersistedOfflineState {
  return JSON.parse(JSON.stringify(state)) as PersistedOfflineState;
}

function normalizeCalendarDerivedState(value: CalendarDerivedState | undefined): CalendarDerivedState {
  const preferences = {
    ...DEFAULT_CALENDAR_ALERT_PREFERENCES,
    ...(value?.preferences ?? {}),
  } satisfies CalendarAlertPreferences;

  const items = Array.isArray(value?.items) ? value.items : [];
  const windows = value?.windows;
  const counts = value?.counts;

  return {
    version: 1,
    preferences,
    items,
    windows: {
      upcoming: Array.isArray(windows?.upcoming) ? windows.upcoming : [],
      due_today: Array.isArray(windows?.due_today) ? windows.due_today : [],
      overdue: Array.isArray(windows?.overdue) ? windows.overdue : [],
    },
    counts: {
      total: typeof counts?.total === 'number' ? counts.total : 0,
      byStatus: {
        upcoming: typeof counts?.byStatus?.upcoming === 'number' ? counts.byStatus.upcoming : 0,
        due_today: typeof counts?.byStatus?.due_today === 'number' ? counts.byStatus.due_today : 0,
        overdue: typeof counts?.byStatus?.overdue === 'number' ? counts.byStatus.overdue : 0,
      },
    },
    lastComputedAt: typeof value?.lastComputedAt === 'string' ? value.lastComputedAt : null,
  };
}

function normalizeNotificationReadState(value: NotificationReadState | undefined): NotificationReadState {
  return {
    readAtById: { ...(value?.readAtById ?? {}) },
  };
}

function normalizeAdminReportingDerivedState(value: AdminReportingDerivedState | undefined): AdminReportingDerivedState {
  const selectedWindow = REPORTING_WINDOWS.includes(value?.selectedWindow as ReportingWindow)
    ? (value?.selectedWindow as ReportingWindow)
    : DEFAULT_REPORTING_WINDOW;
  const selectedPreset = REPORTING_PRESET_IDS.includes(value?.selectedPreset as ReportingPresetId)
    ? (value?.selectedPreset as ReportingPresetId)
    : DEFAULT_REPORTING_PRESET;
  const base = createEmptyAdminReportingDerivedState(selectedWindow, selectedPreset);

  return {
    version: 2,
    selectedWindow,
    selectedPreset,
    freshness: {
      lastSyncAt: typeof value?.freshness?.lastSyncAt === 'string' ? value.freshness.lastSyncAt : null,
      lastComputedAt: typeof value?.freshness?.lastComputedAt === 'string' ? value.freshness.lastComputedAt : null,
      stale: typeof value?.freshness?.stale === 'boolean' ? value.freshness.stale : true,
    },
    aggregates: {
      usersTotal: typeof value?.aggregates?.usersTotal === 'number' ? value.aggregates.usersTotal : 0,
      ganaderosTotal: typeof value?.aggregates?.ganaderosTotal === 'number' ? value.aggregates.ganaderosTotal : 0,
      animalesTotal: typeof value?.aggregates?.animalesTotal === 'number' ? value.aggregates.animalesTotal : 0,
      animalesActivos: typeof value?.aggregates?.animalesActivos === 'number' ? value.aggregates.animalesActivos : 0,
      lotesTotal: typeof value?.aggregates?.lotesTotal === 'number' ? value.aggregates.lotesTotal : 0,
      lotesActivos: typeof value?.aggregates?.lotesActivos === 'number' ? value.aggregates.lotesActivos : 0,
      asignacionesActivas: typeof value?.aggregates?.asignacionesActivas === 'number' ? value.aggregates.asignacionesActivas : 0,
      productividadTotal: typeof value?.aggregates?.productividadTotal === 'number' ? value.aggregates.productividadTotal : 0,
      costosTotal: typeof value?.aggregates?.costosTotal === 'number' ? value.aggregates.costosTotal : 0,
      costoAcumulado: typeof value?.aggregates?.costoAcumulado === 'number' ? value.aggregates.costoAcumulado : 0,
    },
    eventsByType: {
      '7d': normalizeEventsByTypeWindow(value?.eventsByType?.['7d']),
      '30d': normalizeEventsByTypeWindow(value?.eventsByType?.['30d']),
      '90d': normalizeEventsByTypeWindow(value?.eventsByType?.['90d']),
    },
    descriptiveKpis: {
      '7d': normalizeReportingKpiWindow(value?.descriptiveKpis?.['7d']),
      '30d': normalizeReportingKpiWindow(value?.descriptiveKpis?.['30d']),
      '90d': normalizeReportingKpiWindow(value?.descriptiveKpis?.['90d']),
    },
    lotBreakdown: Array.isArray(value?.lotBreakdown) ? value.lotBreakdown : [],
    recentActivity: Array.isArray(value?.recentActivity) ? value.recentActivity : [],
    sourceSignature: {
      ...base.sourceSignature,
      ...(value?.sourceSignature ?? {}),
      selection: `${selectedWindow}:${selectedPreset}`,
    },
  };
}

function normalizeDecisionSupportDerivedState(value: DecisionSupportDerivedState | undefined): DecisionSupportDerivedState {
  const selectedWindow = REPORTING_WINDOWS.includes(value?.selectedWindow as ReportingWindow)
    ? (value?.selectedWindow as ReportingWindow)
    : DEFAULT_REPORTING_WINDOW;
  const base = createEmptyDecisionSupportDerivedState(selectedWindow);

  return {
    version: 1,
    selectedWindow,
    freshness: {
      lastSyncAt: typeof value?.freshness?.lastSyncAt === 'string' ? value.freshness.lastSyncAt : null,
      lastComputedAt: typeof value?.freshness?.lastComputedAt === 'string' ? value.freshness.lastComputedAt : null,
      stale: typeof value?.freshness?.stale === 'boolean' ? value.freshness.stale : true,
    },
    insights: Array.isArray(value?.insights) ? value.insights.map((insight) => ({ ...insight, why: { ...insight.why }, manualActions: [...insight.manualActions] })) : [],
    sourceSignature: {
      ...base.sourceSignature,
      ...(value?.sourceSignature ?? {}),
      selection: selectedWindow,
    },
  };
}

function normalizeEventsByTypeWindow(value: Record<string, number> | undefined) {
  return Object.fromEntries(
    Object.entries(value ?? {}).filter((entry): entry is [string, number] => typeof entry[0] === 'string' && typeof entry[1] === 'number')
  );
}

function normalizeReportingKpiWindow(
  value:
    | {
        animalesActivos?: number;
        lotesActivos?: number;
        productividadTotal?: number;
        costosTotal?: number;
        costoAcumulado?: number;
      }
    | undefined
) {
  return {
    animalesActivos: typeof value?.animalesActivos === 'number' ? value.animalesActivos : 0,
    lotesActivos: typeof value?.lotesActivos === 'number' ? value.lotesActivos : 0,
    productividadTotal: typeof value?.productividadTotal === 'number' ? value.productividadTotal : 0,
    costosTotal: typeof value?.costosTotal === 'number' ? value.costosTotal : 0,
    costoAcumulado: typeof value?.costoAcumulado === 'number' ? value.costoAcumulado : 0,
  };
}
