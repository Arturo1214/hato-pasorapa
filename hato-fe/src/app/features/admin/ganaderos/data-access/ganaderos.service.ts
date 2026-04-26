import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { ApplicationConfigService } from '../../../../core/config/application-config.service';
import { AuthService } from '../../../../core/auth/data-access/auth.service';
import { DEFAULT_OFFLINE_STORE_SERVICE, OfflineStoreService } from '../../../../core/offline/offline-store.service';
import { createRetryPolicy, type RetryPolicy } from '../../../../core/offline/retry-policy';
import { SyncMetricsStore } from '../../../../core/offline/sync-metrics.store';
import { mapOfflineConflict } from '../../../../core/offline/conflict-mapper';
import { type OfflineOperationEnvelope } from '../../../../core/offline/offline-types';
import { OfflineStatusService } from '../../../../core/offline/offline-status.service';
import { type Observable, firstValueFrom, from } from 'rxjs';

export interface GanaderoItem {
  id: string;
  businessIdentifier: string;
  name: string;
  active: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
  lastSyncedAt: string | null;
}

interface GanaderosResponse {
  ganaderos: GanaderoItem[];
}

export interface GanaderoMutationFeedback {
  outcome: 'synced' | 'queued';
  message: string;
}

export interface GanaderosSyncState {
  pending: number;
  syncing: boolean;
  lastSyncAt: string | null;
  lastMessage: string | null;
  manualRefreshRequired: boolean;
}

export interface GanaderosServiceDependencies {
  http: Pick<HttpClient, 'get' | 'post' | 'put'>;
  appConfig: Pick<ApplicationConfigService, 'config'>;
  authService: Pick<AuthService, 'getAccessToken'>;
  offlineStatus: Pick<OfflineStatusService, 'isOnline'>;
  store: OfflineStoreService;
  metricsStore: SyncMetricsStore;
  retryPolicy: RetryPolicy;
  now: () => string;
  windowRef: Pick<Window, 'addEventListener'>;
}

@Injectable({ providedIn: 'root' })
export class GanaderosService {
  private http: Pick<HttpClient, 'get' | 'post' | 'put'> = inject(HttpClient);
  private appConfig: Pick<ApplicationConfigService, 'config'> = inject(ApplicationConfigService);
  private authService: Pick<AuthService, 'getAccessToken'> = inject(AuthService);
  private offlineStatus: OfflineStatusService = inject(OfflineStatusService);
  private store: OfflineStoreService = DEFAULT_OFFLINE_STORE_SERVICE;
  private metricsStore: SyncMetricsStore = inject(SyncMetricsStore);
  private retryPolicy: RetryPolicy = createRetryPolicy();
  private now: () => string = () => new Date().toISOString();
  private windowRef: Pick<Window, 'addEventListener'> | undefined = globalThis.window;
  private readonly syncStateWritable = signal<GanaderosSyncState>({
    pending: 0,
    syncing: false,
    lastSyncAt: null,
    lastMessage: null,
    manualRefreshRequired: false,
  });

  readonly syncState = this.syncStateWritable.asReadonly();

  constructor() {
    this.windowRef?.addEventListener('online', () => {
      void this.replayQueuedMutations();
    });
  }

  configureForTesting(dependencies: Partial<GanaderosServiceDependencies>) {
    this.http = dependencies.http ?? this.http;
    this.appConfig = dependencies.appConfig ?? this.appConfig;
    this.authService = dependencies.authService ?? this.authService;
    if (dependencies.offlineStatus) {
      this.offlineStatus = dependencies.offlineStatus as unknown as OfflineStatusService;
    }
    this.store = dependencies.store ?? this.store;
    this.metricsStore = dependencies.metricsStore ?? this.metricsStore;
    this.retryPolicy = dependencies.retryPolicy ?? this.retryPolicy;
    this.now = dependencies.now ?? this.now;
    this.windowRef = dependencies.windowRef ?? this.windowRef;
  }

  listGanaderos(active?: boolean): Observable<GanaderoItem[]> {
    return from(this.listGanaderosInternal(active));
  }

  createGanadero(payload: { businessIdentifier: string; name: string }): Observable<GanaderoMutationFeedback> {
    return from(this.enqueueCreate(payload));
  }

  updateStatus(id: string, active: boolean): Observable<GanaderoMutationFeedback> {
    return from(this.enqueueStatusUpdate(id, active));
  }

  private async listGanaderosInternal(active?: boolean) {
    if (!this.offlineStatus.isOnline()) {
      return this.listGanaderoSnapshots(active);
    }

    const params = active === undefined ? '' : `?active=${active}`;
    const response = await firstValueFrom(
      this.http.get<GanaderosResponse>(`${this.appConfig.config().apiBaseUrl}/admin/ganaderos${params}`, {
        headers: this.buildHeaders(),
      })
    );

    await Promise.all(response.ganaderos.map((ganadero) => this.saveGanaderoSnapshot(ganadero)));
    return response.ganaderos;
  }

  private async enqueueCreate(payload: { businessIdentifier: string; name: string }) {
    const now = this.now();
    const operation = await this.store.enqueueOperation({
      entityType: 'GANADERO',
      entityId: `pending:${globalThis.crypto.randomUUID()}`,
      opType: 'CREATE',
      payload,
      clientCreatedAt: now,
      clientUpdatedAt: now,
    });
    const pendingId = `pending:${operation.operationId}`;
    await this.saveGanaderoSnapshot({
      id: pendingId,
      businessIdentifier: payload.businessIdentifier,
      name: payload.name,
      active: true,
      version: 0,
      createdAt: now,
      updatedAt: now,
      lastSyncedAt: null,
    });
    await this.refreshPendingState({ lastMessage: 'Alta de ganadero encolada. Se enviará al reconectar.' });

    if (this.offlineStatus.isOnline()) {
      await this.replayQueuedMutations();
      return {
        outcome: 'synced',
        message: 'Ganadero sincronizado correctamente.',
      } satisfies GanaderoMutationFeedback;
    }

    return {
      outcome: 'queued',
      message: 'Alta de ganadero encolada. Se enviará al reconectar.',
    } satisfies GanaderoMutationFeedback;
  }

  private async enqueueStatusUpdate(id: string, active: boolean) {
    const now = this.now();
    await this.store.enqueueOperation({
      entityType: 'GANADERO',
      entityId: id,
      opType: 'STATUS_UPDATE',
      payload: { active },
      clientCreatedAt: now,
      clientUpdatedAt: now,
    });
    await this.applyOptimisticStatus(id, active, now);
    await this.refreshPendingState({ lastMessage: 'Cambio de estado encolado. Se enviará al reconectar.' });

    if (this.offlineStatus.isOnline()) {
      await this.replayQueuedMutations();
      return {
        outcome: 'synced',
        message: 'Estado del ganadero sincronizado correctamente.',
      } satisfies GanaderoMutationFeedback;
    }

    return {
      outcome: 'queued',
      message: 'Cambio de estado encolado. Se enviará al reconectar.',
    } satisfies GanaderoMutationFeedback;
  }

  private async replayQueuedMutations() {
    if (!this.offlineStatus.isOnline()) {
      return;
    }

    const operations = (await this.store.listEligibleOperations(this.now())).filter(
      (operation) => operation.entityType === 'GANADERO'
    );

    if (!operations.length) {
      await this.refreshPendingState();
      return;
    }

    this.syncStateWritable.update((state) => ({ ...state, syncing: true }));

    for (const operation of operations) {
      await this.store.markInFlight(operation.operationId);

      try {
        if (operation.opType === 'CREATE') {
          const response = await firstValueFrom(
            this.http.post<GanaderoItem>(`${this.appConfig.config().apiBaseUrl}/admin/ganaderos`, operation.payload, {
              headers: this.buildMutationHeaders(operation.operationId),
            })
          );
          await this.store.deleteSnapshot('GANADERO', `pending:${operation.operationId}`);
          await this.saveGanaderoSnapshot(response);
        }

        if (operation.opType === 'STATUS_UPDATE') {
          const response = await firstValueFrom(
            this.http.put<GanaderoItem>(
              `${this.appConfig.config().apiBaseUrl}/admin/ganaderos/${operation.entityId}/status`,
              { active: operation.payload['active'] },
              { headers: this.buildMutationHeaders(operation.operationId) }
            )
          );
          await this.saveGanaderoSnapshot(response);
        }

        await this.store.markAcked(operation.operationId);
      } catch (error) {
        await this.handleReplayError(operation, error);
      }
    }

    await this.refreshPendingState({ lastSyncAt: this.now() });
    this.syncStateWritable.update((state) => ({ ...state, syncing: false }));
  }

  private async handleReplayError(operation: OfflineOperationEnvelope, error: unknown) {
    if (error instanceof HttpErrorResponse && error.status === 409) {
      const conflict = mapOfflineConflict(error);
      await this.store.markConflict(
        operation.operationId,
        { code: conflict.code, message: conflict.message },
        {
          serverVersion: 0,
          reason: conflict.message,
          resolutionHint: conflict.resolutionHint,
        }
      );
      await this.refreshPendingState({
        lastMessage: conflict.message,
        manualRefreshRequired: conflict.manualRefreshRequired,
      });
      return;
    }

    const retryDecision = this.retryPolicy.schedule(operation.attempts + 1, this.now());
    if (retryDecision.shouldRetry && retryDecision.nextAttemptAt) {
      await this.store.markRetryScheduled(
        operation.operationId,
        {
          code: 'TRANSIENT_SYNC_ERROR',
          message: 'La sincronización de ganaderos falló temporalmente. Se reintentará automáticamente.',
        },
        retryDecision.nextAttemptAt
      );
      return;
    }

    await this.store.markDeadLetter(operation.operationId, {
      code: 'RETRY_LIMIT_EXCEEDED',
      message: 'Se agotó la política de retry para este cambio de ganadero.',
    });
  }

  private async listGanaderoSnapshots(active?: boolean) {
    const snapshots = await this.store.listSnapshots('GANADERO');
    const ganaderos = snapshots.map((snapshot) => snapshot.payload as unknown as GanaderoItem);
    return active === undefined ? ganaderos : ganaderos.filter((ganadero) => ganadero.active === active);
  }

  private async applyOptimisticStatus(id: string, active: boolean, now: string) {
    const snapshots = await this.store.listSnapshots('GANADERO');
    const existing = snapshots.find((snapshot) => snapshot.entityId === id);
    if (!existing) {
      return;
    }

    const ganadero = existing.payload as unknown as GanaderoItem;
    await this.saveGanaderoSnapshot({
      ...ganadero,
      active,
      updatedAt: now,
    });
  }

  private async saveGanaderoSnapshot(ganadero: GanaderoItem) {
    await this.store.saveSnapshot({
      key: `GANADERO:${ganadero.id}`,
      entityType: 'GANADERO',
      entityId: ganadero.id,
      payload: { ...ganadero },
      updatedAt: ganadero.updatedAt,
      version: ganadero.version,
    });
  }

  private async refreshPendingState(overrides: Partial<GanaderosSyncState> = {}) {
    const pending = await this.store.countPendingOperations();
    this.metricsStore.update({
      pending,
      success: 0,
      failed: 0,
      lastSyncAt: overrides.lastSyncAt ?? this.syncStateWritable().lastSyncAt,
    });
    this.syncStateWritable.update((state) => ({
      ...state,
      pending,
      ...overrides,
    }));
  }

  private buildMutationHeaders(operationId?: string) {
    return this.buildHeaders().set('X-Operation-Id', operationId ?? globalThis.crypto.randomUUID());
  }

  private buildHeaders() {
    const token = this.authService.getAccessToken();
    return token
      ? new HttpHeaders({ Authorization: `Bearer ${token}` })
      : new HttpHeaders();
  }
}
