import type {
  FieldVetChecklistItem,
  FieldVetClinicalNote,
  FieldVetProtocolStatus,
} from '../../../../core/offline/offline-types';
import type { AnimalHealthEventCreateInput } from '../../animals/data-access/animals-health-events.service';

export interface VetVisitFormValue {
  animalUuid: string;
  visitId: string;
  occurredAt: string;
  notes?: string | null;
  checklist: FieldVetChecklistItem[];
  clinicalNote: FieldVetClinicalNote;
  protocolStatus: FieldVetProtocolStatus;
  nextDueAt?: string | null;
}

export function mapVetVisitFormToCreateInput(value: VetVisitFormValue): AnimalHealthEventCreateInput {
  return {
    animalUuid: value.animalUuid.trim(),
    healthEventType: 'FIELD_VET_VISIT',
    occurredAt: normalizeOccurredAtValue(value.occurredAt),
    notes: normalizeOptionalText(value.notes),
    metadata: {
      visit: {
        visitId: value.visitId.trim(),
      },
      checklist: value.checklist.map((item) => ({
        code: item.code,
        ok: item.ok,
        ...(normalizeOptionalText(item.note) ? { note: normalizeOptionalText(item.note)! } : {}),
      })),
      clinicalNote: {
        reason: value.clinicalNote.reason.trim(),
        findings: value.clinicalNote.findings.trim(),
        plan: value.clinicalNote.plan.trim(),
      },
      protocol: {
        status: value.protocolStatus,
        ...(normalizeOptionalText(value.nextDueAt) ? { nextDueAt: normalizeOccurredAtValue(value.nextDueAt!) } : {}),
      },
    },
  };
}

function normalizeOptionalText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeOccurredAtValue(value: string) {
  return value.includes('T') && !value.endsWith('Z') ? `${value}:00.000Z` : value;
}
