import {
  assertDecisionSupportScope,
  coerceDecisionSupportWindow,
  filterWindowRecords,
  resolveDecisionSupportSeverity,
} from './admin-decision-support.utils';

describe('admin decision support utils', () => {
  it('should reject forecast score optimization and autoAction scope violations', () => {
    expect(() => assertDecisionSupportScope(['forecast'])).toThrowError(/fuera de alcance/i);
    expect(() => assertDecisionSupportScope(['score'])).toThrowError(/fuera de alcance/i);
    expect(() => assertDecisionSupportScope(['optimization'])).toThrowError(/fuera de alcance/i);
    expect(() => assertDecisionSupportScope(['autoAction'])).toThrowError(/fuera de alcance/i);
  });

  it('should keep only bounded windows and exclude data outside the selected window deterministically', () => {
    const filtered = filterWindowRecords(
      [
        { id: 'inside', occurredAt: '2026-04-25T10:00:00.000Z' },
        { id: 'outside', occurredAt: '2026-01-01T10:00:00.000Z' },
      ],
      (record) => record.occurredAt,
      '30d',
      '2026-04-27T10:00:00.000Z'
    );

    expect(coerceDecisionSupportWindow('365d')).toBe('7d');
    expect(filtered.map((record) => record.id)).toEqual(['inside']);
  });

  it('should derive watch and critical severities from descriptive deltas only', () => {
    expect(resolveDecisionSupportSeverity(12)).toBe('watch');
    expect(resolveDecisionSupportSeverity(38)).toBe('critical');
    expect(resolveDecisionSupportSeverity(4)).toBe('info');
  });
});
