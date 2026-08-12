import { HttpClient, HttpHeaders } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../../core/auth/data-access/auth.service';
import { ApplicationConfigService } from '../../../../core/config/application-config.service';
import { DEFAULT_OFFLINE_STORE_SERVICE, OfflineStoreService } from '../../../../core/offline/offline-store.service';
import {
  SYNC_CONFLICTS_REFRESH_EVENT,
  triggerManualSync,
  triggerSyncConflictsRefresh,
} from '../../../../core/offline/sync-orchestrator.service';
import type {
  ConflictAuditEntry,
  ConflictDiffField,
  ManualResolutionAction,
  OfflineOperationEnvelope,
  OfflineOperationType,
  OfflineEntityType,
  ResolutionPolicy,
} from '../../../../core/offline/offline-types';

export interface ConflictResolutionListItem {
  operationId: string;
  entityType: OfflineEntityType;
  entityId: string;
  opType: OfflineOperationType;
  classification: 'version_conflict' | 'validation_error';
  reason: string;
  localPayload: Record<string, unknown>;
  clientUpdatedAt: string;
  serverVersion?: number;
  serverState?: Record<string, unknown> | null;
  diffFields: ConflictDiffField[];
  policy?: ResolutionPolicy;
  allowedActions: ManualResolutionAction[];
  auditTrail: ConflictAuditEntry[];
}

interface ResolveConflictResponse {
  operationId: string;
  status: 'resolved' | 'already_resolved';
  resultVersion: string;
  nextLocalStatus: 'acked' | 'pending';
  entityId?: string;
  serverVersion?: number;
  serverState?: Record<string, unknown> | null;
}

interface SyncConflictApiClient {
  listConflicts(): Promise<ConflictResolutionListItem[]>;
  resolveConflict(operationId: string, payload: { action: ManualResolutionAction; reason: string }): Promise<ResolveConflictResponse>;
}

@Injectable({ providedIn: 'root' })
export class AdminConflictResolutionStore {
  private offlineStore: OfflineStoreService = DEFAULT_OFFLINE_STORE_SERVICE;
  private apiClient: SyncConflictApiClient = inject(AdminConflictResolutionApiService);
  private now: () => string = () => new Date().toISOString();
  private onlineStatus: { isOnline(): boolean } = { isOnline: () => true };
  private windowRef: Pick<Window, 'addEventListener' | 'dispatchEvent'> | undefined = globalThis.window;
  private initialized = false;

  private readonly itemsState = signal<ConflictResolutionListItem[]>([]);
  private readonly selectedOperationIdState = signal<string | null>(null);
  private readonly loadingState = signal(false);
  private readonly errorState = signal<string | null>(null);
  private readonly statusMessageState = signal<string | null>(null);

  readonly items = this.itemsState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly statusMessage = this.statusMessageState.asReadonly();
  readonly unresolvedCount = computed(() => this.itemsState().length);
  readonly selectedOperationId = this.selectedOperationIdState.asReadonly();
  readonly selectedConflict = computed(() =>
    this.itemsState().find((item) => item.operationId === this.selectedOperationIdState()) ?? this.itemsState()[0] ?? null
  );

  configureForTesting(
    dependencies: Partial<{
      offlineStore: OfflineStoreService;
      apiClient: SyncConflictApiClient;
      now: () => string;
      onlineStatus: { isOnline(): boolean };
      windowRef: Pick<Window, 'addEventListener' | 'dispatchEvent'>;
    }>
  ) {
    this.offlineStore = dependencies.offlineStore ?? this.offlineStore;
    this.apiClient = dependencies.apiClient ?? this.apiClient;
    this.now = dependencies.now ?? this.now;
    this.onlineStatus = dependencies.onlineStatus ?? this.onlineStatus;
    this.windowRef = dependencies.windowRef ?? this.windowRef;
  }

  async initialize() {
    if (!this.initialized) {
      this.initialized = true;
      this.windowRef?.addEventListener(SYNC_CONFLICTS_REFRESH_EVENT, () => {
        void this.rebuild('post-sync');
      });
    }

    await this.rebuild('startup');
  }

  async rebuild(reason: 'startup' | 'post-sync' | 'manual' | 'resolve') {
    this.loadingState.set(true);
    this.errorState.set(null);

    try {
      const [localConflicts, serverConflicts] = await Promise.all([
        this.offlineStore.listConflictOperations(),
        this.apiClient.listConflicts(),
      ]);

      const serverByOperationId = new Map(serverConflicts.map((item) => [item.operationId, item]));
      const items: ConflictResolutionListItem[] = [];

      for (const operation of localConflicts) {
        const server = serverByOperationId.get(operation.operationId);
        if (!server) {
          continue;
        }

        const localAudit = await this.offlineStore.listConflictAudit(operation.operationId);
        items.push({
          ...server,
          entityId: operation.entityId ?? server.entityId,
          localPayload: operation.payload,
          clientUpdatedAt: operation.clientUpdatedAt,
          auditTrail: mergeAuditTrail(server.auditTrail, localAudit),
        });
      }

      items.sort((left, right) => right.clientUpdatedAt.localeCompare(left.clientUpdatedAt) || right.operationId.localeCompare(left.operationId));
      this.itemsState.set(items);

      if (!items.some((item) => item.operationId === this.selectedOperationIdState())) {
        this.selectedOperationIdState.set(items[0]?.operationId ?? null);
      }

      this.statusMessageState.set(
        reason === 'resolve'
          ? 'Resolución manual aplicada sobre el estado local y auditada en el backend.'
          : reason === 'manual'
            ? 'Conflictos refrescados desde el backend y el outbox local.'
            : null
      );
    } catch {
      this.errorState.set('No pudimos reconstruir la bandeja de conflictos sin conexión.');
    } finally {
      this.loadingState.set(false);
    }
  }

  select(operationId: string) {
    this.selectedOperationIdState.set(operationId);
  }

  async refreshNow() {
    if (!this.onlineStatus.isOnline()) {
      this.statusMessageState.set('Sin conectividad: mostramos el último conflicto local y diferimos la reconciliación remota.');
      return;
    }

    await this.rebuild('manual');
    triggerManualSync(this.windowRef);
  }

  async resolveSelected(action: ManualResolutionAction, reason: string) {
    const selected = this.selectedConflict();
    if (!selected) {
      return;
    }

    const response = await this.apiClient.resolveConflict(selected.operationId, { action, reason });

    if (response.nextLocalStatus === 'pending') {
      await this.offlineStore.markPending(selected.operationId);
    } else {
      if (response.serverState) {
        await this.offlineStore.replaceSnapshotFromServer(
          selected.entityType,
          response.serverState,
          response.entityId ?? selected.entityId,
          response.serverVersion
        );
      }
      await this.offlineStore.markAcked(selected.operationId);
    }

    await this.offlineStore.saveConflictAudit(selected.operationId, {
      eventType: 'RESOLVED',
      decision: action,
      resultStatus: response.nextLocalStatus,
      reason,
      createdAt: this.now(),
    });

    triggerSyncConflictsRefresh(this.windowRef);
    await this.rebuild('resolve');
  }
}

@Injectable({ providedIn: 'root' })
export class AdminConflictResolutionApiService implements SyncConflictApiClient {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(ApplicationConfigService);
  private readonly authService = inject(AuthService);

  async listConflicts() {
    return firstValueFrom(
      this.http.get<ConflictResolutionListItem[]>(`${this.appConfig.config().apiBaseUrl}/sync/conflicts`, {
        headers: this.buildHeaders(),
      })
    );
  }

  async resolveConflict(operationId: string, payload: { action: ManualResolutionAction; reason: string }) {
    return firstValueFrom(
      this.http.post<ResolveConflictResponse>(
        `${this.appConfig.config().apiBaseUrl}/sync/conflicts/${operationId}/resolve`,
        payload,
        { headers: this.buildHeaders() }
      )
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

function mergeAuditTrail(serverAudit: ConflictAuditEntry[], localAudit: ConflictAuditEntry[]) {
  const seen = new Set<string>();
  return [...serverAudit, ...localAudit].filter((entry) => {
    const key = `${entry.eventType}:${entry.decision ?? 'none'}:${entry.createdAt}:${entry.reason}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
