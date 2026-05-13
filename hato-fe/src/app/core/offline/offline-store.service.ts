import {
  CURRENT_OFFLINE_SCHEMA_VERSION,
  createEmptyAdminReportingDerivedState,
  createEmptyDecisionSupportDerivedState,
  createEmptyCalendarDerivedState,
  createEmptyNotificationReadState,
  createEmptyOfflineState,
  migrateOfflineState,
  normalizeOperationStatus,
  type OfflinePersistenceAdapter,
} from './offline-store.migrations';
import {
  type AdminReportingDerivedState,
  type DecisionSupportDerivedState,
  type ConflictAuditEntry,
  type OfflineEntityType,
  type EnqueueOfflineOperationInput,
  type CalendarDerivedState,
  type HerdCostLedgerSnapshotPayload,
  type HerdLotAssignmentSnapshotPayload,
  type HerdLotSnapshotPayload,
  type HerdProductivityLedgerSnapshotPayload,
  type OfflineFailureDescriptor,
  type OfflineInboxEntry,
  type OfflineOperationEnvelope,
  type OfflineSnapshotRecord,
  type OfflineSyncCheckpoint,
  type NotificationReadState,
  type PersistedOfflineState,
  type SyncEntityHealthSummary,
  type SyncIssueSummary,
  type SyncQueueStatus,
  SYNC_QUEUE_STATUSES,
} from './offline-types';
import { SYNC_OBSERVABILITY_RECENT_LIMIT, SYNC_OBSERVABILITY_STALE_DEFAULT_MS } from './sync-metrics.store';

const OUTBOX_STORE = 'outbox';
const INBOX_STORE = 'inbox';
const SNAPSHOTS_STORE = 'snapshots';
const SYNC_STATE_STORE = 'sync_state';
const OFFLINE_DATABASE_NAME = 'hato-offline';
const OFFLINE_DATABASE_VERSION = 1;
const META_KEY = 'meta';
const NOTIFICATION_RETENTION_LIMIT = 200;

export interface OfflineStoreOptions {
  generateId?: () => string;
  now?: () => string;
}

export type SessionBoundaryCleanupPolicy = 'soft_retention' | 'shared_device_hard';
export type SessionBoundaryReason = 'ttl_elapsed' | 'logout' | 'user_switch' | 'manual_lock' | 'migration_reauth_required';

export class OfflineStoreService {
  private cachedState?: PersistedOfflineState;

  constructor(
    private readonly adapter: OfflinePersistenceAdapter = new IndexedDbOfflinePersistenceAdapter(),
    private readonly options: OfflineStoreOptions = {}
  ) {}

  async enqueueOperation(input: EnqueueOfflineOperationInput): Promise<OfflineOperationEnvelope> {
    const state = await this.getState();
    const operation: OfflineOperationEnvelope = {
      operationId:
        input.operationId ?? this.options.generateId?.() ?? globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`,
      entityType: input.entityType,
      entityId: input.entityId,
      opType: input.opType,
      payload: input.payload,
      baseVersion: input.baseVersion,
      clientCreatedAt: input.clientCreatedAt,
      clientUpdatedAt: input.clientUpdatedAt,
      status: 'pending',
      attempts: 0,
    };

    state.outbox.push(operation);
    await this.persistState(state);
    return operation;
  }

  async listOutbox(): Promise<OfflineOperationEnvelope[]> {
    const state = await this.getState();
    return state.outbox.map((operation) => ({
      ...operation,
      status: normalizeOperationStatus(operation.status),
    }));
  }

  async markInFlight(operationId: string) {
    const state = await this.getState();
    const operation = this.requireOperation(state, operationId);
    operation.status = 'in_flight';
    operation.attempts += 1;
    await this.persistState(state);
    return { ...operation };
  }

  async markAcked(operationId: string) {
    const state = await this.getState();
    const operation = this.requireOperation(state, operationId);
    operation.status = 'acked';
    operation.nextAttemptAt = undefined;
    operation.lastErrorCode = undefined;
    operation.lastErrorMessage = undefined;
    operation.conflict = undefined;
    await this.persistState(state);
  }

  async reassignOperationEntityId(operationId: string, entityId: string) {
    const state = await this.getState();
    const operation = this.requireOperation(state, operationId);
    operation.entityId = entityId;
    await this.persistState(state);
    return { ...operation };
  }

  async reassignSnapshotEntityId(
    entityType: OfflineSnapshotRecord['entityType'],
    currentEntityId: string,
    nextEntityId: string
  ) {
    const state = await this.getState();
    const currentKey = `${entityType}:${currentEntityId}`;
    const snapshot = state.snapshots.find((current) => current.key === currentKey);

    if (!snapshot) {
      return null;
    }

    const nextKey = `${entityType}:${nextEntityId}`;
    const payload =
      typeof snapshot.payload['id'] === 'string'
        ? {
            ...snapshot.payload,
            id: nextEntityId,
          }
        : { ...snapshot.payload };

    state.snapshots = [
      ...state.snapshots.filter((current) => current.key !== currentKey && current.key !== nextKey),
      {
        ...snapshot,
        key: nextKey,
        entityId: nextEntityId,
        payload,
      },
    ];
    state.inbox = state.inbox.filter((entry) => entry.key !== currentKey && entry.key !== nextKey);
    await this.persistState(state);

    return {
      ...snapshot,
      key: nextKey,
      entityId: nextEntityId,
      payload,
    };
  }

  async markRetryScheduled(operationId: string, failure: OfflineFailureDescriptor, nextAttemptAt: string) {
    const state = await this.getState();
    const operation = this.requireOperation(state, operationId);
    operation.status = 'retry_scheduled';
    operation.nextAttemptAt = nextAttemptAt;
    operation.lastErrorCode = failure.code;
    operation.lastErrorMessage = failure.message;
    await this.persistState(state);
  }

  async markFailed(operationId: string, failure: OfflineFailureDescriptor) {
    const state = await this.getState();
    const operation = this.requireOperation(state, operationId);
    operation.status = 'failed';
    operation.nextAttemptAt = undefined;
    operation.lastErrorCode = failure.code;
    operation.lastErrorMessage = failure.message;
    await this.persistState(state);
  }

  async markConflict(operationId: string, failure: OfflineFailureDescriptor, conflict: OfflineOperationEnvelope['conflict']) {
    const state = await this.getState();
    const operation = this.requireOperation(state, operationId);
    operation.status = 'conflict';
    operation.nextAttemptAt = undefined;
    operation.lastErrorCode = failure.code;
    operation.lastErrorMessage = failure.message;
    operation.conflict = conflict;
    await this.persistState(state);
  }

  async markPending(operationId: string) {
    const state = await this.getState();
    const operation = this.requireOperation(state, operationId);
    operation.status = 'pending';
    operation.nextAttemptAt = undefined;
    operation.lastErrorCode = undefined;
    operation.lastErrorMessage = undefined;
    operation.conflict = undefined;
    await this.persistState(state);
  }

  async getOperation(operationId: string) {
    const state = await this.getState();
    const operation = state.outbox.find((current) => current.operationId === operationId);
    return operation ? { ...operation } : null;
  }

  async listConflictOperations() {
    const state = await this.getState();
    return state.outbox.filter((operation) => normalizeOperationStatus(operation.status) === 'conflict').map((operation) => ({ ...operation }));
  }

  async saveConflictAudit(operationId: string, entry: ConflictAuditEntry) {
    const state = await this.getState();
    const meta = this.ensureMetaState(state);
    meta.conflictResolution ??= { auditByOperationId: {} };
    const currentEntries = meta.conflictResolution.auditByOperationId[operationId] ?? [];
    meta.conflictResolution.auditByOperationId[operationId] = [...currentEntries, { ...entry }];
    await this.persistState(state);
    return meta.conflictResolution.auditByOperationId[operationId];
  }

  async listConflictAudit(operationId: string) {
    const state = await this.getState();
    return [...(state.syncState.meta?.conflictResolution?.auditByOperationId[operationId] ?? [])];
  }

  async replaceSnapshotFromServer(
    entityType: OfflineSnapshotRecord['entityType'],
    serverState: Record<string, unknown>,
    fallbackEntityId: string,
    serverVersion?: number
  ) {
    const entityId = String(serverState['uuid'] ?? serverState['id'] ?? fallbackEntityId);
    const key = `${entityType}:${entityId}`;
    await this.saveSnapshot({
      key,
      entityType,
      entityId,
      payload: { ...serverState },
      updatedAt: String(serverState['updatedAt'] ?? this.options.now?.() ?? new Date().toISOString()),
      version: typeof serverState['version'] === 'number' ? (serverState['version'] as number) : serverVersion,
    });
  }

  async markDeadLetter(operationId: string, failure: OfflineFailureDescriptor) {
    const state = await this.getState();
    const operation = this.requireOperation(state, operationId);
    operation.status = 'dead_letter';
    operation.lastErrorCode = failure.code;
    operation.lastErrorMessage = failure.message;
    await this.persistState(state);
  }

  async saveCheckpoint(checkpoint: OfflineSyncCheckpoint) {
    const state = await this.getState();
    state.syncState.checkpoints[checkpoint.entityType] = normalizeCheckpointAliases(checkpoint);
    await this.persistState(state);
  }

  async getCheckpoint(entityType: OfflineSyncCheckpoint['entityType']) {
    const state = await this.getState();
    return state.syncState.checkpoints[entityType] ?? null;
  }

  async saveInboxEntry(entry: OfflineInboxEntry) {
    const state = await this.getState();
    state.inbox = [...state.inbox.filter((current) => current.key !== entry.key), entry];
    await this.persistState(state);
  }

  async listInbox() {
    const state = await this.getState();
    return [...state.inbox];
  }

  async saveSnapshot(snapshot: OfflineSnapshotRecord) {
    const state = await this.getState();
    state.snapshots = [...state.snapshots.filter((current) => current.key !== snapshot.key), snapshot];
    await this.persistState(state);
  }

  async listSnapshots(entityType?: OfflineSnapshotRecord['entityType']) {
    const state = await this.getState();
    return entityType ? state.snapshots.filter((snapshot) => snapshot.entityType === entityType) : [...state.snapshots];
  }

  async getSnapshot(entityType: OfflineSnapshotRecord['entityType'], entityId: string) {
    const state = await this.getState();
    return state.snapshots.find((snapshot) => snapshot.entityType === entityType && snapshot.entityId === entityId) ?? null;
  }

  async listLots(): Promise<Array<OfflineSnapshotRecord & { payload: HerdLotSnapshotPayload }>> {
    return (await this.listSnapshots('LOT')) as Array<OfflineSnapshotRecord & { payload: HerdLotSnapshotPayload }>;
  }

  async listLotAssignmentsForAnimal(animalUuid: string): Promise<Array<OfflineSnapshotRecord & { payload: HerdLotAssignmentSnapshotPayload }>> {
    const snapshots = (await this.listSnapshots('LOT_ASSIGNMENT')) as Array<OfflineSnapshotRecord & {
      payload: HerdLotAssignmentSnapshotPayload;
    }>;
    return snapshots.filter((snapshot) => snapshot.payload.animalUuid === animalUuid);
  }

  async listProductivityLedger(): Promise<Array<OfflineSnapshotRecord & { payload: HerdProductivityLedgerSnapshotPayload }>> {
    return (await this.listSnapshots('PRODUCTIVITY_LEDGER')) as Array<OfflineSnapshotRecord & {
      payload: HerdProductivityLedgerSnapshotPayload;
    }>;
  }

  async listCostLedger(): Promise<Array<OfflineSnapshotRecord & { payload: HerdCostLedgerSnapshotPayload }>> {
    return (await this.listSnapshots('COST_LEDGER')) as Array<OfflineSnapshotRecord & { payload: HerdCostLedgerSnapshotPayload }>;
  }

  async validateLotAssignmentNoOverlap(candidate: HerdLotAssignmentSnapshotPayload, excludedId?: string) {
    const snapshots = (await this.listSnapshots('LOT_ASSIGNMENT')) as Array<OfflineSnapshotRecord & {
      payload: HerdLotAssignmentSnapshotPayload;
    }>;
    return !snapshots
      .filter((snapshot) => snapshot.entityId !== excludedId)
      .filter((snapshot) => snapshot.payload.animalUuid === candidate.animalUuid)
      .some((snapshot) => rangesOverlap(candidate.fromDate, candidate.toDate ?? null, snapshot.payload.fromDate, snapshot.payload.toDate ?? null));
  }

  async replaceCanonicalLedgerSnapshot(entityType: 'PRODUCTIVITY_LEDGER' | 'COST_LEDGER', snapshot: OfflineSnapshotRecord) {
    const state = await this.getState();
    const identityKey = String(snapshot.payload['identityKey'] ?? '');
    state.snapshots = state.snapshots.filter(
      (current) => current.entityType !== entityType || String(current.payload['identityKey'] ?? '') !== identityKey || current.key === snapshot.key
    );
    state.snapshots = [...state.snapshots.filter((current) => current.key !== snapshot.key), snapshot];
    await this.persistState(state);
    return snapshot;
  }

  async deleteSnapshot(entityType: OfflineSnapshotRecord['entityType'], entityId: string) {
    const state = await this.getState();
    const key = `${entityType}:${entityId}`;
    state.snapshots = state.snapshots.filter((snapshot) => snapshot.key !== key);
    state.inbox = state.inbox.filter((entry) => entry.key !== key);
    await this.persistState(state);
  }

  async listEligibleOperations(now: string) {
    const state = await this.getState();
    return state.outbox
      .filter((operation) => {
        const status = normalizeOperationStatus(operation.status);
        if (status === 'pending') {
          return true;
        }

        return status === 'retry_scheduled' && (!operation.nextAttemptAt || operation.nextAttemptAt <= now);
      })
      .map((operation) => ({
        ...operation,
        status: normalizeOperationStatus(operation.status),
      }));
  }

  async countPendingOperations() {
    const state = await this.getState();
    return state.outbox.filter((operation) => {
      const status = normalizeOperationStatus(operation.status);
      return status === 'pending' || status === 'retry_scheduled' || status === 'in_flight';
    }).length;
  }

  async summarizeOutboxByStatusAndEntity() {
    const operations = await this.listOutbox();
    const totalByStatus = createQueueSummaryMap();
    const byEntity = {} as Record<OfflineEntityType, Record<SyncQueueStatus, number>>;

    for (const operation of operations) {
      if (!SYNC_QUEUE_STATUSES.includes(operation.status as SyncQueueStatus)) {
        continue;
      }

      const status = operation.status as SyncQueueStatus;
      totalByStatus[status] += 1;
      byEntity[operation.entityType] ??= createQueueSummaryMap();
      byEntity[operation.entityType][status] += 1;
    }

    return { totalByStatus, byEntity };
  }

  async summarizeErrors(limit = SYNC_OBSERVABILITY_RECENT_LIMIT): Promise<SyncIssueSummary[]> {
    const operations = await this.listOutbox();
    const grouped = new Map<string, SyncIssueSummary>();

    for (const operation of operations) {
      if (!operation.lastErrorCode || !operation.lastErrorMessage) {
        continue;
      }

      if (!['failed', 'dead_letter', 'conflict', 'retry_scheduled'].includes(operation.status)) {
        continue;
      }

      const key = `${operation.lastErrorCode}:${operation.lastErrorMessage}:${operation.entityType}:${operation.status}`;
      const current = grouped.get(key) ?? {
        code: operation.lastErrorCode,
        reason: operation.lastErrorMessage,
        count: 0,
        entityType: operation.entityType,
        status: operation.status as SyncIssueSummary['status'],
        lastOccurredAt: null,
        operationIds: [],
      };

      current.count += 1;
      current.lastOccurredAt = maxIsoDate(current.lastOccurredAt, operation.clientUpdatedAt);
      current.operationIds = [...current.operationIds, operation.operationId];
      grouped.set(key, current);
    }

    return [...grouped.values()]
      .sort((left, right) => right.count - left.count || (right.lastOccurredAt ?? '').localeCompare(left.lastOccurredAt ?? ''))
      .slice(0, limit);
  }

  async listCheckpointHealth(
    now: string,
    staleOverride?: Partial<Record<OfflineEntityType, number>>
  ): Promise<Record<OfflineEntityType, SyncEntityHealthSummary>> {
    const state = await this.getState();
    const thresholds = staleOverride ?? {};
    const result = {} as Record<OfflineEntityType, SyncEntityHealthSummary>;

    for (const [entityType, checkpoint] of Object.entries(state.syncState.checkpoints) as Array<
      [OfflineEntityType, OfflineSyncCheckpoint | undefined]
    >) {
      const lastSuccessAt = checkpoint?.lastSuccessAt ?? null;
      const cursorUpdatedAt = checkpoint?.cursorUpdatedAt ?? null;
      const baseline = lastSuccessAt ?? cursorUpdatedAt;
      const stalenessMs = baseline ? Math.max(Date.parse(now) - Date.parse(baseline), 0) : null;
      const thresholdMs = thresholds[entityType] ?? SYNC_OBSERVABILITY_STALE_DEFAULT_MS;

      result[entityType] = {
        cursorUpdatedAt,
        lastSuccessAt,
        stalenessMs,
        stale: stalenessMs == null || stalenessMs > thresholdMs,
      };
    }

    return result;
  }

  async applyPullResponse(
    entityType: OfflineSnapshotRecord['entityType'],
    items: Array<Record<string, unknown>>,
    checkpoint: OfflineSyncCheckpoint
  ) {
    const state = await this.getState();

    items.forEach((item) => {
      const entityId = String(item['uuid'] ?? item['id'] ?? '');
      if (!entityId) {
        return;
      }

      const key = `${entityType}:${entityId}`;
      const payload = { ...item };
      const updatedAt = String(item['updatedAt'] ?? checkpoint.cursorUpdatedAt);
      const version = typeof item['version'] === 'number' ? item['version'] : undefined;

      state.inbox = [...state.inbox.filter((current) => current.key !== key), {
        key,
        entityType,
        entityId,
        payload,
        receivedAt: checkpoint.lastSuccessAt,
      }];
      state.snapshots = [...state.snapshots.filter((current) => current.key !== key), {
        key,
        entityType,
        entityId,
        payload,
        updatedAt,
        version,
      }];
    });

    state.syncState.checkpoints[entityType] = normalizeCheckpointAliases(checkpoint);
    if (entityType === 'NOTIFICATION') {
      this.trimNotificationRetention(state);
    }
    await this.persistState(state);
  }

  async getSchemaVersion() {
    const state = await this.getState();
    return state.schemaVersion;
  }

  async getStateSnapshotForBackup(options: { excludeSessionSecurity?: boolean } = {}) {
    const state = cloneOfflineState(await this.getState());
    if (options.excludeSessionSecurity !== false) {
      delete state.syncState.meta?.sessionSecurity;
    }
    return state;
  }

  async restoreFromBackupTx(nextState: PersistedOfflineState) {
    const currentState = await this.getState();
    const preservedSessionSecurity = currentState.syncState.meta?.sessionSecurity
      ? { ...currentState.syncState.meta.sessionSecurity }
      : undefined;
    const migrated = migrateOfflineState(cloneOfflineState(nextState)).state;

    if (preservedSessionSecurity) {
      migrated.syncState.meta ??= { appliedMigrations: [] };
      migrated.syncState.meta.sessionSecurity = preservedSessionSecurity;
    }

    await this.persistState(migrated);
    return this.getStateSnapshotForBackup({ excludeSessionSecurity: false });
  }

  async getCalendarAlertsState(): Promise<CalendarDerivedState | null> {
    const state = await this.getState();
    return state.syncState.meta?.calendarAlerts ?? null;
  }

  async getAdminReportingState(): Promise<AdminReportingDerivedState | null> {
    const state = await this.getState();
    return state.syncState.meta?.reporting ?? null;
  }

  async getDecisionSupportState(): Promise<DecisionSupportDerivedState | null> {
    const state = await this.getState();
    return state.syncState.meta?.decisionSupport ?? null;
  }

  async setCalendarAlertsState(calendarAlerts: CalendarDerivedState) {
    const state = await this.getState();
    this.ensureMetaState(state).calendarAlerts = calendarAlerts;
    await this.persistState(state);
    return calendarAlerts;
  }

  async setAdminReportingState(reporting: AdminReportingDerivedState) {
    const state = await this.getState();
    this.ensureMetaState(state).reporting = reporting;
    await this.persistState(state);
    return reporting;
  }

  async setDecisionSupportState(decisionSupport: DecisionSupportDerivedState) {
    const state = await this.getState();
    this.ensureMetaState(state).decisionSupport = decisionSupport;
    await this.persistState(state);
    return decisionSupport;
  }

  async getNotificationReadState(): Promise<NotificationReadState> {
    const state = await this.getState();
    return state.syncState.meta?.notifications?.readState ?? createEmptyNotificationReadState();
  }

  async setNotificationReadState(readState: NotificationReadState) {
    const state = await this.getState();
    this.ensureMetaState(state).notifications = {
      readState: {
        readAtById: { ...readState.readAtById },
      },
    };
    await this.persistState(state);
    return this.ensureMetaState(state).notifications!.readState;
  }

  async markNotificationRead(notificationId: string) {
    const readState = await this.getNotificationReadState();
    return this.setNotificationReadState({
      readAtById: {
        ...readState.readAtById,
        [notificationId]: this.options.now?.() ?? new Date().toISOString(),
      },
    });
  }

  async invalidateCalendarAlertsState() {
    const state = await this.getState();
    const current = state.syncState.meta?.calendarAlerts;
    if (!current) {
      return null;
    }

    state.syncState.meta = {
      appliedMigrations: state.syncState.meta?.appliedMigrations ?? [],
      calendarAlerts: {
        ...current,
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
      },
      reporting: state.syncState.meta?.reporting,
      decisionSupport: state.syncState.meta?.decisionSupport,
      notifications: state.syncState.meta?.notifications ?? { readState: createEmptyNotificationReadState() },
      conflictResolution: state.syncState.meta?.conflictResolution ?? { auditByOperationId: {} },
      sessionSecurity: state.syncState.meta?.sessionSecurity,
    };
    await this.persistState(state);
    return state.syncState.meta.calendarAlerts;
  }

  async invalidateAdminReportingState() {
    const state = await this.getState();
    const current = state.syncState.meta?.reporting;
    if (!current) {
      return null;
    }

    state.syncState.meta = {
      appliedMigrations: state.syncState.meta?.appliedMigrations ?? [],
      calendarAlerts: state.syncState.meta?.calendarAlerts,
      notifications: state.syncState.meta?.notifications ?? { readState: createEmptyNotificationReadState() },
      decisionSupport: state.syncState.meta?.decisionSupport,
      conflictResolution: state.syncState.meta?.conflictResolution ?? { auditByOperationId: {} },
      sessionSecurity: state.syncState.meta?.sessionSecurity,
      reporting: {
        ...createEmptyAdminReportingDerivedState(current.selectedWindow, current.selectedPreset),
        freshness: {
          lastSyncAt: current.freshness.lastSyncAt,
          lastComputedAt: null,
          stale: true,
        },
      },
    };
    await this.persistState(state);
    return state.syncState.meta.reporting;
  }

  async invalidateDecisionSupportState() {
    const state = await this.getState();
    const current = state.syncState.meta?.decisionSupport;
    if (!current) {
      return null;
    }

    state.syncState.meta = {
      appliedMigrations: state.syncState.meta?.appliedMigrations ?? [],
      calendarAlerts: state.syncState.meta?.calendarAlerts,
      reporting: state.syncState.meta?.reporting,
      decisionSupport: {
        ...createEmptyDecisionSupportDerivedState(current.selectedWindow),
        freshness: {
          lastSyncAt: current.freshness.lastSyncAt,
          lastComputedAt: null,
          stale: true,
        },
      },
      notifications: state.syncState.meta?.notifications ?? { readState: createEmptyNotificationReadState() },
      conflictResolution: state.syncState.meta?.conflictResolution ?? { auditByOperationId: {} },
      sessionSecurity: state.syncState.meta?.sessionSecurity,
    };
    await this.persistState(state);
    return state.syncState.meta.decisionSupport;
  }

  async clearForSessionBoundary(policy: SessionBoundaryCleanupPolicy, reason: SessionBoundaryReason) {
    const state = await this.getState();
    const retainedMeta = this.buildSessionBoundaryMeta(state, policy, reason);

    state.outbox = [];
    state.inbox = [];
    state.syncState.checkpoints = {};

    if (policy === 'shared_device_hard') {
      state.snapshots = [];
    }

    state.syncState.meta = retainedMeta;
    await this.persistState(state);

    return {
      policy,
      outbox: state.outbox.length,
      inbox: state.inbox.length,
      snapshots: state.snapshots.length,
    };
  }

  private async getState() {
    if (this.cachedState) {
      return this.cachedState;
    }

    const existing = await this.adapter.load();
    const { state, appliedMigrations } = migrateOfflineState(existing);

    if (!existing || appliedMigrations.length > 0 || state.schemaVersion !== CURRENT_OFFLINE_SCHEMA_VERSION) {
      await this.adapter.save(state);
    }

    this.cachedState = state;
    return state;
  }

  private async persistState(state: PersistedOfflineState) {
    this.cachedState = state;
    await this.adapter.save(state);
  }

  private ensureMetaState(state: PersistedOfflineState) {
    state.syncState.meta ??= { appliedMigrations: [] };
    state.syncState.meta.calendarAlerts ??= createEmptyCalendarDerivedState();
    state.syncState.meta.reporting ??= createEmptyAdminReportingDerivedState();
    state.syncState.meta.decisionSupport ??= createEmptyDecisionSupportDerivedState();
    state.syncState.meta.notifications ??= { readState: createEmptyNotificationReadState() };
    state.syncState.meta.conflictResolution ??= { auditByOperationId: {} };
    state.syncState.meta.sessionSecurity ??= {
      fallbackStatus: 'active',
      cleanupPolicy: 'soft_retention',
      lastBoundaryReason: null,
      lastBoundaryAt: null,
    };
    return state.syncState.meta;
  }

  private buildSessionBoundaryMeta(
    state: PersistedOfflineState,
    policy: SessionBoundaryCleanupPolicy,
    reason: SessionBoundaryReason
  ) {
    const currentMeta = this.ensureMetaState(state);
    const calendarPreferences = currentMeta.calendarAlerts?.preferences;
    const reportingSelection = currentMeta.reporting;
    const boundaryAt = this.options.now?.() ?? new Date().toISOString();

    return {
      appliedMigrations: currentMeta.appliedMigrations,
      calendarAlerts: createEmptyCalendarDerivedState(calendarPreferences),
      reporting: createEmptyAdminReportingDerivedState(
        reportingSelection?.selectedWindow,
        reportingSelection?.selectedPreset
      ),
      notifications: {
        readState: createEmptyNotificationReadState(),
      },
      conflictResolution: {
        auditByOperationId: {},
      },
      sessionSecurity: {
        fallbackStatus: 'reauth_required' as const,
        cleanupPolicy: policy,
        lastBoundaryReason: reason,
        lastBoundaryAt: boundaryAt,
      },
    };
  }

  private trimNotificationRetention(state: PersistedOfflineState) {
    const notificationSnapshots = state.snapshots
      .filter((snapshot) => snapshot.entityType === 'NOTIFICATION')
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || right.entityId.localeCompare(left.entityId));

    const retainedIds = new Set(notificationSnapshots.slice(0, NOTIFICATION_RETENTION_LIMIT).map((snapshot) => snapshot.entityId));
    state.snapshots = state.snapshots.filter(
      (snapshot) => snapshot.entityType !== 'NOTIFICATION' || retainedIds.has(snapshot.entityId)
    );
    state.inbox = state.inbox.filter((entry) => entry.entityType !== 'NOTIFICATION' || retainedIds.has(entry.entityId));

    const currentReadState = this.ensureMetaState(state).notifications?.readState ?? createEmptyNotificationReadState();
    this.ensureMetaState(state).notifications = {
      readState: {
        readAtById: Object.fromEntries(
          Object.entries(currentReadState.readAtById).filter(([notificationId]) => retainedIds.has(notificationId))
        ),
      },
    };
  }

  private requireOperation(state: PersistedOfflineState, operationId: string) {
    const operation = state.outbox.find((current) => current.operationId === operationId);

    if (!operation) {
      throw new Error(`Offline operation ${operationId} was not found.`);
    }

    return operation;
  }
}

class IndexedDbOfflinePersistenceAdapter implements OfflinePersistenceAdapter {
  async load(): Promise<PersistedOfflineState | undefined> {
    if (!globalThis.indexedDB) {
      return undefined;
    }

    const database = await openDatabase(globalThis.indexedDB);
    const transaction = database.transaction([OUTBOX_STORE, INBOX_STORE, SNAPSHOTS_STORE, SYNC_STATE_STORE], 'readonly');

    const [outbox, inbox, snapshots, syncStateRecords] = await Promise.all([
      requestToPromise(transaction.objectStore(OUTBOX_STORE).getAll()),
      requestToPromise(transaction.objectStore(INBOX_STORE).getAll()),
      requestToPromise(transaction.objectStore(SNAPSHOTS_STORE).getAll()),
      requestToPromise(transaction.objectStore(SYNC_STATE_STORE).getAll()),
    ]);

    await transactionDone(transaction);

    if (!outbox.length && !inbox.length && !snapshots.length && !syncStateRecords.length) {
      return undefined;
    }

    const metaRecord = syncStateRecords.find((record) => record.key === META_KEY);
    const checkpointRecords = syncStateRecords.filter((record) => record.key !== META_KEY);

    return {
      schemaVersion: metaRecord?.value?.schemaVersion ?? CURRENT_OFFLINE_SCHEMA_VERSION,
      outbox,
      inbox,
      snapshots,
      syncState: {
        checkpoints: Object.fromEntries(
          checkpointRecords.map((record) => [record.key.replace('checkpoint:', ''), record.value])
        ),
        meta: metaRecord?.value?.meta,
      },
    };
  }

  async save(state: PersistedOfflineState): Promise<void> {
    if (!globalThis.indexedDB) {
      return;
    }

    const database = await openDatabase(globalThis.indexedDB);
    const transaction = database.transaction([OUTBOX_STORE, INBOX_STORE, SNAPSHOTS_STORE, SYNC_STATE_STORE], 'readwrite');

    const outboxStore = transaction.objectStore(OUTBOX_STORE);
    const inboxStore = transaction.objectStore(INBOX_STORE);
    const snapshotsStore = transaction.objectStore(SNAPSHOTS_STORE);
    const syncStateStore = transaction.objectStore(SYNC_STATE_STORE);

    await Promise.all([
      requestToPromise(outboxStore.clear()),
      requestToPromise(inboxStore.clear()),
      requestToPromise(snapshotsStore.clear()),
      requestToPromise(syncStateStore.clear()),
    ]);

    state.outbox.forEach((operation) => outboxStore.put(operation));
    state.inbox.forEach((entry) => inboxStore.put(entry));
    state.snapshots.forEach((snapshot) => snapshotsStore.put(snapshot));
    syncStateStore.put({ key: META_KEY, value: { schemaVersion: state.schemaVersion, meta: state.syncState.meta } });

    Object.entries(state.syncState.checkpoints).forEach(([entityType, checkpoint]) => {
      if (checkpoint) {
        syncStateStore.put({ key: `checkpoint:${entityType}`, value: checkpoint });
      }
    });

    await transactionDone(transaction);
  }
}

export const DEFAULT_OFFLINE_STORE_SERVICE = new OfflineStoreService();

function openDatabase(indexedDb: IDBFactory) {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDb.open(OFFLINE_DATABASE_NAME, OFFLINE_DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(OUTBOX_STORE)) {
        database.createObjectStore(OUTBOX_STORE, { keyPath: 'operationId' });
      }
      if (!database.objectStoreNames.contains(INBOX_STORE)) {
        database.createObjectStore(INBOX_STORE, { keyPath: 'key' });
      }
      if (!database.objectStoreNames.contains(SNAPSHOTS_STORE)) {
        database.createObjectStore(SNAPSHOTS_STORE, { keyPath: 'key' });
      }
      if (!database.objectStoreNames.contains(SYNC_STATE_STORE)) {
        database.createObjectStore(SYNC_STATE_STORE, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestToPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function createQueueSummaryMap() {
  return Object.fromEntries(SYNC_QUEUE_STATUSES.map((status) => [status, 0])) as Record<SyncQueueStatus, number>;
}

function maxIsoDate(left: string | null, right: string | null) {
  if (!left) {
    return right;
  }
  if (!right) {
    return left;
  }
  return left > right ? left : right;
}

function cloneOfflineState(state: PersistedOfflineState): PersistedOfflineState {
  return JSON.parse(JSON.stringify(state)) as PersistedOfflineState;
}

function normalizeCheckpointAliases(checkpoint: OfflineSyncCheckpoint): OfflineSyncCheckpoint {
  if (checkpoint.entityType !== 'ANIMAL_EVENT_LOG') {
    return checkpoint;
  }

  return {
    ...checkpoint,
    lastSyncedEventId: checkpoint.lastSyncedEventId ?? checkpoint.cursorId,
    lastSyncedAt: checkpoint.lastSyncedAt ?? checkpoint.lastSuccessAt,
  };
}

function rangesOverlap(leftFrom: string, leftTo: string | null, rightFrom: string, rightTo: string | null) {
  const effectiveLeftTo = leftTo ?? '9999-12-31';
  const effectiveRightTo = rightTo ?? '9999-12-31';
  return leftFrom <= effectiveRightTo && rightFrom <= effectiveLeftTo;
}
