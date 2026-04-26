import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { ApplicationConfigService } from '../../../../core/config/application-config.service';
import { AuthService } from '../../../../core/auth/data-access/auth.service';

export interface DashboardSummary {
  total: number;
  active: number;
  inactive: number;
  blocked: number;
}

export interface AdminDashboardMetrics {
  admins: DashboardSummary;
  ganaderos: DashboardSummary;
}

@Injectable({ providedIn: 'root' })
export class AdminDashboardService {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(ApplicationConfigService);
  private readonly authService = inject(AuthService);

  loadMetrics() {
    return this.http.get<AdminDashboardMetrics>(
      `${this.appConfig.config().apiBaseUrl}/admin/dashboard/users`,
      {
        headers: this.buildHeaders(),
      }
    );
  }

  private buildHeaders() {
    const token = this.authService.getAccessToken();
    return token
      ? new HttpHeaders({ Authorization: `Bearer ${token}` })
      : new HttpHeaders();
  }
}
