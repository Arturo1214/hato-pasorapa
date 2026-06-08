import { HttpClient, HttpHeaders } from '@angular/common/http';
import { computed, inject, Injectable } from '@angular/core';
import { ApplicationConfigService } from '../../../../core/config/application-config.service';
import { AuthService } from '../../../../core/auth/data-access/auth.service';
import { OfflineEntityChangeBus } from '../../../../core/offline/offline-entity-change-bus.service';
import {
  DEFAULT_OFFLINE_STORE_SERVICE,
  type OfflineStoreService,
} from '../../../../core/offline/offline-store.service';
import { SyncMetricsStore } from '../../../../core/offline/sync-metrics.store';
import { OfflineStatusService } from '../../../../core/offline/offline-status.service';
import { triggerManualSync } from '../../../../core/offline/sync-orchestrator.service';
import { type Observable, firstValueFrom, from, map, mergeMap } from 'rxjs';

export interface GanaderoItem {
  id: string;
  businessIdentifier: string;
  name: string;
  email: string;
  contactInfo: string;
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
  outcome: 'synced' | 'queued' | 'blocked';
  message: string;
}

export interface UpsertGanaderoPayload {
  businessIdentifier: string;
  name: string;
  email?: string;
  contactInfo?: string;
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
  entityChangeBus: OfflineEntityChangeBus;
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
  private entityChangeBus: OfflineEntityChangeBus = inject(OfflineEntityChangeBus);
  private readonly recentlyMutatedGanaderoIds = new Set<string>();
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
    this.entityChangeBus = dependencies.entityChangeBus ?? this.entityChangeBus;
    this.now = dependencies.now ?? this.now;
    this.windowRef = dependencies.windowRef ?? this.windowRef;
  }

  listGanaderos(active?: boolean): Observable<GanaderoItem[]> {
    return from(this.listGanaderosInternal(active));
  }

  createGanadero(payload: UpsertGanaderoPayload): Observable<GanaderoMutationFeedback> {
    return from(this.enqueueCreate(payload));
  }

  updateStatus(id: string, active: boolean): Observable<GanaderoMutationFeedback> {
    return from(this.enqueueStatusUpdate(id, active));
  }

  updateGanadero(id: string, payload: UpsertGanaderoPayload): Observable<GanaderoMutationFeedback> {
    if (!this.offlineStatus.isOnline()) {
      return from(
        Promise.resolve({
          outcome: 'blocked',
          message:
            'La edición de ganaderos requiere conexión para mantener la información consistente.',
        } satisfies GanaderoMutationFeedback),
      );
    }

    return this.http
      .put<GanaderoItem>(`${this.appConfig.config().apiBaseUrl}/admin/ganaderos/${id}`, payload, {
        headers: this.buildMutationHeaders(),
      })
      .pipe(
        mergeMap(async (ganadero) => {
          await this.saveGanaderoSnapshot(ganadero);
          this.recentlyMutatedGanaderoIds.add(ganadero.id);
          this.emitGanaderoChange(ganadero.id, 'online-mutation', 'snapshot-upsert');
          return {
            outcome: 'synced',
            message: 'Ganadero actualizado correctamente.',
          } satisfies GanaderoMutationFeedback;
        }),
      );
  }

  resetPassword(id: string): Observable<GanaderoMutationFeedback> {
    if (!this.offlineStatus.isOnline()) {
      return from(
        Promise.resolve({
          outcome: 'blocked',
          message: 'El reseteo de contraseña requiere conexión para aplicar el cambio inmediato.',
        } satisfies GanaderoMutationFeedback),
      );
    }

    return this.http
      .put<{ message: string }>(
        `${this.appConfig.config().apiBaseUrl}/admin/ganaderos/${id}/reset-password`,
        {},
        {
          headers: this.buildMutationHeaders(),
        },
      )
      .pipe(
        map(
          (response) =>
            ({
              outcome: 'synced',
              message: response.message,
            }) satisfies GanaderoMutationFeedback,
        ),
      );
  }

  private async listGanaderosInternal(active?: boolean) {
    const hasPendingGanaderoOperations = await this.hasPendingGanaderoOperations();
    await this.refreshPendingState();

    if (!this.offlineStatus.isOnline() || hasPendingGanaderoOperations) {
      return this.listGanaderoSnapshots(active);
    }

    const params = active === undefined ? '' : `?active=${active}`;
    const response = await firstValueFrom(
      this.http.get<GanaderosResponse>(
        `${this.appConfig.config().apiBaseUrl}/admin/ganaderos${params}`,
        {
          headers: this.buildHeaders(),
        },
      ),
    );

    const ganaderos = await this.mergeRecentlyMutatedSnapshots(response.ganaderos, active);
    await Promise.all(ganaderos.map((ganadero) => this.saveGanaderoSnapshot(ganadero)));
    await this.refreshPendingState();
    return ganaderos;
  }

  private async enqueueCreate(payload: UpsertGanaderoPayload) {
    const now = this.now();
    const operation = await this.store.enqueueOperation({
      entityType: 'GANADERO',
      entityId: `pending:${globalThis.crypto.randomUUID()}`,
      opType: 'CREATE',
      payload: { ...payload } as Record<string, unknown>,
      clientCreatedAt: now,
      clientUpdatedAt: now,
    });
    await this.store.reassignOperationEntityId(operation.operationId, operation.operationId);
    const pendingId = `pending:${operation.operationId}`;
    await this.saveGanaderoSnapshot(
      {
        id: pendingId,
        businessIdentifier: payload.businessIdentifier,
        name: payload.name,
        email: payload.email ?? '',
        contactInfo: payload.contactInfo ?? '',
        active: true,
        version: 0,
        createdAt: now,
        updatedAt: now,
        lastSyncedAt: null,
      },
      operation.operationId,
    );
    this.recentlyMutatedGanaderoIds.add(operation.operationId);
    this.emitGanaderoChange(operation.operationId, 'local-mutation', 'create');
    await this.refreshPendingState({
      lastMessage: 'Alta de ganadero encolada. Se enviará al reconectar.',
    });

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
    const statusSnapshotSaved = await this.applyOptimisticStatus(canonicalEntityId, active, now);
    if (statusSnapshotSaved) {
      this.recentlyMutatedGanaderoIds.add(canonicalEntityId);
      this.emitGanaderoChange(canonicalEntityId, 'local-mutation', 'status-update');
    }
    await this.refreshPendingState({
      lastMessage: 'Cambio de estado encolado. Se enviará al reconectar.',
    });

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
    return active === undefined
      ? ganaderos
      : ganaderos.filter((ganadero) => ganadero.active === active);
  }

  private async mergeRecentlyMutatedSnapshots(ganaderos: GanaderoItem[], active?: boolean) {
    if (!this.recentlyMutatedGanaderoIds.size) {
      return filterGanaderosByActive(ganaderos, active);
    }

    const merged = [...ganaderos];
    const snapshots = await this.store.listSnapshots('GANADERO');
    const outbox = await this.store.listOutbox();

    for (const ganaderoId of [...this.recentlyMutatedGanaderoIds]) {
      let snapshot = snapshots.find((current) => current.entityId === ganaderoId);
      let effectiveGanaderoId = ganaderoId;

      if (!snapshot) {
        const reconciledSnapshot = findReconciledCreateSnapshot(ganaderoId, snapshots, outbox);
        if (reconciledSnapshot) {
          snapshot = reconciledSnapshot;
          effectiveGanaderoId = reconciledSnapshot.entityId;
          this.recentlyMutatedGanaderoIds.delete(ganaderoId);
          this.recentlyMutatedGanaderoIds.add(effectiveGanaderoId);
        }
      }

      const localGanadero = snapshot?.payload as GanaderoItem | undefined;
      if (!localGanadero) {
        this.recentlyMutatedGanaderoIds.delete(ganaderoId);
        continue;
      }

      const serverIndex = merged.findIndex((ganadero) => ganadero.id === effectiveGanaderoId);
      if (serverIndex < 0) {
        merged.unshift(localGanadero);
        continue;
      }

      if (isLocalNewer(localGanadero.updatedAt, merged[serverIndex].updatedAt)) {
        merged[serverIndex] = localGanadero;
        continue;
      }

      this.recentlyMutatedGanaderoIds.delete(effectiveGanaderoId);
    }

    return filterGanaderosByActive(merged, active);
  }

  private async hasPendingGanaderoOperations() {
    const outbox = await this.store.listOutbox();
    return outbox.some(
      (operation) =>
        operation.entityType === 'GANADERO' &&
        (operation.status === 'pending' ||
          operation.status === 'retry_scheduled' ||
          operation.status === 'in_flight'),
    );
  }

  private async applyOptimisticStatus(id: string, active: boolean, now: string) {
    const snapshots = await this.store.listSnapshots('GANADERO');
    const existing = snapshots.find((snapshot) => snapshot.entityId === id);
    if (!existing) {
      return false;
    }

    const ganadero = existing.payload as unknown as GanaderoItem;
    await this.saveGanaderoSnapshot({
      ...ganadero,
      active,
      updatedAt: now,
    });
    return true;
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

  private emitGanaderoChange(
    ganaderoId: string,
    source: 'local-mutation' | 'online-mutation',
    operation: 'create' | 'snapshot-upsert' | 'status-update',
  ) {
    this.entityChangeBus.emit({
      entity: 'GANADERO',
      source,
      operation,
      ids: [ganaderoId],
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
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
  }
}

function filterGanaderosByActive(ganaderos: GanaderoItem[], active?: boolean) {
  return active === undefined
    ? ganaderos
    : ganaderos.filter((ganadero) => ganadero.active === active);
}

function findReconciledCreateSnapshot(
  operationId: string,
  snapshots: Awaited<ReturnType<OfflineStoreService['listSnapshots']>>,
  outbox: Awaited<ReturnType<OfflineStoreService['listOutbox']>>,
) {
  const operation = outbox.find(
    (current) =>
      current.operationId === operationId &&
      current.entityType === 'GANADERO' &&
      current.opType === 'CREATE' &&
      current.status === 'acked',
  );

  if (!operation) {
    return null;
  }

  return (
    snapshots.find(
      (snapshot) =>
        snapshot.entityType === 'GANADERO' &&
        snapshot.entityId !== operationId &&
        matchesGanaderoCreatePayload(snapshot.payload as Partial<GanaderoItem>, operation.payload),
    ) ?? null
  );
}

function matchesGanaderoCreatePayload(
  ganadero: Partial<GanaderoItem>,
  payload: Record<string, unknown>,
) {
  return (
    ganadero.businessIdentifier === payload['businessIdentifier'] &&
    ganadero.name === payload['name'] &&
    (ganadero.email ?? '') === (payload['email'] ?? '') &&
    (ganadero.contactInfo ?? '') === (payload['contactInfo'] ?? '')
  );
}

function isLocalNewer(localUpdatedAt: string, serverUpdatedAt: string) {
  return localUpdatedAt.localeCompare(serverUpdatedAt) > 0;
}
