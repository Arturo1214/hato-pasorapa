import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom, from, type Observable } from 'rxjs';
import { AuthService } from '../../../../core/auth/data-access/auth.service';
import { ApplicationConfigService } from '../../../../core/config/application-config.service';
import {
  ANIMAL_IMAGE_MIME_TYPES,
  type AnimalImageMimeType,
  type AnimalImageOfflineCreatePayload,
  type AnimalImageSnapshotPayload,
} from '../../../../core/offline/offline-types';
import {
  DEFAULT_OFFLINE_IMAGE_BINARY_STORE,
  OfflineImageBinaryStoreService,
} from '../../../../core/offline/offline-image-binary-store.service';
import { OfflineStatusService } from '../../../../core/offline/offline-status.service';
import { DEFAULT_OFFLINE_STORE_SERVICE, OfflineStoreService } from '../../../../core/offline/offline-store.service';
import { triggerManualSync } from '../../../../core/offline/sync-orchestrator.service';
import { SyncMetricsStore } from '../../../../core/offline/sync-metrics.store';
import { compareAnimalImageTimeline, decorateAnimalImageTimeline, normalizeAnimalImageItem, toSnapshotPayload } from './animal-images-timeline.adapter';

export interface AnimalImageItem {
  id: string;
  animalUuid: string;
  operationId: string;
  fileName: string;
  mimeType: AnimalImageMimeType;
  sizeBytes: number;
  checksumSha256: string;
  capturedAt: string;
  sourceChannel: 'ONLINE' | 'OFFLINE';
  binaryRef: string;
  thumbnailRef?: string | null;
  previewUrl?: string | null;
  clientCreatedAt: string;
  createdAt: string;
  updatedAt: string;
  syncState: 'PENDING' | 'SYNCED' | 'FAILED';
  syncMessage?: string | null;
}

export interface AnimalImageMutationFeedback {
  outcome: 'queued' | 'blocked';
  message: string;
}

interface AnimalImageListResponse {
  items: Array<Record<string, unknown>>;
}

@Injectable({ providedIn: 'root' })
export class AnimalsImagesService {
  private http: Pick<HttpClient, 'get'> = inject(HttpClient);
  private appConfig: Pick<ApplicationConfigService, 'config'> = inject(ApplicationConfigService);
  private authService: Pick<AuthService, 'getAccessToken' | 'currentUser'> = inject(AuthService);
  private offlineStatus: Pick<OfflineStatusService, 'isOnline'> = inject(OfflineStatusService);
  private store: OfflineStoreService = DEFAULT_OFFLINE_STORE_SERVICE;
  private imageBinaryStore: OfflineImageBinaryStoreService = DEFAULT_OFFLINE_IMAGE_BINARY_STORE;
  private metricsStore = inject(SyncMetricsStore);
  private now = () => new Date().toISOString();
  private windowRef: Pick<Window, 'dispatchEvent'> | undefined = globalThis.window;

  configureForTesting(dependencies: Partial<{
    http: Pick<HttpClient, 'get'>;
    appConfig: Pick<ApplicationConfigService, 'config'>;
    authService: Pick<AuthService, 'getAccessToken' | 'currentUser'>;
    offlineStatus: Pick<OfflineStatusService, 'isOnline'>;
    store: OfflineStoreService;
    imageBinaryStore: OfflineImageBinaryStoreService;
    metricsStore: SyncMetricsStore;
    now: () => string;
    windowRef: Pick<Window, 'dispatchEvent'>;
  }>) {
    this.http = dependencies.http ?? this.http;
    this.appConfig = dependencies.appConfig ?? this.appConfig;
    this.authService = dependencies.authService ?? this.authService;
    this.offlineStatus = dependencies.offlineStatus ?? this.offlineStatus;
    this.store = dependencies.store ?? this.store;
    this.imageBinaryStore = dependencies.imageBinaryStore ?? this.imageBinaryStore;
    this.metricsStore = dependencies.metricsStore ?? this.metricsStore;
    this.now = dependencies.now ?? this.now;
    this.windowRef = dependencies.windowRef ?? this.windowRef;
  }

  listImages(animalUuid: string): Observable<AnimalImageItem[]> {
    return from(this.listImagesInternal(animalUuid));
  }

  addImages(animalUuid: string, files: FileList | File[]): Observable<AnimalImageMutationFeedback> {
    return from(this.addImagesInternal(animalUuid, Array.from(files)));
  }

  private async listImagesInternal(animalUuid: string) {
    const hasLocalOperations = await this.hasLocalAnimalImageOperations(animalUuid);
    if (!this.offlineStatus.isOnline() || hasLocalOperations) {
      return this.listLocalImageSnapshots(animalUuid);
    }

    const response = await firstValueFrom(
      this.http.get<AnimalImageListResponse>(`${this.appConfig.config().apiBaseUrl}/animals/${animalUuid}/images`, {
        headers: this.buildHeaders(),
      })
    );

    const items = await Promise.all(
      (response.items ?? []).map(async (raw) => {
        const item = normalizeAnimalImageItem(raw);
        return {
          ...item,
          previewUrl: await this.fetchRemotePreview(item.id),
          syncState: 'SYNCED',
          syncMessage: null,
        } satisfies AnimalImageItem;
      })
    );

    await Promise.all(items.map((item) => this.saveImageSnapshot(item)));
    return items.sort(compareAnimalImageTimeline);
  }

  private async addImagesInternal(animalUuid: string, files: File[]) {
    if (!files.length) {
      return { outcome: 'blocked', message: 'Seleccioná al menos una imagen.' } satisfies AnimalImageMutationFeedback;
    }

    if (files.length > 3) {
      return { outcome: 'blocked', message: 'V1 permite como máximo 3 imágenes por animal por ciclo de sync.' } satisfies AnimalImageMutationFeedback;
    }

    const invalidType = files.find((file) => !ANIMAL_IMAGE_MIME_TYPES.includes(file.type as AnimalImageMimeType));
    if (invalidType) {
      return { outcome: 'blocked', message: 'Solo se permiten imágenes JPEG o PNG en V1.' } satisfies AnimalImageMutationFeedback;
    }

    const invalidSize = files.find((file) => file.size > 2 * 1024 * 1024);
    if (invalidSize) {
      return { outcome: 'blocked', message: 'Cada imagen debe pesar como máximo 2MB.' } satisfies AnimalImageMutationFeedback;
    }

    const now = this.now();
    for (const file of files) {
      const operationId = globalThis.crypto.randomUUID();
      const checksumSha256 = await computeSha256(file);
      const previewUrl = globalThis.URL?.createObjectURL?.(file) ?? null;
      const payload: AnimalImageOfflineCreatePayload = {
        animalUuid,
        operationId,
        sourceChannel: this.offlineStatus.isOnline() ? 'ONLINE' : 'OFFLINE',
        fileName: file.name,
        mimeType: file.type as AnimalImageMimeType,
        sizeBytes: file.size,
        checksumSha256,
        capturedAt: now,
        binaryRef: operationId,
      };

      await this.imageBinaryStore.saveBinary({
        operationId,
        blob: file,
        mimeType: file.type,
        sizeBytes: file.size,
        capturedAt: now,
      });
      await this.store.enqueueOperation({
        entityType: 'ANIMAL_IMAGE',
        entityId: operationId,
        opType: 'CREATE',
        payload: payload as unknown as Record<string, unknown>,
        baseVersion: 0,
        clientCreatedAt: now,
        clientUpdatedAt: now,
        operationId,
      });
      await this.saveImageSnapshot({
        ...payload,
        id: operationId,
        previewUrl,
        thumbnailRef: null,
        clientCreatedAt: now,
        createdAt: now,
        updatedAt: now,
        syncState: 'PENDING',
        syncMessage: 'Pendiente de sync.',
      });
    }

    this.metricsStore.patch({ pending: await this.store.countPendingOperations() });
    if (this.offlineStatus.isOnline()) {
      triggerManualSync(this.windowRef);
      return { outcome: 'queued', message: 'Imágenes encoladas. Se disparó la sincronización automática.' } satisfies AnimalImageMutationFeedback;
    }

    return { outcome: 'queued', message: 'Imágenes encoladas. Se enviarán al reconectar.' } satisfies AnimalImageMutationFeedback;
  }

  private async listLocalImageSnapshots(animalUuid: string) {
    const snapshots = await this.store.listSnapshots('ANIMAL_IMAGE');
    const outbox = await this.store.listOutbox();
    const items = await Promise.all(
      snapshots
        .map((snapshot) => snapshot.payload as unknown as AnimalImageItem)
        .filter((item) => item.animalUuid === animalUuid)
        .map(async (item) => ({
          ...item,
          previewUrl: item.previewUrl ?? (await this.imageBinaryStore.createPreviewUrl(item.binaryRef)),
        }))
    );
    return decorateAnimalImageTimeline(items, outbox);
  }

  private async hasLocalAnimalImageOperations(animalUuid: string) {
    const outbox = await this.store.listOutbox();
    return outbox.some(
      (operation) =>
        operation.entityType === 'ANIMAL_IMAGE' &&
        (operation.payload['animalUuid'] as string | undefined) === animalUuid &&
        operation.status !== 'acked'
    );
  }

  private async saveImageSnapshot(item: AnimalImageItem) {
    await this.store.saveSnapshot({
      key: `ANIMAL_IMAGE:${item.id}`,
      entityType: 'ANIMAL_IMAGE',
      entityId: item.id,
      payload: toSnapshotPayload(item) as AnimalImageSnapshotPayload,
      updatedAt: item.updatedAt,
    });
  }

  private async fetchRemotePreview(imageId: string) {
    try {
      const blob = await firstValueFrom(
        this.http.get(`${this.appConfig.config().apiBaseUrl}/animal-images/${imageId}/content`, {
          headers: this.buildHeaders(),
          responseType: 'blob' as const,
        })
      );
      return globalThis.URL?.createObjectURL?.(blob) ?? null;
    } catch {
      return null;
    }
  }

  private buildHeaders() {
    const token = this.authService.getAccessToken();
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
  }
}

async function computeSha256(file: Blob) {
  const buffer = await blobToArrayBuffer(file);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new Uint8Array(buffer));
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

async function blobToArrayBuffer(file: Blob) {
  if (typeof file.arrayBuffer === 'function') {
    return file.arrayBuffer();
  }

  if (typeof FileReader !== 'undefined') {
    return new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });
  }

  const text = typeof file.text === 'function' ? await file.text() : String(file);
  return new TextEncoder().encode(text).buffer;
}
