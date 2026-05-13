import type { BackupImageBinaryEntry } from './backup/offline-backup.types';

export interface OfflineImageBinaryRecord {
  operationId: string;
  blob: Blob;
  mimeType: string;
  sizeBytes: number;
  capturedAt: string;
  thumbnailRef?: string | null;
  compressed?: boolean;
}

export interface OfflineImageBinaryPersistenceAdapter {
  save(record: OfflineImageBinaryRecord): Promise<void>;
  get(operationId: string): Promise<OfflineImageBinaryRecord | null>;
  delete(operationId: string): Promise<void>;
  list(): Promise<OfflineImageBinaryRecord[]>;
  replaceAll(records: OfflineImageBinaryRecord[]): Promise<void>;
}

export class InMemoryOfflineImageBinaryPersistenceAdapter implements OfflineImageBinaryPersistenceAdapter {
  private readonly records = new Map<string, OfflineImageBinaryRecord>();

  async save(record: OfflineImageBinaryRecord) {
    this.records.set(record.operationId, record);
  }

  async get(operationId: string) {
    return this.records.get(operationId) ?? null;
  }

  async delete(operationId: string) {
    this.records.delete(operationId);
  }

  async list() {
    return [...this.records.values()];
  }

  async replaceAll(records: OfflineImageBinaryRecord[]) {
    this.records.clear();
    records.forEach((record) => this.records.set(record.operationId, record));
  }
}

const IMAGE_BINARY_DB = 'hato-offline-image-binaries';
const IMAGE_BINARY_DB_VERSION = 1;
const IMAGE_BINARY_STORE = 'animal_image_binaries';

export class OfflineImageBinaryStoreService {
  constructor(private readonly adapter: OfflineImageBinaryPersistenceAdapter = new IndexedDbOfflineImageBinaryPersistenceAdapter()) {}

  async saveBinary(record: OfflineImageBinaryRecord) {
    await this.adapter.save(record);
  }

  async getBinary(operationId: string) {
    return this.adapter.get(operationId);
  }

  async purgeBinary(operationId: string) {
    await this.adapter.delete(operationId);
  }

  async listForBackup(): Promise<BackupImageBinaryEntry[]> {
    const records = await this.adapter.list();
    return Promise.all(
      records.map(async (record) => ({
        operationId: record.operationId,
        mimeType: record.mimeType,
        sizeBytes: record.sizeBytes,
        capturedAt: record.capturedAt,
        thumbnailRef: record.thumbnailRef,
        compressed: record.compressed,
        base64: await this.getRequiredBase64Data(record),
      }))
    );
  }

  async restoreBinarySetTx(entries: BackupImageBinaryEntry[]) {
    await this.adapter.replaceAll(
      entries.map((entry) => ({
        operationId: entry.operationId,
        blob: base64ToBlob(entry.base64, entry.mimeType),
        mimeType: entry.mimeType,
        sizeBytes: entry.sizeBytes,
        capturedAt: entry.capturedAt,
        thumbnailRef: entry.thumbnailRef,
        compressed: entry.compressed,
      }))
    );
  }

  async getBase64Data(operationId: string) {
    const record = await this.adapter.get(operationId);
    if (!record) {
      return null;
    }

    const buffer = await blobToArrayBuffer(record.blob);
    const bytes = new Uint8Array(buffer);
    let binary = '';
    bytes.forEach((value) => {
      binary += String.fromCharCode(value);
    });
    return globalThis.btoa(binary);
  }

  async createPreviewUrl(operationId: string) {
    const record = await this.adapter.get(operationId);
    if (!record || !globalThis.URL?.createObjectURL) {
      return null;
    }

    return globalThis.URL.createObjectURL(record.blob);
  }

  private async getRequiredBase64Data(record: OfflineImageBinaryRecord) {
    const buffer = await blobToArrayBuffer(record.blob);
    const bytes = new Uint8Array(buffer);
    let binary = '';
    bytes.forEach((value) => {
      binary += String.fromCharCode(value);
    });
    return globalThis.btoa(binary);
  }
}

async function blobToArrayBuffer(blob: Blob) {
  if (typeof blob.arrayBuffer === 'function') {
    return blob.arrayBuffer();
  }

  if (typeof FileReader !== 'undefined') {
    return new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(blob);
    });
  }

  const text = typeof blob.text === 'function' ? await blob.text() : String(blob);
  return new TextEncoder().encode(text).buffer;
}

class IndexedDbOfflineImageBinaryPersistenceAdapter implements OfflineImageBinaryPersistenceAdapter {
  async save(record: OfflineImageBinaryRecord) {
    if (!globalThis.indexedDB) {
      return;
    }
    const db = await openBinaryDatabase(globalThis.indexedDB);
    const tx = db.transaction([IMAGE_BINARY_STORE], 'readwrite');
    tx.objectStore(IMAGE_BINARY_STORE).put(record);
    await transactionDone(tx);
  }

  async get(operationId: string) {
    if (!globalThis.indexedDB) {
      return null;
    }
    const db = await openBinaryDatabase(globalThis.indexedDB);
    const tx = db.transaction([IMAGE_BINARY_STORE], 'readonly');
    const result = await requestToPromise<OfflineImageBinaryRecord | undefined>(tx.objectStore(IMAGE_BINARY_STORE).get(operationId));
    await transactionDone(tx);
    return result ?? null;
  }

  async delete(operationId: string) {
    if (!globalThis.indexedDB) {
      return;
    }
    const db = await openBinaryDatabase(globalThis.indexedDB);
    const tx = db.transaction([IMAGE_BINARY_STORE], 'readwrite');
    tx.objectStore(IMAGE_BINARY_STORE).delete(operationId);
    await transactionDone(tx);
  }

  async list() {
    if (!globalThis.indexedDB) {
      return [];
    }
    const db = await openBinaryDatabase(globalThis.indexedDB);
    const tx = db.transaction([IMAGE_BINARY_STORE], 'readonly');
    const result = await requestToPromise<OfflineImageBinaryRecord[]>(tx.objectStore(IMAGE_BINARY_STORE).getAll());
    await transactionDone(tx);
    return result;
  }

  async replaceAll(records: OfflineImageBinaryRecord[]) {
    if (!globalThis.indexedDB) {
      return;
    }
    const db = await openBinaryDatabase(globalThis.indexedDB);
    const tx = db.transaction([IMAGE_BINARY_STORE], 'readwrite');
    const store = tx.objectStore(IMAGE_BINARY_STORE);
    await requestToPromise(store.clear());
    records.forEach((record) => store.put(record));
    await transactionDone(tx);
  }
}

function base64ToBlob(base64: string, mimeType: string) {
  const binary = globalThis.atob(base64);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new Blob([bytes], { type: mimeType });
}

function openBinaryDatabase(indexedDb: IDBFactory) {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDb.open(IMAGE_BINARY_DB, IMAGE_BINARY_DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(IMAGE_BINARY_STORE)) {
        database.createObjectStore(IMAGE_BINARY_STORE, { keyPath: 'operationId' });
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

export const DEFAULT_OFFLINE_IMAGE_BINARY_STORE = new OfflineImageBinaryStoreService();
