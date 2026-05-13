import {
  CURRENT_OFFLINE_SCHEMA_VERSION,
  createEmptyOfflineState,
  InMemoryOfflinePersistenceAdapter,
} from './offline-store.migrations';
import { OfflineStoreService } from './offline-store.service';

describe('OfflineStoreService', () => {
  const createService = (
    adapter = new InMemoryOfflinePersistenceAdapter(),
    ids = ['op-1', 'op-2', 'op-3'],
    timestamps = ['2026-04-26T10:00:00.000Z', '2026-04-26T10:05:00.000Z', '2026-04-26T10:10:00.000Z']
  ) => {
    let idIndex = 0;
    let timestampIndex = 0;

    return new OfflineStoreService(adapter, {
      generateId: () => ids[idIndex++] ?? `generated-${idIndex}`,
      now: () => timestamps[timestampIndex++] ?? timestamps.at(-1) ?? '2026-04-26T10:10:00.000Z',
    });
  };

  it('should recover queued operations and checkpoints after a restart', async () => {
    const adapter = new InMemoryOfflinePersistenceAdapter();
    const store = createService(adapter);

    await store.enqueueOperation({
      entityType: 'USER',
      opType: 'CREATE',
      payload: { username: 'gestion-admin' },
      clientCreatedAt: '2026-04-26T09:55:00.000Z',
      clientUpdatedAt: '2026-04-26T09:55:00.000Z',
    });
    await store.saveCheckpoint({
      entityType: 'USER',
      cursorUpdatedAt: '2026-04-26T09:50:00.000Z',
      cursorId: 'cursor-user-1',
      lastSuccessAt: '2026-04-26T09:58:00.000Z',
    });

    const restartedStore = createService(adapter, ['op-9'], ['2026-04-26T11:00:00.000Z']);
    const outbox = await restartedStore.listOutbox();
    const checkpoint = await restartedStore.getCheckpoint('USER');

    expect(outbox).toHaveLength(1);
    expect(outbox[0].status).toBe('pending');
    expect(outbox[0].payload).toEqual({ username: 'gestion-admin' });
    expect(checkpoint).toEqual({
      entityType: 'USER',
      cursorUpdatedAt: '2026-04-26T09:50:00.000Z',
      cursorId: 'cursor-user-1',
      lastSuccessAt: '2026-04-26T09:58:00.000Z',
    });
  });

  it('should run local schema migration exactly once and preserve compatible records', async () => {
    const adapter = new InMemoryOfflinePersistenceAdapter({
      schemaVersion: 1,
      outbox: [
        {
          operationId: 'legacy-op',
          entityType: 'ANIMAL',
          opType: 'UPDATE',
          payload: { tag: 'BO-0009' },
          clientCreatedAt: '2026-04-20T10:00:00.000Z',
          clientUpdatedAt: '2026-04-20T10:00:00.000Z',
          status: 'PENDING',
          attempts: 0,
        },
      ],
      inbox: [],
      snapshots: [],
      syncState: {
        checkpoints: {
          ANIMAL: {
            entityType: 'ANIMAL',
            cursorUpdatedAt: '2026-04-20T10:00:00.000Z',
            cursorId: 'legacy-cursor',
            lastSuccessAt: '2026-04-20T10:05:00.000Z',
          },
        },
      },
    });

    const firstBoot = createService(adapter, ['op-9'], ['2026-04-26T11:00:00.000Z']);
    const migratedOutbox = await firstBoot.listOutbox();
    const migratedState = adapter.snapshot();

    expect(migratedOutbox[0].status).toBe('pending');
    expect(migratedState.schemaVersion).toBe(CURRENT_OFFLINE_SCHEMA_VERSION);
      expect(migratedState.syncState.meta?.appliedMigrations).toEqual([
        'v1-to-v2-status-normalization',
        'v2-to-v3-animal-image-binary-store',
        'v3-to-v4-calendar-alerts-derived-state',
        'v4-to-v5-notification-read-state',
        'v5-to-v6-admin-reporting-derived-state',
        'v6-to-v7-conflict-resolution-audit',
        'v7-to-v8-session-security',
        'v8-to-v9-integral-herd-management-v2',
        'v9-to-v10-decision-support-derived-state',
        'v10-to-v11-animal-event-log-consolidation',
      ]);

    const saveCountAfterMigration = adapter.saveCount;
    const secondBoot = createService(adapter, ['op-10'], ['2026-04-26T11:10:00.000Z']);
    await secondBoot.listOutbox();

    expect(adapter.saveCount).toBe(saveCountAfterMigration);
  });

  it('should persist pending to in-flight to acked and dead-letter transitions', async () => {
    const adapter = new InMemoryOfflinePersistenceAdapter();
    const store = createService(adapter);

    const queued = await store.enqueueOperation({
      entityType: 'GANADERO',
      opType: 'STATUS_UPDATE',
      entityId: 'ganadero-1',
      payload: { active: false },
      clientCreatedAt: '2026-04-26T09:55:00.000Z',
      clientUpdatedAt: '2026-04-26T09:55:00.000Z',
    });

    await store.markInFlight(queued.operationId);
    await store.markAcked(queued.operationId);

    const secondQueued = await store.enqueueOperation({
      entityType: 'GANADERO',
      opType: 'STATUS_UPDATE',
      entityId: 'ganadero-2',
      payload: { active: true },
      clientCreatedAt: '2026-04-26T09:57:00.000Z',
      clientUpdatedAt: '2026-04-26T09:57:00.000Z',
    });

    await store.markInFlight(secondQueued.operationId);
    await store.markDeadLetter(secondQueued.operationId, {
      code: 'RETRY_LIMIT_EXCEEDED',
      message: 'Se agotó la política de retry.',
    });

    const outbox = await store.listOutbox();

    expect(outbox.map((operation) => operation.status)).toEqual(['acked', 'dead_letter']);
    expect(outbox[1].lastErrorCode).toBe('RETRY_LIMIT_EXCEEDED');
    expect(outbox[1].lastErrorMessage).toBe('Se agotó la política de retry.');
  });

  it('should get set and invalidate the derived calendar alerts cache without breaking persistence', async () => {
    const adapter = new InMemoryOfflinePersistenceAdapter();
    const store = createService(adapter);

    const initial = await store.getCalendarAlertsState();
    expect(initial?.preferences.horizonDays).toBe(3);

    await store.setCalendarAlertsState({
      version: 1,
      preferences: {
        horizonDays: 7,
        snoozedUntil: '2026-04-26T18:00:00.000Z',
        notificationsEnabled: true,
      },
      items: [
        {
          id: 'agenda-1',
          animalUuid: 'animal-1',
          sourceType: 'ANIMAL_HEALTH_EVENT',
          sourceId: 'health-1',
          dueAt: '2026-04-27T10:00:00.000Z',
          status: 'upcoming',
          title: 'Vacunación próxima',
          detail: 'Animal animal-1',
          priorityScore: 90,
          sortKey: 'ANIMAL_HEALTH_EVENT:health-1',
        },
      ],
      windows: {
        upcoming: [],
        due_today: [],
        overdue: [],
      },
      counts: {
        total: 1,
        byStatus: {
          upcoming: 1,
          due_today: 0,
          overdue: 0,
        },
      },
      lastComputedAt: '2026-04-26T10:00:00.000Z',
    });

    const restartedStore = createService(adapter, ['op-9'], ['2026-04-26T11:00:00.000Z']);
    const persisted = await restartedStore.getCalendarAlertsState();

    expect(persisted?.preferences).toEqual({
      horizonDays: 7,
      snoozedUntil: '2026-04-26T18:00:00.000Z',
      notificationsEnabled: true,
    });
    expect(persisted?.counts.total).toBe(1);

    await restartedStore.invalidateCalendarAlertsState();
    const invalidated = await restartedStore.getCalendarAlertsState();

    expect(invalidated?.preferences).toEqual({
      horizonDays: 7,
      snoozedUntil: '2026-04-26T18:00:00.000Z',
      notificationsEnabled: true,
    });
    expect(invalidated?.items).toEqual([]);
    expect(invalidated?.counts.total).toBe(0);
    expect(invalidated?.lastComputedAt).toBeNull();
  });

  it('should persist notification read state across restart and keep unread defaults for new snapshots', async () => {
    const adapter = new InMemoryOfflinePersistenceAdapter();
    const store = createService(adapter);

    await store.applyPullResponse(
      'NOTIFICATION',
      [
        {
          id: 'notification-a',
          title: 'Aviso A',
          body: 'Primero',
          createdByUserId: 'admin-1',
          publishedAt: '2026-04-26T10:00:00.000Z',
          updatedAt: '2026-04-26T10:00:00.000Z',
        },
      ],
      {
        entityType: 'NOTIFICATION',
        cursorUpdatedAt: '2026-04-26T10:00:00.000Z',
        cursorId: 'notification-a',
        lastSuccessAt: '2026-04-26T10:00:00.000Z',
      }
    );

    await store.markNotificationRead('notification-a');

    const restartedStore = createService(adapter, ['op-9'], ['2026-04-26T11:00:00.000Z']);
    const persistedReadState = await restartedStore.getNotificationReadState();

    expect(persistedReadState.readAtById['notification-a']).toBe('2026-04-26T10:00:00.000Z');

    await restartedStore.applyPullResponse(
      'NOTIFICATION',
      [
        {
          id: 'notification-a',
          title: 'Aviso A',
          body: 'Primero',
          createdByUserId: 'admin-1',
          publishedAt: '2026-04-26T10:00:00.000Z',
          updatedAt: '2026-04-26T10:00:00.000Z',
        },
        {
          id: 'notification-b',
          title: 'Aviso B',
          body: 'Segundo',
          createdByUserId: 'admin-1',
          publishedAt: '2026-04-26T11:00:00.000Z',
          updatedAt: '2026-04-26T11:00:00.000Z',
        },
      ],
      {
        entityType: 'NOTIFICATION',
        cursorUpdatedAt: '2026-04-26T11:00:00.000Z',
        cursorId: 'notification-b',
        lastSuccessAt: '2026-04-26T11:00:00.000Z',
      }
    );

    const mergedReadState = await restartedStore.getNotificationReadState();

    expect(mergedReadState.readAtById['notification-a']).toBe('2026-04-26T10:00:00.000Z');
    expect(mergedReadState.readAtById['notification-b']).toBeUndefined();
  });

  it('should queue explicit V2 lot and ledger operations while rejecting overlapping local assignments', async () => {
    const adapter = new InMemoryOfflinePersistenceAdapter();
    const store = createService(adapter, ['op-lot', 'op-prod', 'op-cost'], ['2026-04-26T10:00:00.000Z']);

    await store.enqueueOperation({
      entityType: 'LOT',
      opType: 'CREATE',
      entityId: 'lot-a',
      payload: { id: 'lot-a', name: 'Lote A', active: true },
      clientCreatedAt: '2026-04-26T09:55:00.000Z',
      clientUpdatedAt: '2026-04-26T09:55:00.000Z',
    });
    await store.enqueueOperation({
      entityType: 'PRODUCTIVITY_LEDGER',
      opType: 'CREATE',
      entityId: 'prod-a',
      payload: {
        id: 'prod-a',
        animalUuid: 'animal-a',
        lotId: 'lot-a',
        periodKey: '2026-04',
        metricType: 'MILK_LITERS',
        value: 120,
        identityKey: '2026-04|animal-a|lot-a|MILK_LITERS',
      },
      clientCreatedAt: '2026-04-26T09:56:00.000Z',
      clientUpdatedAt: '2026-04-26T09:56:00.000Z',
    });
    await store.enqueueOperation({
      entityType: 'COST_LEDGER',
      opType: 'CREATE',
      entityId: 'cost-a',
      payload: {
        id: 'cost-a',
        lotId: 'lot-a',
        periodKey: '2026-04',
        category: 'FEED',
        source: 'PURCHASE',
        amount: 80,
        currency: 'BOB',
        identityKey: '2026-04|lot-a|FEED|PURCHASE',
      },
      clientCreatedAt: '2026-04-26T09:57:00.000Z',
      clientUpdatedAt: '2026-04-26T09:57:00.000Z',
    });
    await store.saveSnapshot({
      key: 'LOT_ASSIGNMENT:assign-a',
      entityType: 'LOT_ASSIGNMENT',
      entityId: 'assign-a',
      updatedAt: '2026-04-26T09:58:00.000Z',
      payload: {
        id: 'assign-a',
        animalUuid: 'animal-a',
        lotId: 'lot-a',
        fromDate: '2026-04-01',
        toDate: '2026-04-30',
        createdAt: '2026-04-01T00:00:00.000Z',
        updatedAt: '2026-04-26T09:58:00.000Z',
        version: 1,
      },
    });

    const outbox = await store.listOutbox();
    const overlappingAllowed = await store.validateLotAssignmentNoOverlap({
      id: 'assign-b',
      animalUuid: 'animal-a',
      lotId: 'lot-b',
      fromDate: '2026-04-15',
      toDate: null,
      createdAt: '2026-04-26T09:59:00.000Z',
      updatedAt: '2026-04-26T09:59:00.000Z',
      version: 1,
    });
    const nonOverlappingAllowed = await store.validateLotAssignmentNoOverlap({
      id: 'assign-c',
      animalUuid: 'animal-a',
      lotId: 'lot-b',
      fromDate: '2026-05-01',
      toDate: null,
      createdAt: '2026-04-26T09:59:00.000Z',
      updatedAt: '2026-04-26T09:59:00.000Z',
      version: 1,
    });

    expect(outbox.map((operation) => [operation.entityType, operation.status])).toEqual([
      ['LOT', 'pending'],
      ['PRODUCTIVITY_LEDGER', 'pending'],
      ['COST_LEDGER', 'pending'],
    ]);
    expect(overlappingAllowed).toBe(false);
    expect(nonOverlappingAllowed).toBe(true);
  });

  it('should clear only sync-reuse state for soft retention and keep non-sensitive offline continuity', async () => {
    const adapter = new InMemoryOfflinePersistenceAdapter();
    const store = createService(adapter, ['op-1'], ['2026-04-28T13:00:00.000Z']);

    await store.enqueueOperation({
      entityType: 'ANIMAL',
      entityId: 'animal-1',
      opType: 'UPDATE',
      payload: { tag: 'BO-100' },
      clientCreatedAt: '2026-04-28T12:00:00.000Z',
      clientUpdatedAt: '2026-04-28T12:00:00.000Z',
    });
    await store.saveInboxEntry({
      key: 'ANIMAL:animal-1',
      entityType: 'ANIMAL',
      entityId: 'animal-1',
      payload: { tag: 'BO-100' },
      receivedAt: '2026-04-28T12:05:00.000Z',
    });
    await store.saveSnapshot({
      key: 'ANIMAL:animal-1',
      entityType: 'ANIMAL',
      entityId: 'animal-1',
      payload: { tag: 'BO-100' },
      updatedAt: '2026-04-28T12:05:00.000Z',
    });
    await store.saveCheckpoint({
      entityType: 'ANIMAL',
      cursorUpdatedAt: '2026-04-28T12:05:00.000Z',
      cursorId: 'animal-1',
      lastSuccessAt: '2026-04-28T12:05:00.000Z',
    });
    await store.setCalendarAlertsState({
      version: 1,
      preferences: { horizonDays: 7, notificationsEnabled: true, snoozedUntil: null },
      items: [],
      windows: { upcoming: [], due_today: [], overdue: [] },
      counts: { total: 0, byStatus: { upcoming: 0, due_today: 0, overdue: 0 } },
      lastComputedAt: '2026-04-28T12:00:00.000Z',
    });
    await store.setAdminReportingState({
      version: 2,
      selectedWindow: '30d',
      selectedPreset: 'active_only',
      freshness: { lastSyncAt: null, lastComputedAt: '2026-04-28T12:00:00.000Z', stale: false },
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
      eventsByType: { '7d': {}, '30d': {}, '90d': {} },
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
        selection: '30d:active_only',
      },
    });

    await store.clearForSessionBoundary('soft_retention', 'ttl_elapsed');

    expect(await store.listOutbox()).toEqual([]);
    expect(await store.listInbox()).toEqual([]);
    expect(await store.getCheckpoint('ANIMAL')).toBeNull();
    expect(await store.listSnapshots('ANIMAL')).toHaveLength(1);
    expect((await store.getCalendarAlertsState())?.preferences.horizonDays).toBe(7);
    expect((await store.getAdminReportingState())?.selectedWindow).toBe('30d');
    expect(adapter.snapshot().syncState.meta?.sessionSecurity).toEqual(
      expect.objectContaining({
        fallbackStatus: 'reauth_required',
        cleanupPolicy: 'soft_retention',
        lastBoundaryReason: 'ttl_elapsed',
      })
    );
  });

  it('should purge snapshots and keep only minimal non-sensitive config for shared devices', async () => {
    const adapter = new InMemoryOfflinePersistenceAdapter();
    const store = createService(adapter, ['op-1'], ['2026-04-28T13:30:00.000Z']);

    await store.saveSnapshot({
      key: 'NOTIFICATION:notification-a',
      entityType: 'NOTIFICATION',
      entityId: 'notification-a',
      payload: { title: 'Aviso' },
      updatedAt: '2026-04-28T12:00:00.000Z',
    });
    await store.markNotificationRead('notification-a');
    await store.setCalendarAlertsState({
      version: 1,
      preferences: { horizonDays: 3, notificationsEnabled: false, snoozedUntil: '2026-04-28T18:00:00.000Z' },
      items: [],
      windows: { upcoming: [], due_today: [], overdue: [] },
      counts: { total: 0, byStatus: { upcoming: 0, due_today: 0, overdue: 0 } },
      lastComputedAt: '2026-04-28T12:00:00.000Z',
    });

    await store.clearForSessionBoundary('shared_device_hard', 'user_switch');

    expect(await store.listSnapshots()).toEqual([]);
    expect(await store.getNotificationReadState()).toEqual({ readAtById: {} });
    expect((await store.getCalendarAlertsState())?.preferences).toEqual({
      horizonDays: 3,
      notificationsEnabled: false,
      snoozedUntil: '2026-04-28T18:00:00.000Z',
    });
    expect(adapter.snapshot().syncState.meta?.sessionSecurity).toEqual(
      expect.objectContaining({
        cleanupPolicy: 'shared_device_hard',
        lastBoundaryReason: 'user_switch',
      })
    );
  });

  it('should rollback to the previous offline state when a backup restore attempt fails later in the pipeline', async () => {
    const adapter = new InMemoryOfflinePersistenceAdapter();
    const store = createService(adapter, ['op-1'], ['2026-04-28T14:00:00.000Z']);

    await store.enqueueOperation({
      entityType: 'ANIMAL',
      entityId: 'animal-1',
      opType: 'UPDATE',
      payload: { tag: 'BO-101' },
      clientCreatedAt: '2026-04-28T13:00:00.000Z',
      clientUpdatedAt: '2026-04-28T13:00:00.000Z',
    });
    const previousState = await store.getStateSnapshotForBackup({ excludeSessionSecurity: false });

    const replacementState = createEmptyOfflineState();
    replacementState.snapshots.push({
      key: 'ANIMAL:animal-9',
      entityType: 'ANIMAL',
      entityId: 'animal-9',
      payload: { tag: 'BO-909' },
      updatedAt: '2026-04-28T13:30:00.000Z',
    });

    await store.restoreFromBackupTx(replacementState);
    expect(await store.listSnapshots('ANIMAL')).toEqual([expect.objectContaining({ entityId: 'animal-9' })]);

    await store.restoreFromBackupTx(previousState);

    expect(await store.listSnapshots('ANIMAL')).toEqual([]);
    expect(await store.listOutbox()).toEqual([expect.objectContaining({ entityId: 'animal-1', status: 'pending' })]);
  });

  it('should leave the current stores untouched when import validation fails before mutation', async () => {
    const adapter = new InMemoryOfflinePersistenceAdapter();
    const store = createService(adapter, ['op-1'], ['2026-04-28T14:10:00.000Z']);

    await store.saveSnapshot({
      key: 'GANADERO:ganadero-1',
      entityType: 'GANADERO',
      entityId: 'ganadero-1',
      payload: { name: 'Ganadero Base' },
      updatedAt: '2026-04-28T13:00:00.000Z',
    });

    const baseline = await store.getStateSnapshotForBackup({ excludeSessionSecurity: false });
    const afterValidationFailure = await store.getStateSnapshotForBackup({ excludeSessionSecurity: false });

    expect(afterValidationFailure).toEqual(baseline);
  });

  it('should get set and invalidate the derived admin reporting cache without breaking persistence', async () => {
    const adapter = new InMemoryOfflinePersistenceAdapter();
    const store = createService(adapter);

    const initial = await store.getAdminReportingState();
    expect(initial?.selectedWindow).toBe('7d');

    await store.setAdminReportingState({
      version: 2,
      selectedWindow: '30d',
      selectedPreset: 'active_only',
      freshness: {
        lastSyncAt: '2026-04-26T09:55:00.000Z',
        lastComputedAt: '2026-04-26T10:00:00.000Z',
        stale: false,
      },
      aggregates: {
        usersTotal: 3,
        ganaderosTotal: 2,
        animalesTotal: 10,
        animalesActivos: 10,
        lotesTotal: 2,
        lotesActivos: 2,
        asignacionesActivas: 3,
        productividadTotal: 4,
        costosTotal: 2,
        costoAcumulado: 140,
      },
      eventsByType: {
        '7d': { 'ANIMAL_EVENT:OBSERVATION': 2 },
        '30d': { 'ANIMAL_EVENT:OBSERVATION': 4 },
        '90d': { 'ANIMAL_EVENT:OBSERVATION': 4 },
      },
      descriptiveKpis: {
        '7d': { animalesActivos: 2, lotesActivos: 1, productividadTotal: 1, costosTotal: 1, costoAcumulado: 40 },
        '30d': { animalesActivos: 3, lotesActivos: 2, productividadTotal: 4, costosTotal: 2, costoAcumulado: 140 },
        '90d': { animalesActivos: 3, lotesActivos: 2, productividadTotal: 4, costosTotal: 2, costoAcumulado: 140 },
      },
      lotBreakdown: [
        { lotId: 'lot-a', lotName: 'Lote A', animalesActivos: 2, productividadTotal: 3, costosTotal: 1, costoAcumulado: 80 },
      ],
      recentActivity: [
        {
          id: 'event-a',
          sourceType: 'ANIMAL_EVENT',
          eventType: 'OBSERVATION',
          occurredAt: '2026-04-26T09:59:00.000Z',
          animalUuid: 'animal-a',
          animalLabel: 'BO-001',
          title: 'Evento animal · Observation',
        },
      ],
      sourceSignature: {
        USER: 'u1',
        GANADERO: 'g1',
        ANIMAL: 'a1',
        LOT: 'l1',
        LOT_ASSIGNMENT: 'la1',
        PRODUCTIVITY_LEDGER: 'p1',
        COST_LEDGER: 'c1',
        ANIMAL_EVENT: 'e1',
        ANIMAL_HEALTH_EVENT: null,
        ANIMAL_REPRODUCTION_EVENT: null,
        selection: '30d:active_only',
      },
    });

    const restartedStore = createService(adapter, ['op-9'], ['2026-04-26T11:00:00.000Z']);
    const persisted = await restartedStore.getAdminReportingState();

    expect(persisted?.selectedPreset).toBe('active_only');
    expect(persisted?.eventsByType['30d']['ANIMAL_EVENT:OBSERVATION']).toBe(4);

    await restartedStore.invalidateAdminReportingState();
    const invalidated = await restartedStore.getAdminReportingState();

    expect(invalidated?.selectedWindow).toBe('30d');
    expect(invalidated?.selectedPreset).toBe('active_only');
    expect(invalidated?.freshness.lastSyncAt).toBe('2026-04-26T09:55:00.000Z');
    expect(invalidated?.freshness.lastComputedAt).toBeNull();
    expect(invalidated?.freshness.stale).toBe(true);
    expect(invalidated?.recentActivity).toEqual([]);
  });

  it('should get set and invalidate the derived decision support cache without breaking persistence', async () => {
    const adapter = new InMemoryOfflinePersistenceAdapter();
    const store = createService(adapter);

    const initial = await store.getDecisionSupportState();
    expect(initial?.selectedWindow).toBe('7d');

    await store.setDecisionSupportState({
      version: 1,
      selectedWindow: '30d',
      freshness: {
        lastSyncAt: '2026-04-26T09:55:00.000Z',
        lastComputedAt: '2026-04-26T10:00:00.000Z',
        stale: false,
      },
      insights: [
        {
          id: 'cost-30d',
          category: 'cost',
          window: '30d',
          metric: 'Costo por encima de la línea base',
          currentValue: 180,
          baselineValue: 100,
          deltaPct: 80,
          severity: 'critical',
          why: {
            source: ['COST_LEDGER', 'PRODUCTIVITY_LEDGER'],
            rule: 'Comparación descriptiva periodo contra periodo.',
            generatedAt: '2026-04-26T10:00:00.000Z',
          },
          manualActions: ['Revisar manualmente costos del lote.'],
          scopeGuard: 'descriptive_only',
        },
      ],
      sourceSignature: {
        USER: 'u1',
        GANADERO: 'g1',
        ANIMAL: 'a1',
        LOT: 'l1',
        LOT_ASSIGNMENT: 'la1',
        PRODUCTIVITY_LEDGER: 'p1',
        COST_LEDGER: 'c1',
        ANIMAL_EVENT: 'e1',
        ANIMAL_HEALTH_EVENT: 'h1',
        ANIMAL_REPRODUCTION_EVENT: 'r1',
        selection: '30d',
      },
    });

    const restartedStore = createService(adapter, ['op-9'], ['2026-04-26T11:00:00.000Z']);
    const persisted = await restartedStore.getDecisionSupportState();

    expect(persisted?.insights).toHaveLength(1);
    expect(persisted?.insights[0].why.source).toEqual(expect.arrayContaining(['COST_LEDGER']));

    await restartedStore.invalidateDecisionSupportState();
    const invalidated = await restartedStore.getDecisionSupportState();

    expect(invalidated?.selectedWindow).toBe('30d');
    expect(invalidated?.freshness.lastSyncAt).toBe('2026-04-26T09:55:00.000Z');
    expect(invalidated?.freshness.lastComputedAt).toBeNull();
    expect(invalidated?.freshness.stale).toBe(true);
    expect(invalidated?.insights).toEqual([]);
  });

  it('should persist v2 conflict policy diff metadata and allow retry_local to reset the outbox entry', async () => {
    const adapter = new InMemoryOfflinePersistenceAdapter();
    const store = createService(adapter);

    const queued = await store.enqueueOperation({
      operationId: 'conflict-op-1',
      entityType: 'ANIMAL',
      entityId: 'animal-1',
      opType: 'UPDATE',
      payload: { tag: 'BO-777' },
      baseVersion: 1,
      clientCreatedAt: '2026-04-28T10:00:00.000Z',
      clientUpdatedAt: '2026-04-28T10:00:00.000Z',
    });

    await store.markConflict(
      queued.operationId,
      { code: 'VERSION_CONFLICT', message: 'Hay un conflicto remoto.' },
      {
        serverVersion: 3,
        serverStateVersion: 3,
        reason: 'Hay un conflicto remoto.',
        diffFields: [{ path: 'tag', localValue: 'BO-777', serverValue: 'BO-776', severity: 'medium' }],
        policy: {
          entityType: 'ANIMAL',
          opType: 'UPDATE',
          allowedActions: ['accept_server', 'retry_local', 'discard_local'],
          policyKey: 'offline-conflict-resolution/v2/ANIMAL/UPDATE',
          policyVersion: 'v2',
        },
        allowedActions: ['accept_server', 'retry_local', 'discard_local'],
        policyKey: 'offline-conflict-resolution/v2/ANIMAL/UPDATE',
      }
    );

    const conflictOperation = await store.getOperation(queued.operationId);
    expect(conflictOperation?.status).toBe('conflict');
    expect(conflictOperation?.conflict?.policy?.policyKey).toBe('offline-conflict-resolution/v2/ANIMAL/UPDATE');
    expect(conflictOperation?.conflict?.diffFields).toHaveLength(1);

    await store.markPending(queued.operationId);
    expect((await store.getOperation(queued.operationId))?.status).toBe('pending');
    expect((await store.getOperation(queued.operationId))?.conflict).toBeUndefined();
  });

  it('should summarize queue state per status and entity', async () => {
    const store = createService();

    await store.enqueueOperation({
      operationId: 'pending-animal',
      entityType: 'ANIMAL',
      entityId: 'animal-1',
      opType: 'UPDATE',
      payload: { tag: 'BO-001' },
      clientCreatedAt: '2026-04-26T10:00:00.000Z',
      clientUpdatedAt: '2026-04-26T10:00:00.000Z',
    });
    await store.enqueueOperation({
      operationId: 'failed-ganadero',
      entityType: 'GANADERO',
      entityId: 'ganadero-1',
      opType: 'STATUS_UPDATE',
      payload: { active: false },
      clientCreatedAt: '2026-04-26T10:01:00.000Z',
      clientUpdatedAt: '2026-04-26T10:01:00.000Z',
    });

    await store.markInFlight('failed-ganadero');
    await store.markFailed('failed-ganadero', { code: 'VALIDATION_ERROR', message: 'Ganadero inválido.' });

    const summary = await store.summarizeOutboxByStatusAndEntity();

    expect(summary.totalByStatus.pending).toBe(1);
    expect(summary.totalByStatus.failed).toBe(1);
    expect(summary.byEntity.ANIMAL.pending).toBe(1);
    expect(summary.byEntity.GANADERO.failed).toBe(1);
  });

  it('should summarize top recent errors and checkpoint health with the stale default', async () => {
    const store = createService();

    const first = await store.enqueueOperation({
      operationId: 'failed-1',
      entityType: 'ANIMAL',
      entityId: 'animal-1',
      opType: 'UPDATE',
      payload: { tag: 'BO-001' },
      clientCreatedAt: '2026-04-26T09:00:00.000Z',
      clientUpdatedAt: '2026-04-26T09:00:00.000Z',
    });
    const second = await store.enqueueOperation({
      operationId: 'failed-2',
      entityType: 'ANIMAL',
      entityId: 'animal-2',
      opType: 'UPDATE',
      payload: { tag: 'BO-002' },
      clientCreatedAt: '2026-04-26T10:00:00.000Z',
      clientUpdatedAt: '2026-04-26T10:00:00.000Z',
    });
    await store.markFailed(first.operationId, { code: 'VALIDATION_ERROR', message: 'Animal inválido.' });
    await store.markFailed(second.operationId, { code: 'VALIDATION_ERROR', message: 'Animal inválido.' });
    await store.saveCheckpoint({
      entityType: 'ANIMAL',
      cursorUpdatedAt: '2026-04-25T08:00:00.000Z',
      cursorId: 'cursor-animal',
      lastSuccessAt: '2026-04-25T08:00:00.000Z',
    });

    const errors = await store.summarizeErrors();
    const health = await store.listCheckpointHealth('2026-04-26T10:00:00.000Z');

    expect(errors).toHaveLength(1);
    expect(errors[0]).toEqual(
      expect.objectContaining({
        code: 'VALIDATION_ERROR',
        count: 2,
        entityType: 'ANIMAL',
      })
    );
    expect(health.ANIMAL.stalenessMs).toBe(26 * 60 * 60 * 1000);
    expect(health.ANIMAL.stale).toBe(true);
  });
});
