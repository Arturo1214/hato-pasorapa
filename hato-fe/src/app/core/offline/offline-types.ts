export const OFFLINE_ENTITY_TYPES = [
  'USER',
  'GANADERO',
  'ANIMAL',
  'LOT',
  'LOT_ASSIGNMENT',
  'PRODUCTIVITY_LEDGER',
  'COST_LEDGER',
  'ANIMAL_EVENT',
  'ANIMAL_HEALTH_EVENT',
  'ANIMAL_REPRODUCTION_EVENT',
  'ANIMAL_EVENT_LOG',
  'ANIMAL_IMAGE',
  'NOTIFICATION',
] as const;
export type OfflineEntityType = (typeof OFFLINE_ENTITY_TYPES)[number];

export const OFFLINE_OPERATION_TYPES = [
  'CREATE',
  'UPDATE',
  'DELETE',
  'STATUS_UPDATE',
  'PASSWORD_RESET',
] as const;
export type OfflineOperationType = (typeof OFFLINE_OPERATION_TYPES)[number];

export const OFFLINE_OPERATION_STATUSES = [
  'pending',
  'in_flight',
  'acked',
  'retry_scheduled',
  'failed',
  'dead_letter',
  'conflict',
] as const;
export type OfflineOperationStatus = (typeof OFFLINE_OPERATION_STATUSES)[number];

export const METRICS_WINDOWS = ['24h', '7d'] as const;
export type MetricsWindow = (typeof METRICS_WINDOWS)[number];

export const SYNC_QUEUE_STATUSES = ['pending', 'in_flight', 'retry_scheduled', 'failed', 'dead_letter', 'conflict'] as const;
export type SyncQueueStatus = (typeof SYNC_QUEUE_STATUSES)[number];
export const SYNC_HARNESS_MAX_HAS_MORE_PAGES = 10;

export interface SyncMetricDictionaryEntry {
  key: 'cycle' | 'queue' | 'errors' | 'conflicts' | 'entityHealth';
  label: string;
  category: 'runtime' | 'historical' | 'hybrid';
  description: string;
}

export interface SyncEntityThresholdConfig {
  defaultStaleMs: number;
  overrides?: Partial<Record<OfflineEntityType, number>>;
}

export interface SyncIssueSummary {
  code: string;
  reason: string;
  count: number;
  entityType: OfflineEntityType | 'GLOBAL';
  status: SyncQueueStatus | 'resolved' | 'validation_error' | 'version_conflict';
  lastOccurredAt: string | null;
  operationIds: string[];
}

export interface SyncEntityHealthSummary {
  cursorUpdatedAt: string | null;
  lastSuccessAt: string | null;
  stalenessMs: number | null;
  stale: boolean;
}

export interface SyncRuntimeCycleMetrics {
  trigger: 'manual' | 'startup' | 'reconnect' | null;
  startedAt: string | null;
  finishedAt: string | null;
  totalDurationMs: number | null;
  pushDurationMs: number | null;
  pullDurationMs: number | null;
  attempt: number | null;
  reconnectCount: number;
  batchComposition: Record<string, number>;
  hasMoreObserved: boolean;
}

export interface SyncRuntimeQueueMetrics {
  totalByStatus: Record<SyncQueueStatus, number>;
  byEntity: Record<OfflineEntityType, Record<SyncQueueStatus, number>>;
}

export interface SyncRuntimeConflictMetrics {
  open: number;
  resolved: number;
  blockedOperations: number;
}

export interface SyncRuntimeSnapshotV2 {
  cycle: SyncRuntimeCycleMetrics;
  queue: SyncRuntimeQueueMetrics;
  errors: SyncIssueSummary[];
  conflicts: SyncRuntimeConflictMetrics;
  entityHealth: Record<OfflineEntityType, SyncEntityHealthSummary>;
}

export interface SyncObservabilityRecentIssue {
  source: 'receipt' | 'conflict_ledger';
  operationId: string;
  entityType: string;
  entityId: string;
  status: string;
  reason: string;
  createdAt: string;
}

export interface SyncObservabilityHistoricalSnapshot {
  window: MetricsWindow;
  dictionary: SyncMetricDictionaryEntry[];
  totals: Record<string, number>;
  byEntity: Record<string, Record<string, number>>;
  topReasons: Array<{ reason: string; count: number; source: 'receipt' | 'conflict_ledger' }>;
  conflicts: { open: number; resolved: number; blockedOperations: number };
  entityHealth: Record<string, SyncEntityHealthSummary>;
  latency: {
    latestReceiptAt: string | null;
    oldestIssueAt: string | null;
    staleThresholdMs: number;
  };
  recentIssues: SyncObservabilityRecentIssue[];
}

export const MANUAL_RESOLUTION_ACTIONS = ['accept_server', 'retry_local', 'discard_local'] as const;
export type ManualResolutionAction = (typeof MANUAL_RESOLUTION_ACTIONS)[number];

export interface ConflictDiffField {
  path: string;
  localValue: unknown;
  serverValue: unknown;
  severity: 'low' | 'medium' | 'high';
}

export interface ResolutionPolicy {
  entityType: OfflineEntityType;
  opType: OfflineOperationType;
  allowedActions: ManualResolutionAction[];
  uxHint?: string;
  policyKey: string;
  policyVersion: string;
}

export interface ConflictAuditEntry {
  eventType: 'DETECTED' | 'RESOLVED';
  decision?: ManualResolutionAction | null;
  resultStatus?: 'acked' | 'pending' | null;
  reason: string;
  actorUserId?: string | null;
  createdAt: string;
}

export interface OfflineConflictMetadata {
  clientVersion?: number;
  serverVersion: number;
  serverState?: unknown;
  reason: string;
  resolutionHint?: string;
  serverStateVersion?: number;
  diffFields?: ConflictDiffField[];
  policy?: ResolutionPolicy;
  allowedActions?: ManualResolutionAction[];
  policyKey?: string;
}

export interface OfflineOperationEnvelope {
  operationId: string;
  entityType: OfflineEntityType;
  entityId?: string;
  opType: OfflineOperationType;
  payload: Record<string, unknown>;
  baseVersion?: number;
  clientCreatedAt: string;
  clientUpdatedAt: string;
  status: OfflineOperationStatus;
  attempts: number;
  nextAttemptAt?: string;
  lastErrorCode?: string;
  lastErrorMessage?: string;
  conflict?: OfflineConflictMetadata;
}

export interface OfflineInboxEntry {
  key: string;
  entityType: OfflineEntityType;
  entityId: string;
  payload: Record<string, unknown>;
  receivedAt: string;
}

export interface OfflineSnapshotRecord {
  key: string;
  entityType: OfflineEntityType;
  entityId: string;
  payload: Record<string, unknown>;
  updatedAt: string;
  version?: number;
}

export interface OfflineSyncCheckpoint {
  entityType: OfflineEntityType;
  cursorUpdatedAt: string;
  cursorId: string;
  lastSuccessAt: string;
  lastSyncedEventId?: string;
  lastSyncedAt?: string;
}

export interface OfflineSyncStateMeta {
  appliedMigrations: string[];
  calendarAlerts?: CalendarDerivedState;
  reporting?: AdminReportingDerivedState;
  decisionSupport?: DecisionSupportDerivedState;
  notifications?: {
    readState: NotificationReadState;
  };
  conflictResolution?: {
    auditByOperationId: Record<string, ConflictAuditEntry[]>;
  };
  sessionSecurity?: {
    fallbackStatus: 'active' | 'reauth_required' | 'expired';
    cleanupPolicy: 'soft_retention' | 'shared_device_hard';
    lastBoundaryReason: 'ttl_elapsed' | 'logout' | 'user_switch' | 'manual_lock' | 'migration_reauth_required' | null;
    lastBoundaryAt: string | null;
  };
}

export const REPORTING_WINDOWS = ['7d', '30d', '90d'] as const;
export type ReportingWindow = (typeof REPORTING_WINDOWS)[number];

export const REPORTING_PRESET_IDS = ['all', 'active_only', 'inactive_only'] as const;
export type ReportingPresetId = (typeof REPORTING_PRESET_IDS)[number];

export type AdminReportingEventSourceType = 'ANIMAL_EVENT' | 'ANIMAL_HEALTH_EVENT' | 'ANIMAL_REPRODUCTION_EVENT';

export interface AdminReportingFreshnessState {
  lastSyncAt: string | null;
  lastComputedAt: string | null;
  stale: boolean;
}

export interface AdminReportingAggregates {
  usersTotal: number;
  ganaderosTotal: number;
  animalesTotal: number;
  animalesActivos: number;
  lotesTotal: number;
  lotesActivos: number;
  asignacionesActivas: number;
  productividadTotal: number;
  costosTotal: number;
  costoAcumulado: number;
}

export interface AdminReportingKpiSummary {
  animalesActivos: number;
  lotesActivos: number;
  productividadTotal: number;
  costosTotal: number;
  costoAcumulado: number;
}

export interface AdminReportingLotBreakdownItem {
  lotId: string;
  lotName: string;
  animalesActivos: number;
  productividadTotal: number;
  costosTotal: number;
  costoAcumulado: number;
}

export interface AdminReportingRecentActivityItem {
  id: string;
  sourceType: AdminReportingEventSourceType;
  eventType: string;
  occurredAt: string;
  animalUuid: string;
  animalLabel: string;
  title: string;
}

export interface AdminReportingDerivedState {
  version: 2;
  selectedWindow: ReportingWindow;
  selectedPreset: ReportingPresetId;
  freshness: AdminReportingFreshnessState;
  aggregates: AdminReportingAggregates;
  eventsByType: Record<ReportingWindow, Record<string, number>>;
  descriptiveKpis: Record<ReportingWindow, AdminReportingKpiSummary>;
  lotBreakdown: AdminReportingLotBreakdownItem[];
  recentActivity: AdminReportingRecentActivityItem[];
  sourceSignature: Record<string, string | null>;
}

export const DECISION_SUPPORT_CATEGORIES = ['health', 'reproduction', 'cost', 'productivity', 'operations'] as const;
export type DecisionSupportCategory = (typeof DECISION_SUPPORT_CATEGORIES)[number];

export const DECISION_SUPPORT_SEVERITIES = ['info', 'watch', 'critical'] as const;
export type DecisionSupportSeverity = (typeof DECISION_SUPPORT_SEVERITIES)[number];

export interface DecisionSupportInsightWhy {
  source: string[];
  rule: string;
  generatedAt: string;
}

export interface DecisionSupportInsight {
  id: string;
  category: DecisionSupportCategory;
  window: ReportingWindow;
  metric: string;
  currentValue: number;
  baselineValue: number;
  deltaPct: number;
  severity: DecisionSupportSeverity;
  why: DecisionSupportInsightWhy;
  manualActions: string[];
  scopeGuard: 'descriptive_only';
}

export interface DecisionSupportDerivedState {
  version: 1;
  selectedWindow: ReportingWindow;
  freshness: AdminReportingFreshnessState;
  insights: DecisionSupportInsight[];
  sourceSignature: Record<string, string | null>;
}

export interface NotificationSnapshot {
  id: string;
  title: string;
  body: string;
  createdByUserId: string;
  publishedAt: string;
  updatedAt: string;
}

export interface NotificationReadState {
  readAtById: Record<string, string>;
}

export const CALENDAR_ALERT_STATUSES = ['upcoming', 'due_today', 'overdue'] as const;
export type CalendarAlertStatus = (typeof CALENDAR_ALERT_STATUSES)[number];

export const CALENDAR_RANGES = ['today', 'next_7_days', 'next_30_days'] as const;
export type CalendarRange = (typeof CALENDAR_RANGES)[number];

export interface CalendarAlertPreferences {
  horizonDays: 1 | 3 | 7;
  snoozedUntil?: string | null;
  notificationsEnabled: boolean;
}

export interface CalendarDerivedAgendaItem {
  id: string;
  animalUuid: string;
  animalLabel?: string;
  sourceType: 'ANIMAL_HEALTH_EVENT' | 'ANIMAL_REPRODUCTION_EVENT' | 'ANIMAL_EVENT';
  sourceId: string;
  dueAt: string;
  status: CalendarAlertStatus;
  title: string;
  detail?: string;
  priorityScore: number;
  sortKey: string;
  visitMode?: 'GLOBAL' | 'SPECIFIC';
}

export interface CalendarDerivedWindows {
  upcoming: CalendarDerivedAgendaItem[];
  due_today: CalendarDerivedAgendaItem[];
  overdue: CalendarDerivedAgendaItem[];
}

export interface CalendarDerivedCounts {
  total: number;
  byStatus: Record<CalendarAlertStatus, number>;
  badges?: Partial<Record<CalendarAlertStatus, string>>;
}

export interface CalendarDerivedState {
  version: 1;
  preferences: CalendarAlertPreferences;
  items: CalendarDerivedAgendaItem[];
  windows: CalendarDerivedWindows;
  counts: CalendarDerivedCounts;
  lastComputedAt: string | null;
}

export interface PersistedOfflineState {
  schemaVersion: number;
  outbox: Array<Omit<OfflineOperationEnvelope, 'status'> & { status: string }>;
  inbox: OfflineInboxEntry[];
  snapshots: OfflineSnapshotRecord[];
  syncState: {
    checkpoints: Partial<Record<OfflineEntityType, OfflineSyncCheckpoint>>;
    meta?: OfflineSyncStateMeta;
  };
}

export interface EnqueueOfflineOperationInput {
  operationId?: string;
  entityType: OfflineEntityType;
  opType: OfflineOperationType;
  payload: Record<string, unknown>;
  entityId?: string;
  baseVersion?: number;
  clientCreatedAt: string;
  clientUpdatedAt: string;
}

export interface OfflineFailureDescriptor {
  code: string;
  message: string;
}

export interface AnimalOfflineMutationPayload extends Record<string, unknown> {
  ownerGanaderoId?: string;
  motherAnimalUuid?: string | null;
  fatherAnimalUuid?: string | null;
  arete?: string | null;
  marca?: string | null;
  tatuaje?: string | null;
  color?: string | null;
  description?: string | null;
  breedUuid?: string | null;
  breedName?: string | null;
  category: 'TERNERO' | 'TERNERA' | 'VAQUILLONA' | 'VACA' | 'TORO' | 'BUEY';
  sex?: 'MACHO' | 'HEMBRA' | null;
  active: boolean;
  admissionDate: string;
  birthDate?: string | null;
  weightKg?: number | null;
}

export interface AnimalOfflineSnapshotPayload extends AnimalOfflineMutationPayload {
  uuid: string;
  motherAnimalUuid?: string | null;
  fatherAnimalUuid?: string | null;
  birthDate?: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
  lastSyncedAt: string | null;
}

export const ANIMAL_EVENT_TYPES = ['SOLD', 'DECEASED', 'LOST', 'TRANSFERRED', 'CASTRATION', 'OBSERVATION'] as const;
export type AnimalEventType = (typeof ANIMAL_EVENT_TYPES)[number];
export type AnimalEventSourceChannel = 'ONLINE' | 'OFFLINE';

export interface AnimalEventOfflineMetadata extends Record<string, unknown> {
  fromOwnerGanaderoId?: string;
  toOwnerGanaderoId?: string;
  reasonCode?: string;
}

export interface AnimalEventOfflineCreatePayload extends Record<string, unknown> {
  animalUuid: string;
  type: AnimalEventType;
  occurredAt: string;
  notes?: string | null;
  performedByUserId: string;
  sourceChannel: AnimalEventSourceChannel;
  operationId: string;
  metadata: AnimalEventOfflineMetadata;
}

export interface AnimalEventSnapshotPayload extends AnimalEventOfflineCreatePayload {
  id: string;
  clientCreatedAt: string;
  createdAt: string;
  updatedAt: string;
  syncStatus?: 'synced' | 'pending' | 'conflict';
  syncMessage?: string | null;
}

export const ANIMAL_EVENT_CATEGORIES = ['GENERAL', 'HEALTH', 'REPRODUCTION'] as const;
export type AnimalEventCategory = (typeof ANIMAL_EVENT_CATEGORIES)[number];
export type AnimalEventLogSourceChannel = 'ONLINE' | 'OFFLINE';
export type AnimalEventLogMetadata = Record<string, unknown>;

export interface AnimalEventLogSnapshotPayload extends Record<string, unknown> {
  id: string;
  animalUuid: string;
  eventCategory: AnimalEventCategory;
  eventType: string;
  occurredAt: string;
  notes?: string | null;
  performedByUserId: string;
  sourceChannel: AnimalEventLogSourceChannel;
  operationId: string;
  metadata: AnimalEventLogMetadata;
  createdAt: string;
  updatedAt: string;
  clientCreatedAt?: string;
  syncStatus?: 'synced' | 'pending' | 'conflict';
  syncMessage?: string | null;
  type?: AnimalEventType;
  healthEventType?: AnimalHealthEventType;
  reproductionEventType?: AnimalReproductionEventType;
  visitId?: string | null;
  parentVisitId?: string | null;
  nextDueAt?: string | null;
  visitStatus?: string;
  protocolStatus?: string;
}

export const ANIMAL_HEALTH_EVENT_TYPES = [
  'VACCINATION',
  'DEWORMING',
  'DISEASE_REPORTED',
  'TREATMENT_STARTED',
  'TREATMENT_FOLLOW_UP',
  'TREATMENT_CLOSED',
  'FIELD_VET_VISIT',
] as const;
export type AnimalHealthEventType = (typeof ANIMAL_HEALTH_EVENT_TYPES)[number];
export type AnimalHealthEventSourceChannel = 'ONLINE' | 'OFFLINE';

export interface TreatmentHealthEventOfflineMetadata extends Record<string, unknown> {
  treatmentCaseId?: string;
  productName?: string;
  batchLot?: string;
  nextDueAt?: string;
}

export interface VaccinationOrDewormingOfflineMetadata extends Record<string, unknown> {
  productName?: string;
  batchLot?: string;
  nextDueAt?: string;
}

export interface DiseaseReportedOfflineMetadata extends Record<string, unknown> {
  diagnosisCode?: string;
}

export const FIELD_VET_CHECKLIST_CODES = [
  'GENERAL_APPEARANCE',
  'TEMPERATURE',
  'HYDRATION',
  'APPETITE',
  'LOCOMOTION',
] as const;
export type FieldVetChecklistCode = (typeof FIELD_VET_CHECKLIST_CODES)[number];

export const FIELD_VET_PROTOCOL_STATUSES = ['STARTED', 'FOLLOW_UP_REQUIRED', 'CLOSED'] as const;
export type FieldVetProtocolStatus = (typeof FIELD_VET_PROTOCOL_STATUSES)[number];

export interface FieldVetVisitBlock {
  visitId: string;
  mode?: 'GLOBAL' | 'SPECIFIC';
  status?: 'PENDING' | 'ATTENDED' | 'RESCHEDULED' | 'FINALIZED' | 'CANCELED';
  veterinarian?: {
    name: string;
    license?: string;
  };
  targetAnimalCount?: number;
  parentVisitId?: string;
  cancelReason?: string;
}

export interface FieldVetChecklistItem extends Record<string, unknown> {
  code: FieldVetChecklistCode;
  ok: boolean;
  note?: string;
}

export interface FieldVetClinicalNote extends Record<string, unknown> {
  reason: string;
  findings?: string;
  plan?: string | string[];
}

export interface FieldVetProtocol extends Record<string, unknown> {
  status: FieldVetProtocolStatus;
  nextDueAt?: string;
}

export interface FieldVetVisitMetadata extends Record<string, unknown> {
  visit: FieldVetVisitBlock;
  checklist: FieldVetChecklistItem[];
  clinicalNote: FieldVetClinicalNote;
  protocol: FieldVetProtocol;
  cost?: { amount: number; currency: 'BOB' };
  treatmentPlan?: string[];
}

export type AnimalHealthEventOfflineMetadata =
  | VaccinationOrDewormingOfflineMetadata
  | DiseaseReportedOfflineMetadata
  | TreatmentHealthEventOfflineMetadata
  | FieldVetVisitMetadata;

export interface AnimalHealthEventOfflineCreatePayload extends Record<string, unknown> {
  animalUuid: string;
  healthEventType: AnimalHealthEventType;
  occurredAt: string;
  notes?: string | null;
  performedByUserId: string;
  sourceChannel: AnimalHealthEventSourceChannel;
  operationId: string;
  metadata: AnimalHealthEventOfflineMetadata;
}

export interface AnimalHealthEventSnapshotPayload extends AnimalHealthEventOfflineCreatePayload {
  id: string;
  clientCreatedAt: string;
  createdAt: string;
  updatedAt: string;
  syncStatus?: 'synced' | 'pending' | 'conflict';
  syncMessage?: string | null;
  treatmentStatus?: 'active' | 'closed';
  visitId?: string | null;
  nextDueAt?: string | null;
  visitMode?: 'GLOBAL' | 'SPECIFIC';
  visitStatus?: string;
  veterinarianName?: string;
  visitProjection?: 'CAMPAIGN' | 'SPECIFIC';
}

export const ANIMAL_REPRODUCTION_EVENT_TYPES = ['SERVICE', 'PREGNANCY_DIAGNOSIS', 'PREGNANCY_CONFIRMED', 'PREGNANCY_LOSS', 'BIRTH'] as const;
export type AnimalReproductionEventType = (typeof ANIMAL_REPRODUCTION_EVENT_TYPES)[number];
export type AnimalReproductionEventSourceChannel = 'ONLINE' | 'OFFLINE';
export type AnimalReproductionEventSyncState = 'PENDING_SYNC' | 'SYNCED' | 'CONFLICT';

export interface AnimalReproductionEventOfflineMetadata extends Record<string, unknown> {
  serviceMethod?: string;
  diagnosisDate?: string;
  result?: string;
  expectedBirthDate?: string;
  serviceEventUuid?: string;
  relatedServiceEventId?: string;
  negativeResult?: boolean;
  status?: string;
  confirmationDate?: string;
  lossReason?: string;
  birthDate?: string;
  offspringCount?: number;
  motherAnimalUuid?: string;
  fatherAnimalUuid?: string;
  offspringAnimalUuids?: string[];
}

export interface AnimalReproductionEventOfflineCreatePayload extends Record<string, unknown> {
  animalUuid: string;
  reproductionEventType: AnimalReproductionEventType;
  occurredAt: string;
  notes?: string | null;
  performedByUserId: string;
  sourceChannel: AnimalReproductionEventSourceChannel;
  operationId: string;
  metadata: AnimalReproductionEventOfflineMetadata;
}

export interface AnimalReproductionEventSnapshotPayload extends AnimalReproductionEventOfflineCreatePayload {
  id: string;
  clientCreatedAt: string;
  createdAt: string;
  updatedAt: string;
  syncStatus?: 'synced' | 'pending' | 'conflict';
  syncMessage?: string | null;
  syncState?: AnimalReproductionEventSyncState;
}

export const ANIMAL_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png'] as const;
export type AnimalImageMimeType = (typeof ANIMAL_IMAGE_MIME_TYPES)[number];
export type AnimalImageSourceChannel = 'ONLINE' | 'OFFLINE';
export type AnimalImageSyncState = 'PENDING' | 'SYNCED' | 'FAILED';

export interface AnimalImageOfflineCreatePayload extends Record<string, unknown> {
  animalUuid: string;
  operationId: string;
  sourceChannel: AnimalImageSourceChannel;
  fileName: string;
  mimeType: AnimalImageMimeType;
  sizeBytes: number;
  checksumSha256: string;
  capturedAt: string;
  binaryRef: string;
  base64Data?: string;
}

export interface AnimalImageSnapshotPayload extends AnimalImageOfflineCreatePayload {
  id: string;
  thumbnailRef?: string | null;
  previewUrl?: string | null;
  clientCreatedAt: string;
  createdAt: string;
  updatedAt: string;
  syncState: AnimalImageSyncState;
  syncMessage?: string | null;
}

export interface HerdLotOfflinePayload extends Record<string, unknown> {
  name: string;
  description?: string | null;
  active: boolean;
}

export interface HerdLotSnapshotPayload extends HerdLotOfflinePayload {
  id: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface HerdLotAssignmentOfflinePayload extends Record<string, unknown> {
  animalUuid: string;
  lotId: string;
  fromDate: string;
  toDate?: string | null;
}

export interface HerdLotAssignmentSnapshotPayload extends HerdLotAssignmentOfflinePayload {
  id: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export type ProductivityIdentity = `${string}|${string}|${string}|${string}`;

export interface HerdProductivityLedgerOfflinePayload extends Record<string, unknown> {
  animalUuid: string;
  lotId: string;
  periodKey: string;
  metricType: string;
  value: number;
}

export interface HerdProductivityLedgerSnapshotPayload extends HerdProductivityLedgerOfflinePayload {
  id: string;
  identityKey: ProductivityIdentity;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export type CostIdentity = `${string}|${string}|${string}|${string}`;

export interface HerdCostLedgerOfflinePayload extends Record<string, unknown> {
  lotId: string;
  periodKey: string;
  category: string;
  source: string;
  amount: number;
  currency: string;
}

export interface HerdCostLedgerSnapshotPayload extends HerdCostLedgerOfflinePayload {
  id: string;
  identityKey: CostIdentity;
  createdAt: string;
  updatedAt: string;
  version: number;
}
