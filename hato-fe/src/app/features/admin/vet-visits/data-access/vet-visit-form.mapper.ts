import type {
  FieldVetChecklistItem,
  FieldVetClinicalNote,
  FieldVetProtocolStatus,
} from '../../../../core/offline/offline-types';
import type { AnimalHealthEventCreateInput } from '../../animals/data-access/animals-health-events.service';

export interface VetVisitFormValue {
  animalUuid: string | null;
  visitId: string;
  mode?: 'GLOBAL' | 'SPECIFIC';
  status?: 'PENDING' | 'ATTENDED' | 'RESCHEDULED' | 'FINALIZED' | 'CANCELED';
  occurredAt: string;
  notes?: string | null;
  checklist: FieldVetChecklistItem[];
  clinicalNote: FieldVetClinicalNote;
  protocolStatus: FieldVetProtocolStatus;
  nextDueAt?: string | null;
  veterinarianName?: string | null;
  veterinarianLicense?: string | null;
  targetAnimalCount?: number | null;
  parentVisitId?: string | null;
}

export function mapVetVisitFormToCreateInput(value: VetVisitFormValue): AnimalHealthEventCreateInput {
  return {
    animalUuid: value.animalUuid?.trim() ?? '',
    healthEventType: 'FIELD_VET_VISIT',
    occurredAt: normalizeOccurredAtValue(value.occurredAt),
    notes: normalizeOptionalText(value.notes),
    metadata: {
      visit: {
        visitId: value.visitId.trim(),
        ...(value.mode ? { mode: value.mode } : {}),
        ...(value.status ? { status: value.status } : {}),
        ...(buildVeterinarian(value) ? { veterinarian: buildVeterinarian(value)! } : {}),
        ...(typeof value.targetAnimalCount === 'number' ? { targetAnimalCount: value.targetAnimalCount } : {}),
        ...(normalizeOptionalText(value.parentVisitId) ? { parentVisitId: normalizeOptionalText(value.parentVisitId)! } : {}),
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

function buildVeterinarian(value: VetVisitFormValue) {
  const name = normalizeOptionalText(value.veterinarianName);
  if (!name) {
    return null;
  }

  const license = normalizeOptionalText(value.veterinarianLicense);
  return {
    name,
    ...(license ? { license } : {}),
  };
}

function normalizeOccurredAtValue(value: string) {
  return value.includes('T') && !value.endsWith('Z') ? `${value}:00.000Z` : value;
}
