import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../auth/data-access/auth.service';
import { ApplicationConfigService } from '../config/application-config.service';
import type { MetricsWindow, SyncObservabilityHistoricalSnapshot } from '../offline/offline-types';

@Injectable({ providedIn: 'root' })
export class SyncObservabilityApi {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(ApplicationConfigService);
  private readonly authService = inject(AuthService);

  async getHistorical(window: MetricsWindow) {
    return firstValueFrom(
      this.http.get<SyncObservabilityHistoricalSnapshot>(
        `${this.appConfig.config().apiBaseUrl}/sync/observability?window=${window}`,
        {
          headers: this.buildHeaders(),
        }
      )
    );
  }

  private buildHeaders() {
    const token = this.authService.getAccessToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return new HttpHeaders(headers);
  }
}
