import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom, from, type Observable } from 'rxjs';
import { AuthService } from '../../../../core/auth/data-access/auth.service';
import { ApplicationConfigService } from '../../../../core/config/application-config.service';
import type {
  AnimalHealthEventOfflineCreatePayload,
  AnimalHealthEventOfflineMetadata,
  AnimalHealthEventSnapshotPayload,
  AnimalEventLogSnapshotPayload,
  AnimalOfflineUiStatus,
} from '../../../../core/offline/offline-types';
import { OfflineEntityChangeBus } from '../../../../core/offline/offline-entity-change-bus.service';
import { OfflineStatusService } from '../../../../core/offline/offline-status.service';
import {
  DEFAULT_OFFLINE_STORE_SERVICE,
  type OfflineStoreService,
} from '../../../../core/offline/offline-store.service';
import type { PushSyncResponse } from '../../../../core/offline/sync-orchestrator.service';
import { SyncMetricsStore } from '../../../../core/offline/sync-metrics.store';
import { AnimalsService } from './animals.service';
import {
  decorateAnimalHealthTimeline,
  matchesAnimalHealthEventFilters,
  normalizeAnimalHealthEventItem,
} from './animal-health-events-timeline.adapter';
import {
  animalEventLogToHealthEventItem,
  filterAnimalEventLogsByCategory,
} from './animal-timeline.adapter';

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
  syncStatus?: AnimalOfflineUiStatus;
  syncMessage?: string | null;
  treatmentStatus?: 'active' | 'closed';
  visitId?: string | null;
  parentVisitId?: string | null;
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
  outcome: 'saved' | 'queued' | 'blocked';
  message: string;
}

interface AnimalHealthEventListResponse {
  items: Array<Record<string, unknown>>;
}

@Injectable({ providedIn: 'root' })
export class AnimalsHealthEventsService {
  private http: Pick<HttpClient, 'get' | 'post'> = inject(HttpClient);
  private appConfig: Pick<ApplicationConfigService, 'config'> = inject(ApplicationConfigService);
  private authService: Pick<AuthService, 'getAccessToken' | 'currentUser'> = inject(AuthService);
  private offlineStatus: Pick<OfflineStatusService, 'isOnline'> = inject(OfflineStatusService);
  private store: OfflineStoreService = DEFAULT_OFFLINE_STORE_SERVICE;
  private metricsStore = inject(SyncMetricsStore);
  private entityChangeBus: OfflineEntityChangeBus = inject(OfflineEntityChangeBus);
  private animalsService: Pick<AnimalsService, 'listActiveAnimals' | 'listAnimals'> =
    inject(AnimalsService);
  private now: () => string = () => new Date().toISOString();
  private windowRef: Pick<Window, 'dispatchEvent'> | undefined = globalThis.window;

  configureForTesting(
    dependencies: Partial<{
      http: Pick<HttpClient, 'get' | 'post'>;
      appConfig: Pick<ApplicationConfigService, 'config'>;
      authService: Pick<AuthService, 'getAccessToken' | 'currentUser'>;
      offlineStatus: Pick<OfflineStatusService, 'isOnline'>;
      store: OfflineStoreService;
      metricsStore: SyncMetricsStore;
      entityChangeBus: OfflineEntityChangeBus;
      animalsService: Pick<AnimalsService, 'listActiveAnimals' | 'listAnimals'>;
      now: () => string;
      windowRef: Pick<Window, 'dispatchEvent'>;
    }>,
  ) {
    this.http = dependencies.http ?? this.http;
    this.appConfig = dependencies.appConfig ?? this.appConfig;
    this.authService = dependencies.authService ?? this.authService;
    this.offlineStatus = dependencies.offlineStatus ?? this.offlineStatus;
    this.store = dependencies.store ?? this.store;
    this.metricsStore = dependencies.metricsStore ?? this.metricsStore;
    this.entityChangeBus = dependencies.entityChangeBus ?? this.entityChangeBus;
    this.animalsService = dependencies.animalsService ?? this.animalsService;
    this.now = dependencies.now ?? this.now;
    this.windowRef = dependencies.windowRef ?? this.windowRef;
  }

  listEvents(
    animalUuid: string,
    filters: AnimalHealthEventListFilters = {},
  ): Observable<AnimalHealthEventItem[]> {
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
        { headers: this.buildHeaders() },
      ),
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
      return {
        outcome: 'blocked',
        message: 'Necesitás sesión activa para registrar eventos sanitarios.',
      } satisfies AnimalHealthEventMutationFeedback;
    }

    const now = this.now();
    if (isGlobalVetVisitInput(input)) {
      return this.createGlobalVetVisitFanOut(input, currentUser, now);
    }

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

    const optimisticSnapshot = createOptimisticHealthEventSnapshot(payload, now);

    if (this.offlineStatus.isOnline()) {
      const pushResult = await this.pushEventOperations([
        { operationId, item: optimisticSnapshot, now },
      ]);
      if (pushResult.outcome === 'blocked') {
        return pushResult;
      }

      await this.saveEventSnapshot({
        ...optimisticSnapshot,
        id: pushResult.entityIds[0] ?? optimisticSnapshot.id,
        syncStatus: 'synced',
        syncMessage: null,
      });
      this.emitHealthEventChanges(operationId, input.metadata, sourceChannel);
      await this.refreshPendingState();
      return {
        outcome: 'saved',
        message: 'Evento sanitario guardado correctamente.',
      } satisfies AnimalHealthEventMutationFeedback;
    }

    await this.store.enqueueOperation({
      entityType: 'ANIMAL_EVENT_LOG',
      entityId: operationId,
      opType: 'CREATE',
      payload: toAnimalEventLogPayload(optimisticSnapshot),
      baseVersion: 0,
      clientCreatedAt: now,
      clientUpdatedAt: now,
      operationId,
    });

    await this.saveEventSnapshot(optimisticSnapshot);
    this.emitHealthEventChanges(operationId, input.metadata, sourceChannel);
    await this.refreshPendingState();

    return {
      outcome: 'queued',
      message: 'Evento sanitario encolado. Se enviará al reconectar.',
    } satisfies AnimalHealthEventMutationFeedback;
  }

  private async listLocalEventSnapshots(animalUuid: string, filters: AnimalHealthEventListFilters) {
    const unifiedSnapshots = await this.store.listSnapshots('ANIMAL_EVENT_LOG');
    const legacySnapshots = await this.store.listSnapshots('ANIMAL_HEALTH_EVENT');
    const outbox = await this.store.listOutbox();

    const items = [
      ...filterAnimalEventLogsByCategory(
        unifiedSnapshots.map((snapshot) => snapshot.payload),
        'HEALTH',
      ).map(animalEventLogToHealthEventItem),
      ...legacySnapshots.map((snapshot) => snapshot.payload as unknown as AnimalHealthEventItem),
    ]
      .filter((item) => item.animalUuid === animalUuid)
      .filter((item) => matchesAnimalHealthEventFilters(item, filters));

    return decorateAnimalHealthTimeline(items, outbox);
  }

  private async hasLocalHealthEventOperations(animalUuid: string) {
    const outbox = await this.store.listOutbox();
    return outbox.some(
      (operation) =>
        (operation.entityType === 'ANIMAL_HEALTH_EVENT' ||
          (operation.entityType === 'ANIMAL_EVENT_LOG' &&
            operation.payload['eventCategory'] === 'HEALTH')) &&
        (operation.payload['animalUuid'] as string | undefined) === animalUuid &&
        operation.status !== 'acked' &&
        operation.status !== 'failed',
    );
  }

  private async pushEventOperations(
    operations: Array<{ operationId: string; item: AnimalHealthEventItem; now: string }>,
  ) {
    const response = await firstValueFrom(
      this.http.post<PushSyncResponse>(
        `${this.appConfig.config().apiBaseUrl}/sync/push`,
        {
          operations: operations.map(({ operationId, item, now }) => ({
            operationId,
            entityType: 'ANIMAL_EVENT_LOG',
            entityId: operationId,
            opType: 'CREATE',
            payload: toAnimalEventLogPayload(item),
            baseVersion: 0,
            clientCreatedAt: now,
            clientUpdatedAt: now,
            status: 'pending',
            attempts: 0,
          })),
        },
        { headers: this.buildHeaders() },
      ),
    );
    const failed = response.results.find((result) => result.classification !== 'no_conflict');
    if (failed) {
      return {
        outcome: 'blocked',
        message: failed.conflict?.reason ?? 'No pudimos guardar el evento sanitario.',
      } satisfies AnimalHealthEventMutationFeedback;
    }
    return {
      outcome: 'saved' as const,
      entityIds: response.results.map((result) => result.entityId),
    };
  }

  private async saveEventSnapshot(item: AnimalHealthEventItem) {
    await this.store.saveSnapshot({
      key: `ANIMAL_EVENT_LOG:${item.id}`,
      entityType: 'ANIMAL_EVENT_LOG',
      entityId: item.id,
      payload: toAnimalEventLogPayload({ ...item } satisfies AnimalHealthEventSnapshotPayload),
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

  private emitHealthEventChanges(
    operationIds: string | string[],
    metadata: AnimalHealthEventOfflineMetadata,
    sourceChannel: 'ONLINE' | 'OFFLINE',
  ) {
    const source: 'online-mutation' | 'local-mutation' =
      sourceChannel === 'ONLINE' ? 'online-mutation' : 'local-mutation';
    const visitId = readVisitIdFromMetadata(metadata);
    const ids = Array.isArray(operationIds) ? operationIds : [operationIds];
    this.entityChangeBus.emitBatch([
      {
        entity: 'ANIMAL_EVENT_LOG',
        source,
        operation: 'create',
        ids,
        count: ids.length,
      },
      ...(visitId
        ? [
            {
              entity: 'VET_VISIT' as const,
              source,
              operation: 'snapshot-upsert' as const,
              ids: [visitId],
            },
          ]
        : []),
    ]);
  }

  private async createGlobalVetVisitFanOut(
    input: AnimalHealthEventCreateInput,
    currentUser: NonNullable<ReturnType<AuthService['currentUser']>>,
    now: string,
  ) {
    const activeAnimals = await this.listFanOutAnimals(currentUser);
    if (!activeAnimals.length) {
      return {
        outcome: 'blocked',
        message: 'No hay animales activos para registrar la campaña veterinaria.',
      } satisfies AnimalHealthEventMutationFeedback;
    }

    const sourceChannel = this.offlineStatus.isOnline() ? 'ONLINE' : 'OFFLINE';
    const metadata = withTargetAnimalCount(input.metadata, activeAnimals.length);
    const operations = activeAnimals.map((animal) => {
      const operationId = globalThis.crypto.randomUUID();
      const payload: AnimalHealthEventOfflineCreatePayload = {
        animalUuid: animal.uuid,
        healthEventType: input.healthEventType,
        occurredAt: normalizeOccurredAt(input.occurredAt),
        notes: normalizeOptionalText(input.notes),
        performedByUserId: currentUser.id,
        sourceChannel,
        operationId,
        metadata,
      };
      return {
        operationId,
        payload,
        snapshot: createOptimisticHealthEventSnapshot(payload, now),
      };
    });
    const operationIds = operations.map((operation) => operation.operationId);

    if (this.offlineStatus.isOnline()) {
      const pushResult = await this.pushEventOperations(
        operations.map(({ operationId, snapshot }) => ({ operationId, item: snapshot, now })),
      );
      if (pushResult.outcome === 'blocked') {
        return pushResult;
      }

      await runSequentially(operations, (operation, index) =>
        this.saveEventSnapshot({
          ...operation.snapshot,
          id: pushResult.entityIds[index] ?? operation.snapshot.id,
          syncStatus: 'synced',
          syncMessage: null,
        }),
      );
      this.emitHealthEventChanges(operationIds, metadata, sourceChannel);
      await this.refreshPendingState();
      return {
        outcome: 'saved',
        message: `Campaña veterinaria guardada para ${activeAnimals.length} animales activos.`,
      } satisfies AnimalHealthEventMutationFeedback;
    }

    await runSequentially(operations, async (operation) => {
      await this.store.enqueueOperation({
        entityType: 'ANIMAL_EVENT_LOG',
        entityId: operation.operationId,
        opType: 'CREATE',
        payload: toAnimalEventLogPayload(operation.snapshot),
        baseVersion: 0,
        clientCreatedAt: now,
        clientUpdatedAt: now,
        operationId: operation.operationId,
      });
      await this.saveEventSnapshot(operation.snapshot);
    });
    this.emitHealthEventChanges(operationIds, metadata, sourceChannel);
    await this.refreshPendingState();

    return {
      outcome: 'queued',
      message: `Campaña veterinaria encolada para ${activeAnimals.length} animales activos. Se enviará al reconectar.`,
    } satisfies AnimalHealthEventMutationFeedback;
  }

  private async listFanOutAnimals(
    currentUser: NonNullable<ReturnType<AuthService['currentUser']>>,
  ) {
    if (currentUser.role === 'GANADERO') {
      return firstValueFrom(
        this.animalsService.listActiveAnimals(
          currentUser.ganaderoId ?? '__NO_AUTHENTICATED_GANADERO__',
          0,
          1000,
        ),
      );
    }
    return firstValueFrom(this.animalsService.listAnimals({ active: true, page: 0, size: 1000 }));
  }
}

function toAnimalEventLogPayload(
  item: AnimalHealthEventSnapshotPayload | AnimalHealthEventItem,
): AnimalEventLogSnapshotPayload {
  const metadata = item.metadata as Record<string, unknown>;
  const visit =
    typeof metadata['visit'] === 'object' && metadata['visit'] !== null
      ? (metadata['visit'] as Record<string, unknown>)
      : null;
  const protocol =
    typeof metadata['protocol'] === 'object' && metadata['protocol'] !== null
      ? (metadata['protocol'] as Record<string, unknown>)
      : null;

  return {
    ...item,
    id: item.id,
    animalUuid: item.animalUuid,
    eventCategory: 'HEALTH',
    eventType: item.healthEventType,
    healthEventType: item.healthEventType,
    occurredAt: item.occurredAt,
    notes: item.notes,
    performedByUserId: item.performedByUserId,
    sourceChannel: item.sourceChannel,
    operationId: item.operationId,
    metadata: item.metadata as Record<string, unknown>,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    clientCreatedAt: item.clientCreatedAt,
    syncStatus: item.syncStatus,
    syncMessage: item.syncMessage,
    visitId: readPayloadString(item, 'visitId') ?? readString(visit, 'visitId'),
    parentVisitId: readPayloadString(item, 'parentVisitId') ?? readString(visit, 'parentVisitId'),
    nextDueAt: readPayloadString(item, 'nextDueAt') ?? readString(protocol, 'nextDueAt'),
    visitStatus: readPayloadString(item, 'visitStatus') ?? readString(visit, 'status') ?? undefined,
    protocolStatus: readString(protocol, 'status') ?? undefined,
  };
}

function readString(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key];
  return typeof value === 'string' ? value : null;
}

function runSequentially<T>(
  items: readonly T[],
  action: (item: T, index: number) => Promise<void>,
): Promise<void> {
  return items.reduce(
    (chain, item, index) => chain.then(() => action(item, index)),
    Promise.resolve(),
  );
}

function readVisitIdFromMetadata(metadata: AnimalHealthEventOfflineMetadata) {
  const record = metadata as Record<string, unknown>;
  const visit =
    typeof record['visit'] === 'object' && record['visit'] !== null
      ? (record['visit'] as Record<string, unknown>)
      : null;
  return readString(visit, 'visitId');
}

function readPayloadString(record: object, key: string) {
  const value = (record as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : null;
}

function isGlobalVetVisitInput(input: AnimalHealthEventCreateInput) {
  return input.healthEventType === 'FIELD_VET_VISIT' && readVisitMode(input.metadata) === 'GLOBAL';
}

function readVisitMode(metadata: AnimalHealthEventOfflineMetadata) {
  if (!('visit' in metadata) || typeof metadata.visit !== 'object' || metadata.visit === null) {
    return undefined;
  }
  return (metadata.visit as Record<string, unknown>)['mode'];
}

function withTargetAnimalCount(
  metadata: AnimalHealthEventOfflineMetadata,
  targetAnimalCount: number,
): AnimalHealthEventOfflineMetadata {
  if (!('visit' in metadata) || typeof metadata.visit !== 'object' || metadata.visit === null) {
    return metadata;
  }
  return {
    ...metadata,
    visit: {
      ...(metadata.visit as Record<string, unknown>),
      targetAnimalCount,
    },
  } as AnimalHealthEventOfflineMetadata;
}

function createOptimisticHealthEventSnapshot(
  payload: AnimalHealthEventOfflineCreatePayload,
  now: string,
): AnimalHealthEventItem {
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
    syncMessage: 'Pendiente de sincronización.',
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
