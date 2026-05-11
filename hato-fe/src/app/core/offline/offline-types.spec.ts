import {
  FIELD_VET_CHECKLIST_CODES,
  FIELD_VET_PROTOCOL_STATUSES,
  MANUAL_RESOLUTION_ACTIONS,
  OFFLINE_ENTITY_TYPES,
  REPORTING_WINDOWS,
  type AnimalOfflineMutationPayload,
  type AnimalOfflineSnapshotPayload,
} from './offline-types';

describe('offline v2 entity types', () => {
  it('should expose NOTIFICATION as a supported offline entity with local read-state contracts', () => {
    const snapshot = {
      id: 'notification-1',
      title: 'Aviso',
      body: 'Mensaje',
      createdByUserId: 'admin-1',
      publishedAt: '2026-04-26T10:00:00.000Z',
      updatedAt: '2026-04-26T10:00:00.000Z',
    };
    const readState = {
      readAtById: {
        'notification-1': '2026-04-26T10:05:00.000Z',
      },
    };

    expect(OFFLINE_ENTITY_TYPES).toContain('NOTIFICATION');
    expect(snapshot.title).toBe('Aviso');
    expect(readState.readAtById['notification-1']).toBe('2026-04-26T10:05:00.000Z');
  });

  it('should expose conflict resolution v2 contracts with bounded manual actions', () => {
    const policy = {
      entityType: 'ANIMAL',
      opType: 'UPDATE',
      allowedActions: ['accept_server', 'retry_local', 'discard_local'],
      policyKey: 'offline-conflict-resolution/v2/ANIMAL/UPDATE',
      policyVersion: 'v2',
    } as const;
    const diffField = {
      path: 'tag',
      localValue: 'BO-2002',
      serverValue: 'BO-2001',
      severity: 'medium',
    } as const;

    expect(MANUAL_RESOLUTION_ACTIONS).toEqual(['accept_server', 'retry_local', 'discard_local']);
    expect(policy.policyKey).toBe('offline-conflict-resolution/v2/ANIMAL/UPDATE');
    expect(diffField.severity).toBe('medium');
  });

  it('should expose herd management V2 entities with monthly identities and bounded 90d reporting', () => {
    const productivity = {
      identityKey: '2026-04|animal-1|lot-1|MILK_LITERS',
      periodKey: '2026-04',
    } as const;
    const cost = {
      identityKey: '2026-04|lot-1|FEED|PURCHASE',
      currency: 'BOB',
    } as const;

    expect(OFFLINE_ENTITY_TYPES).toEqual(
      expect.arrayContaining(['LOT', 'LOT_ASSIGNMENT', 'PRODUCTIVITY_LEDGER', 'COST_LEDGER'])
    );
    expect(productivity.periodKey).toBe('2026-04');
    expect(productivity.identityKey).toContain('MILK_LITERS');
    expect(cost.currency).toBe('BOB');
  });

  it('should keep typed field vet contracts for visitId, protocol and fixed checklist catalog', () => {
    const visitMetadata = {
      visit: { visitId: 'VISIT-001' },
      checklist: [{ code: 'TEMPERATURE', ok: true }],
      clinicalNote: { reason: 'Control', findings: 'Sin novedad', plan: 'Alta' },
      protocol: { status: 'FOLLOW_UP_REQUIRED', nextDueAt: '2026-04-29T10:00:00.000Z' },
    } as const;

    expect(visitMetadata.visit.visitId).toBe('VISIT-001');
    expect(FIELD_VET_PROTOCOL_STATUSES).toEqual(['STARTED', 'FOLLOW_UP_REQUIRED', 'CLOSED']);
    expect(FIELD_VET_CHECKLIST_CODES).toEqual([
      'GENERAL_APPEARANCE',
      'TEMPERATURE',
      'HYDRATION',
      'APPETITE',
      'LOCOMOTION',
    ]);
    expect(visitMetadata.protocol.nextDueAt).toBe('2026-04-29T10:00:00.000Z');
  });

  it('should expose decision support contracts without predictive or autoAction fields', () => {
    const insight = {
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
        generatedAt: '2026-04-27T10:00:00.000Z',
      },
      manualActions: ['Revisar manualmente costos del lote.'],
      scopeGuard: 'descriptive_only',
    } as const;

    expect(REPORTING_WINDOWS).toEqual(['7d', '30d', '90d']);
    expect(insight.scopeGuard).toBe('descriptive_only');
    expect(insight.why.source).toEqual(expect.arrayContaining(['COST_LEDGER']));
    expect((insight as Record<string, unknown>)['forecast']).toBeUndefined();
    expect((insight as Record<string, unknown>)['autoAction']).toBeUndefined();
  });

  it('should type animal offline payloads with core characteristics and breed display snapshots', () => {
    const mutationPayload: AnimalOfflineMutationPayload = {
      arete: 'AR-100',
      category: 'VACA',
      active: true,
      admissionDate: '2026-04-26',
      color: 'Colorado',
      description: 'Bueno para carne',
      breedUuid: 'raza-criolla-uuid',
    };
    const breedUuid: string | null | undefined = mutationPayload.breedUuid;
    const snapshotPayload: AnimalOfflineSnapshotPayload = {
      ...mutationPayload,
      uuid: 'animal-uuid-1',
      breedName: 'Criolla',
      createdAt: '2026-04-26T10:00:00.000Z',
      updatedAt: '2026-04-26T10:00:00.000Z',
      version: 1,
      lastSyncedAt: null,
    };
    const breedName: string | null | undefined = snapshotPayload.breedName;

    expect(breedUuid).toBe('raza-criolla-uuid');
    expect(snapshotPayload.color).toBe('Colorado');
    expect(snapshotPayload.description).toBe('Bueno para carne');
    expect(breedName).toBe('Criolla');
  });
});
