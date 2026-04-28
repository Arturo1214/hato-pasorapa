import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom, from, type Observable } from 'rxjs';
import { AuthService } from '../../../../core/auth/data-access/auth.service';
import { ApplicationConfigService } from '../../../../core/config/application-config.service';
import {
  type AnimalReproductionEventOfflineCreatePayload,
  type AnimalReproductionEventOfflineMetadata,
  type AnimalReproductionEventSnapshotPayload,
} from '../../../../core/offline/offline-types';
import { OfflineStatusService } from '../../../../core/offline/offline-status.service';
import { DEFAULT_OFFLINE_STORE_SERVICE, OfflineStoreService } from '../../../../core/offline/offline-store.service';
import { triggerManualSync } from '../../../../core/offline/sync-orchestrator.service';
import { SyncMetricsStore } from '../../../../core/offline/sync-metrics.store';
import {
  decorateAnimalReproductionTimeline,
  matchesAnimalReproductionEventFilters,
  normalizeAnimalReproductionEventItem,
} from './animal-reproduction-events-timeline.adapter';

export interface AnimalBirthMetadata extends Record<string, unknown> {
  birthDate: string;
  offspringCount: number;
  motherAnimalUuid: string;
  fatherAnimalUuid?: string;
  offspringAnimalUuids?: string[];
}

export interface AnimalReproductionEventItem {
  id: string;
  animalUuid: string;
  reproductionEventType: 'SERVICE' | 'PREGNANCY_CONFIRMED' | 'PREGNANCY_LOSS' | 'BIRTH';
  occurredAt: string;
  notes: string | null;
  performedByUserId: string;
  sourceChannel: 'ONLINE' | 'OFFLINE';
  operationId: string;
  metadata: AnimalReproductionEventOfflineMetadata;
  clientCreatedAt: string;
  createdAt: string;
  updatedAt: string;
  syncStatus?: 'synced' | 'pending' | 'conflict';
  syncMessage?: string | null;
  syncState?: 'PENDING_SYNC' | 'SYNCED' | 'CONFLICT';
}

export interface AnimalReproductionEventListFilters {
  reproductionEventType?: AnimalReproductionEventItem['reproductionEventType'];
  occurredFrom?: string;
  occurredTo?: string;
}

export interface AnimalReproductionEventCreateInput {
  animalUuid: string;
  reproductionEventType: AnimalReproductionEventItem['reproductionEventType'];
  occurredAt: string;
  notes?: string | null;
  metadata: AnimalReproductionEventOfflineMetadata;
}

export interface AnimalReproductionEventMutationFeedback {
  outcome: 'queued' | 'blocked';
  message: string;
}

interface AnimalReproductionEventListResponse {
  items: Array<Record<string, unknown>>;
}

@Injectable({ providedIn: 'root' })
export class AnimalsReproductionEventsService {
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

  listEvents(animalUuid: string, filters: AnimalReproductionEventListFilters = {}): Observable<AnimalReproductionEventItem[]> {
    return from(this.listEventsInternal(animalUuid, filters) as Promise<AnimalReproductionEventItem[]>);
  }

  createEvent(input: AnimalReproductionEventCreateInput): Observable<AnimalReproductionEventMutationFeedback> {
    return from(this.createEventInternal(input) as Promise<AnimalReproductionEventMutationFeedback>);
  }

  private async listEventsInternal(animalUuid: string, filters: AnimalReproductionEventListFilters) {
    const hasLocalOperations = await this.hasLocalReproductionEventOperations(animalUuid);

    if (!this.offlineStatus.isOnline() || hasLocalOperations) {
      return this.listLocalEventSnapshots(animalUuid, filters);
    }

    const response = await firstValueFrom(
      this.http.get<AnimalReproductionEventListResponse>(
        `${this.appConfig.config().apiBaseUrl}/animals/${animalUuid}/reproduction-events${buildReproductionEventsQuery(filters)}`,
        { headers: this.buildHeaders() }
      )
    );

    const items = (response.items ?? [])
      .map(normalizeAnimalReproductionEventItem)
      .filter((item) => matchesAnimalReproductionEventFilters(item, filters));
    await Promise.all(items.map((item) => this.saveEventSnapshot(item)));
    return decorateAnimalReproductionTimeline(items, []);
  }

  private async createEventInternal(input: AnimalReproductionEventCreateInput) {
    const currentUser = this.authService.currentUser();
    if (!currentUser) {
      return { outcome: 'blocked', message: 'Necesitás sesión activa para registrar eventos reproductivos.' } satisfies AnimalReproductionEventMutationFeedback;
    }

    const now = this.now();
    const operationId = globalThis.crypto.randomUUID();
    const sourceChannel = this.offlineStatus.isOnline() ? 'ONLINE' : 'OFFLINE';
    const payload: AnimalReproductionEventOfflineCreatePayload = {
      animalUuid: input.animalUuid,
      reproductionEventType: input.reproductionEventType,
      occurredAt: normalizeOccurredAt(input.occurredAt),
      notes: normalizeOptionalText(input.notes),
      performedByUserId: currentUser.id,
      sourceChannel,
      operationId,
      metadata: input.metadata,
    };

    await this.store.enqueueOperation({
      entityType: 'ANIMAL_REPRODUCTION_EVENT',
      entityId: operationId,
      opType: 'CREATE',
      payload: payload as unknown as Record<string, unknown>,
      baseVersion: 0,
      clientCreatedAt: now,
      clientUpdatedAt: now,
      operationId,
    });

    await this.saveEventSnapshot(createOptimisticReproductionEventSnapshot(payload, now));
    await this.refreshPendingState();

    if (this.offlineStatus.isOnline()) {
      triggerManualSync(this.windowRef);
      return {
        outcome: 'queued',
        message: 'Evento reproductivo encolado. Se disparó la sincronización automática.',
      } satisfies AnimalReproductionEventMutationFeedback;
    }

    return {
      outcome: 'queued',
      message: 'Evento reproductivo encolado. Se enviará al reconectar.',
    } satisfies AnimalReproductionEventMutationFeedback;
  }

  private async listLocalEventSnapshots(animalUuid: string, filters: AnimalReproductionEventListFilters) {
    const snapshots = await this.store.listSnapshots('ANIMAL_REPRODUCTION_EVENT');
    const outbox = await this.store.listOutbox();

    const items = snapshots
      .map((snapshot) => snapshot.payload as unknown as AnimalReproductionEventItem)
      .filter((item) => item.animalUuid === animalUuid)
      .filter((item) => matchesAnimalReproductionEventFilters(item, filters));

    return decorateAnimalReproductionTimeline(items, outbox);
  }

  private async hasLocalReproductionEventOperations(animalUuid: string) {
    const outbox = await this.store.listOutbox();
    return outbox.some(
      (operation) =>
        operation.entityType === 'ANIMAL_REPRODUCTION_EVENT' &&
        (operation.payload['animalUuid'] as string | undefined) === animalUuid &&
        operation.status !== 'acked' &&
        operation.status !== 'failed'
    );
  }

  private async saveEventSnapshot(item: AnimalReproductionEventItem) {
    await this.store.saveSnapshot({
      key: `ANIMAL_REPRODUCTION_EVENT:${item.id}`,
      entityType: 'ANIMAL_REPRODUCTION_EVENT',
      entityId: item.id,
      payload: { ...item } satisfies AnimalReproductionEventSnapshotPayload,
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

function createOptimisticReproductionEventSnapshot(
  payload: AnimalReproductionEventOfflineCreatePayload,
  now: string
): AnimalReproductionEventItem {
  return {
    id: payload.operationId,
    animalUuid: payload.animalUuid,
    reproductionEventType: payload.reproductionEventType,
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
    syncState: 'PENDING_SYNC',
  };
}

function buildReproductionEventsQuery(filters: AnimalReproductionEventListFilters) {
  const params = new URLSearchParams();
  if (filters.reproductionEventType) {
    params.set('reproductionEventType', filters.reproductionEventType);
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

export function buildBirthMetadata(input: {
  birthDate: string;
  offspringCount: number;
  motherAnimalUuid: string;
  fatherAnimalUuid?: string | null;
  offspringAnimalUuids: string[];
}): AnimalBirthMetadata {
  return {
    birthDate: normalizeOccurredAt(input.birthDate),
    offspringCount: input.offspringCount,
    motherAnimalUuid: input.motherAnimalUuid.trim(),
    fatherAnimalUuid: normalizeOptionalText(input.fatherAnimalUuid) ?? undefined,
    offspringAnimalUuids: input.offspringAnimalUuids.map((uuid) => uuid.trim()).filter(Boolean),
  };
}

function normalizeOptionalText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeOccurredAt(value: string) {
  return value.includes('T') && !value.endsWith('Z') ? `${value}:00.000Z`.replace('T', 'T') : value;
}
