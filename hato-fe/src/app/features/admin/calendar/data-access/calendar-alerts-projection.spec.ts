import type { OfflineSnapshotRecord } from '../../../../core/offline/offline-types';
import { projectCalendarAlerts, selectCalendarTimeline } from './calendar-alerts-projection';

describe('calendar alerts projection', () => {
  const animalSnapshot: OfflineSnapshotRecord = {
    key: 'ANIMAL:animal-1',
    entityType: 'ANIMAL',
    entityId: 'animal-1',
    updatedAt: '2026-04-27T08:00:00.000Z',
    version: 1,
    payload: {
      uuid: 'animal-1',
      ownerGanaderoId: 'gan-1',
      arete: 'BO-001',
      marca: null,
      tatuaje: null,
      category: 'COW',
      active: true,
      admissionDate: '2026-04-01T00:00:00.000Z',
      weightKg: 420,
      createdAt: '2026-04-01T00:00:00.000Z',
      updatedAt: '2026-04-27T08:00:00.000Z',
      version: 1,
      lastSyncedAt: null,
    },
  };

  it('should derive a stable agenda from health reproduction and operational snapshots', () => {
    const state = projectCalendarAlerts({
      animals: [animalSnapshot],
      now: '2026-04-27T10:00:00.000Z',
      preferences: { horizonDays: 3, notificationsEnabled: true, snoozedUntil: null },
      healthEvents: [
        snapshot('ANIMAL_HEALTH_EVENT', 'health-1', {
          id: 'health-1',
          animalUuid: 'animal-1',
          healthEventType: 'VACCINATION',
          notes: 'Refuerzo abril',
          metadata: { nextDueAt: '2026-04-28T09:00:00.000Z' },
        }),
      ],
      reproductionEvents: [
        snapshot('ANIMAL_REPRODUCTION_EVENT', 'repro-1', {
          id: 'repro-1',
          animalUuid: 'animal-1',
          reproductionEventType: 'BIRTH',
          notes: 'Parto esperado',
          metadata: { birthDate: '2026-04-27T13:00:00.000Z' },
        }),
      ],
      animalEvents: [
        snapshot('ANIMAL_EVENT', 'event-1', {
          id: 'event-1',
          animalUuid: 'animal-1',
          type: 'TRANSFERRED',
          occurredAt: '2026-04-27T16:00:00.000Z',
          notes: 'Traslado de lote',
          metadata: {},
        }),
      ],
    });

    expect(state.items).toHaveLength(3);
    expect(state.items.map((item) => item.sourceType)).toEqual([
      'ANIMAL_REPRODUCTION_EVENT',
      'ANIMAL_EVENT',
      'ANIMAL_HEALTH_EVENT',
    ]);
    expect(state.counts.total).toBe(3);
    expect(state.counts.byStatus).toEqual({ overdue: 0, due_today: 2, upcoming: 1 });
  });

  it('should exclude records without a valid due date and classify overdue due_today and upcoming windows', () => {
    const state = projectCalendarAlerts({
      animals: [animalSnapshot],
      now: '2026-04-27T10:00:00.000Z',
      preferences: { horizonDays: 3, notificationsEnabled: false, snoozedUntil: null },
      healthEvents: [
        snapshot('ANIMAL_HEALTH_EVENT', 'health-overdue', {
          id: 'health-overdue',
          animalUuid: 'animal-1',
          healthEventType: 'DEWORMING',
          metadata: { nextDueAt: '2026-04-25T09:00:00.000Z' },
        }),
        snapshot('ANIMAL_HEALTH_EVENT', 'health-invalid', {
          id: 'health-invalid',
          animalUuid: 'animal-1',
          healthEventType: 'DEWORMING',
          metadata: { nextDueAt: 'invalid-date' },
        }),
      ],
      reproductionEvents: [
        snapshot('ANIMAL_REPRODUCTION_EVENT', 'repro-missing', {
          id: 'repro-missing',
          animalUuid: 'animal-1',
          reproductionEventType: 'SERVICE',
          metadata: {},
        }),
      ],
      animalEvents: [
        snapshot('ANIMAL_EVENT', 'event-today', {
          id: 'event-today',
          animalUuid: 'animal-1',
          type: 'OBSERVATION',
          occurredAt: '2026-04-27T12:00:00.000Z',
          metadata: {},
        }),
      ],
    });

    expect(state.items).toHaveLength(2);
    expect(state.windows.overdue).toHaveLength(1);
    expect(state.windows.due_today).toHaveLength(1);
    expect(state.windows.upcoming).toHaveLength(0);
  });

  it('should keep deterministic ordering and filter timeline by day week and month ranges', () => {
    const state = projectCalendarAlerts({
      animals: [animalSnapshot],
      now: '2026-04-27T10:00:00.000Z',
      preferences: { horizonDays: 7, notificationsEnabled: false, snoozedUntil: null },
      healthEvents: [
        snapshot('ANIMAL_HEALTH_EVENT', 'same-a', {
          id: 'same-a',
          animalUuid: 'animal-1',
          healthEventType: 'VACCINATION',
          metadata: { nextDueAt: '2026-05-01T09:00:00.000Z' },
        }),
        snapshot('ANIMAL_HEALTH_EVENT', 'same-b', {
          id: 'same-b',
          animalUuid: 'animal-1',
          healthEventType: 'DEWORMING',
          metadata: { nextDueAt: '2026-05-01T09:00:00.000Z' },
        }),
      ],
      reproductionEvents: [],
      animalEvents: [
        snapshot('ANIMAL_EVENT', 'month-only', {
          id: 'month-only',
          animalUuid: 'animal-1',
          type: 'OBSERVATION',
          occurredAt: '2026-05-20T09:00:00.000Z',
          metadata: {},
        }),
      ],
    });

    expect(state.items.map((item) => item.sourceId)).toEqual(['same-a', 'same-b', 'month-only']);
    expect(selectCalendarTimeline(state, 'today', '2026-04-27T10:00:00.000Z')).toEqual([]);
    expect(selectCalendarTimeline(state, 'next_7_days', '2026-04-27T10:00:00.000Z').map((item) => item.sourceId)).toEqual([
      'same-a',
      'same-b',
    ]);
    expect(selectCalendarTimeline(state, 'next_30_days', '2026-04-27T10:00:00.000Z').map((item) => item.sourceId)).toEqual([
      'same-a',
      'same-b',
      'month-only',
    ]);
  });

  it('should project expected birth date only for positive pregnancy diagnosis events', () => {
    const state = projectCalendarAlerts({
      animals: [animalSnapshot],
      now: '2026-05-10T10:00:00.000Z',
      preferences: { horizonDays: 7, notificationsEnabled: false, snoozedUntil: null },
      healthEvents: [],
      reproductionEvents: [
        snapshot('ANIMAL_REPRODUCTION_EVENT', 'pregnancy-positive', {
          id: 'pregnancy-positive',
          animalUuid: 'animal-1',
          reproductionEventType: 'PREGNANCY_DIAGNOSIS',
          occurredAt: '2026-05-10T09:00:00.000Z',
          notes: 'Ecografía positiva',
          metadata: {
            diagnosisDate: '2026-05-10T00:00:00.000Z',
            result: 'PRENADA',
            expectedBirthDate: '2027-02-14T00:00:00.000Z',
          },
        }),
        snapshot('ANIMAL_REPRODUCTION_EVENT', 'pregnancy-negative', {
          id: 'pregnancy-negative',
          animalUuid: 'animal-1',
          reproductionEventType: 'PREGNANCY_DIAGNOSIS',
          occurredAt: '2026-05-10T09:30:00.000Z',
          notes: 'No preñada',
          metadata: {
            diagnosisDate: '2026-05-10T00:00:00.000Z',
            result: 'NO_PRENADA',
            expectedBirthDate: '2027-02-20T00:00:00.000Z',
            negativeResult: true,
            status: 'fallo',
          },
        }),
      ],
      animalEvents: [],
    });

    expect(state.items).toHaveLength(1);
    expect(state.items[0]).toEqual(expect.objectContaining({
      sourceId: 'pregnancy-positive',
      dueAt: '2027-02-14T00:00:00.000Z',
      title: 'Fecha probable de parto',
    }));
  });

  it('should classify global and specific veterinary controls with Spanish labels', () => {
    const state = projectCalendarAlerts({
      animals: [animalSnapshot],
      now: '2026-05-01T08:00:00.000Z',
      preferences: { horizonDays: 7, notificationsEnabled: true, snoozedUntil: null },
      healthEvents: [
        snapshot('ANIMAL_HEALTH_EVENT', 'vet-global', {
          id: 'vet-global',
          animalUuid: 'animal-1',
          healthEventType: 'FIELD_VET_VISIT',
          notes: 'Campaña anual',
          metadata: {
            visit: { visitId: 'VISIT-GLOBAL', mode: 'GLOBAL', status: 'PENDING', veterinarian: { name: 'Dra. Luna' } },
            protocol: { status: 'FOLLOW_UP_REQUIRED', nextDueAt: '2026-05-02T09:00:00.000Z' },
          },
        }),
        snapshot('ANIMAL_HEALTH_EVENT', 'vet-specific', {
          id: 'vet-specific',
          animalUuid: 'animal-1',
          healthEventType: 'FIELD_VET_VISIT',
          notes: 'Control puntual',
          metadata: {
            visit: { visitId: 'VISIT-SPECIFIC', mode: 'SPECIFIC', status: 'RESCHEDULED', veterinarian: { name: 'Dr. Río' } },
            protocol: { status: 'FOLLOW_UP_REQUIRED', nextDueAt: '2026-05-03T09:00:00.000Z' },
          },
        }),
      ],
      reproductionEvents: [],
      animalEvents: [],
    });

    expect(state.items.map((item) => ({ sourceId: item.sourceId, title: item.title, visitMode: item.visitMode }))).toEqual([
      { sourceId: 'vet-global', title: 'Control Veterinario - Campaña', visitMode: 'GLOBAL' },
      { sourceId: 'vet-specific', title: 'Control Veterinario - Específica', visitMode: 'SPECIFIC' },
    ]);
  });

  it('should classify only active veterinary visit controls from nextControlAt and expose Spanish reminder badges', () => {
    const state = projectCalendarAlerts({
      animals: [animalSnapshot],
      now: '2026-05-11T10:00:00.000Z',
      preferences: { horizonDays: 7, notificationsEnabled: true, snoozedUntil: null },
      healthEvents: [
        snapshot('ANIMAL_HEALTH_EVENT', 'vet-overdue', {
          id: 'vet-overdue',
          animalUuid: 'animal-1',
          healthEventType: 'FIELD_VET_VISIT',
          metadata: { visit: { visitId: 'VISIT-1', mode: 'GLOBAL', status: 'PENDING', nextControlAt: '2026-05-10T09:00:00.000Z' } },
        }),
        snapshot('ANIMAL_HEALTH_EVENT', 'vet-today', {
          id: 'vet-today',
          animalUuid: 'animal-1',
          healthEventType: 'FIELD_VET_VISIT',
          metadata: { visit: { visitId: 'VISIT-2', mode: 'SPECIFIC', status: 'RESCHEDULED', nextControlAt: '2026-05-11T12:00:00.000Z' } },
        }),
        snapshot('ANIMAL_HEALTH_EVENT', 'vet-attended', {
          id: 'vet-attended',
          animalUuid: 'animal-1',
          healthEventType: 'FIELD_VET_VISIT',
          metadata: { visit: { visitId: 'VISIT-3', mode: 'SPECIFIC', status: 'ATTENDED', nextControlAt: '2026-05-11T13:00:00.000Z' } },
        }),
        snapshot('ANIMAL_HEALTH_EVENT', 'vet-finalized', {
          id: 'vet-finalized',
          animalUuid: 'animal-1',
          healthEventType: 'FIELD_VET_VISIT',
          metadata: { visit: { visitId: 'VISIT-4', mode: 'GLOBAL', status: 'FINALIZED', nextControlAt: '2026-05-12T09:00:00.000Z' } },
        }),
      ],
      reproductionEvents: [],
      animalEvents: [],
    });

    expect(state.items.map((item) => ({ sourceId: item.sourceId, status: item.status, title: item.title }))).toEqual([
      { sourceId: 'vet-overdue', status: 'overdue', title: 'Control Veterinario Pendiente' },
      { sourceId: 'vet-today', status: 'due_today', title: 'Control Veterinario Hoy' },
    ]);
    expect(state.counts.badges).toEqual({
      overdue: 'Controles Veterinarios Pendientes',
      due_today: 'Controles Hoy',
    });
  });
});

function snapshot(entityType: OfflineSnapshotRecord['entityType'], entityId: string, payload: Record<string, unknown>): OfflineSnapshotRecord {
  return {
    key: `${entityType}:${entityId}`,
    entityType,
    entityId,
    updatedAt: '2026-04-27T10:00:00.000Z',
    payload,
  };
}
