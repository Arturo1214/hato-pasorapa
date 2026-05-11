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
  animalUuid: string | null;
  targetAnimalCount: number | null;
  atencionNotas: string | null;
}

interface VetVisitListResponse {
  items: VetVisitItem[];
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
      .pipe(map((response) => response.items ?? []));
  }

  private buildHeaders() {
    const token = this.authService.getAccessToken();
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
  }
}

function buildVetVisitParams(filter: VetVisitFilter) {
  return Object.entries(filter).reduce((params, [key, value]) => {
    if (value == null || value === '') {
      return params;
    }

    return params.set(key, String(value));
  }, new HttpParams());
}
