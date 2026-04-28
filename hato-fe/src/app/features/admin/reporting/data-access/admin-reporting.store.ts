import { computed, Injectable, signal } from '@angular/core';
import type { AdminReportingDerivedState, OfflineEntityType, OfflineSyncCheckpoint, ReportingPresetId, ReportingWindow } from '../../../../core/offline/offline-types';
import { DEFAULT_OFFLINE_STORE_SERVICE, OfflineStoreService } from '../../../../core/offline/offline-store.service';
import { OfflineStatusService } from '../../../../core/offline/offline-status.service';
import { REPORTING_REFRESH_EVENT, triggerManualSync } from '../../../../core/offline/sync-orchestrator.service';
import { projectAdminReportingV2 } from './admin-reporting-projection';
import {
  ALLOWED_REPORTING_PRESETS,
  ALLOWED_REPORTING_WINDOWS,
  buildReportingSourceSignature,
  coerceReportingPreset,
  coerceReportingWindow,
  DEFAULT_REPORTING_PRESET,
  DEFAULT_REPORTING_WINDOW,
  REPORTING_SCOPE_MESSAGE,
  sameReportingSourceSignature,
} from './admin-reporting.utils';

export type AdminReportingRefreshReason = 'startup' | 'post-sync' | 'manual' | 'stale-guard' | 'selection-change';

const REPORTING_SOURCE_TYPES: OfflineEntityType[] = [
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
export class AdminReportingStore {
  private offlineStore: OfflineStoreService = DEFAULT_OFFLINE_STORE_SERVICE;
  private offlineStatus: Pick<OfflineStatusService, 'isOnline'> = new OfflineStatusService();
  private now: () => string = () => new Date().toISOString();
  private windowRef: Pick<Window, 'addEventListener' | 'dispatchEvent'> | undefined = globalThis.window;
  private initialized = false;

  private readonly state = signal<AdminReportingDerivedState>(createInitialState());
  private readonly loadingState = signal(false);
  private readonly errorState = signal<string | null>(null);
  private readonly lastReasonState = signal<AdminReportingRefreshReason | null>(null);
  private readonly statusMessageState = signal<string | null>(null);

  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly lastReason = this.lastReasonState.asReadonly();
  readonly statusMessage = this.statusMessageState.asReadonly();
  readonly selectedWindow = computed(() => this.state().selectedWindow);
  readonly selectedPreset = computed(() => this.state().selectedPreset);
  readonly summary = computed(() => this.state().aggregates);
  readonly freshness = computed(() => this.state().freshness);
  readonly stale = computed(() => this.state().freshness.stale);
  readonly eventCounts = computed(() => this.state().eventsByType[this.state().selectedWindow]);
  readonly recentActivity = computed(() => this.state().recentActivity);
  readonly descriptiveKpis = computed(() => this.state().descriptiveKpis[this.state().selectedWindow]);
  readonly lotBreakdown = computed(() => this.state().lotBreakdown);
  readonly allowedWindows = computed(() => ALLOWED_REPORTING_WINDOWS);
  readonly allowedPresets = computed(() => ALLOWED_REPORTING_PRESETS);
  readonly scopeGuardMessage = computed(() => REPORTING_SCOPE_MESSAGE);

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

    const persisted = await this.offlineStore.getAdminReportingState();
    if (persisted) {
      this.state.set({
        ...persisted,
        selectedWindow: coerceReportingWindow(persisted.selectedWindow),
        selectedPreset: coerceReportingPreset(persisted.selectedPreset),
      });
    }

    await this.ensureFresh('startup');
  }

  async ensureFresh(reason: Extract<AdminReportingRefreshReason, 'startup' | 'stale-guard'> = 'stale-guard') {
    const { latestSyncAt, sourceSignature } = await this.readReportingRuntimeContext();
    const current = this.state();
    const shouldRebuild =
      !current.freshness.lastComputedAt ||
      current.freshness.stale ||
      !sameReportingSourceSignature(current.sourceSignature, sourceSignature) ||
      (latestSyncAt != null && (current.freshness.lastComputedAt == null || current.freshness.lastComputedAt < latestSyncAt));

    if (shouldRebuild) {
      await this.rebuild(reason);
      return;
    }

    this.state.update((state) => ({
      ...state,
      freshness: {
        lastSyncAt: latestSyncAt,
        lastComputedAt: state.freshness.lastComputedAt,
        stale: false,
      },
      sourceSignature,
    }));
    this.lastReasonState.set(reason);
  }

  async rebuild(reason: AdminReportingRefreshReason) {
    this.loadingState.set(true);
    this.errorState.set(null);

    try {
      const { latestSyncAt, sourceSignature } = await this.readReportingRuntimeContext();
      const current = this.state();
      const projection = projectAdminReportingV2({
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
        selectedWindow: current.selectedWindow,
        selectedPreset: current.selectedPreset,
      });

      const computedAt = this.now();
      const nextState: AdminReportingDerivedState = {
        version: 2,
        selectedWindow: projection.selectedWindow,
        selectedPreset: projection.selectedPreset,
        freshness: {
          lastSyncAt: latestSyncAt,
          lastComputedAt: computedAt,
          stale: false,
        },
        aggregates: projection.aggregates,
        eventsByType: projection.eventsByType,
        descriptiveKpis: projection.descriptiveKpis,
        lotBreakdown: projection.lotBreakdown,
        recentActivity: projection.recentActivity,
        sourceSignature,
      };

      this.state.set(nextState);
      this.lastReasonState.set(reason);
      this.statusMessageState.set(
        reason === 'post-sync'
          ? 'Reportes recalculados después de la sincronización.'
          : reason === 'manual'
            ? 'Reportes recalculados desde snapshots locales.'
            : null
      );
      await this.offlineStore.setAdminReportingState(nextState);
    } catch {
      this.errorState.set('No pudimos recalcular los reportes administrativos locales.');
    } finally {
      this.loadingState.set(false);
    }
  }

  async setWindow(window: ReportingWindow | string) {
    const nextWindow = coerceReportingWindow(window);
    this.state.update((state) => ({ ...state, selectedWindow: nextWindow }));
    await this.rebuild('selection-change');
  }

  async setPreset(preset: ReportingPresetId | string) {
    const nextPreset = coerceReportingPreset(preset);
    this.state.update((state) => ({ ...state, selectedPreset: nextPreset }));
    await this.rebuild('selection-change');
  }

  async refreshNow() {
    if (!this.offlineStatus.isOnline()) {
      this.statusMessageState.set(
        'Sin conectividad: dejamos visible el último reporte local y diferimos la actualización hasta recuperar red.'
      );
      return;
    }

    await this.rebuild('manual');
    triggerManualSync(this.windowRef);
  }

  private async readReportingRuntimeContext() {
    const checkpoints = await Promise.all(
      REPORTING_SOURCE_TYPES.map(async (entityType) => [entityType, await this.offlineStore.getCheckpoint(entityType)] as const)
    );
    const signatureEntries = Object.fromEntries(
      checkpoints.map(([entityType, checkpoint]) => [entityType, checkpoint ? serializeCheckpoint(checkpoint) : null])
    ) as Record<string, string | null>;
    const latestSyncAt = checkpoints
      .map(([, checkpoint]) => checkpoint?.lastSuccessAt ?? null)
      .filter((value): value is string => !!value)
      .sort()
      .at(-1) ?? null;

    return {
      latestSyncAt,
      sourceSignature: buildReportingSourceSignature(signatureEntries, this.state().selectedWindow, this.state().selectedPreset),
    };
  }
}

function serializeCheckpoint(checkpoint: OfflineSyncCheckpoint) {
  return `${checkpoint.lastSuccessAt}|${checkpoint.cursorUpdatedAt}|${checkpoint.cursorId}`;
}

function createInitialState(): AdminReportingDerivedState {
  return {
    version: 2,
    selectedWindow: DEFAULT_REPORTING_WINDOW,
    selectedPreset: DEFAULT_REPORTING_PRESET,
    freshness: {
      lastSyncAt: null,
      lastComputedAt: null,
      stale: true,
    },
    aggregates: {
      usersTotal: 0,
      ganaderosTotal: 0,
      animalesTotal: 0,
      animalesActivos: 0,
      lotesTotal: 0,
      lotesActivos: 0,
      asignacionesActivas: 0,
      productividadTotal: 0,
      costosTotal: 0,
      costoAcumulado: 0,
    },
    eventsByType: {
      '7d': {},
      '30d': {},
      '90d': {},
    },
    descriptiveKpis: {
      '7d': { animalesActivos: 0, lotesActivos: 0, productividadTotal: 0, costosTotal: 0, costoAcumulado: 0 },
      '30d': { animalesActivos: 0, lotesActivos: 0, productividadTotal: 0, costosTotal: 0, costoAcumulado: 0 },
      '90d': { animalesActivos: 0, lotesActivos: 0, productividadTotal: 0, costosTotal: 0, costoAcumulado: 0 },
    },
    lotBreakdown: [],
    recentActivity: [],
    sourceSignature: {
      USER: null,
      GANADERO: null,
      ANIMAL: null,
      LOT: null,
      LOT_ASSIGNMENT: null,
      PRODUCTIVITY_LEDGER: null,
      COST_LEDGER: null,
      ANIMAL_EVENT: null,
      ANIMAL_HEALTH_EVENT: null,
      ANIMAL_REPRODUCTION_EVENT: null,
      selection: `${DEFAULT_REPORTING_WINDOW}:${DEFAULT_REPORTING_PRESET}`,
    },
  };
}
