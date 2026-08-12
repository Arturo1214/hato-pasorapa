import { HttpClient, HttpHeaders } from '@angular/common/http';
import { computed, inject, Injectable } from '@angular/core';
import { ApplicationConfigService } from '../../../../core/config/application-config.service';
import {
  AuthService,
  type Role,
  type UserStatus,
} from '../../../../core/auth/data-access/auth.service';
import { OfflineEntityChangeBus } from '../../../../core/offline/offline-entity-change-bus.service';
import {
  DEFAULT_OFFLINE_STORE_SERVICE,
  type OfflineStoreService,
} from '../../../../core/offline/offline-store.service';
import { SyncMetricsStore } from '../../../../core/offline/sync-metrics.store';
import { OfflineStatusService } from '../../../../core/offline/offline-status.service';
import { triggerManualSync } from '../../../../core/offline/sync-orchestrator.service';
import { type Observable, firstValueFrom, from, map, mergeMap } from 'rxjs';

export interface ManagedUser {
  id: string;
  username: string;
  email: string;
  displayName: string;
  role: Role;
  status: UserStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
  lastSyncedAt: string | null;
}

interface ManagedUsersResponse {
  users: ManagedUser[];
}

export interface CreateManagedUserPayload {
  username: string;
  email: string;
  displayName: string;
  role: Role;
  password: string;
}

export interface UpdateManagedUserPayload {
  username: string;
  email: string;
  displayName: string;
  role: Role;
}

export interface AdminMutationFeedback {
  outcome: 'synced' | 'queued' | 'blocked';
  message: string;
}

export interface AdminUsersSyncState {
  pending: number;
  syncing: boolean;
  lastSyncAt: string | null;
  lastMessage: string | null;
  manualRefreshRequired: boolean;
}

export interface AdminUsersServiceDependencies {
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
export class AdminUsersService {
  private http: Pick<HttpClient, 'get' | 'post' | 'put'> = inject(HttpClient);
  private appConfig: Pick<ApplicationConfigService, 'config'> = inject(ApplicationConfigService);
  private authService: Pick<AuthService, 'getAccessToken'> = inject(AuthService);
  private offlineStatus: OfflineStatusService = inject(OfflineStatusService);
  private store: OfflineStoreService = DEFAULT_OFFLINE_STORE_SERVICE;
  private metricsStore: SyncMetricsStore = inject(SyncMetricsStore);
  private entityChangeBus: OfflineEntityChangeBus = inject(OfflineEntityChangeBus);
  private readonly recentlyMutatedUserIds = new Set<string>();
  private now: () => string = () => new Date().toISOString();
  private windowRef: Pick<Window, 'dispatchEvent'> | undefined = globalThis.window;
  readonly syncState = computed<AdminUsersSyncState>(() => ({
    pending: this.metricsStore.metrics().pending,
    syncing: this.metricsStore.metrics().syncing,
    lastSyncAt: this.metricsStore.metrics().lastSyncAt,
    lastMessage: this.metricsStore.metrics().lastMessage,
    manualRefreshRequired: this.metricsStore.metrics().manualRefreshRequired,
  }));

  constructor() {}

  configureForTesting(dependencies: Partial<AdminUsersServiceDependencies>) {
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

  listUsers(status?: UserStatus): Observable<ManagedUser[]> {
    return from(this.listUsersInternal(status));
  }

  createUser(payload: CreateManagedUserPayload): Observable<AdminMutationFeedback> {
    if (!this.offlineStatus.isOnline()) {
      return from(
        Promise.resolve({
          outcome: 'blocked',
          message:
            'La creación de usuarios requiere conexión para no persistir credenciales sensibles sin conexión.',
        } satisfies AdminMutationFeedback),
      );
    }

    return this.http
      .post<ManagedUser>(`${this.appConfig.config().apiBaseUrl}/admin/users`, payload, {
        headers: this.buildMutationHeaders(),
      })
      .pipe(
        mergeMap(async (user) => {
          await this.saveUserSnapshot(user);
          this.recentlyMutatedUserIds.add(user.id);
          this.emitUserChange(user.id, 'online-mutation', 'snapshot-upsert');
          return {
            outcome: 'synced',
            message: 'Usuario guardado correctamente.',
          } satisfies AdminMutationFeedback;
        }),
      );
  }

  updateUser(userId: string, payload: UpdateManagedUserPayload): Observable<AdminMutationFeedback> {
    if (!this.offlineStatus.isOnline()) {
      return from(
        Promise.resolve({
          outcome: 'blocked',
          message: 'La edición de usuarios requiere conexión para mantener el padrón consistente.',
        } satisfies AdminMutationFeedback),
      );
    }

    return this.http
      .put<ManagedUser>(`${this.appConfig.config().apiBaseUrl}/admin/users/${userId}`, payload, {
        headers: this.buildMutationHeaders(),
      })
      .pipe(
        mergeMap(async (user) => {
          await this.saveUserSnapshot(user);
          this.recentlyMutatedUserIds.add(user.id);
          this.emitUserChange(user.id, 'online-mutation', 'snapshot-upsert');
          return {
            outcome: 'synced',
            message: 'Usuario actualizado correctamente.',
          } satisfies AdminMutationFeedback;
        }),
      );
  }

  updateStatus(userId: string, status: UserStatus): Observable<AdminMutationFeedback> {
    return from(this.enqueueStatusUpdate(userId, status));
  }

  resetPassword(userId: string, password: string): Observable<AdminMutationFeedback> {
    if (!this.offlineStatus.isOnline()) {
      return from(
        Promise.resolve({
          outcome: 'blocked',
          message:
            'El restablecimiento de contraseñas requiere conexión para no persistir credenciales sensibles sin conexión.',
        } satisfies AdminMutationFeedback),
      );
    }

    return this.http
      .put(
        `${this.appConfig.config().apiBaseUrl}/admin/users/${userId}/password`,
        { password },
        { headers: this.buildMutationHeaders() },
      )
      .pipe(
        map(() => {
          this.metricsStore.patch({
            lastMessage: 'Contraseña reseteada correctamente.',
            manualRefreshRequired: false,
          });

          return {
            outcome: 'synced',
            message: 'Contraseña reseteada correctamente.',
          } satisfies AdminMutationFeedback;
        }),
      );
  }

  private async listUsersInternal(status?: UserStatus) {
    const hasPendingUserOperations = await this.hasPendingUserOperations();
    await this.refreshPendingState();

    if (!this.offlineStatus.isOnline() || hasPendingUserOperations) {
      return this.listUserSnapshots(status);
    }

    const params = status ? `?status=${status}` : '';
    const response = await firstValueFrom(
      this.http.get<ManagedUsersResponse>(
        `${this.appConfig.config().apiBaseUrl}/admin/users${params}`,
        {
          headers: this.buildHeaders(),
        },
      ),
    );

    const users = await this.mergeRecentlyMutatedSnapshots(response.users, status);
    await Promise.all(users.map((user) => this.saveUserSnapshot(user)));
    await this.refreshPendingState();
    return users;
  }

  private async enqueueStatusUpdate(userId: string, status: UserStatus) {
    const now = this.now();
    await this.store.enqueueOperation({
      entityType: 'USER',
      entityId: userId,
      opType: 'STATUS_UPDATE',
      payload: { status },
      clientCreatedAt: now,
      clientUpdatedAt: now,
    });
    const statusSnapshotSaved = await this.applyOptimisticStatus(userId, status, now);
    if (statusSnapshotSaved) {
      this.recentlyMutatedUserIds.add(userId);
      this.emitUserChange(userId, 'local-mutation', 'status-update');
    }
    await this.refreshPendingState({
      lastMessage: 'Cambio de estado encolado. Se enviará al reconectar.',
    });

    if (this.offlineStatus.isOnline()) {
      triggerManualSync(this.windowRef);
      return {
        outcome: 'queued',
        message: 'Cambio de estado encolado. Se disparó la sincronización automática.',
      } satisfies AdminMutationFeedback;
    }

    return {
      outcome: 'queued',
      message: 'Cambio de estado encolado. Se enviará al reconectar.',
    } satisfies AdminMutationFeedback;
  }

  private async listUserSnapshots(status?: UserStatus) {
    const snapshots = await this.store.listSnapshots('USER');
    const users = snapshots.map((snapshot) => snapshot.payload as unknown as ManagedUser);
    return status ? users.filter((user) => user.status === status) : users;
  }

  private async mergeRecentlyMutatedSnapshots(users: ManagedUser[], status?: UserStatus) {
    if (!this.recentlyMutatedUserIds.size) {
      return filterUsersByStatus(users, status);
    }

    const merged = [...users];
    const snapshots = await this.store.listSnapshots('USER');

    for (const userId of [...this.recentlyMutatedUserIds]) {
      const localUser = snapshots.find((snapshot) => snapshot.entityId === userId)?.payload as
        | ManagedUser
        | undefined;
      if (!localUser) {
        this.recentlyMutatedUserIds.delete(userId);
        continue;
      }

      const serverIndex = merged.findIndex((user) => user.id === userId);
      if (serverIndex < 0) {
        merged.unshift(localUser);
        continue;
      }

      if (isLocalNewer(localUser.updatedAt, merged[serverIndex].updatedAt)) {
        merged[serverIndex] = localUser;
        continue;
      }

      this.recentlyMutatedUserIds.delete(userId);
    }

    return filterUsersByStatus(merged, status);
  }

  private async hasPendingUserOperations() {
    const outbox = await this.store.listOutbox();
    return outbox.some(
      (operation) =>
        operation.entityType === 'USER' &&
        (operation.status === 'pending' ||
          operation.status === 'retry_scheduled' ||
          operation.status === 'in_flight'),
    );
  }

  private async applyOptimisticStatus(userId: string, status: UserStatus, now: string) {
    const snapshots = await this.store.listSnapshots('USER');
    const existing = snapshots.find((snapshot) => snapshot.entityId === userId);
    if (!existing) {
      return false;
    }

    const user = existing.payload as unknown as ManagedUser;
    await this.saveUserSnapshot({
      ...user,
      status,
      updatedAt: now,
    });
    return true;
  }

  private async saveUserSnapshot(user: ManagedUser) {
    await this.store.saveSnapshot({
      key: `USER:${user.id}`,
      entityType: 'USER',
      entityId: user.id,
      payload: { ...user },
      updatedAt: user.updatedAt,
      version: user.version,
    });
  }

  private emitUserChange(
    userId: string,
    source: 'local-mutation' | 'online-mutation',
    operation: 'snapshot-upsert' | 'status-update',
  ) {
    this.entityChangeBus.emit({
      entity: 'USER',
      source,
      operation,
      ids: [userId],
    });
  }

  private async refreshPendingState(overrides: Partial<AdminUsersSyncState> = {}) {
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

function filterUsersByStatus(users: ManagedUser[], status?: UserStatus) {
  return status ? users.filter((user) => user.status === status) : users;
}

function isLocalNewer(localUpdatedAt: string, serverUpdatedAt: string) {
  return localUpdatedAt.localeCompare(serverUpdatedAt) > 0;
}
