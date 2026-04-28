import { ANIMAL_HEALTH_EVENT_TYPES, OFFLINE_ENTITY_TYPES } from './offline-types';

describe('offline-types animal health contract', () => {
  it('should expose ANIMAL_HEALTH_EVENT as a supported offline entity', () => {
    expect(OFFLINE_ENTITY_TYPES).toContain('ANIMAL_HEALTH_EVENT');
  });

  it('should keep the v1 health event catalog explicit and bounded', () => {
    expect(ANIMAL_HEALTH_EVENT_TYPES).toEqual([
      'VACCINATION',
      'DEWORMING',
      'DISEASE_REPORTED',
      'TREATMENT_STARTED',
      'TREATMENT_FOLLOW_UP',
      'TREATMENT_CLOSED',
      'FIELD_VET_VISIT',
    ]);
  });
});
