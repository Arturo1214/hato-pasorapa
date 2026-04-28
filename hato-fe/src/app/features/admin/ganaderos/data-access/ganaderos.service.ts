import { HttpClient, HttpHeaders } from '@angular/common/http';
import { computed, inject, Injectable } from '@angular/core';
import { ApplicationConfigService } from '../../../../core/config/application-config.service';
import { AuthService } from '../../../../core/auth/data-access/auth.service';
import { DEFAULT_OFFLINE_STORE_SERVICE, OfflineStoreService } from '../../../../core/offline/offline-store.service';
import { SyncMetricsStore } from '../../../../core/offline/sync-metrics.store';
import { OfflineStatusService } from '../../../../core/offline/offline-status.service';
import { triggerManualSync } from '../../../../core/offline/sync-orchestrator.service';
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
  now: () => string;
  windowRef: Pick<Window, 'dispatchEvent'>;
}

@Injectable({ providedIn: 'root' })
export class GanaderosService {
  private http: Pick<HttpClient, 'get' | 'post' | 'put'> = inject(HttpClient);
  private appConfig: Pick<ApplicationConfigService, 'config'> = inject(ApplicationConfigService);
  private authService: Pick<AuthService, 'getAccessToken'> = inject(AuthService);
  private offlineStatus: OfflineStatusService = inject(OfflineStatusService);
  private store: OfflineStoreService = DEFAULT_OFFLINE_STORE_SERVICE;
  private metricsStore: SyncMetricsStore = inject(SyncMetricsStore);
  private now: () => string = () => new Date().toISOString();
  private windowRef: Pick<Window, 'dispatchEvent'> | undefined = globalThis.window;
  readonly syncState = computed<GanaderosSyncState>(() => ({
    pending: this.metricsStore.metrics().pending,
    syncing: this.metricsStore.metrics().syncing,
    lastSyncAt: this.metricsStore.metrics().lastSyncAt,
    lastMessage: this.metricsStore.metrics().lastMessage,
    manualRefreshRequired: this.metricsStore.metrics().manualRefreshRequired,
  }));

  constructor() {}

  configureForTesting(dependencies: Partial<GanaderosServiceDependencies>) {
    this.http = dependencies.http ?? this.http;
    this.appConfig = dependencies.appConfig ?? this.appConfig;
    this.authService = dependencies.authService ?? this.authService;
    if (dependencies.offlineStatus) {
      this.offlineStatus = dependencies.offlineStatus as unknown as OfflineStatusService;
    }
    this.store = dependencies.store ?? this.store;
    this.metricsStore = dependencies.metricsStore ?? this.metricsStore;
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
    const hasPendingGanaderoOperations = await this.hasPendingGanaderoOperations();
    await this.refreshPendingState();

    if (!this.offlineStatus.isOnline() || hasPendingGanaderoOperations) {
      return this.listGanaderoSnapshots(active);
    }

    const params = active === undefined ? '' : `?active=${active}`;
    const response = await firstValueFrom(
      this.http.get<GanaderosResponse>(`${this.appConfig.config().apiBaseUrl}/admin/ganaderos${params}`, {
        headers: this.buildHeaders(),
      })
    );

    await Promise.all(response.ganaderos.map((ganadero) => this.saveGanaderoSnapshot(ganadero)));
    await this.refreshPendingState();
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
    await this.store.reassignOperationEntityId(operation.operationId, operation.operationId);
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
    }, operation.operationId);
    await this.refreshPendingState({ lastMessage: 'Alta de ganadero encolada. Se enviará al reconectar.' });

    if (this.offlineStatus.isOnline()) {
      triggerManualSync(this.windowRef);
      return {
        outcome: 'queued',
        message: 'Alta de ganadero encolada. Se disparó la sincronización automática.',
      } satisfies GanaderoMutationFeedback;
    }

    return {
      outcome: 'queued',
      message: 'Alta de ganadero encolada. Se enviará al reconectar.',
    } satisfies GanaderoMutationFeedback;
  }

  private async enqueueStatusUpdate(id: string, active: boolean) {
    const now = this.now();
    const canonicalEntityId = this.toCanonicalEntityId(id);
    await this.store.enqueueOperation({
      entityType: 'GANADERO',
      entityId: canonicalEntityId,
      opType: 'STATUS_UPDATE',
      payload: { active },
      clientCreatedAt: now,
      clientUpdatedAt: now,
    });
    await this.applyOptimisticStatus(canonicalEntityId, active, now);
    await this.refreshPendingState({ lastMessage: 'Cambio de estado encolado. Se enviará al reconectar.' });

    if (this.offlineStatus.isOnline()) {
      triggerManualSync(this.windowRef);
      return {
        outcome: 'queued',
        message: 'Cambio de estado encolado. Se disparó la sincronización automática.',
      } satisfies GanaderoMutationFeedback;
    }

    return {
      outcome: 'queued',
      message: 'Cambio de estado encolado. Se enviará al reconectar.',
    } satisfies GanaderoMutationFeedback;
  }

  private async listGanaderoSnapshots(active?: boolean) {
    const snapshots = await this.store.listSnapshots('GANADERO');
    const ganaderos = snapshots.map((snapshot) => snapshot.payload as unknown as GanaderoItem);
    return active === undefined ? ganaderos : ganaderos.filter((ganadero) => ganadero.active === active);
  }

  private async hasPendingGanaderoOperations() {
    const outbox = await this.store.listOutbox();
    return outbox.some(
      (operation) =>
        operation.entityType === 'GANADERO' &&
        (operation.status === 'pending' || operation.status === 'retry_scheduled' || operation.status === 'in_flight')
    );
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

  private async saveGanaderoSnapshot(ganadero: GanaderoItem, entityId = ganadero.id) {
    await this.store.saveSnapshot({
      key: `GANADERO:${entityId}`,
      entityType: 'GANADERO',
      entityId,
      payload: { ...ganadero },
      updatedAt: ganadero.updatedAt,
      version: ganadero.version,
    });
  }

  private toCanonicalEntityId(id: string) {
    return id.startsWith('pending:') ? id.replace('pending:', '') : id;
  }

  private async refreshPendingState(overrides: Partial<GanaderosSyncState> = {}) {
    const pending = await this.store.countPendingOperations();
    this.metricsStore.patch({
      pending,
      ...overrides,
    });
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
