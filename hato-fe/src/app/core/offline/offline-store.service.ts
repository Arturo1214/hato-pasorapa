import {
  CURRENT_OFFLINE_SCHEMA_VERSION,
  createEmptyOfflineState,
  migrateOfflineState,
  normalizeOperationStatus,
  type OfflinePersistenceAdapter,
} from './offline-store.migrations';
import {
  type EnqueueOfflineOperationInput,
  type OfflineFailureDescriptor,
  type OfflineInboxEntry,
  type OfflineOperationEnvelope,
  type OfflineSnapshotRecord,
  type OfflineSyncCheckpoint,
  type PersistedOfflineState,
} from './offline-types';

const OUTBOX_STORE = 'outbox';
const INBOX_STORE = 'inbox';
const SNAPSHOTS_STORE = 'snapshots';
const SYNC_STATE_STORE = 'sync_state';
const OFFLINE_DATABASE_NAME = 'hato-offline';
const OFFLINE_DATABASE_VERSION = 1;
const META_KEY = 'meta';

export interface OfflineStoreOptions {
  generateId?: () => string;
  now?: () => string;
}

export class OfflineStoreService {
  private cachedState?: PersistedOfflineState;

  constructor(
    private readonly adapter: OfflinePersistenceAdapter = new IndexedDbOfflinePersistenceAdapter(),
    private readonly options: OfflineStoreOptions = {}
  ) {}

  async enqueueOperation(input: EnqueueOfflineOperationInput): Promise<OfflineOperationEnvelope> {
    const state = await this.getState();
    const operation: OfflineOperationEnvelope = {
      operationId:
        input.operationId ?? this.options.generateId?.() ?? globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`,
      entityType: input.entityType,
      entityId: input.entityId,
      opType: input.opType,
      payload: input.payload,
      baseVersion: input.baseVersion,
      clientCreatedAt: input.clientCreatedAt,
      clientUpdatedAt: input.clientUpdatedAt,
      status: 'pending',
      attempts: 0,
    };

    state.outbox.push(operation);
    await this.persistState(state);
    return operation;
  }

  async listOutbox(): Promise<OfflineOperationEnvelope[]> {
    const state = await this.getState();
    return state.outbox.map((operation) => ({
      ...operation,
      status: normalizeOperationStatus(operation.status),
    }));
  }

  async markInFlight(operationId: string) {
    const state = await this.getState();
    const operation = this.requireOperation(state, operationId);
    operation.status = 'in_flight';
    operation.attempts += 1;
    await this.persistState(state);
    return { ...operation };
  }

  async markAcked(operationId: string) {
    const state = await this.getState();
    const operation = this.requireOperation(state, operationId);
    operation.status = 'acked';
    operation.nextAttemptAt = undefined;
    operation.lastErrorCode = undefined;
    operation.lastErrorMessage = undefined;
    operation.conflict = undefined;
    await this.persistState(state);
  }

  async markRetryScheduled(operationId: string, failure: OfflineFailureDescriptor, nextAttemptAt: string) {
    const state = await this.getState();
    const operation = this.requireOperation(state, operationId);
    operation.status = 'retry_scheduled';
    operation.nextAttemptAt = nextAttemptAt;
    operation.lastErrorCode = failure.code;
    operation.lastErrorMessage = failure.message;
    await this.persistState(state);
  }

  async markFailed(operationId: string, failure: OfflineFailureDescriptor) {
    const state = await this.getState();
    const operation = this.requireOperation(state, operationId);
    operation.status = 'failed';
    operation.nextAttemptAt = undefined;
    operation.lastErrorCode = failure.code;
    operation.lastErrorMessage = failure.message;
    await this.persistState(state);
  }

  async markConflict(operationId: string, failure: OfflineFailureDescriptor, conflict: OfflineOperationEnvelope['conflict']) {
    const state = await this.getState();
    const operation = this.requireOperation(state, operationId);
    operation.status = 'conflict';
    operation.nextAttemptAt = undefined;
    operation.lastErrorCode = failure.code;
    operation.lastErrorMessage = failure.message;
    operation.conflict = conflict;
    await this.persistState(state);
  }

  async markDeadLetter(operationId: string, failure: OfflineFailureDescriptor) {
    const state = await this.getState();
    const operation = this.requireOperation(state, operationId);
    operation.status = 'dead_letter';
    operation.lastErrorCode = failure.code;
    operation.lastErrorMessage = failure.message;
    await this.persistState(state);
  }

  async saveCheckpoint(checkpoint: OfflineSyncCheckpoint) {
    const state = await this.getState();
    state.syncState.checkpoints[checkpoint.entityType] = checkpoint;
    await this.persistState(state);
  }

  async getCheckpoint(entityType: OfflineSyncCheckpoint['entityType']) {
    const state = await this.getState();
    return state.syncState.checkpoints[entityType] ?? null;
  }

  async saveInboxEntry(entry: OfflineInboxEntry) {
    const state = await this.getState();
    state.inbox = [...state.inbox.filter((current) => current.key !== entry.key), entry];
    await this.persistState(state);
  }

  async listInbox() {
    const state = await this.getState();
    return [...state.inbox];
  }

  async saveSnapshot(snapshot: OfflineSnapshotRecord) {
    const state = await this.getState();
    state.snapshots = [...state.snapshots.filter((current) => current.key !== snapshot.key), snapshot];
    await this.persistState(state);
  }

  async listSnapshots(entityType?: OfflineSnapshotRecord['entityType']) {
    const state = await this.getState();
    return entityType ? state.snapshots.filter((snapshot) => snapshot.entityType === entityType) : [...state.snapshots];
  }

  async deleteSnapshot(entityType: OfflineSnapshotRecord['entityType'], entityId: string) {
    const state = await this.getState();
    const key = `${entityType}:${entityId}`;
    state.snapshots = state.snapshots.filter((snapshot) => snapshot.key !== key);
    state.inbox = state.inbox.filter((entry) => entry.key !== key);
    await this.persistState(state);
  }

  async listEligibleOperations(now: string) {
    const state = await this.getState();
    return state.outbox
      .filter((operation) => {
        const status = normalizeOperationStatus(operation.status);
        if (status === 'pending') {
          return true;
        }

        return status === 'retry_scheduled' && (!operation.nextAttemptAt || operation.nextAttemptAt <= now);
      })
      .map((operation) => ({
        ...operation,
        status: normalizeOperationStatus(operation.status),
      }));
  }

  async countPendingOperations() {
    const state = await this.getState();
    return state.outbox.filter((operation) => {
      const status = normalizeOperationStatus(operation.status);
      return status === 'pending' || status === 'retry_scheduled' || status === 'in_flight';
    }).length;
  }

  async applyPullResponse(
    entityType: OfflineSnapshotRecord['entityType'],
    items: Array<Record<string, unknown>>,
    checkpoint: OfflineSyncCheckpoint
  ) {
    const state = await this.getState();

    items.forEach((item) => {
      const entityId = String(item['uuid'] ?? item['id'] ?? '');
      if (!entityId) {
        return;
      }

      const key = `${entityType}:${entityId}`;
      const payload = { ...item };
      const updatedAt = String(item['updatedAt'] ?? checkpoint.cursorUpdatedAt);
      const version = typeof item['version'] === 'number' ? item['version'] : undefined;

      state.inbox = [...state.inbox.filter((current) => current.key !== key), {
        key,
        entityType,
        entityId,
        payload,
        receivedAt: checkpoint.lastSuccessAt,
      }];
      state.snapshots = [...state.snapshots.filter((current) => current.key !== key), {
        key,
        entityType,
        entityId,
        payload,
        updatedAt,
        version,
      }];
    });

    state.syncState.checkpoints[entityType] = checkpoint;
    await this.persistState(state);
  }

  async getSchemaVersion() {
    const state = await this.getState();
    return state.schemaVersion;
  }

  private async getState() {
    if (this.cachedState) {
      return this.cachedState;
    }

    const existing = await this.adapter.load();
    const { state, appliedMigrations } = migrateOfflineState(existing);

    if (!existing || appliedMigrations.length > 0 || state.schemaVersion !== CURRENT_OFFLINE_SCHEMA_VERSION) {
      await this.adapter.save(state);
    }

    this.cachedState = state;
    return state;
  }

  private async persistState(state: PersistedOfflineState) {
    this.cachedState = state;
    await this.adapter.save(state);
  }

  private requireOperation(state: PersistedOfflineState, operationId: string) {
    const operation = state.outbox.find((current) => current.operationId === operationId);

    if (!operation) {
      throw new Error(`Offline operation ${operationId} was not found.`);
    }

    return operation;
  }
}

class IndexedDbOfflinePersistenceAdapter implements OfflinePersistenceAdapter {
  async load(): Promise<PersistedOfflineState | undefined> {
    if (!globalThis.indexedDB) {
      return undefined;
    }

    const database = await openDatabase(globalThis.indexedDB);
    const transaction = database.transaction([OUTBOX_STORE, INBOX_STORE, SNAPSHOTS_STORE, SYNC_STATE_STORE], 'readonly');

    const [outbox, inbox, snapshots, syncStateRecords] = await Promise.all([
      requestToPromise(transaction.objectStore(OUTBOX_STORE).getAll()),
      requestToPromise(transaction.objectStore(INBOX_STORE).getAll()),
      requestToPromise(transaction.objectStore(SNAPSHOTS_STORE).getAll()),
      requestToPromise(transaction.objectStore(SYNC_STATE_STORE).getAll()),
    ]);

    await transactionDone(transaction);

    if (!outbox.length && !inbox.length && !snapshots.length && !syncStateRecords.length) {
      return undefined;
    }

    const metaRecord = syncStateRecords.find((record) => record.key === META_KEY);
    const checkpointRecords = syncStateRecords.filter((record) => record.key !== META_KEY);

    return {
      schemaVersion: metaRecord?.value?.schemaVersion ?? CURRENT_OFFLINE_SCHEMA_VERSION,
      outbox,
      inbox,
      snapshots,
      syncState: {
        checkpoints: Object.fromEntries(
          checkpointRecords.map((record) => [record.key.replace('checkpoint:', ''), record.value])
        ),
        meta: metaRecord?.value?.meta,
      },
    };
  }

  async save(state: PersistedOfflineState): Promise<void> {
    if (!globalThis.indexedDB) {
      return;
    }

    const database = await openDatabase(globalThis.indexedDB);
    const transaction = database.transaction([OUTBOX_STORE, INBOX_STORE, SNAPSHOTS_STORE, SYNC_STATE_STORE], 'readwrite');

    const outboxStore = transaction.objectStore(OUTBOX_STORE);
    const inboxStore = transaction.objectStore(INBOX_STORE);
    const snapshotsStore = transaction.objectStore(SNAPSHOTS_STORE);
    const syncStateStore = transaction.objectStore(SYNC_STATE_STORE);

    await Promise.all([
      requestToPromise(outboxStore.clear()),
      requestToPromise(inboxStore.clear()),
      requestToPromise(snapshotsStore.clear()),
      requestToPromise(syncStateStore.clear()),
    ]);

    state.outbox.forEach((operation) => outboxStore.put(operation));
    state.inbox.forEach((entry) => inboxStore.put(entry));
    state.snapshots.forEach((snapshot) => snapshotsStore.put(snapshot));
    syncStateStore.put({ key: META_KEY, value: { schemaVersion: state.schemaVersion, meta: state.syncState.meta } });

    Object.entries(state.syncState.checkpoints).forEach(([entityType, checkpoint]) => {
      if (checkpoint) {
        syncStateStore.put({ key: `checkpoint:${entityType}`, value: checkpoint });
      }
    });

    await transactionDone(transaction);
  }
}

export const DEFAULT_OFFLINE_STORE_SERVICE = new OfflineStoreService();

function openDatabase(indexedDb: IDBFactory) {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDb.open(OFFLINE_DATABASE_NAME, OFFLINE_DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(OUTBOX_STORE)) {
        database.createObjectStore(OUTBOX_STORE, { keyPath: 'operationId' });
      }
      if (!database.objectStoreNames.contains(INBOX_STORE)) {
        database.createObjectStore(INBOX_STORE, { keyPath: 'key' });
      }
      if (!database.objectStoreNames.contains(SNAPSHOTS_STORE)) {
        database.createObjectStore(SNAPSHOTS_STORE, { keyPath: 'key' });
      }
      if (!database.objectStoreNames.contains(SYNC_STATE_STORE)) {
        database.createObjectStore(SYNC_STATE_STORE, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestToPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}
