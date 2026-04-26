import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../auth/data-access/auth.service';
import { ApplicationConfigService } from '../config/application-config.service';
import { OfflineStatusService } from './offline-status.service';
import { DEFAULT_OFFLINE_STORE_SERVICE, OfflineStoreService } from './offline-store.service';
import {
  OFFLINE_ENTITY_TYPES,
  type OfflineConflictMetadata,
  type OfflineEntityType,
  type OfflineOperationEnvelope,
  type OfflineSyncCheckpoint,
} from './offline-types';
import { createRetryPolicy, type RetryPolicy } from './retry-policy';
import { SyncMetricsStore } from './sync-metrics.store';

export type SyncTrigger = 'manual' | 'startup' | 'reconnect';
export const MANUAL_SYNC_EVENT = 'hato:sync-manual';

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
}

export interface SyncOrchestratorDependencies {
  store: OfflineStoreService;
  apiClient: SyncApiClient;
  metricsStore: SyncMetricsStore;
  offlineStatus: OnlineStatusReader;
  authSession: AuthSessionReader;
  retryPolicy: RetryPolicy;
  now: () => string;
  random: () => number;
  windowRef: Pick<Window, 'addEventListener'>;
  supportedEntities: readonly OfflineEntityType[];
}

export class SyncOrchestratorService {
  private readonly store: OfflineStoreService;
  private readonly apiClient: SyncApiClient;
  private readonly metricsStore: SyncMetricsStore;
  private readonly offlineStatus: OnlineStatusReader;
  private readonly authSession: AuthSessionReader;
  private readonly retryPolicy: RetryPolicy;
  private readonly now: () => string;
  private readonly windowRef?: Pick<Window, 'addEventListener'>;
  private readonly supportedEntities: readonly OfflineEntityType[];

  private initialized = false;
  private syncing = false;

  constructor(dependencies: Partial<SyncOrchestratorDependencies> = {}) {
    this.store = dependencies.store ?? DEFAULT_OFFLINE_STORE_SERVICE;
    this.apiClient = dependencies.apiClient ?? inject(SyncApiService);
    this.metricsStore = dependencies.metricsStore ?? inject(SyncMetricsStore);
    this.offlineStatus =
      dependencies.offlineStatus ?? ({ isOnline: () => inject(OfflineStatusService).isOnline() } satisfies OnlineStatusReader);
    this.authSession = dependencies.authSession ?? ({ getAccessToken: () => inject(AuthService).getAccessToken() } satisfies AuthSessionReader);
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
    if (this.syncing || !this.offlineStatus.isOnline() || !this.authSession.getAccessToken()) {
      return;
    }

    this.syncing = true;
    const cycleNow = this.now();
    let success = 0;
    let failed = 0;

    try {
      const eligibleOperations = await this.store.listEligibleOperations(cycleNow);

      if (eligibleOperations.length > 0) {
        for (const operation of eligibleOperations) {
          await this.store.markInFlight(operation.operationId);
        }

        try {
          const pushResponse = await this.apiClient.push({ operations: eligibleOperations });

          for (const result of pushResponse.results) {
            if (result.classification === 'no_conflict') {
              success += 1;
              await this.store.markAcked(result.operationId);
              continue;
            }

            failed += 1;
            if (result.classification === 'version_conflict') {
              await this.store.markConflict(
                result.operationId,
                {
                  code: 'VERSION_CONFLICT',
                  message: result.conflict?.reason ?? 'La versión remota cambió y requiere refresh manual.',
                },
                this.mapConflict(result.conflict)
              );
              continue;
            }

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
            const retryDecision = this.retryPolicy.schedule(operation.attempts, cycleNow);
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
          this.metricsStore.update({ pending, success, failed, lastSyncAt: cycleNow });
          return;
        }
      }

      for (const entityType of this.supportedEntities) {
        const cursor = await this.store.getCheckpoint(entityType);
        const response = await this.apiClient.pull({ entityType, cursor });
        await this.store.applyPullResponse(entityType, response.items, response.nextCursor);
      }

      const pending = await this.store.countPendingOperations();
      this.metricsStore.update({ pending, success, failed, lastSyncAt: cycleNow });
    } finally {
      this.syncing = false;
    }
  }

  private mapConflict(conflict?: SyncOperationResult['conflict']): OfflineConflictMetadata {
    return {
      clientVersion: conflict?.clientVersion,
      serverVersion: conflict?.serverVersion ?? 0,
      serverState: conflict?.serverState,
      reason: conflict?.reason ?? 'Se detectó un conflicto de versión.',
      resolutionHint: conflict?.resolutionHint,
    };
  }
}

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
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
  }
}
