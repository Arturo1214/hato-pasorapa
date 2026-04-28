import { computed, Injectable, signal } from '@angular/core';
import type { DecisionSupportDerivedState, OfflineEntityType, OfflineSyncCheckpoint, ReportingWindow } from '../../../../core/offline/offline-types';
import { OfflineStoreService, DEFAULT_OFFLINE_STORE_SERVICE } from '../../../../core/offline/offline-store.service';
import { OfflineStatusService } from '../../../../core/offline/offline-status.service';
import { REPORTING_REFRESH_EVENT, triggerManualSync } from '../../../../core/offline/sync-orchestrator.service';
import { createInitialDecisionSupportState, projectDecisionSupportV1 } from './admin-decision-support-projection';
import {
  ALLOWED_DECISION_SUPPORT_WINDOWS,
  coerceDecisionSupportWindow,
  DECISION_SUPPORT_AUTO_APPLY_MESSAGE,
  DECISION_SUPPORT_SCOPE_MESSAGE,
} from './admin-decision-support.utils';

export type AdminDecisionSupportRefreshReason = 'startup' | 'post-sync' | 'manual' | 'stale-guard' | 'selection-change';
const DECISION_SUPPORT_OFFLINE_STATUS_MESSAGE = 'Sin conectividad: mostramos el último estado local persistido.';

const DECISION_SUPPORT_SOURCE_TYPES: OfflineEntityType[] = [
  'USER',
  'GANADERO',
  'ANIMAL',
  'LOT',
  'LOT_ASSIGNMENT',
  'PRODUCTIVITY_LEDGER',
  'COST_LEDGER',
  'ANIMAL_EVENT',
  'ANIMAL_HEALTH_EVENT',
  'ANIMAL_REPRODUCTION_EVENT',
];

@Injectable({ providedIn: 'root' })
export class AdminDecisionSupportStore {
  private offlineStore: OfflineStoreService = DEFAULT_OFFLINE_STORE_SERVICE;
  private offlineStatus: Pick<OfflineStatusService, 'isOnline'> = new OfflineStatusService();
  private now: () => string = () => new Date().toISOString();
  private windowRef: Pick<Window, 'addEventListener' | 'dispatchEvent'> | undefined = globalThis.window;
  private initialized = false;

  private readonly state = signal<DecisionSupportDerivedState>(createInitialDecisionSupportState());
  private readonly loadingState = signal(false);
  private readonly errorState = signal<string | null>(null);
  private readonly statusMessageState = signal<string | null>(null);

  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly statusMessage = this.statusMessageState.asReadonly();
  readonly selectedWindow = computed(() => this.state().selectedWindow);
  readonly freshness = computed(() => this.state().freshness);
  readonly insights = computed(() => this.state().insights);
  readonly scopeGuardMessage = computed(() => DECISION_SUPPORT_SCOPE_MESSAGE);
  readonly autoApplyMessage = computed(() => DECISION_SUPPORT_AUTO_APPLY_MESSAGE);
  readonly allowedWindows = computed(() => ALLOWED_DECISION_SUPPORT_WINDOWS);

  configureForTesting(
    dependencies: Partial<{
      offlineStore: OfflineStoreService;
      offlineStatus: Pick<OfflineStatusService, 'isOnline'>;
      now: () => string;
      windowRef: Pick<Window, 'addEventListener' | 'dispatchEvent'>;
    }>
  ) {
    this.offlineStore = dependencies.offlineStore ?? this.offlineStore;
    this.offlineStatus = dependencies.offlineStatus ?? this.offlineStatus;
    this.now = dependencies.now ?? this.now;
    this.windowRef = dependencies.windowRef ?? this.windowRef;
  }

  async initialize() {
    if (!this.initialized) {
      this.initialized = true;
      this.windowRef?.addEventListener(REPORTING_REFRESH_EVENT, () => {
        void this.rebuild('post-sync');
      });
    }

    const persisted = await this.offlineStore.getDecisionSupportState();
    if (persisted) {
      this.state.set({ ...persisted, selectedWindow: coerceDecisionSupportWindow(persisted.selectedWindow) });
    }

    await this.ensureFresh('startup');
  }

  async ensureFresh(reason: Extract<AdminDecisionSupportRefreshReason, 'startup' | 'stale-guard'> = 'stale-guard') {
    const { latestSyncAt, sourceSignature } = await this.readRuntimeContext();
    const current = this.state();
    const shouldRebuild =
      !current.freshness.lastComputedAt ||
      current.freshness.stale ||
      current.sourceSignature['selection'] !== sourceSignature['selection'] ||
      Object.keys(sourceSignature).some((key) => (current.sourceSignature[key] ?? null) !== (sourceSignature[key as keyof typeof sourceSignature] ?? null)) ||
      (latestSyncAt != null && (current.freshness.lastComputedAt == null || current.freshness.lastComputedAt < latestSyncAt));

    if (shouldRebuild) {
      await this.rebuild(reason);
      return;
    }

    this.state.update((state) => ({
      ...state,
      freshness: { lastSyncAt: latestSyncAt, lastComputedAt: state.freshness.lastComputedAt, stale: false },
      sourceSignature,
    }));
    this.statusMessageState.set(!this.offlineStatus.isOnline() ? DECISION_SUPPORT_OFFLINE_STATUS_MESSAGE : null);
  }

  async rebuild(reason: AdminDecisionSupportRefreshReason) {
    this.loadingState.set(true);
    this.errorState.set(null);

    try {
      const { latestSyncAt, sourceSignature } = await this.readRuntimeContext();
      const projection = projectDecisionSupportV1({
        users: await this.offlineStore.listSnapshots('USER'),
        ganaderos: await this.offlineStore.listSnapshots('GANADERO'),
        animals: await this.offlineStore.listSnapshots('ANIMAL'),
        lots: await this.offlineStore.listSnapshots('LOT'),
        lotAssignments: await this.offlineStore.listSnapshots('LOT_ASSIGNMENT'),
        productivityLedger: await this.offlineStore.listSnapshots('PRODUCTIVITY_LEDGER'),
        costLedger: await this.offlineStore.listSnapshots('COST_LEDGER'),
        animalEvents: await this.offlineStore.listSnapshots('ANIMAL_EVENT'),
        healthEvents: await this.offlineStore.listSnapshots('ANIMAL_HEALTH_EVENT'),
        reproductionEvents: await this.offlineStore.listSnapshots('ANIMAL_REPRODUCTION_EVENT'),
        now: this.now(),
        selectedWindow: this.state().selectedWindow,
      });

      const nextState: DecisionSupportDerivedState = {
        version: 1,
        selectedWindow: projection.selectedWindow,
        freshness: {
          lastSyncAt: latestSyncAt,
          lastComputedAt: this.now(),
          stale: false,
        },
        insights: projection.insights,
        sourceSignature,
      };

      this.state.set(nextState);
      this.statusMessageState.set(
        !this.offlineStatus.isOnline()
          ? DECISION_SUPPORT_OFFLINE_STATUS_MESSAGE
          : reason === 'post-sync'
            ? 'Insights recalculados después de la sincronización.'
            : null
      );
      await this.offlineStore.setDecisionSupportState(nextState);
    } catch {
      this.errorState.set('No pudimos recalcular el soporte de decisión local.');
    } finally {
      this.loadingState.set(false);
    }
  }

  async setWindow(window: ReportingWindow | string) {
    const nextWindow = coerceDecisionSupportWindow(window);
    this.state.update((state) => ({ ...state, selectedWindow: nextWindow }));
    await this.rebuild('selection-change');
  }

  async refreshNow() {
    if (!this.offlineStatus.isOnline()) {
      this.statusMessageState.set(DECISION_SUPPORT_OFFLINE_STATUS_MESSAGE);
      return;
    }

    await this.rebuild('manual');
    triggerManualSync(this.windowRef);
  }

  private async readRuntimeContext() {
    const checkpoints = await Promise.all(
      DECISION_SUPPORT_SOURCE_TYPES.map(async (entityType) => [entityType, await this.offlineStore.getCheckpoint(entityType)] as const)
    );
    const signatureEntries = Object.fromEntries(checkpoints.map(([entityType, checkpoint]) => [entityType, checkpoint ? serializeCheckpoint(checkpoint) : null])) as Record<string, string | null>;
    const latestSyncAt = checkpoints
      .map(([, checkpoint]) => checkpoint?.lastSuccessAt ?? null)
      .filter((value): value is string => !!value)
      .sort()
      .at(-1) ?? null;

    return {
      latestSyncAt,
      sourceSignature: {
        ...signatureEntries,
        selection: this.state().selectedWindow,
      },
    };
  }
}

function serializeCheckpoint(checkpoint: OfflineSyncCheckpoint) {
  return `${checkpoint.lastSuccessAt}|${checkpoint.cursorUpdatedAt}|${checkpoint.cursorId}`;
}
