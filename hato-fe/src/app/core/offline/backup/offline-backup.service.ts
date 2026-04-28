import { inject, Injectable } from '@angular/core';
import { AuthService } from '../../auth/data-access/auth.service';
import {
  DEFAULT_OFFLINE_IMAGE_BINARY_STORE,
  OfflineImageBinaryStoreService,
} from '../offline-image-binary-store.service';
import { CURRENT_OFFLINE_SCHEMA_VERSION } from '../offline-store.migrations';
import { DEFAULT_OFFLINE_STORE_SERVICE, OfflineStoreService } from '../offline-store.service';
import type { PersistedOfflineState } from '../offline-types';
import {
  BACKUP_DIGEST_ALGORITHM,
  BACKUP_VERSION_V1,
  type BackupEnvelopeV1,
  type BackupExportOptions,
  type BackupImportResult,
  BackupImportError,
  BackupValidationError,
  cloneBackupEnvelopeForDigest,
  computeSha256Hex,
  serializeBackupEnvelopeCanonical,
} from './offline-backup.types';
import { validateBackupEnvelope } from './offline-backup.validator';
import { runOfflineRestoreRehydration } from '../../../app.initializers';

@Injectable({ providedIn: 'root' })
export class OfflineBackupService {
  private store: OfflineStoreService = DEFAULT_OFFLINE_STORE_SERVICE;
  private imageBinaryStore: OfflineImageBinaryStoreService = DEFAULT_OFFLINE_IMAGE_BINARY_STORE;
  private authService: Pick<AuthService, 'forceReauthAfterRestore'> = inject(AuthService);
  private now: () => string = () => new Date().toISOString();
  private runtimeRehydrator: () => Promise<void> = () => runOfflineRestoreRehydration();
  private downloadJson: (fileName: string, json: string) => void = defaultJsonDownload;

  configureForTesting(
    dependencies: Partial<{
      store: OfflineStoreService;
      imageBinaryStore: OfflineImageBinaryStoreService;
      authService: Pick<AuthService, 'forceReauthAfterRestore'>;
      now: () => string;
      runtimeRehydrator: () => Promise<void>;
      downloadJson: (fileName: string, json: string) => void;
    }>
  ) {
    this.store = dependencies.store ?? this.store;
    this.imageBinaryStore = dependencies.imageBinaryStore ?? this.imageBinaryStore;
    this.authService = dependencies.authService ?? this.authService;
    this.now = dependencies.now ?? this.now;
    this.runtimeRehydrator = dependencies.runtimeRehydrator ?? this.runtimeRehydrator;
    this.downloadJson = dependencies.downloadJson ?? this.downloadJson;
  }

  async exportBackup(options: BackupExportOptions = { includeImages: true }): Promise<BackupEnvelopeV1> {
    const sourceState = await this.store.getStateSnapshotForBackup({ excludeSessionSecurity: true });
    const offlineState = options.includeImages ? sourceState : stripAnimalImageArtifacts(sourceState);
    const images = options.includeImages ? await this.imageBinaryStore.listForBackup() : [];
    const envelope: BackupEnvelopeV1 = {
      backupVersion: BACKUP_VERSION_V1,
      createdAt: this.now(),
      sourceSchemaVersion: CURRENT_OFFLINE_SCHEMA_VERSION,
      manifest: {
        imagesExcluded: !options.includeImages,
        entityCounts: countEntities(offlineState),
      },
      offlineState,
      images: images.length > 0 ? images : undefined,
      integrity: {
        digestAlgorithm: BACKUP_DIGEST_ALGORITHM,
        digest: '',
        imageOperationIds: images.map((image) => image.operationId).sort(),
      },
    };

    const digest = await computeSha256Hex(serializeBackupEnvelopeCanonical(cloneBackupEnvelopeForDigest(envelope)));
    return {
      ...envelope,
      integrity: {
        ...envelope.integrity,
        digest,
      },
    };
  }

  async exportBackupJson(options: BackupExportOptions = { includeImages: true }) {
    const envelope = await this.exportBackup(options);
    return serializeBackupEnvelopeCanonical(envelope);
  }

  async downloadBackup(options: BackupExportOptions = { includeImages: true }) {
    const json = await this.exportBackupJson(options);
    this.downloadJson(buildBackupFileName(this.now(), options.includeImages), json);
  }

  async importBackupFile(file: File): Promise<BackupImportResult> {
    try {
      return this.importBackupJson(await file.text());
    } catch (error) {
      if (error instanceof BackupValidationError || error instanceof BackupImportError) {
        throw error;
      }

      throw new BackupImportError(
        'BACKUP_FILE_CORRUPT',
        'No pudimos leer el archivo. Verificá que sea un JSON exportado desde Hato.',
        error
      );
    }
  }

  async importBackupJson(serialized: string): Promise<BackupImportResult> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(serialized);
    } catch (error) {
      throw new BackupImportError(
        'BACKUP_FILE_CORRUPT',
        'El archivo no contiene JSON válido. Exportalo nuevamente antes de restaurar.',
        error
      );
    }

    return this.importBackup(parsed);
  }

  async importBackup(candidate: unknown): Promise<BackupImportResult> {
    const envelope = await validateBackupEnvelope(candidate, {
      currentSchemaVersion: CURRENT_OFFLINE_SCHEMA_VERSION,
    });

    const previousState = await this.store.getStateSnapshotForBackup({ excludeSessionSecurity: false });
    const previousImages = await this.imageBinaryStore.listForBackup();

    try {
      await this.store.restoreFromBackupTx(envelope.offlineState);
      await this.imageBinaryStore.restoreBinarySetTx(envelope.images ?? []);
      await this.runtimeRehydrator();
      await this.authService.forceReauthAfterRestore();

      return {
        restoredAt: this.now(),
        imagesRestored: envelope.images?.length ?? 0,
        entityCounts: envelope.manifest.entityCounts,
      };
    } catch (error) {
      await this.store.restoreFromBackupTx(previousState);
      await this.imageBinaryStore.restoreBinarySetTx(previousImages);
      throw new BackupImportError(
        'BACKUP_RESTORE_FAILED',
        'No pudimos restaurar el backup sin dejar estado parcial. Se recuperó el estado previo del dispositivo.',
        error
      );
    }
  }
}

function countEntities(state: PersistedOfflineState) {
  const counts: Record<string, number> = {
    OUTBOX: state.outbox.length,
    INBOX: state.inbox.length,
    SNAPSHOTS: state.snapshots.length,
    CHECKPOINTS: Object.values(state.syncState.checkpoints).filter(Boolean).length,
  };

  for (const operation of state.outbox) {
    counts[operation.entityType] = (counts[operation.entityType] ?? 0) + 1;
  }

  for (const snapshot of state.snapshots) {
    counts[snapshot.entityType] = (counts[snapshot.entityType] ?? 0) + 1;
  }

  return counts;
}

function stripAnimalImageArtifacts(state: PersistedOfflineState): PersistedOfflineState {
  return {
    ...state,
    outbox: state.outbox.filter((operation) => operation.entityType !== 'ANIMAL_IMAGE'),
    inbox: state.inbox.filter((entry) => entry.entityType !== 'ANIMAL_IMAGE'),
    snapshots: state.snapshots.filter((snapshot) => snapshot.entityType !== 'ANIMAL_IMAGE'),
    syncState: {
      ...state.syncState,
      checkpoints: Object.fromEntries(
        Object.entries(state.syncState.checkpoints).filter(([entityType, checkpoint]) => entityType !== 'ANIMAL_IMAGE' && !!checkpoint)
      ),
    },
  };
}

function buildBackupFileName(now: string, includeImages: boolean) {
  const compactDate = now.replace(/[:]/g, '-');
  return `hato-backup-${includeImages ? 'full' : 'no-images'}-${compactDate}.json`;
}

function defaultJsonDownload(fileName: string, json: string) {
  if (!globalThis.document || !globalThis.URL?.createObjectURL) {
    return;
  }

  const blob = new Blob([json], { type: 'application/json' });
  const url = globalThis.URL.createObjectURL(blob);
  const anchor = globalThis.document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  globalThis.URL.revokeObjectURL(url);
}
