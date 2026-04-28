import { computed, inject, Injectable, signal } from '@angular/core';
import { SyncObservabilityApi } from '../../../core/api/sync-observability.api';
import type { MetricsWindow } from '../../../core/offline/offline-types';
import { SYNC_METRICS_WINDOWS, SyncMetricsStore } from '../../../core/offline/sync-metrics.store';

@Injectable({ providedIn: 'root' })
export class SyncObservabilityStore {
  private readonly api = inject(SyncObservabilityApi);
  private readonly metricsStore = inject(SyncMetricsStore);
  private readonly initialized = signal(false);

  readonly runtime = this.metricsStore.runtime;
  readonly dictionary = this.metricsStore.dictionary;
  readonly historical = this.metricsStore.historical;
  readonly loading = this.metricsStore.historicalLoading;
  readonly error = this.metricsStore.historicalError;
  readonly selectedWindow = this.metricsStore.selectedWindow;
  readonly allowedWindows = computed(() => SYNC_METRICS_WINDOWS);
  readonly recentIssues = computed(() => this.metricsStore.historical()?.recentIssues ?? []);
  readonly topReasons = computed(() => this.metricsStore.historical()?.topReasons ?? []);
  readonly entityHealthEntries = computed(() => Object.entries(this.runtime().entityHealth));

  async initialize() {
    if (this.initialized()) {
      return;
    }

    this.initialized.set(true);
    await this.refresh(this.selectedWindow());
  }

  async useWindow(window: MetricsWindow) {
    this.metricsStore.setHistoricalWindow(window);
    await this.refresh(window);
  }

  async refresh(window: MetricsWindow = this.selectedWindow()) {
    this.metricsStore.setHistoricalLoading(true);
    this.metricsStore.setHistoricalError(null);

    try {
      const snapshot = await this.api.getHistorical(window);
      this.metricsStore.setHistorical(snapshot);
    } catch {
      this.metricsStore.setHistoricalError('No pudimos cargar el histórico agregado de sincronización.');
    }
  }
}
