import {
  CURRENT_OFFLINE_SCHEMA_VERSION,
  createEmptyNotificationReadState,
  createEmptyOfflineState,
  migrateOfflineState,
} from './offline-store.migrations';

describe('offline store migrations', () => {
  it('should create schema v10 with herd reporting and decision support metadata by default', () => {
    const state = createEmptyOfflineState();

    expect(state.schemaVersion).toBe(CURRENT_OFFLINE_SCHEMA_VERSION);
    expect(state.syncState.meta?.calendarAlerts).toEqual(
      expect.objectContaining({
        version: 1,
        preferences: {
          horizonDays: 3,
          snoozedUntil: null,
          notificationsEnabled: false,
        },
        lastComputedAt: null,
      })
    );
    expect(state.syncState.meta?.reporting).toEqual(
      expect.objectContaining({
        version: 2,
        selectedWindow: '7d',
        selectedPreset: 'all',
        freshness: {
          lastSyncAt: null,
          lastComputedAt: null,
          stale: true,
        },
        aggregates: expect.objectContaining({ lotesTotal: 0, productividadTotal: 0, costosTotal: 0 }),
        descriptiveKpis: expect.objectContaining({ '90d': expect.any(Object) }),
      })
    );
    expect(state.syncState.meta?.decisionSupport).toEqual(
      expect.objectContaining({
        version: 1,
        selectedWindow: '7d',
        insights: [],
      })
    );
    expect(state.syncState.meta?.notifications?.readState).toEqual(createEmptyNotificationReadState());
    expect(state.syncState.meta?.conflictResolution?.auditByOperationId).toEqual({});
    expect(state.syncState.meta?.sessionSecurity).toEqual({
      fallbackStatus: 'active',
      cleanupPolicy: 'soft_retention',
      lastBoundaryReason: null,
      lastBoundaryAt: null,
    });
  });

  it('should migrate legacy v9 state to schema v10 and normalize decision support defaults', () => {
    const { state, appliedMigrations } = migrateOfflineState({
      schemaVersion: 9,
      outbox: [],
      inbox: [],
      snapshots: [],
      syncState: {
        checkpoints: {},
        meta: {
          appliedMigrations: [
            'v1-to-v2-status-normalization',
            'v2-to-v3-animal-image-binary-store',
            'v3-to-v4-calendar-alerts-derived-state',
            'v4-to-v5-notification-read-state',
            'v5-to-v6-admin-reporting-derived-state',
            'v6-to-v7-conflict-resolution-audit',
              'v7-to-v8-session-security',
              'v8-to-v9-integral-herd-management-v2',
            ],
          },
        },
      });

    expect(state.schemaVersion).toBe(CURRENT_OFFLINE_SCHEMA_VERSION);
    expect(appliedMigrations).toEqual(['v9-to-v10-decision-support-derived-state']);
    expect(state.syncState.meta?.calendarAlerts?.preferences.horizonDays).toBe(3);
    expect(state.syncState.meta?.calendarAlerts?.items).toEqual([]);
    expect(state.syncState.meta?.reporting?.selectedWindow).toBe('7d');
    expect(state.syncState.meta?.reporting?.descriptiveKpis['90d']).toEqual({
      animalesActivos: 0,
      lotesActivos: 0,
      productividadTotal: 0,
      costosTotal: 0,
      costoAcumulado: 0,
    });
    expect(state.syncState.meta?.reporting?.selectedPreset).toBe('all');
    expect(state.syncState.meta?.decisionSupport).toEqual(
      expect.objectContaining({
        version: 1,
        selectedWindow: '7d',
        insights: [],
      })
    );
    expect(state.syncState.meta?.notifications?.readState).toEqual({ readAtById: {} });
    expect(state.syncState.meta?.conflictResolution?.auditByOperationId).toEqual({});
    expect(state.syncState.meta?.sessionSecurity).toEqual({
      fallbackStatus: 'active',
      cleanupPolicy: 'soft_retention',
      lastBoundaryReason: null,
      lastBoundaryAt: null,
    });
  });
});
