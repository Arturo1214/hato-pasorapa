import type { AnimalEventCategory, AnimalEventLogSnapshotPayload } from '../../../../core/offline/offline-types';
import { normalizeAnimalEventItem } from './animal-events-timeline.adapter';
import { normalizeAnimalHealthEventItem } from './animal-health-events-timeline.adapter';
import { normalizeAnimalReproductionEventItem } from './animal-reproduction-events-timeline.adapter';

export function filterAnimalEventLogsByCategory(
  logs: Array<Record<string, unknown>>,
  category: AnimalEventCategory
): AnimalEventLogSnapshotPayload[] {
  return logs
    .filter((log) => log['eventCategory'] === category)
    .map((log) => ({ ...log } as AnimalEventLogSnapshotPayload));
}

export function animalEventLogToGeneralEventItem(log: Record<string, unknown>) {
  return normalizeAnimalEventItem({
    ...log,
    type: log['type'] ?? log['eventType'],
  });
}

export function animalEventLogToHealthEventItem(log: Record<string, unknown>) {
  return normalizeAnimalHealthEventItem({
    ...log,
    healthEventType: log['healthEventType'] ?? log['eventType'],
  });
}

export function animalEventLogToReproductionEventItem(log: Record<string, unknown>) {
  return normalizeAnimalReproductionEventItem({
    ...log,
    reproductionEventType: log['reproductionEventType'] ?? log['eventType'],
  });
}
