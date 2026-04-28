import { projectAdminReportingV2 } from './admin-reporting-projection';
import {
  animalSnapshot,
  costSnapshot,
  eventSnapshot,
  ganaderoSnapshot,
  lotAssignmentSnapshot,
  lotSnapshot,
  productivitySnapshot,
  userSnapshot,
} from '../testing/admin-analytics-offline.fixtures';

describe('admin reporting projection v2', () => {
  it('should derive descriptive KPIs 7d 30d 90d plus lot breakdown deterministically', () => {
    const state = projectAdminReportingV2({
      users: [userSnapshot('user-a', 'ACTIVE')],
      ganaderos: [ganaderoSnapshot('gan-a', true)],
      animals: [animalSnapshot('animal-a', true)],
      lots: [lotSnapshot('lot-a', 'Lote A', true)],
      lotAssignments: [lotAssignmentSnapshot('assign-a', 'animal-a', 'lot-a', '2026-04-01')],
      productivityLedger: [productivitySnapshot('prod-a', 'animal-a', 'lot-a', '2026-04', 'MILK_LITERS', 120)],
      costLedger: [costSnapshot('cost-a', 'lot-a', '2026-04', 'FEED', 'PURCHASE', 80, 'BOB')],
      animalEvents: [eventSnapshot('ANIMAL_EVENT', 'event-a', 'animal-a', 'OBSERVATION', '2026-04-27T09:00:00.000Z')],
      healthEvents: [],
      reproductionEvents: [],
      now: '2026-04-27T10:00:00.000Z',
      selectedWindow: '90d',
      selectedPreset: 'all',
    });

    expect(state.aggregates).toEqual(
      expect.objectContaining({
        animalesActivos: 1,
        lotesTotal: 1,
        lotesActivos: 1,
        asignacionesActivas: 1,
        productividadTotal: 1,
        costosTotal: 1,
        costoAcumulado: 80,
      })
    );
    expect(state.descriptiveKpis['90d']).toEqual({
      animalesActivos: 1,
      lotesActivos: 1,
      productividadTotal: 1,
      costosTotal: 1,
      costoAcumulado: 80,
    });
    expect(state.lotBreakdown).toEqual([
      {
        lotId: 'lot-a',
        lotName: 'Lote A',
        animalesActivos: 1,
        productividadTotal: 1,
        costosTotal: 1,
        costoAcumulado: 80,
      },
    ]);
  });

  it('should dedupe productivity and cost ledgers by identity using updatedAt then entityId tie-breaker', () => {
    const state = projectAdminReportingV2({
      users: [],
      ganaderos: [],
      animals: [animalSnapshot('animal-a', true)],
      lots: [lotSnapshot('lot-a', 'Lote A', true)],
      lotAssignments: [lotAssignmentSnapshot('assign-a', 'animal-a', 'lot-a', '2026-04-01')],
      productivityLedger: [
        productivitySnapshot('prod-old', 'animal-a', 'lot-a', '2026-04', 'MILK_LITERS', 100, '2026-04-26T10:00:00.000Z'),
        productivitySnapshot('prod-new', 'animal-a', 'lot-a', '2026-04', 'MILK_LITERS', 120, '2026-04-27T10:00:00.000Z'),
      ],
      costLedger: [
        costSnapshot('cost-a', 'lot-a', '2026-04', 'FEED', 'PURCHASE', 80, 'BOB', '2026-04-27T10:00:00.000Z'),
        costSnapshot('cost-z', 'lot-a', '2026-04', 'FEED', 'PURCHASE', 90, 'BOB', '2026-04-27T10:00:00.000Z'),
      ],
      animalEvents: [],
      healthEvents: [],
      reproductionEvents: [],
      now: '2026-04-27T10:00:00.000Z',
      selectedWindow: '30d',
      selectedPreset: 'all',
    });

    expect(state.aggregates.productividadTotal).toBe(1);
    expect(state.aggregates.costosTotal).toBe(1);
    expect(state.aggregates.costoAcumulado).toBe(90);
    expect(state.lotBreakdown[0].costoAcumulado).toBe(90);
  });

  it('should keep the scope descriptive and reject unsupported ad-hoc window by fallback', () => {
    const state = projectAdminReportingV2({
      users: [],
      ganaderos: [],
      animals: [animalSnapshot('animal-a', true)],
      lots: [],
      lotAssignments: [],
      productivityLedger: [],
      costLedger: [],
      animalEvents: [],
      healthEvents: [],
      reproductionEvents: [],
      now: '2026-04-27T10:00:00.000Z',
      selectedWindow: '365d',
      selectedPreset: 'custom',
    });

    expect(state.selectedWindow).toBe('7d');
    expect(state.selectedPreset).toBe('all');
  });

  it('should omit explicitly excluded productivity metrics and cost categories from V1 preset totals', () => {
    const state = projectAdminReportingV2({
      users: [],
      ganaderos: [],
      animals: [animalSnapshot('animal-a', true)],
      lots: [lotSnapshot('lot-a', 'Lote A', true)],
      lotAssignments: [lotAssignmentSnapshot('assign-a', 'animal-a', 'lot-a', '2026-04-01')],
      productivityLedger: [
        productivitySnapshot('prod-included', 'animal-a', 'lot-a', '2026-04', 'MILK_LITERS', 120),
        productivitySnapshot('prod-excluded', 'animal-a', 'lot-a', '2026-04', 'WEIGHT_GAIN', 42),
      ],
      costLedger: [
        costSnapshot('cost-included', 'lot-a', '2026-04', 'FEED', 'PURCHASE', 80, 'BOB'),
        costSnapshot('cost-excluded', 'lot-a', '2026-04', 'TRANSPORT', 'PURCHASE', 30, 'BOB'),
      ],
      animalEvents: [],
      healthEvents: [],
      reproductionEvents: [],
      now: '2026-04-27T10:00:00.000Z',
      selectedWindow: '90d',
      selectedPreset: 'active_only',
    });

    expect(state.aggregates.productividadTotal).toBe(1);
    expect(state.aggregates.costosTotal).toBe(1);
    expect(state.aggregates.costoAcumulado).toBe(80);
    expect(state.descriptiveKpis['90d']).toEqual({
      animalesActivos: 1,
      lotesActivos: 1,
      productividadTotal: 1,
      costosTotal: 1,
      costoAcumulado: 80,
    });
    expect(state.lotBreakdown).toEqual([
      {
        lotId: 'lot-a',
        lotName: 'Lote A',
        animalesActivos: 1,
        productividadTotal: 1,
        costosTotal: 1,
        costoAcumulado: 80,
      },
    ]);
  });
});
