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
  color: string | null;
  description: string | null;
  breedUuid: string | null;
  breedName: string | null;
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

export interface AnimalGenealogy {
  animal: AnimalItem;
  mother: AnimalItem | null;
  father: AnimalItem | null;
  offspring: AnimalItem[];
  ancestors?: AnimalGenealogyNode | null;
}

export interface AnimalGenealogyNode {
  animal: AnimalItem;
  mother?: AnimalGenealogyNode | null;
  father?: AnimalGenealogyNode | null;
}

interface RawAnimalGenealogy {
  animal: RawAnimalItem;
  mother?: RawAnimalItem | null;
  father?: RawAnimalItem | null;
  offspring?: RawAnimalItem[] | null;
  ancestors?: RawAnimalGenealogyNode | null;
}

interface RawAnimalGenealogyNode {
  animal: RawAnimalItem;
  mother?: RawAnimalGenealogyNode | null;
  father?: RawAnimalGenealogyNode | null;
}

export interface AnimalMutationPayload {
  ownerGanaderoId?: string | null;
  motherAnimalUuid?: string | null;
  fatherAnimalUuid?: string | null;
  arete?: string | null;
  marca?: string | null;
  tatuaje?: string | null;
  color?: string | null;
  description?: string | null;
  breedUuid?: string | null;
  breedName?: string | null;
  category: AnimalCategory;
  sex?: AnimalSex | null;
  active: boolean;
  admissionDate: string;
  birthDate?: string | null;
  weightKg?: number | null;
}

export interface BirthRegistrationOffspringPayload {
  arete?: string | null;
  marca?: string | null;
  tatuaje?: string | null;
  category: AnimalCategory;
  sex: AnimalSex;
  active: boolean;
  admissionDate?: string | null;
  weightKg?: number | null;
}

export interface BirthRegistrationPayload {
  birthDate: string;
  fatherAnimalUuid?: string | null;
  offspring: BirthRegistrationOffspringPayload[];
  notes?: string | null;
}

export interface BirthRegistrationResponse {
  eventId: string;
  motherAnimalUuid: string;
  fatherAnimalUuid: string | null;
  birthDate: string;
  offspringCount: number;
  offspring: AnimalItem[];
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
  animalUuid?: string;
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
  authService: Pick<AuthService, 'getAccessToken' | 'currentUser'>;
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
  private authService: Pick<AuthService, 'getAccessToken' | 'currentUser'> = inject(AuthService);
  private offlineStatus: Pick<OfflineStatusService, 'isOnline'> = inject(OfflineStatusService);
  private store: OfflineStoreService = DEFAULT_OFFLINE_STORE_SERVICE;
  private metricsStore = inject(SyncMetricsStore);
  private now: () => string = () => new Date().toISOString();
  private windowRef: Pick<Window, 'dispatchEvent'> | undefined = globalThis.window;
  private readonly recentlyMutatedAnimalUuids = new Set<string>();

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

  getAnimal(uuid: string): Observable<AnimalItem> {
    return from(this.getAnimalInternal(uuid));
  }

  getGenealogy(uuid: string, generations?: number): Observable<AnimalGenealogy> {
    return from(this.getGenealogyInternal(uuid, generations));
  }

  createAnimal(payload: AnimalMutationPayload): Observable<AnimalMutationFeedback> {
    return from(this.createAnimalInternal(payload));
  }

  updateAnimal(uuid: string, payload: AnimalMutationPayload): Observable<AnimalMutationFeedback> {
    return from(this.updateAnimalInternal(uuid, payload));
  }

  registerBirth(motherUuid: string, payload: BirthRegistrationPayload): Observable<BirthRegistrationResponse> {
    return from(this.registerBirthInternal(motherUuid, payload));
  }

  private async listAnimalsInternal(filters: AnimalListFilters) {
    const effectiveFilters = this.withGanaderoOwnerScope(filters);
    const hasLocalAnimalOperations = await this.hasLocalAnimalOperations();
    await this.refreshPendingState();

    if (!this.offlineStatus.isOnline() || hasLocalAnimalOperations) {
      return this.listAnimalSnapshots(effectiveFilters);
    }

    const response = await firstValueFrom(
      this.http.get<AnimalsPageResponse>(`${this.appConfig.config().apiBaseUrl}/animals${buildListQuery(effectiveFilters)}`, {
        headers: this.buildHeaders(),
      })
    );

    const animals = (response.content ?? []).map(normalizeAnimalItem);
    await Promise.all(animals.map((animal) => this.saveAnimalSnapshot(animal)));
    await this.refreshPendingState();
    const mergedAnimals = await this.mergeRecentlyMutatedSnapshots(animals, effectiveFilters);
    return mergedAnimals.map(
      (animal) =>
        ({
          ...animal,
          syncStatus: animal.syncStatus ?? 'synced',
          syncMessage: animal.syncMessage ?? null,
        }) satisfies AnimalItem
    );
  }

  private async getAnimalInternal(uuid: string) {
    const localAnimal = await this.findAnimalSnapshot(uuid);
    await this.refreshPendingState();

    if (!this.offlineStatus.isOnline() || (await this.hasLocalAnimalOperations())) {
      if (!localAnimal) {
        throw new Error('ANIMAL_NOT_AVAILABLE_OFFLINE');
      }
      const outbox = await this.store.listOutbox();
      return decorateAnimalSnapshot(normalizeAnimalItem(localAnimal), outbox);
    }

    const response = await firstValueFrom(
      this.http.get<RawAnimalItem>(`${this.appConfig.config().apiBaseUrl}/animals/${uuid}`, {
        headers: this.buildHeaders(),
      })
    );
    const animal = normalizeAnimalItem(response);
    await this.saveAnimalSnapshot(animal);
    return { ...animal, syncStatus: 'synced', syncMessage: null } satisfies AnimalItem;
  }

  private async getGenealogyInternal(uuid: string, generations?: number) {
    const response = await firstValueFrom(
      this.http.get<RawAnimalGenealogy>(`${this.appConfig.config().apiBaseUrl}/animals/${uuid}/genealogy${buildGenealogyQuery(generations)}`, {
        headers: this.buildHeaders(),
      })
    );

    return {
      animal: markSynced(normalizeAnimalItem(response.animal)),
      mother: response.mother ? markSynced(normalizeAnimalItem(response.mother)) : null,
      father: response.father ? markSynced(normalizeAnimalItem(response.father)) : null,
      offspring: (response.offspring ?? []).map((animal) => markSynced(normalizeAnimalItem(animal))),
      ancestors: response.ancestors ? normalizeGenealogyNode(response.ancestors) : null,
    } satisfies AnimalGenealogy;
  }

  private withGanaderoOwnerScope(filters: AnimalListFilters): AnimalListFilters {
    const currentUser = this.authService.currentUser();
    if (currentUser?.role !== 'GANADERO') {
      return filters;
    }

    return {
      ...filters,
      ownerGanaderoId: currentUser.ganaderoId ?? '__NO_AUTHENTICATED_GANADERO__',
    };
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
    this.recentlyMutatedAnimalUuids.add(animalUuid);
    await this.refreshPendingState({
      lastMessage: this.offlineStatus.isOnline()
        ? 'Alta de animal encolada. Se disparó la sincronización automática.'
        : 'Alta de animal encolada. Se enviará al reconectar.',
    });

    if (this.offlineStatus.isOnline()) {
      triggerManualSync(this.windowRef);
      return {
        outcome: 'queued',
        animalUuid,
        message: 'Alta de animal encolada. Se disparó la sincronización automática.',
      } satisfies AnimalMutationFeedback;
    }

    return {
      outcome: 'queued',
      animalUuid,
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
    await this.saveAnimalSnapshot(
      applyOptimisticAnimalUpdate(uuid, currentSnapshot, sanitizedPayload, now)
    );
    this.recentlyMutatedAnimalUuids.add(uuid);
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

  private async registerBirthInternal(motherUuid: string, payload: BirthRegistrationPayload) {
    const response = await firstValueFrom(
      this.http.post<BirthRegistrationResponse>(`${this.appConfig.config().apiBaseUrl}/animals/${motherUuid}/birth-registration`, payload, {
        headers: this.buildHeaders(),
      })
    );

    const createdOffspring = response.offspring.map(normalizeAnimalItem);
    await Promise.all(createdOffspring.map((animal) => this.saveAnimalSnapshot(animal)));
    createdOffspring.forEach((animal) => this.recentlyMutatedAnimalUuids.add(animal.uuid));
    return {
      ...response,
      offspring: createdOffspring,
    } satisfies BirthRegistrationResponse;
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

  private async mergeRecentlyMutatedSnapshots(animals: AnimalItem[], filters: AnimalListFilters) {
    const remoteAnimalUuids = new Set(animals.map((animal) => animal.uuid));
    for (const uuid of [...this.recentlyMutatedAnimalUuids]) {
      if (remoteAnimalUuids.has(uuid)) {
        this.recentlyMutatedAnimalUuids.delete(uuid);
      }
    }

    if (!this.recentlyMutatedAnimalUuids.size) {
      return animals;
    }

    const snapshots = await this.store.listSnapshots('ANIMAL');
    const outbox = await this.store.listOutbox();
    const missingRecentlyMutatedAnimals = snapshots
      .filter((snapshot) => this.recentlyMutatedAnimalUuids.has(snapshot.entityId))
      .map((snapshot) => normalizeAnimalItem(snapshot.payload as unknown as RawAnimalItem | AnimalItem))
      .map((animal) => decorateAnimalSnapshot(animal, outbox))
      .filter((animal) => !remoteAnimalUuids.has(animal.uuid))
      .filter((animal) => matchesAnimalFilters(animal, filters));

    if (!missingRecentlyMutatedAnimals.length) {
      return animals;
    }

    return [...missingRecentlyMutatedAnimals, ...animals].sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt)
    );
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
    ownerGanaderoId: payload.ownerGanaderoId ?? 'SESSION_GANADERO',
    motherAnimalUuid: payload.motherAnimalUuid ?? null,
    fatherAnimalUuid: payload.fatherAnimalUuid ?? null,
    arete: payload.arete ?? null,
    marca: payload.marca ?? null,
    tatuaje: payload.tatuaje ?? null,
    color: payload.color ?? null,
    description: payload.description ?? null,
    breedUuid: payload.breedUuid ?? null,
    breedName: payload.breedName ?? null,
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
    ownerGanaderoId: payload.ownerGanaderoId ?? currentSnapshot?.ownerGanaderoId ?? 'SESSION_GANADERO',
    motherAnimalUuid: payload.motherAnimalUuid ?? currentSnapshot?.motherAnimalUuid ?? null,
    fatherAnimalUuid: payload.fatherAnimalUuid ?? currentSnapshot?.fatherAnimalUuid ?? null,
    arete: payload.arete ?? null,
    marca: payload.marca ?? null,
    tatuaje: payload.tatuaje ?? null,
    color: payload.color ?? currentSnapshot?.color ?? null,
    description: payload.description ?? currentSnapshot?.description ?? null,
    breedUuid: payload.breedUuid ?? currentSnapshot?.breedUuid ?? null,
    breedName: payload.breedName ?? currentSnapshot?.breedName ?? null,
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
    color: animal.color ?? null,
    description: animal.description ?? null,
    breedUuid: animal.breedUuid ?? null,
    breedName: animal.breedName ?? null,
  } satisfies AnimalItem;
}

function normalizeGenealogyNode(node: RawAnimalGenealogyNode): AnimalGenealogyNode {
  return {
    animal: markSynced(normalizeAnimalItem(node.animal)),
    mother: node.mother ? normalizeGenealogyNode(node.mother) : null,
    father: node.father ? normalizeGenealogyNode(node.father) : null,
  } satisfies AnimalGenealogyNode;
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

function buildGenealogyQuery(generations: number | undefined) {
  if (generations === undefined) {
    return '';
  }

  return `?generations=${encodeURIComponent(String(generations))}`;
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

function markSynced(animal: AnimalItem): AnimalItem {
  return { ...animal, syncStatus: 'synced', syncMessage: null } satisfies AnimalItem;
}

function sanitizeMutationPayload(payload: AnimalMutationPayload): AnimalOfflineMutationPayload {
  const ownerGanaderoId = normalizeOptionalText(payload.ownerGanaderoId);
  const motherAnimalUuid = normalizeOptionalText(payload.motherAnimalUuid);
  const fatherAnimalUuid = normalizeOptionalText(payload.fatherAnimalUuid);
  return {
    ...(ownerGanaderoId ? { ownerGanaderoId } : {}),
    motherAnimalUuid,
    fatherAnimalUuid,
    arete: normalizeOptionalText(payload.arete),
    marca: normalizeOptionalText(payload.marca),
    tatuaje: normalizeOptionalText(payload.tatuaje),
    color: normalizeOptionalText(payload.color),
    description: normalizeOptionalText(payload.description),
    breedUuid: normalizeOptionalText(payload.breedUuid),
    breedName: normalizeOptionalText(payload.breedName),
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
