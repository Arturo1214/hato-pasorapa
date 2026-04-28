import {
  buildReportingSourceSignature,
  coerceReportingPreset,
  coerceReportingWindow,
  compareRecentActivityDesc,
  isWithinReportingWindow,
  RECENT_ACTIVITY_LIMIT,
  resolveReportingPresetExclusions,
  sameReportingSourceSignature,
} from './admin-reporting.utils';

describe('admin reporting utils', () => {
  it('should accept only V1 presets and fallback invalid values to all', () => {
    expect(coerceReportingPreset('all')).toBe('all');
    expect(coerceReportingPreset('active_only')).toBe('active_only');
    expect(coerceReportingPreset('inactive_only')).toBe('inactive_only');
    expect(coerceReportingPreset('ad_hoc')).toBe('all');
  });

  it('should accept only bounded 7d 30d and 90d windows', () => {
    expect(coerceReportingWindow('7d')).toBe('7d');
    expect(coerceReportingWindow('30d')).toBe('30d');
    expect(coerceReportingWindow('90d')).toBe('90d');
  });

  it('should expose explicit productivity and cost exclusions for bounded V1 presets', () => {
    expect(resolveReportingPresetExclusions('all')).toEqual({
      productivityMetricTypes: [],
      costCategories: [],
    });
    expect(resolveReportingPresetExclusions('active_only')).toEqual({
      productivityMetricTypes: ['WEIGHT_GAIN'],
      costCategories: ['TRANSPORT'],
    });
    expect(resolveReportingPresetExclusions('inactive_only')).toEqual({
      productivityMetricTypes: ['MILK_LITERS'],
      costCategories: ['FEED'],
    });
  });

  it('should keep deterministic descending ordering and compare source signatures by checkpoints plus selection', () => {
    const items = [
      { id: 'b', sourceType: 'ANIMAL_EVENT' as const, occurredAt: '2026-04-27T10:00:00.000Z' },
      { id: 'a', sourceType: 'ANIMAL_EVENT' as const, occurredAt: '2026-04-27T10:00:00.000Z' },
      { id: 'c', sourceType: 'ANIMAL_HEALTH_EVENT' as const, occurredAt: '2026-04-28T10:00:00.000Z' },
    ];
    const left = buildReportingSourceSignature({ USER: '1' }, '7d', 'all');
    const right = buildReportingSourceSignature({ USER: '1' }, '7d', 'all');
    const changed = buildReportingSourceSignature({ USER: '2' }, '7d', 'all');

    expect(items.sort(compareRecentActivityDesc).map((item) => item.id)).toEqual(['c', 'a', 'b']);
    expect(sameReportingSourceSignature(left, right)).toBe(true);
    expect(sameReportingSourceSignature(left, changed)).toBe(false);
  });

  it('should enforce bounded windows and preserve the V1 recent activity limit constant', () => {
    expect(isWithinReportingWindow('2026-04-26T10:00:00.000Z', '7d', '2026-04-27T10:00:00.000Z')).toBe(true);
    expect(isWithinReportingWindow('2026-03-20T10:00:00.000Z', '30d', '2026-04-27T10:00:00.000Z')).toBe(false);
    expect(isWithinReportingWindow('2026-02-15T10:00:00.000Z', '90d', '2026-04-27T10:00:00.000Z')).toBe(true);
    expect(RECENT_ACTIVITY_LIMIT).toBe(20);
  });
});
