import {
  SYNC_METRICS_DICTIONARY_V2,
  SYNC_METRICS_WINDOWS,
  SYNC_OBSERVABILITY_RECENT_LIMIT,
  SYNC_OBSERVABILITY_STALE_DEFAULT_MS,
  SyncMetricsStore,
} from './sync-metrics.store';

describe('SyncMetricsStore', () => {
  it('should expose only the v2 windows and defaults', () => {
    const store = new SyncMetricsStore();

    expect(SYNC_METRICS_WINDOWS).toEqual(['24h', '7d']);
    expect(SYNC_OBSERVABILITY_RECENT_LIMIT).toBe(20);
    expect(SYNC_OBSERVABILITY_STALE_DEFAULT_MS).toBe(24 * 60 * 60 * 1000);
    expect(store.snapshot().selectedWindow).toBe('24h');
  });

  it('should keep a unique dictionary and an empty runtime snapshot by default', () => {
    const store = new SyncMetricsStore();

    expect(store.dictionary()).toEqual(SYNC_METRICS_DICTIONARY_V2);
    expect(store.runtime().cycle.trigger).toBeNull();
    expect(store.runtime().queue.totalByStatus.pending).toBe(0);
    expect(store.runtime().errors).toEqual([]);
    expect(store.runtime().entityHealth.ANIMAL.stale).toBe(true);
  });
});
