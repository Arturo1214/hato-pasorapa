import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, throwError, type Observable } from 'rxjs';
import { AuthService } from '../../../../core/auth/data-access/auth.service';
import { ApplicationConfigService } from '../../../../core/config/application-config.service';

export type AdminReportId = 'inventory-by-ganadero' | 'health-activity' | 'notification-reach';

export interface InventoryByGanaderoFilter {
  ganaderoId?: number | null;
  active?: boolean | null;
}

export interface HealthActivityFilter {
  from?: string | null;
  to?: string | null;
  type?: string | null;
  ganaderoId?: number | null;
  animalUuid?: string | null;
  limit?: number | null;
}

export interface NotificationReachFilter {
  from?: string | null;
  to?: string | null;
  targetingMode?: string | null;
  limit?: number | null;
}

export interface AdminReportFilters extends InventoryByGanaderoFilter, HealthActivityFilter, NotificationReachFilter {}

export interface InventoryByGanaderoRow {
  ganaderoId: number;
  ganaderoName: string;
  total: number;
  active: number;
  inactive: number;
  byCategory: Record<string, number>;
  bySex: Record<string, number>;
}

export interface HealthActivityRow {
  eventId: string;
  occurredAt: string;
  type: string;
  ganaderoId: number | null;
  ganaderoName: string | null;
  animalUuid: string;
  animalCode: string | null;
  animalTag: string | null;
  notes: string | null;
}

export type NotificationReachTargetingMode = 'ALL_ACTIVE_GANADEROS' | 'EXPLICIT_LIST' | string;

export interface NotificationReachRow {
  notificationId: string;
  title: string;
  publishedAt: string | null;
  targetingMode: NotificationReachTargetingMode;
  totalRecipients: number;
  readCount: number;
  pendingCount: number;
  readRate: number;
}

export interface InventoryByGanaderoResponse {
  rows: InventoryByGanaderoRow[];
}

export interface HealthActivityResponse {
  rows: HealthActivityRow[];
}

export interface NotificationReachResponse {
  rows: NotificationReachRow[];
}

export type AdminReportRow = InventoryByGanaderoRow | HealthActivityRow | NotificationReachRow;

@Injectable({ providedIn: 'root' })
export class AdminReportsService {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(ApplicationConfigService);
  private readonly authService = inject(AuthService);

  getInventoryByGanadero(filter: InventoryByGanaderoFilter = {}): Observable<InventoryByGanaderoResponse> {
    return this.getReport<InventoryByGanaderoResponse>('inventory-by-ganadero', filter);
  }

  getHealthActivity(filter: HealthActivityFilter = {}): Observable<HealthActivityResponse> {
    return this.getReport<HealthActivityResponse>('health-activity', filter);
  }

  getNotificationReach(filter: NotificationReachFilter = {}): Observable<NotificationReachResponse> {
    return this.getReport<NotificationReachResponse>('notification-reach', filter);
  }

  private getReport<T>(path: AdminReportId, filter: object): Observable<T> {
    return this.http
      .get<T>(`${this.appConfig.config().apiBaseUrl}/admin/reports/${path}`, {
        headers: this.buildHeaders(),
        params: this.buildParams(filter),
      })
      .pipe(catchError(() => throwError(() => new Error('No pudimos cargar el reporte administrativo.'))));
  }

  private buildHeaders() {
    const token = this.authService.getAccessToken();
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
  }

  private buildParams(filter: object) {
    return Object.entries(filter as Record<string, string | number | boolean | null | undefined>).reduce((params, [key, value]) => {
      if (value == null || value === '') {
        return params;
      }

      return params.set(key, String(value));
    }, new HttpParams());
  }
}
