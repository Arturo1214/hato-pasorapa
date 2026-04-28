import {
  ANIMAL_REPRODUCTION_EVENT_TYPES,
  OFFLINE_ENTITY_TYPES,
  type AnimalReproductionEventOfflineMetadata,
} from './offline-types';

describe('offline-types animal reproduction contract', () => {
  it('should expose ANIMAL_REPRODUCTION_EVENT as a supported offline entity', () => {
    expect(OFFLINE_ENTITY_TYPES).toContain('ANIMAL_REPRODUCTION_EVENT');
  });

  it('should keep the v1 reproduction event catalog explicit and bounded', () => {
    expect(ANIMAL_REPRODUCTION_EVENT_TYPES).toEqual(['SERVICE', 'PREGNANCY_CONFIRMED', 'PREGNANCY_LOSS', 'BIRTH']);
  });

  it('should support typed birth metadata including mandatory offspring linkage when present', () => {
    const metadata: AnimalReproductionEventOfflineMetadata = {
      birthDate: '2026-04-27',
      offspringCount: 2,
      motherAnimalUuid: 'mother-1',
      fatherAnimalUuid: 'father-1',
      offspringAnimalUuids: ['calf-1', 'calf-2'],
    };

    expect(metadata.offspringAnimalUuids).toEqual(['calf-1', 'calf-2']);
    expect(metadata.offspringCount).toBe(2);
  });
});
