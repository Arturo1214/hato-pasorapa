import { computed, Injectable, signal } from '@angular/core';
import {
  type MetricsWindow,
  METRICS_WINDOWS,
  OFFLINE_ENTITY_TYPES,
  type OfflineEntityType,
  type SyncEntityHealthSummary,
  type SyncIssueSummary,
  type SyncMetricDictionaryEntry,
  type SyncObservabilityHistoricalSnapshot,
  type SyncRuntimeConflictMetrics,
  type SyncRuntimeCycleMetrics,
  type SyncRuntimeQueueMetrics,
  type SyncRuntimeSnapshotV2,
  SYNC_QUEUE_STATUSES,
} from './offline-types';

export const SYNC_OBSERVABILITY_RECENT_LIMIT = 20;
export const SYNC_OBSERVABILITY_STALE_DEFAULT_MS = 24 * 60 * 60 * 1000;
export const SYNC_METRICS_WINDOWS = METRICS_WINDOWS;
export const SYNC_METRICS_DICTIONARY_V2: SyncMetricDictionaryEntry[] = [
  { key: 'cycle', label: 'Ciclo', category: 'runtime', description: 'Trigger, timestamps y latencias del ciclo actual.' },
  { key: 'queue', label: 'Cola', category: 'hybrid', description: 'Pendientes y resultados por estado y entidad.' },
  { key: 'errors', label: 'Errores', category: 'hybrid', description: 'Razones operativas rankeadas y recientes limitados.' },
  { key: 'conflicts', label: 'Conflictos', category: 'hybrid', description: 'Abiertos, resueltos y operaciones bloqueadas.' },
  { key: 'entityHealth', label: 'Salud por entidad', category: 'hybrid', description: 'Freshness por cursor y último éxito.' },
];

export interface SyncMetricsSnapshot {
  pending: number;
  success: number;
  failed: number;
  syncing: boolean;
  lastSyncAt: string | null;
  lastMessage: string | null;
  manualRefreshRequired: boolean;
  selectedWindow: MetricsWindow;
  dictionary: SyncMetricDictionaryEntry[];
  runtime: SyncRuntimeSnapshotV2;
  historical: SyncObservabilityHistoricalSnapshot | null;
  historicalLoading: boolean;
  historicalError: string | null;
}

@Injectable({ providedIn: 'root' })
export class SyncMetricsStore {
  private readonly state = signal<SyncMetricsSnapshot>({
    pending: 0,
    success: 0,
    failed: 0,
    syncing: false,
    lastSyncAt: null,
    lastMessage: null,
    manualRefreshRequired: false,
    selectedWindow: '24h',
    dictionary: SYNC_METRICS_DICTIONARY_V2,
    runtime: createEmptyRuntimeSnapshot(),
    historical: null,
    historicalLoading: false,
    historicalError: null,
  });

  readonly metrics = this.state.asReadonly();
  readonly runtime = computed(() => this.state().runtime);
  readonly historical = computed(() => this.state().historical);
  readonly selectedWindow = computed(() => this.state().selectedWindow);
  readonly historicalLoading = computed(() => this.state().historicalLoading);
  readonly historicalError = computed(() => this.state().historicalError);
  readonly dictionary = computed(() => this.state().dictionary);

  update(snapshot: SyncMetricsSnapshot) {
    this.state.set(snapshot);
  }

  patch(snapshot: Partial<SyncMetricsSnapshot>) {
    this.state.update((current) => ({
      ...current,
      ...snapshot,
    }));
  }

  snapshot() {
    return this.state();
  }

  updateRuntime(runtime: SyncRuntimeSnapshotV2) {
    this.state.update((current) => ({
      ...current,
      dictionary: SYNC_METRICS_DICTIONARY_V2,
      runtime,
    }));
  }

  setHistoricalWindow(window: MetricsWindow) {
    this.patch({ selectedWindow: window });
  }

  setHistoricalLoading(loading: boolean) {
    this.patch({ historicalLoading: loading });
  }

  setHistoricalError(error: string | null) {
    this.patch({ historicalError: error, historicalLoading: false });
  }

  setHistorical(snapshot: SyncObservabilityHistoricalSnapshot) {
    this.patch({
      selectedWindow: snapshot.window,
      historical: snapshot,
      historicalLoading: false,
      historicalError: null,
      dictionary: SYNC_METRICS_DICTIONARY_V2,
    });
  }
}

function createEmptyRuntimeSnapshot(): SyncRuntimeSnapshotV2 {
  return {
    cycle: createEmptyCycleMetrics(),
    queue: createEmptyQueueMetrics(),
    errors: [],
    conflicts: createEmptyConflictMetrics(),
    entityHealth: createEmptyEntityHealthMap(),
  };
}

function createEmptyCycleMetrics(): SyncRuntimeCycleMetrics {
  return {
    trigger: null,
    startedAt: null,
    finishedAt: null,
    totalDurationMs: null,
    pushDurationMs: null,
    pullDurationMs: null,
    attempt: null,
    reconnectCount: 0,
    batchComposition: {},
    hasMoreObserved: false,
  };
}

function createEmptyQueueMetrics(): SyncRuntimeQueueMetrics {
  return {
    totalByStatus: createQueueStatusMap(),
    byEntity: Object.fromEntries(OFFLINE_ENTITY_TYPES.map((entityType) => [entityType, createQueueStatusMap()])) as Record<
      OfflineEntityType,
      Record<(typeof SYNC_QUEUE_STATUSES)[number], number>
    >,
  };
}

function createEmptyConflictMetrics(): SyncRuntimeConflictMetrics {
  return {
    open: 0,
    resolved: 0,
    blockedOperations: 0,
  };
}

function createEmptyEntityHealthMap() {
  return Object.fromEntries(
    OFFLINE_ENTITY_TYPES.map((entityType) => [
      entityType,
      {
        cursorUpdatedAt: null,
        lastSuccessAt: null,
        stalenessMs: null,
        stale: true,
      } satisfies SyncEntityHealthSummary,
    ])
  ) as Record<OfflineEntityType, SyncEntityHealthSummary>;
}

function createQueueStatusMap() {
  return Object.fromEntries(SYNC_QUEUE_STATUSES.map((status) => [status, 0])) as Record<(typeof SYNC_QUEUE_STATUSES)[number], number>;
}
