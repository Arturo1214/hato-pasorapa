import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import type { MetricsWindow } from '../../core/offline/offline-types';
import { SyncObservabilityStore } from './data-access/sync-observability.store';

@Component({
  selector: 'app-sync-observability',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatCardModule],
  templateUrl: './sync-observability.component.html',
  styleUrl: './sync-observability.component.scss',
})
export class SyncObservabilityComponent {
  readonly store = inject(SyncObservabilityStore);
  readonly runtime = this.store.runtime;
  readonly historical = this.store.historical;
  readonly loading = this.store.loading;
  readonly error = this.store.error;
  readonly selectedWindow = this.store.selectedWindow;
  readonly windows = this.store.allowedWindows;
  readonly recentIssues = this.store.recentIssues;
  readonly topReasons = this.store.topReasons;
  readonly queueEntries = computed(() => Object.entries(this.runtime().queue.totalByStatus));
  readonly entityHealthEntries = computed(() => this.store.entityHealthEntries());

  constructor() {
    void this.store.initialize();
  }

  async useWindow(window: MetricsWindow) {
    await this.store.useWindow(window);
  }
}
