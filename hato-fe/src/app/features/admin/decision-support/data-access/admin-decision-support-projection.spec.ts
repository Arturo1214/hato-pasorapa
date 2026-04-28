import {
  animalSnapshot,
  costSnapshot,
  eventSnapshot,
  ganaderoSnapshot,
  lotAssignmentSnapshot,
  lotSnapshot,
  productivitySnapshot,
  userSnapshot,
} from '../../reporting/testing/admin-analytics-offline.fixtures';
import { buildDecisionSupportPeriodComparison, projectDecisionSupportV1 } from './admin-decision-support-projection';

describe('admin decision support projection', () => {
  it('should build deterministic bounded period comparisons for decision support inputs', () => {
    const comparison = buildDecisionSupportPeriodComparison(
      [
        costSnapshot('cost-outside', 'lot-a', '2026-02', 'FEED', 'PURCHASE', 300, 'BOB', '2026-02-12T08:00:00.000Z'),
        costSnapshot('cost-current', 'lot-a', '2026-04', 'FEED', 'PURCHASE', 180, 'BOB', '2026-04-20T08:00:00.000Z'),
        costSnapshot('cost-baseline', 'lot-a', '2026-03', 'FEED', 'PURCHASE', 100, 'BOB', '2026-03-18T08:00:00.000Z'),
      ],
      {
        window: '30d',
        now: '2026-04-27T10:00:00.000Z',
        periodKeyOf: (snapshot) => String(snapshot.payload['periodKey'] ?? ''),
        measureOf: (snapshot) => Number(snapshot.payload['amount'] ?? 0),
      }
    );

    const sameComparisonWithShuffledInput = buildDecisionSupportPeriodComparison(
      [
        costSnapshot('cost-baseline', 'lot-a', '2026-03', 'FEED', 'PURCHASE', 100, 'BOB', '2026-03-18T08:00:00.000Z'),
        costSnapshot('cost-outside', 'lot-a', '2026-02', 'FEED', 'PURCHASE', 300, 'BOB', '2026-02-12T08:00:00.000Z'),
        costSnapshot('cost-current', 'lot-a', '2026-04', 'FEED', 'PURCHASE', 180, 'BOB', '2026-04-20T08:00:00.000Z'),
      ],
      {
        window: '30d',
        now: '2026-04-27T10:00:00.000Z',
        periodKeyOf: (snapshot) => String(snapshot.payload['periodKey'] ?? ''),
        measureOf: (snapshot) => Number(snapshot.payload['amount'] ?? 0),
      }
    );

    expect(comparison.currentRecords.map((snapshot) => snapshot.entityId)).toEqual(['cost-current']);
    expect(comparison.baselineRecords.map((snapshot) => snapshot.entityId)).toEqual(['cost-baseline']);
    expect(comparison.currentValue).toBe(180);
    expect(comparison.baselineValue).toBe(100);
    expect(sameComparisonWithShuffledInput).toEqual(comparison);
  });

  it('should align occurredAt and periodKey records across 7d 30d and 90d windows', () => {
    const projection = projectDecisionSupportV1({
      users: [userSnapshot('user-a', 'ACTIVE')],
      ganaderos: [ganaderoSnapshot('gan-a', true)],
      animals: [animalSnapshot('animal-a', true)],
      lots: [lotSnapshot('lot-a', 'Lote A', true)],
      lotAssignments: [lotAssignmentSnapshot('assign-a', 'animal-a', 'lot-a', '2026-04-01')],
      productivityLedger: [
        productivitySnapshot('prod-current', 'animal-a', 'lot-a', '2026-04', 'MILK_LITERS', 120),
        productivitySnapshot('prod-baseline', 'animal-a', 'lot-a', '2026-03', 'MILK_LITERS', 90),
      ],
      costLedger: [
        costSnapshot('cost-current', 'lot-a', '2026-04', 'FEED', 'PURCHASE', 180, 'BOB'),
        costSnapshot('cost-baseline', 'lot-a', '2026-03', 'FEED', 'PURCHASE', 100, 'BOB'),
      ],
      animalEvents: [eventSnapshot('ANIMAL_EVENT', 'event-current', 'animal-a', 'OBSERVATION', '2026-04-26T08:00:00.000Z')],
      healthEvents: [eventSnapshot('ANIMAL_HEALTH_EVENT', 'health-current', 'animal-a', 'VACCINATION', '2026-04-24T08:00:00.000Z', 'healthEventType')],
      reproductionEvents: [eventSnapshot('ANIMAL_REPRODUCTION_EVENT', 'repro-baseline', 'animal-a', 'PREGNANCY_CHECK', '2026-03-15T08:00:00.000Z', 'reproductionEventType')],
      now: '2026-04-27T10:00:00.000Z',
      selectedWindow: '30d',
    });

    expect(projection.selectedWindow).toBe('30d');
    expect(projection.insights.map((insight) => insight.window)).toEqual(['30d', '30d', '30d']);
    expect(projection.insights[0].why.source).toEqual(expect.arrayContaining(['COST_LEDGER', 'PRODUCTIVITY_LEDGER']));
    expect(projection.insights[0].why.rule).toContain('periodo contra periodo');
  });

  it('should create explicable insights with source rule window and manual actions only', () => {
    const projection = projectDecisionSupportV1({
      users: [userSnapshot('user-a', 'ACTIVE')],
      ganaderos: [ganaderoSnapshot('gan-a', true)],
      animals: [animalSnapshot('animal-a', true)],
      lots: [lotSnapshot('lot-a', 'Lote A', true)],
      lotAssignments: [lotAssignmentSnapshot('assign-a', 'animal-a', 'lot-a', '2026-04-01')],
      productivityLedger: [productivitySnapshot('prod-current', 'animal-a', 'lot-a', '2026-04', 'MILK_LITERS', 120)],
      costLedger: [costSnapshot('cost-current', 'lot-a', '2026-04', 'FEED', 'PURCHASE', 180, 'BOB')],
      animalEvents: [],
      healthEvents: [eventSnapshot('ANIMAL_HEALTH_EVENT', 'health-current', 'animal-a', 'VACCINATION', '2026-04-24T08:00:00.000Z', 'healthEventType')],
      reproductionEvents: [],
      now: '2026-04-27T10:00:00.000Z',
      selectedWindow: '7d',
    });

    expect(projection.insights).toHaveLength(3);
    expect(projection.insights[0]).toEqual(
      expect.objectContaining({
        scopeGuard: 'descriptive_only',
        manualActions: expect.arrayContaining([expect.stringMatching(/manual/i)]),
      })
    );
    expect(projection.insights[0].why.generatedAt).toBe('2026-04-27T10:00:00.000Z');
    expect((projection.insights[0] as unknown as Record<string, unknown>)['forecast']).toBeUndefined();
    expect((projection.insights[0] as unknown as Record<string, unknown>)['autoAction']).toBeUndefined();
  });
});
