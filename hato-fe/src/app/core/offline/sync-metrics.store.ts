import { Injectable, signal } from '@angular/core';

export interface SyncMetricsSnapshot {
  pending: number;
  success: number;
  failed: number;
  lastSyncAt: string | null;
}

@Injectable({ providedIn: 'root' })
export class SyncMetricsStore {
  private readonly state = signal<SyncMetricsSnapshot>({
    pending: 0,
    success: 0,
    failed: 0,
    lastSyncAt: null,
  });

  readonly metrics = this.state.asReadonly();

  update(snapshot: SyncMetricsSnapshot) {
    this.state.set(snapshot);
  }

  snapshot() {
    return this.state();
  }
}
