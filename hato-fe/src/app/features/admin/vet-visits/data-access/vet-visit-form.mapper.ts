import type {
  FieldVetChecklistItem,
  FieldVetClinicalNote,
  FieldVetProtocolStatus,
} from '../../../../core/offline/offline-types';
import type { AnimalHealthEventCreateInput } from '../../animals/data-access/animals-health-events.service';

export interface VetVisitFormValue {
  action?: 'create' | 'cancel' | 'attend' | 'reschedule' | 'followUp';
  creationMode?: 'scheduled' | 'attendedNow';
  animalUuid: string | null;
  visitId: string;
  mode?: 'GLOBAL' | 'SPECIFIC';
  status?: 'PENDING' | 'ATTENDED' | 'RESCHEDULED' | 'FINALIZED' | 'CANCELED';
  occurredAt: string | Date;
  notes?: string | null;
  checklist: FieldVetChecklistItem[];
  clinicalNote: FieldVetClinicalNote;
  protocolStatus: FieldVetProtocolStatus;
  nextDueAt?: string | null;
  veterinarianName?: string | null;
  veterinarianLicense?: string | null;
  targetAnimalCount?: number | null;
  parentVisitId?: string | null;
  cancelReason?: string | null;
  cost?: { amount: number; currency: 'BOB' } | null;
  treatmentPlan?: string[] | null;
  followUpChoice?: 'schedule' | 'finalize' | null;
}

export function mapVetVisitFormToCreateInput(value: VetVisitFormValue): AnimalHealthEventCreateInput {
  const action = value.action ?? 'create';
  const cancelReason = normalizeOptionalText(value.cancelReason);
  const normalizedPlan = normalizePlan(value.treatmentPlan ?? value.clinicalNote.plan);
  const status = resolveVisitStatus(value);
  const protocolStatus = resolveProtocolStatus(value);
  const includeClinicalFields = status === 'ATTENDED';

  if (action === 'cancel' && !cancelReason) {
    throw new Error('VET_VISIT_CANCEL_REASON_REQUIRED');
  }

  return {
    animalUuid: value.animalUuid?.trim() ?? '',
    healthEventType: 'FIELD_VET_VISIT',
    occurredAt: normalizeOccurredAtValue(value.occurredAt),
    notes: normalizeOptionalText(value.notes),
    metadata: {
      visit: {
        visitId: value.visitId.trim(),
        ...(value.mode ? { mode: value.mode } : {}),
        ...(status ? { status } : {}),
        ...(buildVeterinarian(value) ? { veterinarian: buildVeterinarian(value)! } : {}),
        ...(typeof value.targetAnimalCount === 'number' ? { targetAnimalCount: value.targetAnimalCount } : {}),
        ...(normalizeOptionalText(value.parentVisitId) ? { parentVisitId: normalizeOptionalText(value.parentVisitId)! } : {}),
        ...(cancelReason ? { cancelReason } : {}),
      },
      checklist: value.checklist.map((item) => ({
        code: item.code,
        ok: item.ok,
        ...(normalizeOptionalText(item.note) ? { note: normalizeOptionalText(item.note)! } : {}),
      })),
      ...(includeClinicalFields && normalizeOptionalText(value.notes) ? { atencionNotas: normalizeOptionalText(value.notes)! } : {}),
      ...(includeClinicalFields && value.cost ? { cost: value.cost } : {}),
      ...(includeClinicalFields && normalizedPlan.length ? { treatmentPlan: normalizedPlan } : {}),
      clinicalNote: {
        reason: value.clinicalNote.reason.trim(),
        ...(includeClinicalFields && normalizeOptionalText(value.clinicalNote.findings) ? { findings: normalizeOptionalText(value.clinicalNote.findings)! } : {}),
        ...(includeClinicalFields && normalizedPlan.length ? { plan: normalizedPlan } : {}),
      },
      protocol: {
        status: protocolStatus,
        ...(normalizeOptionalText(value.nextDueAt) ? { nextDueAt: normalizeOccurredAtValue(value.nextDueAt!) } : {}),
      },
    },
  };
}

export function normalizePlan(plan: string | string[] | null | undefined): string[] {
  if (Array.isArray(plan)) {
    return plan.map((step) => step.trim()).filter(Boolean);
  }

  const normalized = normalizeOptionalText(plan);
  return normalized ? [normalized] : [];
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

function resolveVisitStatus(value: VetVisitFormValue) {
  if (value.action === 'cancel') {
    return 'CANCELED';
  }
  if (value.action === 'attend' || value.creationMode === 'attendedNow') {
    return 'ATTENDED';
  }
  if (value.creationMode === 'scheduled' || value.action === 'followUp') {
    return 'PENDING';
  }
  return value.status;
}

function resolveProtocolStatus(value: VetVisitFormValue): FieldVetProtocolStatus {
  if (value.action === 'cancel' || value.followUpChoice === 'finalize') {
    return 'CLOSED';
  }
  if (value.action === 'attend' && value.followUpChoice === 'schedule') {
    return 'FOLLOW_UP_REQUIRED';
  }
  return value.protocolStatus;
}

function normalizeOccurredAtValue(value: string | Date) {
  if (value instanceof Date) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())).toISOString();
  }
  if (!value.includes('T')) {
    return `${value}T00:00:00.000Z`;
  }
  return value.endsWith('Z') ? value : `${value}:00.000Z`;
}
