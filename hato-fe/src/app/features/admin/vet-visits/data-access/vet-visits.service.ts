import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { AuthService } from '../../../../core/auth/data-access/auth.service';
import { ApplicationConfigService } from '../../../../core/config/application-config.service';

export type VetVisitMode = 'GLOBAL' | 'SPECIFIC' | '';
export type VetVisitStatus = 'PENDING' | 'ATTENDED' | 'RESCHEDULED' | 'FINALIZED' | 'CANCELED' | '';

export interface VetVisitFilter {
  mode?: VetVisitMode | null;
  status?: VetVisitStatus | null;
  veterinarian?: string | null;
  animalUuid?: string | null;
  visitId?: string | null;
  occurredFrom?: string | null;
  occurredTo?: string | null;
  page?: number | null;
  size?: number | null;
}

export interface VetVisitVeterinarian {
  name: string;
  license?: string | null;
}

export interface VetVisitItem {
  visitId: string;
  mode: 'GLOBAL' | 'SPECIFIC';
  status: Exclude<VetVisitStatus, ''>;
  veterinarian: VetVisitVeterinarian | null;
  occurredAt: string;
  nextControlAt: string | null;
  parentVisitId: string | null;
  cancelReason: string | null;
  chainStatus: 'OPEN' | 'CLOSED' | null;
  animalUuid: string | null;
  targetAnimalCount: number | null;
  atencionNotas: string | null;
  findings: string | null;
  costo: number | null;
  costCurrency: string | null;
  treatmentPlan: string[] | null;
}

interface VetVisitListResponse {
  items: Array<Record<string, unknown>>;
  page: number;
  size: number;
  total: number;
}

@Injectable({ providedIn: 'root' })
export class VetVisitsService {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(ApplicationConfigService);
  private readonly authService = inject(AuthService);

  listVetVisits(filter: VetVisitFilter = {}): Observable<VetVisitItem[]> {
    const normalized = { ...filter, page: filter.page ?? 0, size: filter.size ?? 20 };
    return this.http
      .get<VetVisitListResponse>(`${this.appConfig.config().apiBaseUrl}/vet-visits`, {
        headers: this.buildHeaders(),
        params: buildVetVisitParams(normalized),
      })
      .pipe(map((response) => (response.items ?? []).map(mapVetVisitItem)));
  }

  getVetVisitChain(visitId: string): Observable<VetVisitItem[]> {
    return this.http
      .get<VetVisitListResponse | Array<Record<string, unknown>>>(`${this.appConfig.config().apiBaseUrl}/vet-visits/${encodeURIComponent(visitId)}/chain`, {
        headers: this.buildHeaders(),
      })
      .pipe(map((response) => normalizeVetVisitCollection(response).map(mapVetVisitItem)));
  }

  private buildHeaders() {
    const token = this.authService.getAccessToken();
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
  }
}

function mapVetVisitItem(item: Record<string, unknown>): VetVisitItem {
  return {
    visitId: String(item['visitId']),
    mode: item['mode'] === 'GLOBAL' ? 'GLOBAL' : 'SPECIFIC',
    status: normalizeStatus(item['status']),
    veterinarian: normalizeVeterinarian(item['veterinarian']),
    occurredAt: String(item['occurredAt']),
    nextControlAt: normalizeNullableString(item['nextControlAt']),
    parentVisitId: normalizeNullableString(item['parentVisitId']),
    cancelReason: normalizeNullableString(item['cancelReason']),
    chainStatus: normalizeChainStatus(item['chainStatus']),
    animalUuid: normalizeNullableString(item['animalUuid']),
    targetAnimalCount: typeof item['targetAnimalCount'] === 'number' ? item['targetAnimalCount'] : null,
    atencionNotas: normalizeNullableString(item['atencionNotas']),
    findings: normalizeNullableString(item['findings']) ?? normalizeNestedClinicalFindings(item['clinicalNote']),
    costo: typeof item['costo'] === 'number' ? item['costo'] : null,
    costCurrency: normalizeNullableString(item['costCurrency']),
    treatmentPlan: normalizeTreatmentPlan(item['treatmentPlan']),
  };
}

function normalizeVetVisitCollection(response: VetVisitListResponse | Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  return Array.isArray(response) ? response : response.items ?? [];
}

function normalizeNestedClinicalFindings(value: unknown): string | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  return normalizeNullableString((value as Record<string, unknown>)['findings']);
}

function normalizeChainStatus(value: unknown): 'OPEN' | 'CLOSED' | null {
  if (value === 'CLOSED') {
    return 'CLOSED';
  }
  if (value === 'OPEN' || value === 'ACTIVE') {
    return 'OPEN';
  }
  return null;
}

function normalizeStatus(value: unknown): Exclude<VetVisitStatus, ''> {
  if (
    value === 'PENDING' ||
    value === 'ATTENDED' ||
    value === 'RESCHEDULED' ||
    value === 'FINALIZED' ||
    value === 'CANCELED'
  ) {
    return value;
  }
  return 'PENDING';
}

function normalizeVeterinarian(value: unknown): VetVisitVeterinarian | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const name = normalizeNullableString(record['name']);
  if (!name) {
    return null;
  }

  return {
    name,
    license: normalizeNullableString(record['license']),
  };
}

function normalizeTreatmentPlan(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const steps = value.filter((step): step is string => typeof step === 'string');
  return steps.length ? steps : null;
}

function normalizeNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function buildVetVisitParams(filter: VetVisitFilter) {
  return Object.entries(filter).reduce((params, [key, value]) => {
    if (value == null || value === '') {
      return params;
    }

    return params.set(key, String(value));
  }, new HttpParams());
}
