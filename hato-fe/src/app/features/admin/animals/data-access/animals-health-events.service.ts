import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom, from, type Observable } from 'rxjs';
import { AuthService } from '../../../../core/auth/data-access/auth.service';
import { ApplicationConfigService } from '../../../../core/config/application-config.service';
import {
  type AnimalHealthEventOfflineCreatePayload,
  type AnimalHealthEventOfflineMetadata,
  type AnimalHealthEventSnapshotPayload,
} from '../../../../core/offline/offline-types';
import { OfflineStatusService } from '../../../../core/offline/offline-status.service';
import { DEFAULT_OFFLINE_STORE_SERVICE, OfflineStoreService } from '../../../../core/offline/offline-store.service';
import { triggerManualSync } from '../../../../core/offline/sync-orchestrator.service';
import { SyncMetricsStore } from '../../../../core/offline/sync-metrics.store';
import {
  compareAnimalHealthEventTimeline,
  decorateAnimalHealthTimeline,
  matchesAnimalHealthEventFilters,
  normalizeAnimalHealthEventItem,
} from './animal-health-events-timeline.adapter';

export interface AnimalHealthEventItem {
  id: string;
  animalUuid: string;
  healthEventType:
    | 'VACCINATION'
    | 'DEWORMING'
    | 'DISEASE_REPORTED'
    | 'TREATMENT_STARTED'
    | 'TREATMENT_FOLLOW_UP'
    | 'TREATMENT_CLOSED'
    | 'FIELD_VET_VISIT';
  occurredAt: string;
  notes: string | null;
  performedByUserId: string;
  sourceChannel: 'ONLINE' | 'OFFLINE';
  operationId: string;
  metadata: AnimalHealthEventOfflineMetadata;
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

export interface AnimalHealthEventListFilters {
  healthEventType?: AnimalHealthEventItem['healthEventType'];
  occurredFrom?: string;
  occurredTo?: string;
  visitId?: string;
}

export interface AnimalHealthEventCreateInput {
  animalUuid: string;
  healthEventType: AnimalHealthEventItem['healthEventType'];
  occurredAt: string;
  notes?: string | null;
  metadata: AnimalHealthEventOfflineMetadata;
}

export interface AnimalHealthEventMutationFeedback {
  outcome: 'queued' | 'blocked';
  message: string;
}

interface AnimalHealthEventListResponse {
  items: Array<Record<string, unknown>>;
}

@Injectable({ providedIn: 'root' })
export class AnimalsHealthEventsService {
  private http: Pick<HttpClient, 'get'> = inject(HttpClient);
  private appConfig: Pick<ApplicationConfigService, 'config'> = inject(ApplicationConfigService);
  private authService: Pick<AuthService, 'getAccessToken' | 'currentUser'> = inject(AuthService);
  private offlineStatus: Pick<OfflineStatusService, 'isOnline'> = inject(OfflineStatusService);
  private store: OfflineStoreService = DEFAULT_OFFLINE_STORE_SERVICE;
  private metricsStore = inject(SyncMetricsStore);
  private now: () => string = () => new Date().toISOString();
  private windowRef: Pick<Window, 'dispatchEvent'> | undefined = globalThis.window;

  configureForTesting(dependencies: Partial<{
    http: Pick<HttpClient, 'get'>;
    appConfig: Pick<ApplicationConfigService, 'config'>;
    authService: Pick<AuthService, 'getAccessToken' | 'currentUser'>;
    offlineStatus: Pick<OfflineStatusService, 'isOnline'>;
    store: OfflineStoreService;
    metricsStore: SyncMetricsStore;
    now: () => string;
    windowRef: Pick<Window, 'dispatchEvent'>;
  }>) {
    this.http = dependencies.http ?? this.http;
    this.appConfig = dependencies.appConfig ?? this.appConfig;
    this.authService = dependencies.authService ?? this.authService;
    this.offlineStatus = dependencies.offlineStatus ?? this.offlineStatus;
    this.store = dependencies.store ?? this.store;
    this.metricsStore = dependencies.metricsStore ?? this.metricsStore;
    this.now = dependencies.now ?? this.now;
    this.windowRef = dependencies.windowRef ?? this.windowRef;
  }

  listEvents(animalUuid: string, filters: AnimalHealthEventListFilters = {}): Observable<AnimalHealthEventItem[]> {
    return from(this.listEventsInternal(animalUuid, filters) as Promise<AnimalHealthEventItem[]>);
  }

  createEvent(input: AnimalHealthEventCreateInput): Observable<AnimalHealthEventMutationFeedback> {
    return from(this.createEventInternal(input) as Promise<AnimalHealthEventMutationFeedback>);
  }

  private async listEventsInternal(animalUuid: string, filters: AnimalHealthEventListFilters) {
    const hasLocalOperations = await this.hasLocalHealthEventOperations(animalUuid);

    if (!this.offlineStatus.isOnline() || hasLocalOperations) {
      return this.listLocalEventSnapshots(animalUuid, filters);
    }

    const response = await firstValueFrom(
      this.http.get<AnimalHealthEventListResponse>(
        `${this.appConfig.config().apiBaseUrl}/animals/${animalUuid}/health-events${buildHealthEventsQuery(filters)}`,
        { headers: this.buildHeaders() }
      )
    );

    const items = (response.items ?? [])
      .map(normalizeAnimalHealthEventItem)
      .filter((item) => matchesAnimalHealthEventFilters(item, filters));
    await Promise.all(items.map((item) => this.saveEventSnapshot(item)));
    return decorateAnimalHealthTimeline(items, []);
  }

  private async createEventInternal(input: AnimalHealthEventCreateInput) {
    const currentUser = this.authService.currentUser();
    if (!currentUser) {
      return { outcome: 'blocked', message: 'Necesitás sesión activa para registrar eventos sanitarios.' } satisfies AnimalHealthEventMutationFeedback;
    }

    const now = this.now();
    const operationId = globalThis.crypto.randomUUID();
    const sourceChannel = this.offlineStatus.isOnline() ? 'ONLINE' : 'OFFLINE';
    const payload: AnimalHealthEventOfflineCreatePayload = {
      animalUuid: input.animalUuid,
      healthEventType: input.healthEventType,
      occurredAt: normalizeOccurredAt(input.occurredAt),
      notes: normalizeOptionalText(input.notes),
      performedByUserId: currentUser.id,
      sourceChannel,
      operationId,
      metadata: input.metadata,
    };

    await this.store.enqueueOperation({
      entityType: 'ANIMAL_HEALTH_EVENT',
      entityId: operationId,
      opType: 'CREATE',
      payload: payload as unknown as Record<string, unknown>,
      baseVersion: 0,
      clientCreatedAt: now,
      clientUpdatedAt: now,
      operationId,
    });

    await this.saveEventSnapshot(createOptimisticHealthEventSnapshot(payload, now));
    await this.refreshPendingState();

    if (this.offlineStatus.isOnline()) {
      triggerManualSync(this.windowRef);
      return {
        outcome: 'queued',
        message: 'Evento sanitario encolado. Se disparó la sincronización automática.',
      } satisfies AnimalHealthEventMutationFeedback;
    }

    return {
      outcome: 'queued',
      message: 'Evento sanitario encolado. Se enviará al reconectar.',
    } satisfies AnimalHealthEventMutationFeedback;
  }

  private async listLocalEventSnapshots(animalUuid: string, filters: AnimalHealthEventListFilters) {
    const snapshots = await this.store.listSnapshots('ANIMAL_HEALTH_EVENT');
    const outbox = await this.store.listOutbox();

    const items = snapshots
      .map((snapshot) => snapshot.payload as unknown as AnimalHealthEventItem)
      .filter((item) => item.animalUuid === animalUuid)
      .filter((item) => matchesAnimalHealthEventFilters(item, filters));

    return decorateAnimalHealthTimeline(items, outbox);
  }

  private async hasLocalHealthEventOperations(animalUuid: string) {
    const outbox = await this.store.listOutbox();
    return outbox.some(
      (operation) =>
        operation.entityType === 'ANIMAL_HEALTH_EVENT' &&
        (operation.payload['animalUuid'] as string | undefined) === animalUuid &&
        operation.status !== 'acked' &&
        operation.status !== 'failed'
    );
  }

  private async saveEventSnapshot(item: AnimalHealthEventItem) {
    await this.store.saveSnapshot({
      key: `ANIMAL_HEALTH_EVENT:${item.id}`,
      entityType: 'ANIMAL_HEALTH_EVENT',
      entityId: item.id,
      payload: { ...item } satisfies AnimalHealthEventSnapshotPayload,
      updatedAt: item.updatedAt,
    });
  }

  private buildHeaders() {
    const token = this.authService.getAccessToken();
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
  }

  private async refreshPendingState() {
    this.metricsStore.patch({ pending: await this.store.countPendingOperations() });
  }
}

function createOptimisticHealthEventSnapshot(payload: AnimalHealthEventOfflineCreatePayload, now: string): AnimalHealthEventItem {
  return {
    id: payload.operationId,
    animalUuid: payload.animalUuid,
    healthEventType: payload.healthEventType,
    occurredAt: payload.occurredAt,
    notes: payload.notes ?? null,
    performedByUserId: payload.performedByUserId,
    sourceChannel: payload.sourceChannel,
    operationId: payload.operationId,
    metadata: payload.metadata,
    clientCreatedAt: now,
    createdAt: now,
    updatedAt: now,
    syncStatus: 'pending',
    syncMessage: 'Pendiente de sync.',
  };
}

function buildHealthEventsQuery(filters: AnimalHealthEventListFilters) {
  const params = new URLSearchParams();
  if (filters.healthEventType) {
    params.set('healthEventType', filters.healthEventType);
  }
  if (filters.occurredFrom) {
    params.set('occurredFrom', filters.occurredFrom);
  }
  if (filters.occurredTo) {
    params.set('occurredTo', filters.occurredTo);
  }
  if (filters.visitId) {
    params.set('visitId', filters.visitId);
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}

function normalizeOptionalText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeOccurredAt(value: string) {
  return value.includes('T') && !value.endsWith('Z') ? `${value}:00.000Z`.replace('T', 'T') : value;
}
