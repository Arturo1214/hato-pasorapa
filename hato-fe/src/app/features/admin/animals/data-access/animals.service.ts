import { HttpClient, HttpHeaders } from '@angular/common/http';
import { computed, inject, Injectable } from '@angular/core';
import { firstValueFrom, from, type Observable } from 'rxjs';
import { AuthService } from '../../../../core/auth/data-access/auth.service';
import { ApplicationConfigService } from '../../../../core/config/application-config.service';
import {
  type AnimalOfflineMutationPayload,
} from '../../../../core/offline/offline-types';
import { OfflineStatusService } from '../../../../core/offline/offline-status.service';
import { DEFAULT_OFFLINE_STORE_SERVICE, OfflineStoreService } from '../../../../core/offline/offline-store.service';
import { triggerManualSync } from '../../../../core/offline/sync-orchestrator.service';
import { SyncMetricsStore } from '../../../../core/offline/sync-metrics.store';

export const ANIMAL_CATEGORY = {
  TERNERO: 'TERNERO',
  TERNERA: 'TERNERA',
  VAQUILLONA: 'VAQUILLONA',
  VACA: 'VACA',
  TORO: 'TORO',
  BUEY: 'BUEY',
} as const;

export type AnimalCategory = (typeof ANIMAL_CATEGORY)[keyof typeof ANIMAL_CATEGORY];

export const ANIMAL_SEX = {
  MACHO: 'MACHO',
  HEMBRA: 'HEMBRA',
} as const;

export type AnimalSex = (typeof ANIMAL_SEX)[keyof typeof ANIMAL_SEX];

type LegacyAnimalCategory = 'COW' | 'BULL' | 'CALF' | 'HEIFER';

export const ANIMAL_CATEGORY_OPTIONS = [
  { value: ANIMAL_CATEGORY.TERNERO, label: 'Ternero' },
  { value: ANIMAL_CATEGORY.TERNERA, label: 'Ternera' },
  { value: ANIMAL_CATEGORY.VAQUILLONA, label: 'Vaquillona' },
  { value: ANIMAL_CATEGORY.VACA, label: 'Vaca' },
  { value: ANIMAL_CATEGORY.TORO, label: 'Toro' },
  { value: ANIMAL_CATEGORY.BUEY, label: 'Buey' },
] as const;

export const ANIMAL_SEX_OPTIONS = [
  { value: ANIMAL_SEX.HEMBRA, label: 'Hembra' },
  { value: ANIMAL_SEX.MACHO, label: 'Macho' },
] as const;

export interface AnimalItem {
  uuid: string;
  ownerGanaderoId: string;
  motherAnimalUuid?: string | null;
  fatherAnimalUuid?: string | null;
  arete: string | null;
  marca: string | null;
  tatuaje: string | null;
  category: AnimalCategory;
  sex: AnimalSex | null;
  active: boolean;
  birthDate?: string | null;
  admissionDate: string;
  weightKg: number | null;
  createdAt: string;
  version: number;
  updatedAt: string;
  lastSyncedAt: string | null;
  syncStatus?: 'synced' | 'pending' | 'conflict';
  syncMessage?: string | null;
}

export interface AnimalListFilters {
  visible?: string;
  ownerGanaderoId?: string;
  category?: AnimalCategory | null;
  active?: boolean | null;
}

export interface AnimalMutationPayload {
  ownerGanaderoId: string;
  arete?: string | null;
  marca?: string | null;
  tatuaje?: string | null;
  category: AnimalCategory;
  sex?: AnimalSex | null;
  active: boolean;
  admissionDate: string;
  birthDate?: string | null;
  weightKg?: number | null;
}

interface AnimalsPageResponse {
  content: RawAnimalItem[];
}

interface RawAnimalItem extends Omit<AnimalItem, 'category' | 'sex'> {
  category: AnimalCategory | LegacyAnimalCategory;
  sex?: AnimalSex | null;
}

export interface AnimalMutationFeedback {
  outcome: 'queued' | 'blocked';
  message: string;
}

export interface AnimalsSyncState {
  pending: number;
  syncing: boolean;
  lastSyncAt: string | null;
  lastMessage: string | null;
  manualRefreshRequired: boolean;
}

export interface AnimalsServiceDependencies {
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
export class AnimalsService {
  private http: Pick<HttpClient, 'get' | 'post' | 'put'> = inject(HttpClient);
  private appConfig: Pick<ApplicationConfigService, 'config'> = inject(ApplicationConfigService);
  private authService: Pick<AuthService, 'getAccessToken'> = inject(AuthService);
  private offlineStatus: Pick<OfflineStatusService, 'isOnline'> = inject(OfflineStatusService);
  private store: OfflineStoreService = DEFAULT_OFFLINE_STORE_SERVICE;
  private metricsStore = inject(SyncMetricsStore);
  private now: () => string = () => new Date().toISOString();
  private windowRef: Pick<Window, 'dispatchEvent'> | undefined = globalThis.window;

  readonly syncState = computed<AnimalsSyncState>(() => ({
    pending: this.metricsStore.metrics().pending,
    syncing: this.metricsStore.metrics().syncing,
    lastSyncAt: this.metricsStore.metrics().lastSyncAt,
    lastMessage: this.metricsStore.metrics().lastMessage,
    manualRefreshRequired: this.metricsStore.metrics().manualRefreshRequired,
  }));

  configureForTesting(dependencies: Partial<AnimalsServiceDependencies>) {
    this.http = dependencies.http ?? this.http;
    this.appConfig = dependencies.appConfig ?? this.appConfig;
    this.authService = dependencies.authService ?? this.authService;
    this.offlineStatus = dependencies.offlineStatus ?? this.offlineStatus;
    this.store = dependencies.store ?? this.store;
    this.metricsStore = dependencies.metricsStore ?? this.metricsStore;
    this.now = dependencies.now ?? this.now;
    this.windowRef = dependencies.windowRef ?? this.windowRef;
  }

  listAnimals(filters: AnimalListFilters = {}): Observable<AnimalItem[]> {
    return from(this.listAnimalsInternal(filters));
  }

  createAnimal(payload: AnimalMutationPayload): Observable<AnimalMutationFeedback> {
    return from(this.createAnimalInternal(payload));
  }

  updateAnimal(uuid: string, payload: AnimalMutationPayload): Observable<AnimalMutationFeedback> {
    return from(this.updateAnimalInternal(uuid, payload));
  }

  private async listAnimalsInternal(filters: AnimalListFilters) {
    const hasLocalAnimalOperations = await this.hasLocalAnimalOperations();
    await this.refreshPendingState();

    if (!this.offlineStatus.isOnline() || hasLocalAnimalOperations) {
      return this.listAnimalSnapshots(filters);
    }

    const response = await firstValueFrom(
      this.http.get<AnimalsPageResponse>(`${this.appConfig.config().apiBaseUrl}/animals${buildListQuery(filters)}`, {
        headers: this.buildHeaders(),
      })
    );

    const animals = (response.content ?? []).map(normalizeAnimalItem);
    await Promise.all(animals.map((animal) => this.saveAnimalSnapshot(animal)));
    await this.refreshPendingState();
    return animals.map(
      (animal) =>
        ({
          ...animal,
          syncStatus: 'synced',
          syncMessage: null,
        }) satisfies AnimalItem
    );
  }

  private async createAnimalInternal(payload: AnimalMutationPayload) {
    const now = this.now();
    const animalUuid = globalThis.crypto.randomUUID();
    const sanitizedPayload = sanitizeMutationPayload(payload);

    await this.store.enqueueOperation({
      entityType: 'ANIMAL',
      entityId: animalUuid,
      opType: 'CREATE',
      payload: sanitizedPayload,
      baseVersion: 0,
      clientCreatedAt: now,
      clientUpdatedAt: now,
    });
    await this.saveAnimalSnapshot(createOptimisticAnimalSnapshot(animalUuid, sanitizedPayload, now));
    await this.refreshPendingState({
      lastMessage: this.offlineStatus.isOnline()
        ? 'Alta de animal encolada. Se disparó la sincronización automática.'
        : 'Alta de animal encolada. Se enviará al reconectar.',
    });

    if (this.offlineStatus.isOnline()) {
      triggerManualSync(this.windowRef);
      return {
        outcome: 'queued',
        message: 'Alta de animal encolada. Se disparó la sincronización automática.',
      } satisfies AnimalMutationFeedback;
    }

    return {
      outcome: 'queued',
      message: 'Alta de animal encolada. Se enviará al reconectar.',
    } satisfies AnimalMutationFeedback;
  }

  private async updateAnimalInternal(uuid: string, payload: AnimalMutationPayload) {
    const now = this.now();
    const sanitizedPayload = sanitizeMutationPayload(payload);
    const currentSnapshot = await this.findAnimalSnapshot(uuid);

    await this.store.enqueueOperation({
      entityType: 'ANIMAL',
      entityId: uuid,
      opType: 'UPDATE',
      payload: sanitizedPayload,
      baseVersion: currentSnapshot?.version ?? 0,
      clientCreatedAt: now,
      clientUpdatedAt: now,
    });
    await this.saveAnimalSnapshot(applyOptimisticAnimalUpdate(uuid, currentSnapshot, sanitizedPayload, now));
    await this.refreshPendingState({
      lastMessage: this.offlineStatus.isOnline()
        ? 'Actualización de animal encolada. Se disparó la sincronización automática.'
        : 'Actualización de animal encolada. Se enviará al reconectar.',
    });

    if (this.offlineStatus.isOnline()) {
      triggerManualSync(this.windowRef);
      return {
        outcome: 'queued',
        message: 'Actualización de animal encolada. Se disparó la sincronización automática.',
      } satisfies AnimalMutationFeedback;
    }

    return {
      outcome: 'queued',
      message: 'Actualización de animal encolada. Se enviará al reconectar.',
    } satisfies AnimalMutationFeedback;
  }

  private async listAnimalSnapshots(filters: AnimalListFilters) {
    const snapshots = await this.store.listSnapshots('ANIMAL');
    const outbox = await this.store.listOutbox();

    return snapshots
      .map((snapshot) => normalizeAnimalItem(snapshot.payload as unknown as RawAnimalItem | AnimalItem))
      .map((animal) => decorateAnimalSnapshot(animal, outbox))
      .filter((animal) => matchesAnimalFilters(animal, filters))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  private async hasLocalAnimalOperations() {
    const outbox = await this.store.listOutbox();
    return outbox.some(
      (operation) => operation.entityType === 'ANIMAL' && operation.status !== 'acked' && operation.status !== 'failed'
    );
  }

  private async saveAnimalSnapshot(animal: AnimalItem) {
    await this.store.saveSnapshot({
      key: `ANIMAL:${animal.uuid}`,
      entityType: 'ANIMAL',
      entityId: animal.uuid,
      payload: { ...animal },
      updatedAt: animal.updatedAt,
      version: animal.version,
    });
  }

  private async findAnimalSnapshot(uuid: string) {
    const snapshots = await this.store.listSnapshots('ANIMAL');
    return snapshots.find((snapshot) => snapshot.entityId === uuid)?.payload as AnimalItem | undefined;
  }

  private buildHeaders() {
    const token = this.authService.getAccessToken();
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
  }

  private async refreshPendingState(overrides: Partial<AnimalsSyncState> = {}) {
    const pending = await this.store.countPendingOperations();
    this.metricsStore.patch({ pending, ...overrides });
  }
}

function createOptimisticAnimalSnapshot(
  uuid: string,
  payload: AnimalOfflineMutationPayload,
  now: string
): AnimalItem {
  return {
    uuid,
    ownerGanaderoId: payload.ownerGanaderoId,
    motherAnimalUuid: null,
    fatherAnimalUuid: null,
    arete: payload.arete ?? null,
    marca: payload.marca ?? null,
    tatuaje: payload.tatuaje ?? null,
    category: payload.category,
    sex: payload.sex ?? inferAnimalSexFromCategory(payload.category),
    active: payload.active,
    birthDate: payload.birthDate ?? null,
    admissionDate: payload.admissionDate,
    weightKg: payload.weightKg ?? null,
    createdAt: now,
    updatedAt: now,
    version: 0,
    lastSyncedAt: null,
    syncStatus: 'pending',
    syncMessage: 'Pendiente de sync.',
  };
}

function applyOptimisticAnimalUpdate(
  uuid: string,
  currentSnapshot: AnimalItem | undefined,
  payload: AnimalOfflineMutationPayload,
  now: string
): AnimalItem {
  return {
    uuid,
    ownerGanaderoId: payload.ownerGanaderoId,
    motherAnimalUuid: currentSnapshot?.motherAnimalUuid ?? null,
    fatherAnimalUuid: currentSnapshot?.fatherAnimalUuid ?? null,
    arete: payload.arete ?? null,
    marca: payload.marca ?? null,
    tatuaje: payload.tatuaje ?? null,
    category: payload.category,
    sex: payload.sex ?? currentSnapshot?.sex ?? inferAnimalSexFromCategory(payload.category),
    active: payload.active,
    birthDate: payload.birthDate ?? currentSnapshot?.birthDate ?? null,
    admissionDate: payload.admissionDate,
    weightKg: payload.weightKg ?? null,
    createdAt: currentSnapshot?.createdAt ?? now,
    version: currentSnapshot?.version ?? 0,
    updatedAt: now,
    lastSyncedAt: currentSnapshot?.lastSyncedAt ?? null,
    syncStatus: 'pending',
    syncMessage: 'Pendiente de sync.',
  };
}

function normalizeAnimalItem(animal: RawAnimalItem | AnimalItem): AnimalItem {
  const category = normalizeAnimalCategory(animal.category, animal.sex ?? null);
  return {
    ...animal,
    category,
    sex: animal.sex ?? inferAnimalSexFromCategory(category),
    birthDate: animal.birthDate ?? null,
  } satisfies AnimalItem;
}

function normalizeAnimalCategory(category: RawAnimalItem['category'], sex: AnimalSex | null | undefined): AnimalCategory {
  switch (category) {
    case 'COW':
      return ANIMAL_CATEGORY.VACA;
    case 'BULL':
      return ANIMAL_CATEGORY.TORO;
    case 'HEIFER':
      return ANIMAL_CATEGORY.VAQUILLONA;
    case 'CALF':
      return sex === ANIMAL_SEX.HEMBRA ? ANIMAL_CATEGORY.TERNERA : ANIMAL_CATEGORY.TERNERO;
    default:
      return category;
  }
}

export function inferAnimalSexFromCategory(category: AnimalCategory): AnimalSex {
  switch (category) {
    case ANIMAL_CATEGORY.TERNERA:
    case ANIMAL_CATEGORY.VAQUILLONA:
    case ANIMAL_CATEGORY.VACA:
      return ANIMAL_SEX.HEMBRA;
    default:
      return ANIMAL_SEX.MACHO;
  }
}

function buildListQuery(filters: AnimalListFilters) {
  const params: string[] = [];

  if (filters.visible?.trim()) {
    params.push(`visible.contains=${encodeURIComponent(filters.visible.trim())}`);
  }
  if (filters.ownerGanaderoId?.trim()) {
    params.push(`ownerGanaderoId.equals=${encodeURIComponent(filters.ownerGanaderoId.trim())}`);
  }
  if (filters.active !== undefined && filters.active !== null) {
    params.push(`active.equals=${filters.active}`);
  }
  if (filters.category) {
    params.push(`category.equals=${filters.category}`);
  }

  params.push('page=0', 'size=20', 'sort=updatedAt,desc');
  return `?${params.join('&')}`;
}

function matchesAnimalFilters(animal: AnimalItem, filters: AnimalListFilters) {
  const visibleNeedle = filters.visible?.trim().toLowerCase();
  if (visibleNeedle) {
    const visibleFields = [animal.arete, animal.marca, animal.tatuaje]
      .filter((value): value is string => Boolean(value))
      .map((value) => value.toLowerCase());

    if (!visibleFields.some((value) => value.includes(visibleNeedle))) {
      return false;
    }
  }

  if (filters.ownerGanaderoId?.trim() && animal.ownerGanaderoId !== filters.ownerGanaderoId.trim()) {
    return false;
  }

  if (filters.active !== undefined && filters.active !== null && animal.active !== filters.active) {
    return false;
  }

  if (filters.category && animal.category !== filters.category) {
    return false;
  }

  return true;
}

function decorateAnimalSnapshot(animal: AnimalItem, outbox: Awaited<ReturnType<OfflineStoreService['listOutbox']>>): AnimalItem {
  const relatedOperations = outbox.filter((operation) => operation.entityType === 'ANIMAL' && operation.entityId === animal.uuid);
  const conflict = relatedOperations.find((operation) => operation.status === 'conflict');
  if (conflict) {
    return {
      ...animal,
      syncStatus: 'conflict',
      syncMessage: conflict.conflict?.reason ?? conflict.lastErrorMessage ?? 'Hay un conflicto remoto.',
    };
  }

  const pending = relatedOperations.find(
    (operation) => operation.status === 'pending' || operation.status === 'retry_scheduled' || operation.status === 'in_flight'
  );
  if (pending) {
    return {
      ...animal,
      syncStatus: 'pending',
      syncMessage: 'Pendiente de sync.',
    };
  }

  return {
    ...animal,
    syncStatus: 'synced',
    syncMessage: null,
  };
}

function sanitizeMutationPayload(payload: AnimalMutationPayload): AnimalOfflineMutationPayload {
  return {
    ownerGanaderoId: payload.ownerGanaderoId.trim(),
    arete: normalizeOptionalText(payload.arete),
    marca: normalizeOptionalText(payload.marca),
    tatuaje: normalizeOptionalText(payload.tatuaje),
    category: payload.category,
    sex: payload.sex ?? null,
    active: payload.active,
    admissionDate: payload.admissionDate,
    birthDate: payload.birthDate ?? null,
    weightKg: payload.weightKg ?? null,
  };
}

function normalizeOptionalText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}
