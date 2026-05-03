import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom, from, type Observable } from 'rxjs';
import { AuthService } from '../../../../core/auth/data-access/auth.service';
import { ApplicationConfigService } from '../../../../core/config/application-config.service';
import {
  type AnimalEventOfflineCreatePayload,
  type AnimalEventOfflineMetadata,
  type AnimalEventSnapshotPayload,
  type AnimalOfflineSnapshotPayload,
} from '../../../../core/offline/offline-types';
import { OfflineStatusService } from '../../../../core/offline/offline-status.service';
import { DEFAULT_OFFLINE_STORE_SERVICE, OfflineStoreService } from '../../../../core/offline/offline-store.service';
import { triggerManualSync } from '../../../../core/offline/sync-orchestrator.service';
import { SyncMetricsStore } from '../../../../core/offline/sync-metrics.store';
import {
  compareAnimalEventTimeline,
  decorateAnimalEventSnapshot,
  matchesAnimalEventFilters,
  normalizeAnimalEventItem,
} from './animal-events-timeline.adapter';

export interface AnimalEventItem {
  id: string;
  animalUuid: string;
  type: 'SOLD' | 'DECEASED' | 'LOST' | 'TRANSFERRED' | 'CASTRATION' | 'OBSERVATION';
  occurredAt: string;
  notes: string | null;
  performedByUserId: string;
  sourceChannel: 'ONLINE' | 'OFFLINE';
  operationId: string;
  metadata: AnimalEventOfflineMetadata;
  clientCreatedAt: string;
  createdAt: string;
  updatedAt: string;
  syncStatus?: 'synced' | 'pending' | 'conflict';
  syncMessage?: string | null;
}

export interface AnimalEventListFilters {
  eventType?: AnimalEventItem['type'];
  occurredFrom?: string;
  occurredTo?: string;
}

export interface AnimalEventCreateInput {
  animalUuid: string;
  type: AnimalEventItem['type'];
  occurredAt: string;
  notes?: string | null;
  metadata: AnimalEventOfflineMetadata;
}

export interface AnimalEventMutationFeedback {
  outcome: 'queued' | 'blocked';
  message: string;
}

export interface AnimalsEventsServiceDependencies {
  http: Pick<HttpClient, 'get'>;
  appConfig: Pick<ApplicationConfigService, 'config'>;
  authService: Pick<AuthService, 'getAccessToken' | 'currentUser'>;
  offlineStatus: Pick<OfflineStatusService, 'isOnline'>;
  store: OfflineStoreService;
  metricsStore: SyncMetricsStore;
  now: () => string;
  windowRef: Pick<Window, 'dispatchEvent'>;
}

interface AnimalEventListResponse {
  items: Array<Record<string, unknown>>;
}

@Injectable({ providedIn: 'root' })
export class AnimalsEventsService {
  private http: Pick<HttpClient, 'get'> = inject(HttpClient);
  private appConfig: Pick<ApplicationConfigService, 'config'> = inject(ApplicationConfigService);
  private authService: Pick<AuthService, 'getAccessToken' | 'currentUser'> = inject(AuthService);
  private offlineStatus: Pick<OfflineStatusService, 'isOnline'> = inject(OfflineStatusService);
  private store: OfflineStoreService = DEFAULT_OFFLINE_STORE_SERVICE;
  private metricsStore = inject(SyncMetricsStore);
  private now: () => string = () => new Date().toISOString();
  private windowRef: Pick<Window, 'dispatchEvent'> | undefined = globalThis.window;

  configureForTesting(dependencies: Partial<AnimalsEventsServiceDependencies>) {
    this.http = dependencies.http ?? this.http;
    this.appConfig = dependencies.appConfig ?? this.appConfig;
    this.authService = dependencies.authService ?? this.authService;
    this.offlineStatus = dependencies.offlineStatus ?? this.offlineStatus;
    this.store = dependencies.store ?? this.store;
    this.metricsStore = dependencies.metricsStore ?? this.metricsStore;
    this.now = dependencies.now ?? this.now;
    this.windowRef = dependencies.windowRef ?? this.windowRef;
  }

  listEvents(animalUuid: string, filters: AnimalEventListFilters = {}): Observable<AnimalEventItem[]> {
    return from(this.listEventsInternal(animalUuid, filters) as Promise<AnimalEventItem[]>);
  }

  createEvent(input: AnimalEventCreateInput): Observable<AnimalEventMutationFeedback> {
    return from(this.createEventInternal(input) as Promise<AnimalEventMutationFeedback>);
  }

  createCastrationEvent(
    animalUuid: string,
    payload: Pick<AnimalEventCreateInput, 'occurredAt' | 'notes' | 'metadata'>
  ): Observable<AnimalEventMutationFeedback> {
    return this.createEvent({
      animalUuid,
      type: 'CASTRATION',
      occurredAt: payload.occurredAt,
      notes: payload.notes,
      metadata: payload.metadata,
    });
  }

  private async listEventsInternal(animalUuid: string, filters: AnimalEventListFilters) {
    const hasLocalEventOperations = await this.hasLocalAnimalEventOperations(animalUuid);

    if (!this.offlineStatus.isOnline() || hasLocalEventOperations) {
      return this.listLocalEventSnapshots(animalUuid, filters);
    }

    const response = await firstValueFrom(
      this.http.get<AnimalEventListResponse>(
        `${this.appConfig.config().apiBaseUrl}/animals/${animalUuid}/events${buildEventsQuery(filters)}`,
        { headers: this.buildHeaders() }
      )
    );

    const items = (response.items ?? []).map(normalizeAnimalEventItem).filter((item) => matchesAnimalEventFilters(item, filters));
    await Promise.all(items.map((item) => this.saveEventSnapshot(item)));
    return items.sort(compareAnimalEventTimeline).map(
      (item) => ({ ...item, syncStatus: 'synced', syncMessage: null }) satisfies AnimalEventItem
    );
  }

  private async createEventInternal(input: AnimalEventCreateInput) {
    const currentUser = this.authService.currentUser();
    if (!currentUser) {
      return { outcome: 'blocked', message: 'Necesitás sesión activa para registrar eventos animales.' } satisfies AnimalEventMutationFeedback;
    }

    const now = this.now();
    const operationId = globalThis.crypto.randomUUID();
    const sourceChannel = this.offlineStatus.isOnline() ? 'ONLINE' : 'OFFLINE';
    const payload: AnimalEventOfflineCreatePayload = {
      animalUuid: input.animalUuid,
      type: input.type,
      occurredAt: normalizeOccurredAt(input.occurredAt),
      notes: normalizeOptionalText(input.notes),
      performedByUserId: currentUser.id,
      sourceChannel,
      operationId,
      metadata: input.metadata,
    };

    await this.store.enqueueOperation({
      entityType: 'ANIMAL_EVENT',
      entityId: operationId,
      opType: 'CREATE',
      payload: payload as unknown as Record<string, unknown>,
      baseVersion: 0,
      clientCreatedAt: now,
      clientUpdatedAt: now,
      operationId,
    });

    await this.saveEventSnapshot(createOptimisticEventSnapshot(payload, now));
    await this.applyOptimisticAnimalProjection(payload, now);
    await this.refreshPendingState();

    if (this.offlineStatus.isOnline()) {
      triggerManualSync(this.windowRef);
      return {
        outcome: 'queued',
        message: 'Evento animal encolado. Se disparó la sincronización automática.',
      } satisfies AnimalEventMutationFeedback;
    }

    return {
      outcome: 'queued',
      message: 'Evento animal encolado. Se enviará al reconectar.',
    } satisfies AnimalEventMutationFeedback;
  }

  private async listLocalEventSnapshots(animalUuid: string, filters: AnimalEventListFilters) {
    const snapshots = await this.store.listSnapshots('ANIMAL_EVENT');
    const outbox = await this.store.listOutbox();

    return snapshots
      .map((snapshot) => snapshot.payload as unknown as AnimalEventItem)
      .filter((item) => item.animalUuid === animalUuid)
      .filter((item) => matchesAnimalEventFilters(item, filters))
      .map((item) => decorateAnimalEventSnapshot(item, outbox))
      .sort(compareAnimalEventTimeline);
  }

  private async hasLocalAnimalEventOperations(animalUuid: string) {
    const outbox = await this.store.listOutbox();
    return outbox.some(
      (operation) =>
        operation.entityType === 'ANIMAL_EVENT' &&
        (operation.payload['animalUuid'] as string | undefined) === animalUuid &&
        operation.status !== 'acked' &&
        operation.status !== 'failed'
    );
  }

  private async saveEventSnapshot(item: AnimalEventItem) {
    await this.store.saveSnapshot({
      key: `ANIMAL_EVENT:${item.id}`,
      entityType: 'ANIMAL_EVENT',
      entityId: item.id,
      payload: { ...item } satisfies AnimalEventSnapshotPayload,
      updatedAt: item.updatedAt,
    });
  }

  private async applyOptimisticAnimalProjection(payload: AnimalEventOfflineCreatePayload, now: string) {
    const currentSnapshot = (await this.store.getSnapshot('ANIMAL', payload.animalUuid))?.payload as
      | AnimalOfflineSnapshotPayload
      | undefined;

    if (!currentSnapshot) {
      return;
    }

    const nextSnapshot: AnimalOfflineSnapshotPayload = {
      ...currentSnapshot,
      ownerGanaderoId:
        payload.type === 'TRANSFERRED' && payload.metadata.toOwnerGanaderoId
          ? payload.metadata.toOwnerGanaderoId
          : currentSnapshot.ownerGanaderoId,
      active:
        payload.type === 'SOLD' || payload.type === 'DECEASED' || payload.type === 'LOST'
          ? false
          : currentSnapshot.active,
      category: resolveProjectedCategory(currentSnapshot.category as string | null | undefined, payload.type),
      updatedAt: now,
    };

    await this.store.saveSnapshot({
      key: `ANIMAL:${payload.animalUuid}`,
      entityType: 'ANIMAL',
      entityId: payload.animalUuid,
      payload: nextSnapshot,
      updatedAt: nextSnapshot.updatedAt,
      version: nextSnapshot.version,
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

function createOptimisticEventSnapshot(payload: AnimalEventOfflineCreatePayload, now: string): AnimalEventItem {
  return {
    id: payload.operationId,
    animalUuid: payload.animalUuid,
    type: payload.type,
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

function buildEventsQuery(filters: AnimalEventListFilters) {
  const params = new URLSearchParams();
  if (filters.eventType) {
    params.set('eventType', filters.eventType);
  }
  if (filters.occurredFrom) {
    params.set('occurredFrom', filters.occurredFrom);
  }
  if (filters.occurredTo) {
    params.set('occurredTo', filters.occurredTo);
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

function resolveProjectedCategory(
  currentCategory: string | null | undefined,
  eventType: AnimalEventItem['type']
): AnimalOfflineSnapshotPayload['category'] {
  const safeCategory = currentCategory?.toUpperCase() ?? null;

  if (eventType !== 'CASTRATION') {
    return (safeCategory as AnimalOfflineSnapshotPayload['category'] | null) ?? 'VACA';
  }

  if (safeCategory === 'BULL' || safeCategory === 'CALF' || safeCategory === 'TORO' || safeCategory === 'TERNERO') {
    return 'BUEY';
  }

  return (safeCategory as AnimalOfflineSnapshotPayload['category'] | null) ?? 'VACA';
}
