import {
  OFFLINE_OPERATION_STATUSES,
  type OfflineOperationEnvelope,
  type PersistedOfflineState,
} from './offline-types';

export const CURRENT_OFFLINE_SCHEMA_VERSION = 2;

export interface OfflinePersistenceAdapter {
  load(): Promise<PersistedOfflineState | undefined>;
  save(state: PersistedOfflineState): Promise<void>;
}

export interface OfflineMigrationResult {
  state: PersistedOfflineState;
  appliedMigrations: string[];
}

export class InMemoryOfflinePersistenceAdapter implements OfflinePersistenceAdapter {
  private state?: PersistedOfflineState;
  saveCount = 0;

  constructor(seed?: PersistedOfflineState) {
    this.state = seed ? cloneState(seed) : undefined;
  }

  async load() {
    return this.state ? cloneState(this.state) : undefined;
  }

  async save(state: PersistedOfflineState) {
    this.state = cloneState(state);
    this.saveCount += 1;
  }

  snapshot() {
    return cloneState(this.state ?? createEmptyOfflineState());
  }
}

export function createEmptyOfflineState(): PersistedOfflineState {
  return {
    schemaVersion: CURRENT_OFFLINE_SCHEMA_VERSION,
    outbox: [],
    inbox: [],
    snapshots: [],
    syncState: {
      checkpoints: {},
      meta: {
        appliedMigrations: [],
      },
    },
  };
}

export function migrateOfflineState(existing?: PersistedOfflineState): OfflineMigrationResult {
  if (!existing) {
    return {
      state: createEmptyOfflineState(),
      appliedMigrations: [],
    };
  }

  const state = cloneState(existing);
  const appliedMigrations: string[] = [];

  if (state.schemaVersion < 2) {
    state.outbox = state.outbox.map((operation) => ({
      ...operation,
      status: normalizeOperationStatus(operation.status),
    }));

    state.syncState.meta = {
      appliedMigrations: ['v1-to-v2-status-normalization'],
    };
    state.schemaVersion = 2;
    appliedMigrations.push('v1-to-v2-status-normalization');
  }

  state.schemaVersion = CURRENT_OFFLINE_SCHEMA_VERSION;
  state.syncState.checkpoints ??= {};
  state.syncState.meta ??= { appliedMigrations: [] };

  return {
    state,
    appliedMigrations,
  };
}

export function normalizeOperationStatus(status: string): OfflineOperationEnvelope['status'] {
  const normalized = status.toLowerCase();
  return OFFLINE_OPERATION_STATUSES.includes(normalized as OfflineOperationEnvelope['status'])
    ? (normalized as OfflineOperationEnvelope['status'])
    : 'pending';
}

function cloneState(state: PersistedOfflineState): PersistedOfflineState {
  return JSON.parse(JSON.stringify(state)) as PersistedOfflineState;
}
