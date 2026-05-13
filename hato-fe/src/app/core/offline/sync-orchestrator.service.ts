import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService, type OfflineSessionStatus } from '../auth/data-access/auth.service';
import { ApplicationConfigService } from '../config/application-config.service';
import { OfflineStatusService } from './offline-status.service';
import {
  DEFAULT_OFFLINE_IMAGE_BINARY_STORE,
  OfflineImageBinaryStoreService,
} from './offline-image-binary-store.service';
import { DEFAULT_OFFLINE_STORE_SERVICE, OfflineStoreService } from './offline-store.service';
import {
  type AnimalImageOfflineCreatePayload,
  type ConflictAuditEntry,
  type ConflictDiffField,
  type ManualResolutionAction,
  OFFLINE_ENTITY_TYPES,
  type OfflineConflictMetadata,
  type OfflineEntityType,
  type OfflineOperationEnvelope,
  type ResolutionPolicy,
  type OfflineSyncCheckpoint,
  SYNC_HARNESS_MAX_HAS_MORE_PAGES,
  type SyncRuntimeSnapshotV2,
} from './offline-types';
import { createRetryPolicy, type RetryPolicy } from './retry-policy';
import { SYNC_OBSERVABILITY_STALE_DEFAULT_MS, SyncMetricsStore } from './sync-metrics.store';

export type SyncTrigger = 'manual' | 'startup' | 'reconnect';
export const MANUAL_SYNC_EVENT = 'hato:sync-manual';
export const CALENDAR_ALERTS_REFRESH_EVENT = 'calendar-alerts:refresh';
export const NOTIFICATIONS_REFRESH_EVENT = 'notifications:refresh';
export const REPORTING_REFRESH_EVENT = 'reporting:refresh';
export const SYNC_CONFLICTS_REFRESH_EVENT = 'sync-conflicts:refresh';

export function triggerManualSync(windowRef: Pick<Window, 'dispatchEvent'> | undefined = globalThis.window) {
  windowRef?.dispatchEvent(new CustomEvent(MANUAL_SYNC_EVENT));
}

export function triggerCalendarAlertsRefresh(windowRef: Pick<Window, 'dispatchEvent'> | undefined = globalThis.window) {
  windowRef?.dispatchEvent(new CustomEvent(CALENDAR_ALERTS_REFRESH_EVENT));
}

export function triggerNotificationsRefresh(windowRef: Pick<Window, 'dispatchEvent'> | undefined = globalThis.window) {
  windowRef?.dispatchEvent(new CustomEvent(NOTIFICATIONS_REFRESH_EVENT));
}

export function triggerReportingRefresh(windowRef: Pick<Window, 'dispatchEvent'> | undefined = globalThis.window) {
  windowRef?.dispatchEvent(new CustomEvent(REPORTING_REFRESH_EVENT));
}

export function triggerSyncConflictsRefresh(windowRef: Pick<Window, 'dispatchEvent'> | undefined = globalThis.window) {
  windowRef?.dispatchEvent(new CustomEvent(SYNC_CONFLICTS_REFRESH_EVENT));
}

export interface SyncOperationResult {
  operationId: string;
  entityType: OfflineEntityType;
  entityId?: string;
  classification: 'no_conflict' | 'version_conflict' | 'validation_error';
  serverVersion?: number;
  conflict?: {
    entityId?: string;
    clientVersion?: number;
    serverVersion?: number;
    reason: string;
    resolutionHint?: string;
    serverState?: unknown;
    serverStateVersion?: number;
    diffFields?: ConflictDiffField[];
    policy?: ResolutionPolicy;
    allowedActions?: ManualResolutionAction[];
    policyKey?: string;
  };
}

export interface PushSyncResponse {
  results: SyncOperationResult[];
}

export interface PullSyncResponse {
  entityType: OfflineEntityType;
  items: Array<Record<string, unknown>>;
  nextCursor: OfflineSyncCheckpoint;
  hasMore: boolean;
}

export interface SyncApiClient {
  push(request: { operations: OfflineOperationEnvelope[] }): Promise<PushSyncResponse>;
  pull(request: { entityType: OfflineEntityType; cursor: OfflineSyncCheckpoint | null }): Promise<PullSyncResponse>;
}

export interface OnlineStatusReader {
  isOnline(): boolean;
}

export interface AuthSessionReader {
  getAccessToken(): string | null;
  getOfflineSessionStatus?(now?: string): OfflineSessionStatus;
}

export interface SyncOrchestratorDependencies {
  store: OfflineStoreService;
  imageBinaryStore: OfflineImageBinaryStoreService;
  apiClient: SyncApiClient;
  metricsStore: SyncMetricsStore;
  offlineStatus: OnlineStatusReader;
  authSession: AuthSessionReader;
  retryPolicy: RetryPolicy;
  now: () => string;
  random: () => number;
  windowRef: Pick<Window, 'addEventListener' | 'dispatchEvent'>;
  supportedEntities: readonly OfflineEntityType[];
}

export class SyncOrchestratorService {
  private readonly store: OfflineStoreService;
  private readonly apiClient: SyncApiClient;
  private readonly imageBinaryStore: OfflineImageBinaryStoreService;
  private readonly metricsStore: SyncMetricsStore;
  private readonly offlineStatus: OnlineStatusReader;
  private readonly authSession: AuthSessionReader;
  private readonly retryPolicy: RetryPolicy;
  private readonly now: () => string;
  private readonly windowRef?: Pick<Window, 'addEventListener' | 'dispatchEvent'>;
  private readonly supportedEntities: readonly OfflineEntityType[];

  private initialized = false;
  private syncing = false;

  constructor(dependencies: Partial<SyncOrchestratorDependencies> = {}) {
    this.store = dependencies.store ?? DEFAULT_OFFLINE_STORE_SERVICE;
    this.imageBinaryStore = dependencies.imageBinaryStore ?? DEFAULT_OFFLINE_IMAGE_BINARY_STORE;
    this.apiClient = dependencies.apiClient ?? inject(SyncApiService);
    this.metricsStore = dependencies.metricsStore ?? inject(SyncMetricsStore);
    this.offlineStatus =
      dependencies.offlineStatus ?? ({ isOnline: () => inject(OfflineStatusService).isOnline() } satisfies OnlineStatusReader);
    this.authSession =
      dependencies.authSession ??
      ({
        getAccessToken: () => inject(AuthService).getAccessToken(),
        getOfflineSessionStatus: (now?: string) => inject(AuthService).getOfflineSessionStatus(now),
      } satisfies AuthSessionReader);
    this.now = dependencies.now ?? (() => new Date().toISOString());
    this.windowRef = dependencies.windowRef ?? globalThis.window;
    this.supportedEntities = dependencies.supportedEntities ?? OFFLINE_ENTITY_TYPES;
    this.retryPolicy =
      dependencies.retryPolicy ??
      createRetryPolicy({
        random: dependencies.random ?? Math.random,
      });
  }

  async initialize() {
    if (!this.initialized) {
      this.initialized = true;
      this.windowRef?.addEventListener('online', () => {
        void this.syncNow('reconnect');
      });
      this.windowRef?.addEventListener(MANUAL_SYNC_EVENT, () => {
        void this.syncNow('manual');
      });
    }

    await this.syncNow('startup');
  }

  async syncNow(_trigger: SyncTrigger) {
    const cycleStartedAt = this.now();
    const sessionStatus = this.authSession.getOfflineSessionStatus?.(cycleStartedAt) ?? 'active';

    if (this.syncing || !this.offlineStatus.isOnline() || !this.authSession.getAccessToken() || sessionStatus !== 'active') {
      if (sessionStatus !== 'active') {
        this.metricsStore.patch({
          lastMessage: describeBlockedSession(sessionStatus),
          manualRefreshRequired: false,
          syncing: false,
        });
      }
      return;
    }

    this.syncing = true;
    let success = 0;
    let failed = 0;
    let lastMessage: string | null = null;
    let manualRefreshRequired = false;
    let pushDurationMs: number | null = null;
    let pullDurationMs: number | null = null;
    let runtimeContext: SyncCycleRuntimeContext = createRuntimeContext(_trigger, []);
    this.metricsStore.patch({ syncing: true });
    await this.publishRuntimeSnapshot(_trigger, runtimeContext, {
      startedAt: cycleStartedAt,
      finishedAt: null,
      totalDurationMs: null,
      pushDurationMs: null,
      pullDurationMs: null,
    });

    try {
      const eligibleOperations = await this.store.listEligibleOperations(cycleStartedAt);
      runtimeContext = createRuntimeContext(_trigger, eligibleOperations);
      await this.publishRuntimeSnapshot(_trigger, runtimeContext, {
        startedAt: cycleStartedAt,
        finishedAt: null,
        totalDurationMs: null,
        pushDurationMs: null,
        pullDurationMs: null,
      });

      if (eligibleOperations.length > 0) {
        const pushStartedAt = this.now();
        for (const operation of eligibleOperations) {
          await this.store.markInFlight(operation.operationId);
        }
        await this.publishRuntimeSnapshot(_trigger, runtimeContext, {
          startedAt: cycleStartedAt,
          finishedAt: null,
          totalDurationMs: null,
          pushDurationMs: null,
          pullDurationMs: null,
        });

        try {
          const hydratedOperations = await Promise.all(eligibleOperations.map((operation) => this.hydratePushOperation(operation)));
          const pushResponse = await this.apiClient.push({ operations: hydratedOperations });
          pushDurationMs = diffMs(pushStartedAt, this.now());

          for (const result of pushResponse.results) {
            if (result.classification === 'no_conflict') {
              success += 1;
              await this.reconcileAcknowledgedCreateSnapshot(result.operationId, result.entityType, result.entityId, hydratedOperations);
              if (result.entityType === 'ANIMAL_IMAGE') {
                // Image binaries are purged only after server ack. Conflict/failed paths keep the blob so media badges
                // can still surface local-only/conflict state and future retry/resolution has the original payload.
                await this.imageBinaryStore.purgeBinary(result.operationId);
              }
              await this.store.markAcked(result.operationId);
              continue;
            }

            failed += 1;
            const requiresManualResolution = result.classification === 'version_conflict' || result.conflict?.resolutionHint === 'manual_resolution';
            if (requiresManualResolution) {
              lastMessage = result.conflict?.reason ?? 'La versión remota cambió y requiere refresh manual.';
              manualRefreshRequired = result.conflict?.resolutionHint === 'manual_refresh';
              await this.store.markConflict(
                result.operationId,
                {
                  code: 'VERSION_CONFLICT',
                  message: result.conflict?.reason ?? 'La versión remota cambió y requiere refresh manual.',
                },
                this.mapConflict(result.conflict)
              );
              await this.store.saveConflictAudit(result.operationId, {
                eventType: 'DETECTED',
                reason: result.conflict?.reason ?? 'Se detectó un conflicto remoto.',
                createdAt: cycleStartedAt,
              } satisfies ConflictAuditEntry);
              triggerSyncConflictsRefresh(this.windowRef);
              continue;
            }

            lastMessage = result.conflict?.reason ?? 'La operación offline fue rechazada por validación.';
            await this.store.markFailed(result.operationId, {
              code: 'VALIDATION_ERROR',
              message: result.conflict?.reason ?? 'La operación offline fue rechazada por validación.',
            });
          }
        } catch {
          failed += eligibleOperations.length;
          const inFlightOperations = (await this.store.listOutbox()).filter((operation) =>
            eligibleOperations.some((eligible) => eligible.operationId === operation.operationId)
          );

          for (const operation of inFlightOperations) {
            const retryDecision = this.retryPolicy.schedule(operation.attempts, cycleStartedAt);
            if (retryDecision.shouldRetry && retryDecision.nextAttemptAt) {
              await this.store.markRetryScheduled(
                operation.operationId,
                {
                  code: 'TRANSIENT_SYNC_ERROR',
                  message: 'La sincronización falló temporalmente. Se reintentará automáticamente.',
                },
                retryDecision.nextAttemptAt
              );
              continue;
            }

            await this.store.markDeadLetter(operation.operationId, {
              code: 'RETRY_LIMIT_EXCEEDED',
              message: 'Se agotó la política de retry para esta operación offline.',
            });
          }

          const pending = await this.store.countPendingOperations();
          const finishedAt = this.now();
          this.metricsStore.update({
            pending,
            success,
            failed,
            syncing: false,
            lastSyncAt: finishedAt,
            lastMessage: 'La sincronización falló temporalmente. Se reintentará automáticamente.',
            manualRefreshRequired: false,
            selectedWindow: this.metricsStore.snapshot().selectedWindow,
            dictionary: this.metricsStore.snapshot().dictionary,
            runtime: await this.buildRuntimeSnapshot(_trigger, runtimeContext, {
              startedAt: cycleStartedAt,
              finishedAt,
              totalDurationMs: diffMs(cycleStartedAt, finishedAt),
              pushDurationMs,
              pullDurationMs,
            }),
            historical: this.metricsStore.snapshot().historical,
            historicalLoading: this.metricsStore.snapshot().historicalLoading,
            historicalError: this.metricsStore.snapshot().historicalError,
          });
          return;
        }
      }

      const pullStartedAt = this.now();
      for (const entityType of this.supportedEntities) {
        let cursor = await this.store.getCheckpoint(entityType);
        for (let page = 0; page < SYNC_HARNESS_MAX_HAS_MORE_PAGES; page += 1) {
          const response = await this.apiClient.pull({ entityType, cursor });
          runtimeContext = {
            ...runtimeContext,
            hasMoreObserved: runtimeContext.hasMoreObserved || response.hasMore,
          };
          await this.store.applyPullResponse(entityType, response.items, response.nextCursor);

          if (!response.hasMore) {
            break;
          }

          if (page + 1 >= SYNC_HARNESS_MAX_HAS_MORE_PAGES) {
            const message = `Sync harness pagination overflow after ${SYNC_HARNESS_MAX_HAS_MORE_PAGES} pages for ${entityType}.`;
            this.metricsStore.patch({ lastMessage: message });
            throw new Error(message);
          }

          cursor = response.nextCursor;
        }
      }
      pullDurationMs = diffMs(pullStartedAt, this.now());

      triggerCalendarAlertsRefresh(this.windowRef);
      triggerNotificationsRefresh(this.windowRef);
      triggerReportingRefresh(this.windowRef);
      triggerSyncConflictsRefresh(this.windowRef);

      const pending = await this.store.countPendingOperations();
      const finishedAt = this.now();
      this.metricsStore.update({
        pending,
        success,
        failed,
        syncing: false,
        lastSyncAt: finishedAt,
        lastMessage:
          lastMessage ??
          (success > 0 || pending > 0 ? 'Sincronización central completada.' : this.metricsStore.snapshot().lastMessage),
        manualRefreshRequired,
        selectedWindow: this.metricsStore.snapshot().selectedWindow,
        dictionary: this.metricsStore.snapshot().dictionary,
        runtime: await this.buildRuntimeSnapshot(_trigger, runtimeContext, {
          startedAt: cycleStartedAt,
          finishedAt,
          totalDurationMs: diffMs(cycleStartedAt, finishedAt),
          pushDurationMs,
          pullDurationMs,
        }),
        historical: this.metricsStore.snapshot().historical,
        historicalLoading: this.metricsStore.snapshot().historicalLoading,
        historicalError: this.metricsStore.snapshot().historicalError,
      });
    } finally {
      this.syncing = false;
      this.metricsStore.patch({ syncing: false });
    }
  }

  private async publishRuntimeSnapshot(
    trigger: SyncTrigger,
    runtimeContext: SyncCycleRuntimeContext,
    cycle: {
      startedAt: string;
      finishedAt: string | null;
      totalDurationMs: number | null;
      pushDurationMs: number | null;
      pullDurationMs: number | null;
    }
  ) {
    this.metricsStore.updateRuntime(await this.buildRuntimeSnapshot(trigger, runtimeContext, cycle));
  }

  private async buildRuntimeSnapshot(
    trigger: SyncTrigger,
    runtimeContext: SyncCycleRuntimeContext,
    cycle: {
      startedAt: string;
      finishedAt: string | null;
      totalDurationMs: number | null;
      pushDurationMs: number | null;
      pullDurationMs: number | null;
    }
  ): Promise<SyncRuntimeSnapshotV2> {
    const queue = await this.store.summarizeOutboxByStatusAndEntity();
    const errors = await this.store.summarizeErrors();
    const entityHealth = await this.withAllEntityHealth(await this.store.listCheckpointHealth(this.now()));

    return {
      cycle: {
        trigger,
        startedAt: cycle.startedAt,
        finishedAt: cycle.finishedAt,
        totalDurationMs: cycle.totalDurationMs,
        pushDurationMs: cycle.pushDurationMs,
        pullDurationMs: cycle.pullDurationMs,
        attempt: runtimeContext.attempt,
        reconnectCount: runtimeContext.reconnectCount,
        batchComposition: runtimeContext.batchComposition,
        hasMoreObserved: runtimeContext.hasMoreObserved,
      },
      queue,
      errors,
      conflicts: {
        open: queue.totalByStatus.conflict,
        resolved: 0,
        blockedOperations: queue.totalByStatus.conflict,
      },
      entityHealth,
    };
  }

  private async withAllEntityHealth(partial: Awaited<ReturnType<OfflineStoreService['listCheckpointHealth']>>) {
    const result = { ...partial } as Awaited<ReturnType<OfflineStoreService['listCheckpointHealth']>>;

    for (const entityType of this.supportedEntities) {
      result[entityType] ??= {
        cursorUpdatedAt: null,
        lastSuccessAt: null,
        stalenessMs: null,
        stale: true,
      };

      if (result[entityType].stalenessMs != null) {
        result[entityType].stale = result[entityType].stalenessMs > SYNC_OBSERVABILITY_STALE_DEFAULT_MS;
      }
    }

    return result;
  }

  private async reconcileAcknowledgedCreateSnapshot(
    operationId: string,
    entityType: OfflineEntityType,
    serverEntityId: string | undefined,
    eligibleOperations: OfflineOperationEnvelope[]
  ) {
    if (!serverEntityId) {
      return;
    }

    const operation = eligibleOperations.find((current) => current.operationId === operationId);
    if (!operation || operation.opType !== 'CREATE' || !operation.entityId || operation.entityId === serverEntityId) {
      return;
    }

    await this.store.reassignSnapshotEntityId(entityType, operation.entityId, serverEntityId);
  }

  private async hydratePushOperation(operation: OfflineOperationEnvelope): Promise<OfflineOperationEnvelope> {
    if (operation.entityType !== 'ANIMAL_IMAGE') {
      return operation;
    }

    const payload = operation.payload as AnimalImageOfflineCreatePayload;
    if (payload.base64Data) {
      return operation;
    }

    const base64Data = await this.imageBinaryStore.getBase64Data(operation.operationId);
    return {
      ...operation,
      payload: {
        ...payload,
        base64Data,
      },
    };
  }

  private mapConflict(conflict?: SyncOperationResult['conflict']): OfflineConflictMetadata {
    return {
      clientVersion: conflict?.clientVersion,
      serverVersion: conflict?.serverVersion ?? 0,
      serverState: conflict?.serverState,
      reason: conflict?.reason ?? 'Se detectó un conflicto de versión.',
      resolutionHint: conflict?.resolutionHint,
      serverStateVersion: conflict?.serverStateVersion,
      diffFields: conflict?.diffFields,
      policy: conflict?.policy,
      allowedActions: conflict?.allowedActions,
      policyKey: conflict?.policyKey,
    };
  }
}

interface SyncCycleRuntimeContext {
  attempt: number;
  reconnectCount: number;
  batchComposition: Record<string, number>;
  hasMoreObserved: boolean;
}

@Injectable({ providedIn: 'root' })
export class SyncApiService implements SyncApiClient {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(ApplicationConfigService);
  private readonly authService = inject(AuthService);

  async push(request: { operations: OfflineOperationEnvelope[] }) {
    return firstValueFrom(
      this.http.post<PushSyncResponse>(`${this.appConfig.config().apiBaseUrl}/sync/push`, request, {
        headers: this.buildHeaders(),
      })
    );
  }

  async pull(request: { entityType: OfflineEntityType; cursor: OfflineSyncCheckpoint | null }) {
    const params = new URLSearchParams({ entityType: request.entityType });
    if (request.cursor) {
      params.set('cursorUpdatedAt', request.cursor.cursorUpdatedAt);
      params.set('cursorId', request.cursor.cursorId);
    }

    return firstValueFrom(
      this.http.get<PullSyncResponse>(`${this.appConfig.config().apiBaseUrl}/sync/pull?${params.toString()}`, {
        headers: this.buildHeaders(),
      })
    );
  }

  private buildHeaders() {
    const token = this.authService.getAccessToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (this.appConfig.config().offlineConflictResolutionV2) {
      headers['X-Sync-Conflict-Version'] = '2';
    }
    return new HttpHeaders(headers);
  }
}

function diffMs(startedAt: string, finishedAt: string) {
  return Math.max(Date.parse(finishedAt) - Date.parse(startedAt), 0);
}

function describeBlockedSession(status: Exclude<OfflineSessionStatus, 'active'>) {
  return status === 'expired'
    ? 'La sesión offline expiró. Iniciá sesión nuevamente antes de sincronizar.'
    : 'Este dispositivo requiere reautenticación antes de sincronizar.';
}

function createRuntimeContext(trigger: SyncTrigger, eligibleOperations: OfflineOperationEnvelope[]): SyncCycleRuntimeContext {
  return {
    attempt: Math.max(1, ...eligibleOperations.map((operation) => operation.attempts + 1)),
    reconnectCount: trigger === 'reconnect' ? 1 : 0,
    batchComposition: summarizeBatchComposition(eligibleOperations),
    hasMoreObserved: false,
  };
}

function summarizeBatchComposition(eligibleOperations: OfflineOperationEnvelope[]) {
  return eligibleOperations.reduce<Record<string, number>>((composition, operation) => {
    const key = `${operation.entityType}:${operation.opType}`;
    composition[key] = (composition[key] ?? 0) + 1;
    return composition;
  }, {});
}
